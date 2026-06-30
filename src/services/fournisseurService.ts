import { insforge } from '../lib/insforge';
import { globalEventBus, EVENTS } from '../utils/events';

export interface Fournisseur {
  id: string;
  nom: string;
  contact?: string;
  telephone?: string;
  adresse?: string;
  solde_dette: number;
  created_at?: string;
}

export const getFournisseurs = async (): Promise<Fournisseur[]> => {
  const { data, error } = await insforge.database
    .from('fournisseurs')
    .select('*').limit(100000)
    .order('nom', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createFournisseur = async (fournisseur: Omit<Fournisseur, 'id' | 'solde_dette'>): Promise<string> => {
  const { data, error } = await insforge.database
    .from('fournisseurs')
    .insert([{
      ...fournisseur,
      solde_dette: 0
    }])
    .select().limit(100000);
  
  if (error) throw error;
  globalEventBus.emit(EVENTS.FOURNISSEURS_UPDATED);
  return data?.[0]?.id;
};

export const updateFournisseur = async (id: string, data: Partial<Fournisseur>): Promise<void> => {
  const { error } = await insforge.database
    .from('fournisseurs')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
  globalEventBus.emit(EVENTS.FOURNISSEURS_UPDATED);
};

export const deleteFournisseur = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('fournisseurs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  globalEventBus.emit(EVENTS.FOURNISSEURS_UPDATED);
};

export const payDebt = async (id: string, amount: number): Promise<void> => {
  // 1. Fetch current debt
  const { data: f } = await insforge.database
    .from('fournisseurs')
    .select('solde_dette').limit(100000)
    .eq('id', id)
    .single();

  if (!f) throw new Error("Fournisseur introuvable");

  const newDebt = Math.max(0, Number(f.solde_dette || 0) - amount);

  // 2. Update debt
  await insforge.database
    .from('fournisseurs')
    .update({ solde_dette: newDebt })
    .eq('id', id);

  // 3. Update related purchases status (FIFO)
  // Re-fetch all "En attente" purchases for this supplier to reconcile
  const { data: pendingAchats } = await insforge.database
    .from('achats_stock')
    .select('id, montant_total').limit(100000)
    .eq('fournisseur_id', id)
    .eq('statut_paiement', 'En attente')
    .order('date_achat', { ascending: true });

  if (pendingAchats && pendingAchats.length > 0) {
    const totalPending = pendingAchats.reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0);
    // The amount that has been paid is (Total ever owed - Current debt)
    // But since we only have the "En attente" list, we can say:
    // Any amount by which we reduced the debt should close the oldest pending purchases.
    // However, if the user makes multiple partial payments, we need to know how much was already paid.
    // A simpler way: if the total debt is 0, all are paid.
    if (newDebt <= 0.1) {
      await insforge.database
        .from('achats_stock')
        .update({ statut_paiement: 'Payé' })
        .eq('fournisseur_id', id)
        .eq('statut_paiement', 'En attente');
    } else {
      // Reconcile FIFO: mark as paid all purchases that fit in (TotalPending - currentDebt)
      let amountToMarkAsPaid = Math.max(0, totalPending - newDebt);
      for (const achat of pendingAchats) {
        const achatMontant = Number(achat.montant_total) || 0;
        if (amountToMarkAsPaid >= achatMontant - 0.1) {
          await insforge.database
            .from('achats_stock')
            .update({ statut_paiement: 'Payé' })
            .eq('id', achat.id);
          amountToMarkAsPaid -= achatMontant;
        } else {
          // If we can't fully pay the next one, we stop
          break;
        }
      }
    }
  }

  // 4. Create expense
  const { addDepense } = await import('./financialService');
  await addDepense({
    date: new Date().toISOString(),
    categorie: 'Règlement Fournisseur',
    montant: amount,
    description: `Règlement Dette Fournisseur : (ID: ${id.substring(0,8)})`,
    mode_paiement: 'Cash'
  });

  globalEventBus.emit(EVENTS.FOURNISSEURS_UPDATED);
  globalEventBus.emit(EVENTS.ACHATS_UPDATED);
};

