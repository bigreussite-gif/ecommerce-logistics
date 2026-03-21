import { insforge } from '../lib/insforge';
import { Depense, Commande, LigneCommande } from '../types';

export const getDepenses = async (): Promise<Depense[]> => {
  const { data, error } = await insforge.database
    .from('depenses')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const addDepense = async (depense: Omit<Depense, 'id'>): Promise<void> => {
  const { error } = await insforge.database
    .from('depenses')
    .insert([depense]);
  
  if (error) throw error;
};

export const deleteDepense = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('depenses')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export interface ProfitStats {
  ca_brut: number;
  cogs_total: number;
  frais_livraison_total: number;
  depenses_fixes_total: number;
  profit_net: number;
  marge_brute_percent: number;
  marge_nette_percent: number;
}

export const calculateProfitMetrics = (commandes: (Commande & { lignes?: LigneCommande[] })[], depenses: Depense[]): ProfitStats => {
  const deliveredCmds = commandes.filter(c => c.statut_commande === 'livree');
  
  const ca_brut = deliveredCmds.reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  
  // Calculate COGS (Cost of Goods Sold)
  let cogs_total = 0;
  deliveredCmds.forEach(c => {
    if (c.lignes) {
      c.lignes.forEach(l => {
        cogs_total += (l.quantite * (l.prix_achat_unitaire || 0));
      });
    }
  });

  const frais_livraison_total = deliveredCmds.reduce((acc, c) => acc + (Number(c.frais_livraison) || 0), 0);
  const depenses_fixes_total = depenses.reduce((acc, d) => acc + (Number(d.montant) || 0), 0);
  
  const marge_brute = ca_brut - cogs_total;
  const profit_net = marge_brute - depenses_fixes_total;
  
  const marge_brute_percent = ca_brut > 0 ? Math.round((marge_brute / ca_brut) * 100) : 0;
  const marge_nette_percent = ca_brut > 0 ? Math.round((profit_net / ca_brut) * 100) : 0;

  return {
    ca_brut,
    cogs_total,
    frais_livraison_total,
    depenses_fixes_total,
    profit_net,
    marge_brute_percent,
    marge_nette_percent
  };
};
