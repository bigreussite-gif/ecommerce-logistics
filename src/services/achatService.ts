import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';
import { addDepense, deleteDepense } from './financialService';
import { updateFournisseur, getFournisseurs } from './fournisseurService';
import { globalEventBus, EVENTS } from '../utils/events';

export interface AchatStock {
  id: string;
  produit_id: string;
  fournisseur_id: string;
  quantite: number;
  prix_achat_unitaire: number;
  montant_total: number;
  mode_paiement: 'Cash' | 'Crédit';
  statut_paiement: 'Payé' | 'En attente';
  date_achat: string;
  created_at?: string;
}

export const getAchatsStock = async (): Promise<AchatStock[]> => {
  const { data, error } = await insforge.database
    .from('achats_stock')
    .select('*, produits(nom), fournisseurs(nom)')
    .order('date_achat', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const registerAchatStock = async (achat: Omit<AchatStock, 'id' | 'date_achat'>): Promise<void> => {
  const date_achat = new Date().toISOString();
  
  // 1. Enregistrer l'achat
  const { data: achatData, error: achatError } = await insforge.database
    .from('achats_stock')
    .insert([{
      ...achat,
      date_achat
    }])
    .select();

  if (achatError) throw achatError;

  // 2. Mettre à jour le stock
  await addMouvementStock({
    produit_id: achat.produit_id,
    type_mouvement: 'entree',
    quantite: achat.quantite,
    reference: `Achat Stock #${achatData[0].id.substring(0, 8)}`,
    commentaire: `Approvisionnement chez fournisseur`
  } as any);

  // 3. Gérer le flux financier
  if (achat.mode_paiement === 'Cash') {
    // Créer une dépense automatique
    await addDepense({
      date: date_achat,
      categorie: 'Achat Stock',
      montant: achat.montant_total,
      description: `Paiement Cash Achat Stock #${achatData[0].id.substring(0, 8)}`,
      mode_paiement: 'Cash'
    });
  } else {
    // Augmenter la dette du fournisseur
    const fournisseurs = await getFournisseurs();
    const f = fournisseurs.find(item => item.id === achat.fournisseur_id);
    if (f) {
      await updateFournisseur(f.id, {
        solde_dette: Number(f.solde_dette || 0) + Number(achat.montant_total)
      });
    }
  }

  globalEventBus.emit(EVENTS.ACHATS_UPDATED);
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
};

export const registerBulkAchatsStock = async (achats: Omit<AchatStock, 'id' | 'date_achat'>[]): Promise<void> => {
  const date_achat = new Date().toISOString();
  
  for (const achat of achats) {
    // 1. Enregistrer l'achat individuel
    const { data: achatData, error: achatError } = await insforge.database
      .from('achats_stock')
      .insert([{
        ...achat,
        date_achat
      }])
      .select();

    if (achatError) throw achatError;

    // 2. Mettre à jour le stock
    await addMouvementStock({
      produit_id: achat.produit_id,
      type_mouvement: 'entree',
      quantite: achat.quantite,
      reference: `Achat Stock #${achatData[0].id.substring(0, 8)}`,
      commentaire: `Approvisionnement (Bulk)`
    } as any);

    // 3. Gérer le flux financier
    if (achat.mode_paiement === 'Cash') {
      await addDepense({
        date: date_achat,
        categorie: 'Achat Stock',
        montant: achat.montant_total,
        description: `Paiement Cash Achat Stock #${achatData[0].id.substring(0, 8)}`,
        mode_paiement: 'Cash'
      });
    } else {
      const fournisseurs = await getFournisseurs();
      const f = fournisseurs.find(item => item.id === achat.fournisseur_id);
      if (f) {
        await updateFournisseur(f.id, {
          solde_dette: Number(f.solde_dette || 0) + Number(achat.montant_total)
        });
      }
    }
  }
  
  globalEventBus.emit(EVENTS.ACHATS_UPDATED);
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
};


export const updateAchatStock = async (id: string, updates: Partial<AchatStock>): Promise<void> => {
  // 1. Get old record
  const { data: oldAchat, error: getError } = await insforge.database
    .from('achats_stock')
    .select('*')
    .eq('id', id)
    .single();
  
  if (getError || !oldAchat) throw new Error("Achat introuvable");

  const newAchat = { ...oldAchat, ...updates };
  const shortId = id.substring(0, 8);

  // 2. Reverse OLD effects
  // Reverse Stock
  await addMouvementStock({
    produit_id: oldAchat.produit_id,
    type_mouvement: 'sortie',
    quantite: oldAchat.quantite,
    reference: `Correction Achat #${shortId}`,
    commentaire: `Annulation ancienne quantité pour correction`
  } as any);

  // Reverse Finance
  if (oldAchat.mode_paiement === 'Cash') {
    // Delete expense (search by description)
    const { data: deps } = await insforge.database
      .from('depenses')
      .select('id')
      .ilike('description', `%Achat Stock #${shortId}%`);
    
    if (deps) {
      for (const d of deps) {
        await deleteDepense(d.id);
      }
    }
  } else {
    // Decrease old supplier debt
    const fournisseurs = await getFournisseurs();
    const f = fournisseurs.find(item => item.id === oldAchat.fournisseur_id);
    if (f) {
      await updateFournisseur(f.id, {
        solde_dette: Math.max(0, Number(f.solde_dette || 0) - Number(oldAchat.montant_total))
      });
    }
  }

  // 3. Update the record
  const { error: updateError } = await insforge.database
    .from('achats_stock')
    .update(updates)
    .eq('id', id);
  
  if (updateError) throw updateError;

  // 4. Apply NEW effects
  // New Stock
  await addMouvementStock({
    produit_id: newAchat.produit_id,
    type_mouvement: 'entree',
    quantite: newAchat.quantite,
    reference: `Correction Achat #${shortId}`,
    commentaire: `Nouvelle quantité après correction`
  } as any);

  // New Finance
  if (newAchat.mode_paiement === 'Cash') {
    await addDepense({
      date: newAchat.date_achat,
      categorie: 'Achat Stock',
      montant: newAchat.montant_total,
      description: `Paiement Cash Achat Stock #${shortId} (Corrigé)`,
      mode_paiement: 'Cash'
    });
  } else {
    const fournisseurs = await getFournisseurs();
    const f = fournisseurs.find(item => item.id === newAchat.fournisseur_id);
    if (f) {
      await updateFournisseur(f.id, {
        solde_dette: Number(f.solde_dette || 0) + Number(newAchat.montant_total)
      });
    }
  }

  globalEventBus.emit(EVENTS.ACHATS_UPDATED);
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
};

export const deleteAchatStock = async (id: string): Promise<void> => {
  // 1. Get record to reverse effects
  const { data: achat, error: getError } = await insforge.database
    .from('achats_stock')
    .select('*')
    .eq('id', id)
    .single();
  
  if (getError || !achat) throw new Error("Achat introuvable");

  const shortId = id.substring(0, 8);

  // 2. Reverse Stock
  await addMouvementStock({
    produit_id: achat.produit_id,
    type_mouvement: 'sortie',
    quantite: achat.quantite,
    reference: `Suppression Achat #${shortId}`,
    commentaire: `Retrait du stock après suppression achat`
  } as any);

  // 3. Reverse Finance
  if (achat.mode_paiement === 'Cash') {
    const { data: deps } = await insforge.database
      .from('depenses')
      .select('id')
      .ilike('description', `%Achat Stock #${shortId}%`);
    
    if (deps) {
      for (const d of deps) {
        await deleteDepense(d.id);
      }
    }
  } else {
    const fournisseurs = await getFournisseurs();
    const f = fournisseurs.find(item => item.id === achat.fournisseur_id);
    if (f) {
      await updateFournisseur(f.id, {
        solde_dette: Math.max(0, Number(f.solde_dette || 0) - Number(achat.montant_total))
      });
    }
  }

  // 4. Delete record
  const { error: delError } = await insforge.database
    .from('achats_stock')
    .delete()
    .eq('id', id);
  
  if (delError) throw delError;

  globalEventBus.emit(EVENTS.ACHATS_UPDATED);
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
};
