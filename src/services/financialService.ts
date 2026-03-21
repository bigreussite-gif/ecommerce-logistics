import { insforge } from '../lib/insforge';
import { Depense, Commande, LigneCommande } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const terminalCmds = (commandes || []).filter(c => ['livree', 'terminee'].includes(c.statut_commande));
  
  const ca_brut = terminalCmds.reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  const frais_livraison_total = terminalCmds.reduce((acc, c) => acc + (Number(c.frais_livraison) || 0), 0);
  
  // Calculate COGS (Cost of Goods Sold)
  let cogs_total = 0;
  terminalCmds.forEach(c => {
    if (c.lignes) {
      c.lignes.forEach(l => {
        cogs_total += (l.quantite * (l.prix_achat_unitaire || 0));
      });
    }
  });

  const depenses_fixes_total = (depenses || []).reduce((acc, d) => acc + (Number(d.montant) || 0), 0);
  
  // Profit Net = (Revenue total - Frais Livraison) - COGS - Dépenses fixes
  // Note: On soustrait les frais de livraison car ils sont reversés aux livreurs ou couvrent l'essence
  const ca_produits = ca_brut - frais_livraison_total;
  const marge_brute = ca_produits - cogs_total;
  const profit_net = marge_brute - depenses_fixes_total;
  
  const marge_brute_percent = ca_produits > 0 ? Math.round((marge_brute / ca_produits) * 100) : 0;
  const marge_nette_percent = ca_produits > 0 ? Math.round((profit_net / ca_produits) * 100) : 0;

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

export const generateTimeSeriesData = (commandes: (Commande & { lignes?: LigneCommande[] })[], type: 'daily' | 'monthly' = 'daily') => {
  const terminalCmds = (commandes || []).filter(c => ['livree', 'terminee'].includes(c.statut_commande));
  const groups: { [key: string]: { name: string, revenue: number, profit: number } } = {};

  terminalCmds.forEach(c => {
    const date = new Date(c.date_creation);
    const key = type === 'daily' 
      ? format(date, 'dd/MM') 
      : format(date, 'MMM', { locale: fr });

    if (!groups[key]) {
      groups[key] = { name: key, revenue: 0, profit: 0 };
    }

    const rev = (Number(c.montant_total) || 0) - (Number(c.frais_livraison) || 0);
    let cost = 0;
    (c.lignes || []).forEach(l => {
      cost += (l.quantite * (l.prix_achat_unitaire || 0));
    });

    groups[key].revenue += rev;
    groups[key].profit += (rev - cost);
  });

  return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
};
