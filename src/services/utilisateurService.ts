import { User } from '../types';
import { insforge } from '../lib/insforge';

export const getUtilisateurs = async (): Promise<User[]> => {
  const { data, error } = await insforge.database
    .from('users')
    .select('*')
    .order('nom_complet', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createUtilisateurProfile = async (user: Omit<User, 'id'>, id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .insert([{ ...user, id }]);
  
  if (error) throw error;
};
