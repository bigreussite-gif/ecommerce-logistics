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

  // Fetch composants for bundles
  const { data: composantsData } = await insforge.database
    .from('produits_composants')
    .select('*, produit:produits!produits_composants_composant_id_fkey(*)');
    
  const bundlesMap = new Map<string, any[]>();
  (composantsData || []).forEach(comp => {
    if (!bundlesMap.has(comp.bundle_id)) bundlesMap.set(comp.bundle_id, []);
    bundlesMap.get(comp.bundle_id)!.push(comp);
  });

  try {
    const { data: lines, error: linesError } = await insforge.database
      .from('lignes_commandes')
      .select('produit_id, quantite, commandes!inner(statut_commande, date_creation)')
      .in('commandes.statut_commande', ['nouvelle', 'a_rappeler', 'en_attente_appel', 'validee', 'en_cours_livraison', 'echouee', 'retour_livreur']);

    if (linesError) {
      console.error("Error fetching reserved stock lines:", linesError);
      return products.map(p => ({
        ...p,
        stock_reserve: 0,
        stock_en_livraison: 0,
        stock_disponible: p.stock_actuel
      }));
    }

    const reservedMap = new Map<string, number>();
    const enLivraisonMap = new Map<string, number>();
    const now = new Date();

    (lines || []).forEach((l: any) => {
      const cmd = Array.isArray(l.commandes) ? l.commandes[0] : l.commandes;
      const status = cmd?.statut_commande?.toLowerCase();
      
      if (cmd?.date_creation) {
        const dateCreation = new Date(cmd.date_creation);
        const daysOld = (now.getTime() - dateCreation.getTime()) / (1000 * 3600 * 24);
        // Ne pas bloquer le stock pour les vieilles commandes non traitées (+14 jours)
        if (['nouvelle', 'a_rappeler', 'en_attente_appel'].includes(status) && daysOld > 14) {
          return;
        }
      }
      
      if (['en_cours_livraison', 'echouee', 'retour_livreur'].includes(status)) {
        const current = enLivraisonMap.get(l.produit_id) || 0;
        enLivraisonMap.set(l.produit_id, current + Number(l.quantite || 0));
      } else {
        const current = reservedMap.get(l.produit_id) || 0;
        reservedMap.set(l.produit_id, current + Number(l.quantite || 0));
      }
    });

    return products.map(p => {
      const stock_reserve = reservedMap.get(p.id) || 0;
      const stock_en_livraison = enLivraisonMap.get(p.id) || 0;
      return {
        ...p,
        stock_reserve,
        stock_en_livraison,
        stock_disponible: Math.max(0, p.stock_actuel - stock_reserve - stock_en_livraison),
        composants: bundlesMap.get(p.id) || []
      };
    });
  } catch (err) {
    console.error("Error in advanced stock calculation:", err);
    return products.map(p => ({
      ...p,
      stock_reserve: 0,
      stock_en_livraison: 0,
      stock_disponible: p.stock_actuel,
      composants: bundlesMap.get(p.id) || []
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
  const { composants, ...prodData } = produit;
  const { data, error } = await insforge.database
    .from('produits')
    .insert([{
      ...prodData,
      created_at: new Date().toISOString()
    }])
    .select();
  
  if (error) throw error;
  const newId = data?.[0]?.id;

  if (newId && prodData.is_bundle && composants && composants.length > 0) {
    const compData = composants.map(c => ({
      bundle_id: newId,
      composant_id: c.composant_id,
      quantite: c.quantite
    }));
    await insforge.database.from('produits_composants').insert(compData);
  }

  globalEventBus.emit(EVENTS.STOCK_UPDATED);
  return newId;
};

export const updateProduit = async (id: string, data: Partial<Produit>): Promise<void> => {
  const { composants, ...prodData } = data;
  const { error } = await insforge.database
    .from('produits')
    .update({ ...prodData })
    .eq('id', id);
  
  if (error) throw error;

  if (data.is_bundle !== undefined) {
    if (data.is_bundle && composants) {
      await insforge.database.from('produits_composants').delete().eq('bundle_id', id);
      const compData = composants.map(c => ({
        bundle_id: id,
        composant_id: c.composant_id,
        quantite: c.quantite
      }));
      if (compData.length > 0) {
        await insforge.database.from('produits_composants').insert(compData);
      }
    } else if (data.is_bundle === false) {
      await insforge.database.from('produits_composants').delete().eq('bundle_id', id);
    }
  }

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

