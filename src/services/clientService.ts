import { Client, Commande } from '../types';
import { insforge } from '../lib/insforge';

export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-numeric characters
  const clean = phone.replace(/\D/g, '');
  // Take last 10 digits (Standard for CI / West Africa)
  return clean.slice(-10);
};

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

export const updateClient = async (id: string, updates: Partial<Client>): Promise<void> => {
  // If we are changing the phone, we must check for collisions (UNIQUE constraint)
  if (updates.telephone) {
    const existing = await searchClientByPhone(updates.telephone);
    
    // If a DIFFERENT client already has this phone number, we perform a STRATEGIC MERGE
    if (existing && existing.id !== id) {
      console.log(`🚀 Strategic Merge: Moving data from ${id} to ${existing.id} (colliding phone: ${updates.telephone})`);
      
      // 1. Relink all orders to the existing client
      await insforge.database
        .from('commandes')
        .update({ client_id: existing.id })
        .eq('client_id', id);
        
      // 2. Clear out redundant client
      await deleteClient(id);
      
      // 3. Update the existing client with any other new info (nom, adresse, etc.)
      const { telephone, ...otherUpdates } = updates;
      if (Object.keys(otherUpdates).length > 0) {
        await insforge.database
          .from('clients')
          .update(otherUpdates)
          .eq('id', existing.id);
      }
      return;
    }
  }

  // Standard update if no collision
  const { error } = await insforge.database
    .from('clients')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
};

export const deleteClient = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export interface ClientFidelityStats {
  total_commandes: number;
  total_brut: number;      // All orders
  total_encaisse: number;  // Only livree/terminee
  panier_moyen: number;
  derniere_commande: Date | null;
  segment: 'Diamant 💎' | 'Fidèle ✅' | 'À relancer ⚠️' | 'Nouveau 🆕';
}

export const getClientsWithIntelligence = async (): Promise<(Client & ClientFidelityStats & { identities: string[], locations: string[] })[]> => {
  const [clients, allOrdersResult] = await Promise.all([
    getAllClients(),
    insforge.database.from('commandes').select('*')
  ]);

  const orders = allOrdersResult.data || [];

  // Group clients by normalized phone
  const clientsByPhone: Record<string, Client[]> = {};
  clients.forEach(c => {
    const norm = normalizePhone(c.telephone);
    if (!clientsByPhone[norm]) clientsByPhone[norm] = [];
    clientsByPhone[norm].push(c);
  });

  // Group orders by normalized phone (via their clients)
  const clientToPhoneMap: Record<string, string> = {};
  clients.forEach(c => { clientToPhoneMap[c.id] = normalizePhone(c.telephone); });

  const ordersByPhone: Record<string, Commande[]> = {};
  orders.forEach(o => {
    const phone = clientToPhoneMap[o.client_id];
    if (phone) {
      if (!ordersByPhone[phone]) ordersByPhone[phone] = [];
      ordersByPhone[phone].push(o);
    }
  });

  const uniqueIdentities = Object.keys(clientsByPhone).map(phone => {
    const linkedClients = clientsByPhone[phone];
    const clientOrders = ordersByPhone[phone] || [];
    
    // Aggregate metadata
    const identities = Array.from(new Set(linkedClients.map(lc => lc.nom_complet)));
    const locations = Array.from(new Set(linkedClients.map(lc => lc.commune).filter((c): c is string => !!c)));
    
    // Use the most recent or first client as the primary reference
    const primaryClient = linkedClients[0];

    const total_brut = clientOrders.reduce((acc, o) => acc + (Number(o.montant_total) || 0), 0);
    const settledOrders = clientOrders.filter(o => ['livree', 'terminee'].includes(o.statut_commande?.toLowerCase()));
    const total_encaisse = settledOrders.reduce((acc, o) => acc + (Number(o.montant_total) || 0), 0);
    const total_commandes = clientOrders.length;
    
    let segment: any = 'Nouveau 🆕';
    if (settledOrders.length >= 5 || total_encaisse > 150000) segment = 'Diamant 💎';
    else if (settledOrders.length >= 2) segment = 'Fidèle ✅';
    
    const now = new Date();
    const lastOrderDate = settledOrders.length > 0 ? new Date(settledOrders[0].date_creation) : null;
    if (lastOrderDate && (now.getTime() - lastOrderDate.getTime()) > 60 * 24 * 60 * 60 * 1000) {
      segment = 'À relancer ⚠️';
    }

    return {
      ...primaryClient,
      identities,
      locations,
      total_commandes,
      total_brut,
      total_encaisse,
      panier_moyen: settledOrders.length > 0 ? Math.round(total_encaisse / settledOrders.length) : 0,
      derniere_commande: lastOrderDate,
      segment
    };
  });

  return uniqueIdentities.sort((a, b) => b.total_commandes - a.total_commandes);
};
