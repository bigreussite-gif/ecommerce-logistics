import { User, Commune } from '../types';
import { getItems, addItem, updateItem, deleteItem } from './localDb';

// --- USERS MANAGEMENT ---

export const getAdminUsers = async (): Promise<User[]> => {
  return getItems('users').sort((a: User, b: User) => a.nom_complet.localeCompare(b.nom_complet));
};

export const createAdminUser = async (user: Omit<User, 'id'>): Promise<string> => {
  return addItem('users', user);
};

export const updateAdminUser = async (id: string, data: Partial<User>): Promise<void> => {
  updateItem('users', id, data);
};

export const deleteAdminUser = async (id: string): Promise<void> => {
  deleteItem('users', id);
};


// --- COMMUNES MANAGEMENT ---

export const getCommunes = async (): Promise<Commune[]> => {
  return getItems('communes').sort((a: Commune, b: Commune) => a.nom.localeCompare(b.nom));
};

export const getCommuneByName = async (nom: string): Promise<Commune | undefined> => {
  const communes = await getCommunes();
  return communes.find(c => c.nom.toLowerCase() === nom.toLowerCase());
};

export const createCommune = async (commune: Omit<Commune, 'id'>): Promise<string> => {
  return addItem('communes', commune);
};

export const updateCommune = async (id: string, data: Partial<Commune>): Promise<void> => {
  updateItem('communes', id, data);
};

export const deleteCommune = async (id: string): Promise<void> => {
  deleteItem('communes', id);
};
