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

export interface LogisticalStats {
  total_sortis: number;
  livrees: number;
  retours: number;
  annulees: number;
  reportees: number;
  taux_succes: number;
}

export interface ProductROI {
  id: string;
  nom: string;
  ventes_reussies: number;
  echecs: number;
  ca_produits: number;
  cogs: number;
  frais_perte_livraison: number;
  profit_net: number;
  roi_percent: number;
}

export const calculateLogisticalStats = (commandes: Commande[]): LogisticalStats => {
  const filtered = (commandes || []);
  
  const livrees = filtered.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).length;
  const retours = filtered.filter(c => ['retour_livreur', 'retour_stock'].includes(c.statut_commande?.toLowerCase())).length;
  const annulees = filtered.filter(c => c.statut_commande?.toLowerCase() === 'annulee').length;
  const reportees = filtered.filter(c => c.statut_commande?.toLowerCase() === 'echouee').length;
  
  const total_sortis = livrees + retours + annulees + reportees;
  const taux_succes = total_sortis > 0 ? Math.round((livrees / total_sortis) * 100) : 0;
  
  return {
    total_sortis,
    livrees,
    retours,
    annulees,
    reportees,
    taux_succes
  };
};

export const calculateProfitMetrics = (commandes: (Commande & { lignes?: LigneCommande[] })[], depenses: Depense[]): ProfitStats => {
  const terminalCmds = (commandes || []).filter(c => {
    const s = c.statut_commande?.toLowerCase();
    return ['livree', 'terminee'].includes(s);
  });
  
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
  const terminalCmds = (commandes || []).filter(c => {
    const s = c.statut_commande?.toLowerCase();
    return ['livree', 'terminee'].includes(s);
  });
  const groups: { [key: string]: { name: string, revenue: number, profit: number } } = {};

  terminalCmds.forEach(c => {
    // Favor actual delivery date if available, otherwise fallback to creation date
    const date = new Date(c.date_livraison_effective || c.date_creation);
    let key = 'Inconnu';
    try {
      if (!isNaN(date.getTime())) {
        key = type === 'daily' 
          ? format(date, 'dd/MM') 
          : format(date, 'MMM', { locale: fr });
      }
    } catch (e) {
      console.warn("Invalid date in commande:", c.id);
    }

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

export const calculateProductROI = (commandes: (Commande & { lignes?: LigneCommande[] })[]): ProductROI[] => {
  const productMap: { [id: string]: ProductROI } = {};

  (commandes || []).forEach(c => {
    const s = c.statut_commande?.toLowerCase();
    const isSuccess = ['livree', 'terminee'].includes(s);
    const isFailure = ['echouee', 'retour_livreur', 'retour_stock'].includes(s);

    if (c.lignes) {
      c.lignes.forEach(l => {
        if (!productMap[l.produit_id]) {
          productMap[l.produit_id] = {
            id: l.produit_id,
            nom: l.nom_produit,
            ventes_reussies: 0,
            echecs: 0,
            ca_produits: 0,
            cogs: 0,
            frais_perte_livraison: 0,
            profit_net: 0,
            roi_percent: 0
          };
        }

        const p = productMap[l.produit_id];
        if (isSuccess) {
          p.ventes_reussies += l.quantite;
          p.ca_produits += (l.quantite * l.prix_unitaire);
          p.cogs += (l.quantite * (l.prix_achat_unitaire || 0));
        } else if (isFailure) {
          p.echecs += l.quantite;
          // Loss estimate: if it failed, we likely paid delivery estimated at 1000 CFA or the order's delivery fee
          const shareOfFrais = (Number(c.frais_livraison) || 1000) / (c.lignes?.length || 1);
          p.frais_perte_livraison += Math.round(shareOfFrais);
        }
      });
    }
  });

  return Object.values(productMap).map(p => {
    p.profit_net = p.ca_produits - p.cogs - p.frais_perte_livraison;
    p.roi_percent = p.cogs > 0 ? Math.round((p.profit_net / p.cogs) * 100) : 0;
    return p;
  }).sort((a, b) => b.profit_net - a.profit_net);
};
