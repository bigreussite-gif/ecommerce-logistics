import { Produit, MouvementStock } from '../types';
import { getItems, subscribeToItems, addItem, updateItem } from './localDb';

export const subscribeToProduits = (callback: (produits: Produit[]) => void) => {
  return subscribeToItems('produits', callback, undefined, (a: Produit, b: Produit) => a.nom.localeCompare(b.nom));
};

export const createProduit = async (produit: Omit<Produit, 'id'>): Promise<string> => addItem('produits', produit);

export const updateProduit = async (id: string, data: Partial<Produit>): Promise<void> => updateItem('produits', id, data);

export const addMouvementStock = async (mouvement: Omit<MouvementStock, 'id'>): Promise<void> => {
  mouvement.date = new Date();
  addItem('mouvements_stock', mouvement);
  const produits = getItems('produits');
  const prod = produits.find((p: Produit) => p.id === mouvement.produit_id);
  if (prod) {
    const modifier = mouvement.type_mouvement === 'sortie' ? -mouvement.quantite : mouvement.quantite;
    updateItem('produits', prod.id, { stock_actuel: (prod.stock_actuel || 0) + modifier });
  }
};

export const getHistoriqueStock = async (produit_id: string): Promise<MouvementStock[]> => {
  return getItems('mouvements_stock')
    .filter((m: MouvementStock) => m.produit_id === produit_id)
    .sort((a: MouvementStock, b: MouvementStock) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
