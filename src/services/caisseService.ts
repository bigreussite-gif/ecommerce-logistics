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

export const getCommandesConcernees = async (feuilleRouteId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*')
    .eq('feuille_route_id', feuilleRouteId);

  if (error) throw error;
  return data || [];
};

export const processCaisse = async (feuilleRouteId: string, resolutions: {id: string, statut: string, mode_paiement: string}[], montantPhysique: number, ecart: number, commentaire: string): Promise<void> => {
  const { error: frError } = await insforge.database
    .from('feuilles_route')
    .update({
      statut_feuille: 'terminee',
      date_traitement: new Date().toISOString(),
      total_montant_theorique: montantPhysique, // This usually comes from the sum of delivered orders
      // ecart_caisse: ecart // Note: Verify if this column exists in your schema or add it
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
  
  const { error: retourError } = await insforge.database
    .from('caisse_retours')
    .insert([{ 
      date: new Date(), 
      feuille_route_id: feuilleRouteId, 
      montant_remis_par_livreur: montantPhysique, 
      montant_attendu: montantPhysique - ecart, // Simplified logic
      ecart, 
      commentaire_caissiere: commentaire 
    }]);

  if (retourError) throw retourError;
};
