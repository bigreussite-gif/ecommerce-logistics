import { Produit, MouvementStock } from '../types';
import { insforge } from '../lib/insforge';
import { globalEventBus, EVENTS } from '../utils/events';

export const getProduits = async (): Promise<Produit[]> => {
  const { data: products, error } = await insforge.database
    .from('produits')
    .select('*')
    .order('nom', { ascending: true });
  
  if (error) throw error;
  if (!products || products.length === 0) return [];

  try {
    const { data: lines, error: linesError } = await insforge.database
      .from('lignes_commandes')
      .select('produit_id, quantite, commandes!inner(statut_commande)')
      .in('commandes.statut_commande', ['validee', 'en_cours_livraison', 'retour_livreur', 'echouee']);

    if (linesError) {
      console.error("Error fetching reserved stock lines:", linesError);
      return products.map(p => ({
        ...p,
        stock_reserve: 0,
        stock_disponible: p.stock_actuel
      }));
    }

    const reservedMap = new Map<string, number>();
    (lines || []).forEach((l: any) => {
      const current = reservedMap.get(l.produit_id) || 0;
      reservedMap.set(l.produit_id, current + Number(l.quantite || 0));
    });

    return products.map(p => {
      const stock_reserve = reservedMap.get(p.id) || 0;
      return {
        ...p,
        stock_reserve,
        stock_disponible: Math.max(0, p.stock_actuel - stock_reserve)
      };
    });
  } catch (err) {
    console.error("Error in advanced stock calculation:", err);
    return products.map(p => ({
      ...p,
      stock_reserve: 0,
      stock_disponible: p.stock_actuel
    }));
  }
};

export const subscribeToProduits = (callback: (produits: Produit[]) => void) => {
  const fetch = () => {
    getProduits().then(callback).catch(console.error);
  };

  fetch();
  
  // Listen for local updates
  globalEventBus.on(EVENTS.STOCK_UPDATED, fetch);
  
  return () => {
    globalEventBus.off(EVENTS.STOCK_UPDATED, fetch);
  };
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
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
  return data?.[0]?.id;
};

export const updateProduit = async (id: string, data: Partial<Produit>): Promise<void> => {
  const { error } = await insforge.database
    .from('produits')
    .update({
      ...data
    })
    .eq('id', id);
  
  if (error) throw error;
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
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
      stock_actuel: newStock
    })
    .eq('id', mouvement.produit_id);

  if (updateError) {
    console.error("Error updating product total stock:", updateError);
    throw updateError;
  }
  
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
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

