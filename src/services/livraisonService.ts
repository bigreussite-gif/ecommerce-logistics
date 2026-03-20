import { Commande, FeuilleRoute } from '../types';
import { insforge } from '../lib/insforge';

export const getCurrentFeuilleRoute = async (livreurId: string): Promise<FeuilleRoute | null> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*')
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
    .select('*')
    .eq('feuille_route_id', feuilleRouteId);

  if (error) throw error;
  return data || [];
};

export const markCommandeLivre = async (commandeId: string, montantEncaisse: number, notesRetours: string): Promise<void> => {
  const { error } = await insforge.database
    .from('commandes')
    .update({ 
      statut_commande: 'livree', 
      date_livraison_effective: new Date(), 
      montant_encaisse: montantEncaisse, 
      notes_livreur: notesRetours 
    })
    .eq('id', commandeId);
  
  if (error) throw error;
};

export const markCommandeEchouee = async (commandeId: string, motif: string): Promise<void> => {
  const { error } = await insforge.database
    .from('commandes')
    .update({ 
      statut_commande: 'echouee', 
      notes_livreur: motif 
    })
    .eq('id', commandeId);
  
  if (error) throw error;
};
