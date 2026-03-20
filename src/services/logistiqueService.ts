import { Commande, User } from '../types';
import { getItems, addItem, updateItems } from './localDb';

export const getAvailableLivreurs = async (): Promise<User[]> => {
  return getItems('users').filter((u: User) => u.role === 'LIVREUR' && u.actif !== false);
};

export const creerFeuilleRoute = async (livreurId: string, commandeIds: string[]): Promise<string> => {
  const commandes: Commande[] = getItems('commandes').filter((c: Commande) => commandeIds.includes(c.id));
  const montant_total = commandes.reduce((acc, c) => acc + Number(c.montant_total), 0);
  const communes = Array.from(new Set(commandes.map(c => c.commune_livraison)));
  
  const feuilleId = addItem('feuilles_route', {
    date: new Date(),
    livreur_id: livreurId,
    statut_feuille: 'en_cours',
    communes_couvertes: communes,
    total_commandes: commandes.length,
    total_montant_theorique: montant_total
  });
  
  const updates = commandeIds.map(cid => ({ id: cid, changes: { statut_commande: 'en_cours_livraison', livreur_id: livreurId, feuille_route_id: feuilleId } }));
  updateItems('commandes', updates);
  
  return feuilleId;
};

export const getFeuillesRoute = async () => {
  return getItems('feuilles_route').sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getCommandesByFeuille = async (feuilleId: string): Promise<Commande[]> => {
  return getItems('commandes').filter((c: Commande) => c.feuille_route_id === feuilleId);
};
