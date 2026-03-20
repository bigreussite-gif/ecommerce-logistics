import { Commande, FeuilleRoute } from '../types';
import { getItems, updateItem } from './localDb';

export const getCurrentFeuilleRoute = async (livreurId: string): Promise<FeuilleRoute | null> => {
  const feuilles = getItems('feuilles_route').filter((f: FeuilleRoute) => f.livreur_id === livreurId && f.statut_feuille === 'en_cours');
  return feuilles.length > 0 ? feuilles[0] : null;
};

export const getCommandesForFeuille = async (feuilleRouteId: string): Promise<Commande[]> => {
  return getItems('commandes').filter((c: Commande) => c.feuille_route_id === feuilleRouteId);
};

export const markCommandeLivre = async (commandeId: string, montantEncaisse: number, notesRetours: string): Promise<void> => {
  updateItem('commandes', commandeId, { statut_commande: 'livree', date_livraison_effective: new Date(), montant_encaisse: montantEncaisse, notes_livreur: notesRetours });
};

export const markCommandeEchouee = async (commandeId: string, motif: string): Promise<void> => {
  updateItem('commandes', commandeId, { statut_commande: 'echouee', notes_livreur: motif });
};
