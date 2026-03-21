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

export interface ClientFidelityStats {
  total_commandes: number;
  total_depense: number;
  panier_moyen: number;
  derniere_commande: Date | null;
  segment: 'Diamant 💎' | 'Fidèle ✅' | 'À relancer ⚠️' | 'Nouveau 🆕';
}

export const getClientsWithIntelligence = async (): Promise<(Client & ClientFidelityStats)[]> => {
  const [clients, allOrders] = await Promise.all([
    getAllClients(),
    insforge.database.from('commandes').select('*').eq('statut_commande', 'livree')
  ]);

  const orders = allOrders.data || [];

  return clients.map(client => {
    const clientOrders = orders.filter(o => o.client_id === client.id);
    const total_depense = clientOrders.reduce((acc, o) => acc + (Number(o.montant_total) || 0), 0);
    const total_commandes = clientOrders.length;
    
    // Segmentation logic
    let segment: any = 'Nouveau 🆕';
    if (total_commandes >= 5 || total_depense > 150000) segment = 'Diamant 💎';
    else if (total_commandes >= 2) segment = 'Fidèle ✅';
    
    // Check for "At Risk" (last order > 60 days ago)
    const now = new Date();
    const lastOrderDate = clientOrders.length > 0 ? new Date(clientOrders[0].date_creation) : null;
    if (lastOrderDate && (now.getTime() - lastOrderDate.getTime()) > 60 * 24 * 60 * 60 * 1000) {
      segment = 'À relancer ⚠️';
    }

    return {
      ...client,
      total_commandes,
      total_depense,
      panier_moyen: total_commandes > 0 ? Math.round(total_depense / total_commandes) : 0,
      derniere_commande: lastOrderDate,
      segment
    };
  });
};
