import { Commande, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

export const getCommandeWithLines = async (id: string): Promise<Commande & { lignes: LigneCommande[] }> => {
  const { data: cmd, error: cmdError } = await insforge.database
    .from('commandes')
    .select('*, clients(*)')
    .eq('id', id)
    .single();

  if (cmdError) throw cmdError;

  const { data: lines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*')
    .eq('commande_id', id);

  if (linesError) throw linesError;

  return {
    ...cmd,
    nom_client: cmd.clients?.nom_complet,
    telephone_client: cmd.clients?.telephone,
    lignes: lines || []
  };
};

export const getCommandes = async (): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .order('date_creation', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone
  }));
};

export const subscribeToCommandes = (callback: (commandes: Commande[]) => void) => {
  getCommandes().then(callback);
  const interval = setInterval(() => getCommandes().then(callback), 5000);
  return () => clearInterval(interval);
};

export const getCommandesByStatus = async (statusList: string[]): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .in('statut_commande', statusList)
    .order('date_creation', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone
  }));
};

export const subscribeToCommandesByStatus = (statusList: string[], callback: (commandes: Commande[]) => void) => {
  getCommandesByStatus(statusList).then(callback);
  const interval = setInterval(() => getCommandesByStatus(statusList).then(callback), 5000);
  return () => clearInterval(interval);
};

export const createCommandeBase = async (commande: Omit<Commande, 'id'>, lignes: Omit<LigneCommande, 'id' | 'commande_id'>[]): Promise<string> => {
  commande.date_creation = new Date();
  commande.statut_commande = 'en_attente_appel'; 

  const { data: cmdData, error: cmdError } = await insforge.database
    .from('commandes')
    .insert([commande])
    .select();

  if (cmdError) {
    console.error("Erreur création commande:", cmdError);
    throw new Error(`Erreur insertion commande: ${cmdError.message}`);
  }
  
  const id = cmdData?.[0]?.id;
  if (!id) throw new Error("ID de commande non généré par la base de données.");

  for (const l of lignes) {
    // Fetch current purchase price to lock it in the line
    const { data: prodData } = await insforge.database
      .from('produits')
      .select('prix_achat')
      .eq('id', l.produit_id)
      .single();

    const { error: lineError } = await insforge.database
      .from('lignes_commandes')
      .insert([{ 
        ...l, 
        commande_id: id,
        prix_achat_unitaire: prodData?.prix_achat || 0 
      }]);
    
    if (lineError) {
      console.error("Erreur ligne commande:", lineError);
      throw new Error(`Erreur ligne commande (${l.nom_produit}): ${lineError.message}`);
    }

    try {
      await addMouvementStock({
        produit_id: l.produit_id,
        type_mouvement: 'sortie',
        quantite: l.quantite,
        reference: `Sortie Cmd #${id.substring(0, 8)}`
      } as any);
    } catch (stkErr) {
      console.warn("Erreur mise à jour stock (non bloquant):", stkErr);
    }
  }
  return id;
};

export const updateCommandeStatus = async (id: string, status: string, additionalData: any = {}): Promise<void> => {
  // 1. Fetch current status to check if we need to restore stock
  const { data: currentCmd } = await insforge.database
    .from('commandes')
    .select('statut_commande')
    .eq('id', id)
    .single();

  const prevStatus = currentCmd?.statut_commande;

  // 2. Update status
  const { error } = await insforge.database
    .from('commandes')
    .update({ statut_commande: status, ...additionalData, updated_at: new Date() })
    .eq('id', id);
  
  if (error) throw error;

  // 3. Stock restoration logic: 
  // If we move TO 'annulee' or 'a_rappeler' FROM a state that had stock removed (like en_attente_appel or validee)
  const stockRemovedStates = ['en_attente_appel', 'validee', 'en_cours_livraison'];
  const stockRestoreStates = ['annulee', 'a_rappeler'];

  if (stockRestoreStates.includes(status) && stockRemovedStates.includes(prevStatus)) {
    try {
      const { data: lines } = await insforge.database
        .from('lignes_commandes')
        .select('*')
        .eq('commande_id', id);

      if (lines) {
        for (const l of lines) {
          await addMouvementStock({
            produit_id: l.produit_id,
            type_mouvement: 'entree',
            quantite: l.quantite,
            reference: `Retour Stock (${status}) Cmd #${id.substring(0, 8)}`
          } as any);
        }
      }
    } catch (stockErr) {
      console.error("Erreur lors de la restauration du stock:", stockErr);
    }
  }
};

export const getTopSellingProducts = async (limit = 10): Promise<{ nom: string, nb_ventes: number, total_ca: number, total_sorties: number, taux_succes: number }[]> => {
  const { data: lines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*, commandes(statut_commande)');
  
  if (linesError) throw linesError;
  
  const aggregates: Record<string, { nb: number, ca: number, sorties: number, livrees: number }> = {};
  
  (lines || []).forEach((l: any) => {
    if (!aggregates[l.nom_produit]) {
      aggregates[l.nom_produit] = { nb: 0, ca: 0, sorties: 0, livrees: 0 };
    }
    
    const status = l.commandes?.statut_commande;
    const isSortie = ['en_cours_livraison', 'livree', 'echouee', 'retour_stock', 'retour_livreur'].includes(status);
    const isLivree = ['livree', 'terminee'].includes(status);
    
    if (isLivree) {
      aggregates[l.nom_produit].nb += l.quantite;
      aggregates[l.nom_produit].ca += l.montant_ligne;
      aggregates[l.nom_produit].livrees += l.quantite;
    }
    
    if (isSortie) {
      aggregates[l.nom_produit].sorties += l.quantite;
    }
  });

  return Object.entries(aggregates)
    .map(([nom, stats]) => ({ 
      nom, 
      nb_ventes: stats.livrees, 
      total_ca: stats.ca,
      total_sorties: stats.sorties,
      taux_succes: stats.sorties > 0 ? Math.round((stats.livrees / stats.sorties) * 100) : 0
    }))
    .sort((a, b) => b.nb_ventes - a.nb_ventes)
    .slice(0, limit);
};

export const deleteCommande = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('commandes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const getFinancialData = async (): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .eq('statut_commande', 'livree')
    .order('date_creation', { ascending: false });

  if (orderError) throw orderError;

  const { data: lines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*');

  if (linesError) throw linesError;

  // Manual join for efficiency
  return (orders || []).map((o: any) => ({
    ...o,
    nom_client: o.clients?.nom_complet,
    telephone_client: o.clients?.telephone,
    lignes: (lines || []).filter((l: any) => l.commande_id === o.id)
  }));
};
