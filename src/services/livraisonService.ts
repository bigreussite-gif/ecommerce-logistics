import { updateCommandeStatus } from './commandeService';
import { Commande, FeuilleRoute } from '../types';
import { insforge } from '../lib/insforge';

export const getCurrentFeuilleRoute = async (livreurId: string): Promise<FeuilleRoute | null> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*').limit(100000)
    .eq('livreur_id', livreurId)
    .eq('statut_feuille', 'en_cours')
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const getCommandesForFeuille = async (feuilleRouteId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone, telephone_secondaire).limit(100000), lignes_commandes(*)').limit(100000)
    .eq('feuille_route_id', feuilleRouteId);

  if (error) throw error;
  
  return (data || []).map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone,
    telephone_secondaire: c.clients?.telephone_secondaire,
    lignes: c.lignes_commandes || []
  }));
};

export const markCommandeLivre = async (commandeId: string, notesRetours: string): Promise<void> => {
  await updateCommandeStatus(commandeId, 'livree', {
    date_livraison_effective: new Date(),
    notes_livreur: notesRetours
  });
};

export const markCommandeEchouee = async (commandeId: string, motif: string): Promise<void> => {
  await updateCommandeStatus(commandeId, 'echouee', {
    notes_livreur: motif
  });
};
