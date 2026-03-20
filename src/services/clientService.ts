import { Client, Commande } from '../types';
import { insforge } from '../lib/insforge';

export const getAllClients = async (): Promise<Client[]> => {
  const { data, error } = await insforge.database
    .from('clients')
    .select('*')
    .order('nom_complet', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const getClientCommandes = async (clientId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*')
    .eq('client_id', clientId)
    .order('date_creation', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const searchClientByPhone = async (phone: string): Promise<Client | null> => {
  const { data, error } = await insforge.database
    .from('clients')
    .select('*')
    .eq('telephone', phone)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return data || null;
};

export const createClient = async (client: Omit<Client, 'id'>): Promise<string> => {
  const { data, error } = await insforge.database
    .from('clients')
    .insert([client])
    .select();

  if (error) throw error;
  return data?.[0]?.id;
};
