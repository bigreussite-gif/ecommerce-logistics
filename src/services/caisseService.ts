import { Commande, FeuilleRoute } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

export const getFeuillesEnCours = async (livreurId: string): Promise<FeuilleRoute[]> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*')
    .eq('livreur_id', livreurId)
    .eq('statut_feuille', 'en_cours');

  if (error) throw error;
  return data || [];
};

export const getCloturedFeuilles = async (): Promise<FeuilleRoute[]> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*, livreurs:livreur_id(nom_complet)')
    .in('statut_feuille', ['cloturee', 'terminee'])
    .order('date_traitement', { ascending: false });

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

export const processCaisse = async (feuilleRouteId: string, resolutions: {id: string, statut: string, mode_paiement: string}[], montantPhysique: number, ecart: number, commentaire: string): Promise<void> => {
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
  
  const { data: lignesCommandes, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*');

  if (linesError) throw linesError;
  
  for (const res of resolutions) {
    let finalStatus = res.statut;
    if (res.statut === 'livree') finalStatus = 'terminee';
    if (res.statut === 'retour_livreur' || res.statut === 'echouee') finalStatus = 'retour_stock';
    
    const { error: cmdUpdateError } = await insforge.database
      .from('commandes')
      .update({ statut_commande: finalStatus, mode_paiement: res.mode_paiement })
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
      montant_remis_par_livreur: montantPhysique, 
      montant_attendu: montantPhysique - ecart,
      ecart, 
      commentaire_caissiere: commentaire 
    }]);

  if (retourError) throw retourError;
};

export const getDailyFinancials = async (dateStr: string): Promise<any> => {
  const startOfDayDate = new Date(dateStr);
  startOfDayDate.setHours(0,0,0,0);
  const endOfDayDate = new Date(dateStr);
  endOfDayDate.setHours(23,59,59,999);

  // 1. Get Caisse Retours for the day
  const { data: retours, error: retoursError } = await insforge.database
    .from('caisse_retours')
    .select('*')
    .gte('date', startOfDayDate.toISOString())
    .lte('date', endOfDayDate.toISOString());

  if (retoursError) throw retoursError;

  // 2. Get All Commandes modified or delivered today for stats
  const { data: commandes, error: cmdError } = await insforge.database
    .from('commandes')
    .select('id, montant_total, statut_commande, mode_paiement, frais_livraison')
    .or(`date_livraison_effective.gte.${startOfDayDate.toISOString()},updated_at.gte.${startOfDayDate.toISOString()}`);

  if (cmdError) throw cmdError;

  return { retours, commandes };
};
