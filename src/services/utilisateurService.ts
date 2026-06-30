import { User } from '../types';
import { insforge } from '../lib/insforge';

export const getUtilisateurs = async (): Promise<User[]> => {
  const { data, error } = await insforge.database
    .from('users')
    .select('*').limit(100000)
    .order('nom_complet', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const creerUtilisateur = async (user: Omit<User, 'id'>, id: string = crypto.randomUUID()): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .insert([{ ...user, id }]);
  
  if (error) throw error;
};

export const updateUtilisateur = async (id: string, user: Partial<User>): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .update(user)
    .eq('id', id);
  
  if (error) throw error;
};

export const supprimerUtilisateur = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .update({ actif: false })
    .eq('id', id);
  
  if (error) throw error;
};
