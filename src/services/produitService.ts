import { Produit, MouvementStock } from '../types';
import { insforge } from '../lib/insforge';

export const getProduits = async (): Promise<Produit[]> => {
  const { data, error } = await insforge.database
    .from('produits')
    .select('*')
    .order('nom', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

// Note: For now, we replace realtime with a fetch. 
// Real-time would require configuring triggers in the backend.
export const subscribeToProduits = (callback: (produits: Produit[]) => void) => {
  getProduits().then(callback);
  // We can implement a simple interval for now or just wait for triggers
  const interval = setInterval(() => getProduits().then(callback), 3000);
  return () => clearInterval(interval);
};

export const createProduit = async (produit: Omit<Produit, 'id'>): Promise<string> => {
  const { data, error } = await insforge.database
    .from('produits')
    .insert([produit])
    .select();
  
  if (error) throw error;
  return data?.[0]?.id;
};

export const updateProduit = async (id: string, data: Partial<Produit>): Promise<void> => {
  const { error } = await insforge.database
    .from('produits')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
};

export const addMouvementStock = async (mouvement: Omit<MouvementStock, 'id'>): Promise<void> => {
  mouvement.date = new Date();
  
  const { error: moveError } = await insforge.database
    .from('mouvements_stock')
    .insert([mouvement]);
  
  if (moveError) throw moveError;

  // Update product stock
  const { data: prod, error: fetchError } = await insforge.database
    .from('produits')
    .select('stock_actuel')
    .eq('id', mouvement.produit_id)
    .single();

  if (fetchError) throw fetchError;

  const modifier = mouvement.type_mouvement === 'sortie' ? -mouvement.quantite : mouvement.quantite;
  const newStock = (prod?.stock_actuel || 0) + modifier;

  await updateProduit(mouvement.produit_id, { stock_actuel: newStock });
};

export const getHistoriqueStock = async (produit_id: string): Promise<MouvementStock[]> => {
  const { data, error } = await insforge.database
    .from('mouvements_stock')
    .select('*')
    .eq('produit_id', produit_id)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};
