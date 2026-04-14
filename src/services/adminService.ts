import { User, Commune, Categorie } from '../types';
import { insforge } from '../lib/insforge';

// --- CATEGORIES MANAGEMENT ---

export const getCategories = async (): Promise<Categorie[]> => {
  const { data, error } = await insforge.database
    .from('categories')
    .select('*')
    .order('nom', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createCategorie = async (categorie: Omit<Categorie, 'id'>): Promise<string> => {
  const { data, error } = await insforge.database
    .from('categories')
    .insert([categorie])
    .select();

  if (error) throw error;
  return data?.[0]?.id;
};

export const updateCategorie = async (id: string, data: Partial<Categorie>): Promise<void> => {
  const { error } = await insforge.database
    .from('categories')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteCategorie = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('categories')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// --- USERS MANAGEMENT ---

export const getAdminUsers = async (): Promise<User[]> => {
  const { data, error } = await insforge.database
    .from('users')
    .select('*')
    .order('nom_complet', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createAdminUser = async (user: Omit<User, 'id'>, id?: string): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .insert([{ ...user, id: id || crypto.randomUUID() }]);
  
  if (error) throw error;
};

export const updateAdminUser = async (id: string, data: Partial<User>): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteAdminUser = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('users')
    .update({ actif: false }) // Soft delete
    .eq('id', id);
  
  if (error) throw error;
};


// --- COMMUNES MANAGEMENT ---

export const getCommunes = async (): Promise<Commune[]> => {
  const { data, error } = await insforge.database
    .from('communes')
    .select('*')
    .order('nom', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getCommuneByName = async (nom: string): Promise<Commune | undefined> => {
  const { data, error } = await insforge.database
    .from('communes')
    .select('*')
    .ilike('nom', nom)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || undefined;
};

export const createCommune = async (commune: Omit<Commune, 'id'>): Promise<string> => {
  const { data, error } = await insforge.database
    .from('communes')
    .insert([commune])
    .select();

  if (error) throw error;
  return data?.[0]?.id;
};

export const updateCommune = async (id: string, data: Partial<Commune>): Promise<void> => {
  const { error } = await insforge.database
    .from('communes')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteCommune = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('communes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};
