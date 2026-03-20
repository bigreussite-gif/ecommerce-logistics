import { Commande, User } from '../types';
import { insforge } from '../lib/insforge';

export const getAvailableLivreurs = async (): Promise<User[]> => {
  const { data, error } = await insforge.database
    .from('users')
    .select('*')
    .eq('role', 'LIVREUR')
    .eq('actif', true);
  
  if (error) throw error;
  return data || [];
};

export const creerFeuilleRoute = async (livreurId: string, commandeIds: string[]): Promise<string> => {
  const { data: cmdData, error: cmdFetchError } = await insforge.database
    .from('commandes')
    .select('*')
    .in('id', commandeIds);

  if (cmdFetchError) throw cmdFetchError;
  
  const total_montant = cmdData.reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  const communes = Array.from(new Set(cmdData.map(c => c.commune_livraison)));

  const { data: frData, error: frError } = await insforge.database
    .from('feuilles_route')
    .insert([{
      date: new Date(),
      livreur_id: livreurId,
      statut_feuille: 'en_cours',
      communes_couvertes: communes,
      total_commandes: cmdData.length,
      total_montant_theorique: total_montant
    }])
    .select();

  if (frError) throw frError;
  const feuilleId = frData?.[0]?.id;

  for (const cid of commandeIds) {
    const { error } = await insforge.database
      .from('commandes')
      .update({ 
        statut_commande: 'en_cours_livraison', 
        livreur_id: livreurId, 
        feuille_route_id: feuilleId 
      })
      .eq('id', cid);
    
    if (error) throw error;
  }

  return feuilleId;
};

export const getFeuillesRoute = async () => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*, users(*)')
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getCommandesByFeuille = async (feuilleId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*')
    .eq('feuille_route_id', feuilleId);

  if (error) throw error;
  return data || [];
};
