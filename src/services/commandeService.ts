import { Commande, LigneCommande } from '../types';
import { getItems, subscribeToItems, addItem, updateItem } from './localDb';

export const getCommandes = async (): Promise<Commande[]> => {
  return getItems('commandes').sort((a: Commande, b: Commande) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
};

export const subscribeToCommandes = (callback: (commandes: Commande[]) => void) => {
  return subscribeToItems('commandes', callback, undefined, (a: Commande, b: Commande) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
};

export const getCommandesByStatus = async (statusList: string[]): Promise<Commande[]> => {
  return getItems('commandes')
    .filter((c: Commande) => statusList.includes(c.statut_commande))
    .sort((a: Commande, b: Commande) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
};

export const subscribeToCommandesByStatus = (statusList: string[], callback: (commandes: Commande[]) => void) => {
  return subscribeToItems('commandes', callback, (c: Commande) => statusList.includes(c.statut_commande), (a: Commande, b: Commande) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
};

import { addMouvementStock } from './produitService';

export const createCommandeBase = async (commande: Omit<Commande, 'id'>, lignes: Omit<LigneCommande, 'id' | 'commande_id'>[]): Promise<string> => {
  commande.date_creation = new Date();
  commande.statut_commande = 'en_attente_appel'; 
  const id = addItem('commandes', commande);
  for (const l of lignes) {
    addItem('lignes_commandes', { ...l, commande_id: id });
    await addMouvementStock({
      produit_id: l.produit_id,
      type_mouvement: 'sortie',
      quantite: l.quantite,
      reference: `Sortie Cmd #${id.slice(0,5)}`
    } as any);
  }
  return id;
};

export const updateCommandeStatus = async (id: string, status: string, additionalData: any = {}): Promise<void> => {
  updateItem('commandes', id, { statut_commande: status, ...additionalData });
};
