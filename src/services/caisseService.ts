import { Commande, FeuilleRoute } from '../types';
import { getItems, updateItem, addItem, updateItems } from './localDb';
import { addMouvementStock } from './produitService';

export const getFeuillesEnCours = async (livreurId: string): Promise<FeuilleRoute[]> => {
  return getItems('feuilles_route').filter((f: FeuilleRoute) => f.livreur_id === livreurId && f.statut_feuille === 'en_cours');
};

export const getCommandesConcernees = async (feuilleRouteId: string): Promise<Commande[]> => {
  return getItems('commandes').filter((c: Commande) => c.feuille_route_id === feuilleRouteId);
};

export const processCaisse = async (feuilleRouteId: string, resolutions: {id: string, statut: string, mode_paiement: string}[], montantPhysique: number, ecart: number, commentaire: string): Promise<void> => {
  await updateItem('feuilles_route', feuilleRouteId, {
    statut_feuille: 'terminee',
    date_traitement: new Date().toISOString(),
    montant_encaisse: montantPhysique,
    ecart_caisse: ecart
  });
  
  const updates: any[] = [];
  const lignesCommandes = getItems('lignes_commandes');
  
  for (const res of resolutions) {
    let finalStatus = res.statut;
    if (res.statut === 'livree') finalStatus = 'terminee';
    if (res.statut === 'retour_livreur' || res.statut === 'echouee') finalStatus = 'retour_stock';
    
    // Reprogrammer -> "a_rappeler", Annuler -> "annulee"
    updates.push({ id: res.id, changes: { statut_commande: finalStatus, mode_paiement: res.mode_paiement } });

    if (finalStatus === 'retour_stock' || finalStatus === 'annulee') {
      const lignes: any[] = lignesCommandes.filter((l: any) => l.commande_id === res.id);
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
  
  updateItems('commandes', updates);
  
  addItem('caisse_retours', { 
    date: new Date(), 
    feuille_route_id: feuilleRouteId, 
    montant_remis_par_livreur: montantPhysique, 
    ecart, 
    commentaire_caissiere: commentaire 
  });
};
