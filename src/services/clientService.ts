import { Client, Commande } from '../types';
import { getItems, addItem } from './localDb';

export const getAllClients = async (): Promise<Client[]> => {
  return getItems('clients');
};

export const getClientCommandes = async (clientId: string): Promise<Commande[]> => {
  return getItems('commandes').filter((c: Commande) => c.client_id === clientId);
};

export const searchClientByPhone = async (phone: string): Promise<Client | null> => {
  return getItems('clients').find((c: Client) => c.telephone === phone) || null;
};

export const createClient = async (client: Omit<Client, 'id'>): Promise<string> => {
  return addItem('clients', client);
};
