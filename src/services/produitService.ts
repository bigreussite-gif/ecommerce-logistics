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
    .insert([{
      ...produit,
      created_at: new Date().toISOString()
    }])
    .select();
  
  if (error) throw error;
  return data?.[0]?.id;
};

export const updateProduit = async (id: string, data: Partial<Produit>): Promise<void> => {
  const { error } = await insforge.database
    .from('produits')
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
};

export const addMouvementStock = async (mouvement: Omit<MouvementStock, 'id'>): Promise<void> => {
  // 1. Fetch current product - strictly select only what is needed
  const { data: prod, error: fetchError } = await insforge.database
    .from('produits')
    .select('stock_actuel')
    .eq('id', mouvement.produit_id)
    .single();

  if (fetchError) {
    console.error("Error fetching product for stock movement:", fetchError);
    throw new Error(`Produit introuvable: ${fetchError.message}`);
  }

  const currentStock = Number(prod?.stock_actuel || 0);
  const qty = Number(mouvement.quantite);
  const modifier = (mouvement.type_mouvement === 'sortie') ? -qty : qty;
  const newStock = currentStock + modifier;

  // 2. Prepare CLEAN movement data
  const moveData = {
    produit_id: mouvement.produit_id,
    type_mouvement: mouvement.type_mouvement,
    quantite: qty,
    reference: mouvement.reference || '',
    commentaire: mouvement.commentaire || '',
    date: new Date().toISOString()
  };

  const { error: moveError } = await insforge.database
    .from('mouvements_stock')
    .insert([moveData]);

  if (moveError) {
    console.error("Error creating stock movement record:", moveError);
    throw moveError;
  }

  // 3. Update the product stock
  const { error: updateError } = await insforge.database
    .from('produits')
    .update({ 
      stock_actuel: newStock,
      updated_at: new Date().toISOString()
    })
    .eq('id', mouvement.produit_id);

  if (updateError) {
    console.error("Error updating product total stock:", updateError);
    throw updateError;
  }
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
