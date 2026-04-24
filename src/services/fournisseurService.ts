import { insforge } from '../lib/insforge';

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
    .select('*')
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
    .select();
  
  if (error) throw error;
  return data?.[0]?.id;
};

export const updateFournisseur = async (id: string, data: Partial<Fournisseur>): Promise<void> => {
  const { error } = await insforge.database
    .from('fournisseurs')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteFournisseur = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('fournisseurs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const payDebt = async (id: string, amount: number): Promise<void> => {
  // 1. Fetch current debt
  const { data: f } = await insforge.database
    .from('fournisseurs')
    .select('solde_dette')
    .eq('id', id)
    .single();

  if (!f) throw new Error("Fournisseur introuvable");

  const newDebt = Number(f.solde_dette || 0) - amount;

  // 2. Update debt
  await insforge.database
    .from('fournisseurs')
    .update({ solde_dette: newDebt })
    .eq('id', id);

  // 3. Create expense
  const { addDepense } = await import('./financialService');
  await addDepense({
    date: new Date().toISOString(),
    categorie: 'Règlement Fournisseur',
    montant: amount,
    description: `Paiement dette fournisseur (ID: ${id.substring(0,8)})`,
    mode_paiement: 'Cash'
  });
};
