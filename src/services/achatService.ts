import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';
import { addDepense } from './financialService';
import { updateFournisseur, getFournisseurs } from './fournisseurService';

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
};
