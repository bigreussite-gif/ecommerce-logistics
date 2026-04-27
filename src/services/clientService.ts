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
    .or(`telephone.eq.${phone},telephone_secondaire.eq.${phone}`)
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
  // If we are changing the phone, we must check for collisions (UNIQUE constraint) using normalization
  if (updates.telephone) {
    const targetNorm = normalizePhone(updates.telephone);
    
    // We fetch all and find the collision manually to be sure about normalization consistency
    const all = await getAllClients();
    const existing = all.find(c => c.id !== id && normalizePhone(c.telephone) === targetNorm);
    
    // If a DIFFERENT client already has this phone number, we perform a STRATEGIC MERGE
    if (existing) {
      console.log(`🚀 Strategic Merge: Moving data from ${id} to ${existing.id} (colliding phone: ${updates.telephone})`);
      
      // 1. Relink all orders to the existing client
      await insforge.database
        .from('commandes')
        .update({ client_id: existing.id })
        .eq('client_id', id);
        
      // 2. Update the existing client with any other new info (nom, adresse, etc.)
      const { telephone, ...otherUpdates } = updates;
      if (Object.keys(otherUpdates).length > 0) {
        await insforge.database
          .from('clients')
          .update(otherUpdates)
          .eq('id', existing.id);
      }

      // 3. Clear out redundant client
      await deleteClient(id);
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
  // 1. Fetch only essential columns for performance
  const [clientsResult, ordersResult] = await Promise.all([
    insforge.database.from('clients').select('id, nom_complet, telephone, telephone_secondaire, commune, quartier, adresse'),
    insforge.database.from('commandes').select('client_id, montant_total, statut_commande, date_creation')
  ]);

  const clients = clientsResult.data || [];
  const orders = ordersResult.data || [];

  // 2. Pre-index orders by client_id for O(1) lookup
  const ordersByClientId: Record<string, any[]> = {};
  orders.forEach(o => {
    if (!ordersByClientId[o.client_id]) ordersByClientId[o.client_id] = [];
    ordersByClientId[o.client_id].push(o);
  });

  // 3. Group clients by normalized phone
  const phoneToClientsMap: Record<string, Client[]> = {};
  clients.forEach(c => {
    const norm = normalizePhone(c.telephone);
    if (!phoneToClientsMap[norm]) phoneToClientsMap[norm] = [];
    phoneToClientsMap[norm].push(c as any);
  });

  const now = new Date();
  const sixtyDaysAgo = now.getTime() - 60 * 24 * 60 * 60 * 1000;

  // 4. Process each unique phone identity
  const uniqueIdentities = Object.keys(phoneToClientsMap).map(phone => {
    const linkedClients = phoneToClientsMap[phone];
    
    // Gather all orders for all client_ids linked to this phone
    const clientOrders: any[] = [];
    const identitiesSet = new Set<string>();
    const locationsSet = new Set<string>();

    linkedClients.forEach(lc => {
      identitiesSet.add(lc.nom_complet);
      if (lc.commune) locationsSet.add(lc.commune);
      
      const ordersForThisId = ordersByClientId[lc.id];
      if (ordersForThisId) clientOrders.push(...ordersForThisId);
    });

    // Use the first client record as the base
    const primary = linkedClients[0];

    // Calculate Stats
    let total_brut = 0;
    let total_encaisse = 0;
    let settledCount = 0;
    let lastOrderDate: Date | null = null;

    clientOrders.forEach(o => {
      const montant = Number(o.montant_total) || 0;
      total_brut += montant;
      
      const s = o.statut_commande?.toLowerCase();
      if (['livree', 'terminee'].includes(s)) {
        total_encaisse += montant;
        settledCount++;
        
        const d = new Date(o.date_creation);
        if (!lastOrderDate || d > lastOrderDate) lastOrderDate = d;
      }
    });

    // CRM Segmentation
    let segment: ClientFidelityStats['segment'] = 'Nouveau 🆕';
    if (settledCount >= 5 || total_encaisse > 150000) segment = 'Diamant 💎';
    else if (settledCount >= 2) segment = 'Fidèle ✅';
    
    if (lastOrderDate && (lastOrderDate as Date).getTime() < sixtyDaysAgo) {
      segment = 'À relancer ⚠️';
    }

    return {
      ...primary,
      identities: Array.from(identitiesSet),
      locations: Array.from(locationsSet),
      total_commandes: clientOrders.length,
      total_brut,
      total_encaisse,
      panier_moyen: settledCount > 0 ? Math.round(total_encaisse / settledCount) : 0,
      derniere_commande: lastOrderDate,
      segment
    };
  });

  return uniqueIdentities.sort((a, b) => b.total_encaisse - a.total_encaisse);
};
