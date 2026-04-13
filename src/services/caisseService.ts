import { Commande, FeuilleRoute } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

export const getFeuillesEnCours = async (livreurId?: string): Promise<FeuilleRoute[]> => {
  let query = insforge.database
    .from('feuilles_route')
    .select('*')
    .in('statut_feuille', ['en_cours', 'cloturee']);

  if (livreurId) {
    query = query.eq('livreur_id', livreurId);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  if (!data || data.length === 0) return [];

  // Fetch names separately to be bulletproof against join errors
  const userIds = Array.from(new Set(data.map(f => f.livreur_id).filter(Boolean)));
  const { data: userData } = await insforge.database
    .from('users')
    .select('id, nom_complet')
    .in('id', userIds);

  const nameMap = new Map(userData?.map(u => [u.id, u.nom_complet]) || []);

  return data.map((f: any) => ({
    ...f,
    nom_livreur: nameMap.get(f.livreur_id) || `Livreur #${f.livreur_id?.slice(0,5)}`
  }));
};

export const getCloturedFeuilles = async (): Promise<FeuilleRoute[]> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*')
    .eq('statut_feuille', 'terminee')
    .order('date', { ascending: false });

  if (error) throw error;
  
  if (!data || data.length === 0) return [];

  // Safe fetch names
  const userIds = Array.from(new Set(data.map(f => f.livreur_id).filter(Boolean)));
  const { data: userData } = await insforge.database
    .from('users')
    .select('id, nom_complet')
    .in('id', userIds);

  const nameMap = new Map(userData?.map(u => [u.id, u.nom_complet]) || []);

  return data.map((f: any) => ({
    ...f,
    nom_livreur: nameMap.get(f.livreur_id) || `Livreur #${f.livreur_id?.slice(0,5)}`
  }));
};

export const getCommandesConcernees = async (feuilleRouteId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*')
    .eq('feuille_route_id', feuilleRouteId);

  if (error) throw error;
  return data || [];
};

export const processCaisse = async (
  feuilleRouteId: string, 
  resolutions: {id: string, statut: string, mode_paiement: string}[], 
  montantPhysique: number, 
  ecart: number, 
  commentaire: string,
  caissiereId: string,
  livreurId: string
): Promise<void> => {
  // 1. Update Feuille Route status and summary financials
  const { error: frError } = await insforge.database
    .from('feuilles_route')
    .update({
      statut_feuille: 'terminee',
      date_traitement: new Date().toISOString(),
      montant_encaisse: montantPhysique,
      ecart_caisse: ecart
    })
    .eq('id', feuilleRouteId);

  if (frError) throw frError;
  
  const orderIds = resolutions.map(r => r.id);
  const { data: lignesCommandes, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*')
    .in('commande_id', orderIds);

  if (linesError) throw linesError;
  
  for (const res of resolutions) {
    let finalStatus = res.statut;
    if (res.statut === 'livree') finalStatus = 'terminee';
    if (res.statut === 'retour_livreur' || res.statut === 'echouee') finalStatus = 'retour_stock';
    
    const isDelivered = finalStatus === 'terminee' || finalStatus === 'livree';
    
    const updateData: any = { 
      statut_commande: finalStatus, 
      mode_paiement: res.mode_paiement 
    };

    // If not delivered, clear the route sheet ID so it can be re-assigned in Logistics
    if (!isDelivered) {
      updateData.feuille_route_id = null;
    }
    
    // CRITICAL FIX: Ensure date_livraison_effective is set if the command is successful
    if (isDelivered) {
      updateData.date_livraison_effective = new Date().toISOString();
    }
    
    const { error: cmdUpdateError } = await insforge.database
      .from('commandes')
      .update(updateData)
      .eq('id', res.id);

    if (cmdUpdateError) throw cmdUpdateError;

    if (finalStatus === 'retour_stock' || finalStatus === 'annulee') {
      const lignes = lignesCommandes.filter((l: any) => l.commande_id === res.id);
      for (const l of lignes) {
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: 'entree',
          quantite: l.quantite,
          reference: `Retour Echec cmd #${res.id.slice(0,5)}`,
        } as any);
      }
    }
  }
  
  // 2. Log formal Caisse Retour
    const { error: retourError } = await insforge.database
      .from('caisse_retours')
      .insert([{ 
        date: new Date().toISOString(), 
      feuille_route_id: feuilleRouteId, 
      livreur_id: livreurId,
      caissiere_id: caissiereId,
      montant_remis_par_livreur: montantPhysique, 
      montant_attendu: montantPhysique - ecart,
      ecart, 
      commentaire_caissiere: commentaire 
    }]);

  if (retourError) throw retourError;
};

export const reopenFeuilleRoute = async (id: string): Promise<void> => {
  // 1. Supprimer l'enregistrement caisse_retours associé
  //    pour ne pas polluer les calculs du rapport journalier
  const { error: retourErr } = await insforge.database
    .from('caisse_retours')
    .delete()
    .eq('feuille_route_id', id);

  if (retourErr) throw retourErr;

  // 2. Remettre la feuille en cours
  const { error } = await insforge.database
    .from('feuilles_route')
    .update({
      statut_feuille: 'en_cours',
      montant_encaisse: 0,
      ecart_caisse: 0,
      date_traitement: null
    })
    .eq('id', id);

  if (error) throw error;

  // 3. Remettre les commandes "terminee/livree" de cette feuille
  //    en "en_cours_livraison" pour qu'elles soient re-traitées
  const { error: cmdErr } = await insforge.database
    .from('commandes')
    .update({
      statut_commande: 'en_cours_livraison',
      date_livraison_effective: null
    })
    .in('statut_commande', ['terminee', 'livree'])
    .eq('feuille_route_id', id);

  if (cmdErr) throw cmdErr;
};

export const getRangeFinancials = async (startDateStr: string, endDateStr?: string): Promise<any> => {
  const start = new Date(startDateStr);
  start.setHours(0,0,0,0);
  
  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
  end.setHours(23,59,59,999);

  // 1. Get Caisse Retours for the range (Physical closure records)
  const { data: retours, error: retoursError } = await insforge.database
    .from('caisse_retours')
    .select('*')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString());

  if (retoursError) throw retoursError;

  // 2. Get All Commandes delivered in range OR whose sheet was processed in range
  // This is much more stable than updated_at
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  
  // Fetch all sheets treated in range to include their orders (especially failures)
  const { data: sheets } = await insforge.database
    .from('feuilles_route')
    .select('id')
    .gte('date_traitement', startStr)
    .lte('date_traitement', endStr);

  const sheetIds = sheets?.map(s => s.id) || [];
  
  // Filter: (date_livraison_effective in range) OR (feuille_route_id in sheetIds)
  let filterStr = `and(date_livraison_effective.gte.${startStr},date_livraison_effective.lte.${endStr})`;
  if (sheetIds.length > 0) {
    filterStr += `,feuille_route_id.in.(${sheetIds.join(',')})`;
  }

  const { data: commandes, error: cmdError } = await insforge.database
    .from('commandes')
    .select('id, montant_total, statut_commande, mode_paiement, frais_livraison, updated_at, date_livraison_effective, lignes:lignes_commandes(*)')
    .or(filterStr);

  if (cmdError) throw cmdError;

  return { retours, commandes };
};
