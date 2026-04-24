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
