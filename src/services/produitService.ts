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
  // Ensure date is in ISO format for the DB
  const movementToInsert: any = {
    ...mouvement,
    date: new Date().toISOString()
  };

  // 1. Fetch current product to get stock_actuel AND tenant_id
  const { data: prod, error: fetchError } = await insforge.database
    .from('produits')
    .select('stock_actuel, tenant_id')
    .eq('id', mouvement.produit_id)
    .single();

  if (fetchError) {
    console.error("Error fetching product for stock movement:", fetchError);
    throw fetchError;
  }

  // 2. Add tenant_id if missing to ensure RLS/Filtering consistency
  if (!movementToInsert.tenant_id && prod?.tenant_id) {
    movementToInsert.tenant_id = prod.tenant_id;
  }

  // 3. Record movement
  const { error: moveError } = await insforge.database
    .from('mouvements_stock')
    .insert([movementToInsert]);
  
  if (moveError) {
    console.error("Error inserting movement:", moveError);
    throw moveError;
  }

  // 4. Update product stock
  const modifier = mouvement.type_mouvement === 'sortie' ? -Number(mouvement.quantite) : Number(mouvement.quantite);
  const newStock = (prod?.stock_actuel || 0) + modifier;

  await updateProduit(mouvement.produit_id, { 
    stock_actuel: newStock,
    updated_at: new Date().toISOString()
  });
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
