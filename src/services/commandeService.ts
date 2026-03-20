import { Commande, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

export const getCommandes = async (): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*')
    .order('date_creation', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const subscribeToCommandes = (callback: (commandes: Commande[]) => void) => {
  getCommandes().then(callback);
  const interval = setInterval(() => getCommandes().then(callback), 5000);
  return () => clearInterval(interval);
};

export const getCommandesByStatus = async (statusList: string[]): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*')
    .in('statut_commande', statusList)
    .order('date_creation', { ascending: false });

  if (error) throw error;
  return data || [];
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
    const { error: lineError } = await insforge.database
      .from('lignes_commandes')
      .insert([{ ...l, commande_id: id }]);
    
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
  const { error } = await insforge.database
    .from('commandes')
    .update({ statut_commande: status, ...additionalData, updated_at: new Date() })
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteCommande = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('commandes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};
