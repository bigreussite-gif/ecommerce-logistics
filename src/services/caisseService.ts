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
  return data || [];
};

export const getCloturedFeuilles = async (): Promise<FeuilleRoute[]> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*, livreurs:livreur_id(nom_complet)')
    .eq('statut_feuille', 'terminee')
    .order('date', { ascending: false });

  if (error) throw error;
  
  // Transform to include nom_livreur directly
  return (data || []).map((f: any) => ({
    ...f,
    nom_livreur: f.livreurs?.nom_complet
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
      mode_paiement: res.mode_paiement, 
      updated_at: new Date() 
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
      date: new Date(), 
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
};

export const getRangeFinancials = async (startDateStr: string, endDateStr?: string): Promise<any> => {
  const start = new Date(startDateStr);
  start.setHours(0,0,0,0);
  
  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
  end.setHours(23,59,59,999);

  // 1. Get Caisse Retours for the range
  const { data: retours, error: retoursError } = await insforge.database
    .from('caisse_retours')
    .select('*')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString());

  if (retoursError) throw retoursError;

  // 2. Get All Commandes modified or delivered in range for stats
  const filterStr = `and(date_livraison_effective.gte.${start.toISOString()},date_livraison_effective.lte.${end.toISOString()}),and(updated_at.gte.${start.toISOString()},updated_at.lte.${end.toISOString()})`;

  const { data: commandes, error: cmdError } = await insforge.database
    .from('commandes')
    .select('id, montant_total, statut_commande, mode_paiement, frais_livraison, updated_at, date_livraison_effective, lignes:lignes_commandes(*)')
    .or(filterStr);

  if (cmdError) throw cmdError;

  return { retours, commandes };
};
