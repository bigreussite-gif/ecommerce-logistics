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

export const DEFAULT_SHIPPING_FEE = 1000;
export const EXTRACTION_LOGISTIQUE = 500;
export const EXTRACTION_ENTRETIEN = 250;
export const EXTRACTION_INTERNET = 300;
export const TOTAL_EXTRACTION_PER_UNIT = EXTRACTION_LOGISTIQUE + EXTRACTION_ENTRETIEN + EXTRACTION_INTERNET; // 1050
export const RETENUE_PERCENT = 0.05;

export interface ProfitStats {
  ca_brut: number;
  ca_net_produits: number;
  cogs_total: number;
  frais_livraison_total: number;
  depenses_fixes_total: number;
  total_extractions: number;
  retenue_charges: number;
  profit_net_brut: number; // Before extractions
  profit_net_reel: number; // After everything
  taux_succes: number;
  marge_brute_percent: number;
  marge_nette_percent: number;
  ca_global_vendu?: number;
  total_sorties?: number;
  cout_achat_total?: number;
  valeur_stock?: number;
  benefice_caisse?: number;
  ads_spend?: number;
  roas?: number;
  cac?: number;
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
  const retours = filtered.filter(c => ['retour_livreur', 'retour_stock', 'retour_client'].includes(c.statut_commande?.toLowerCase())).length;
  const annulees = filtered.filter(c => c.statut_commande?.toLowerCase() === 'annulee').length;
  const reportees = filtered.filter(c => ['echouee', 'absent', 'a_rappeler'].includes(c.statut_commande?.toLowerCase())).length;
  
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
  
  // Failed orders cost us delivery fees (perte logistique)
  // These are orders that were attempted but not delivered.
  const failedCmds = (commandes || []).filter(c => {
    const s = c.statut_commande?.toLowerCase();
    return ['echouee', 'retour_livreur', 'retour_stock', 'absent', 'retour_client'].includes(s);
  });
  
  const ca_brut = terminalCmds.reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  const frais_livraison_reussis = terminalCmds.reduce((acc, c) => acc + (c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : DEFAULT_SHIPPING_FEE), 0);
  const pertes_livraison = failedCmds.reduce((acc, c) => acc + (c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : DEFAULT_SHIPPING_FEE), 0);
  
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
  
  // CA Net = Total received - Shipping Fees
  const ca_net_produits = ca_brut - frais_livraison_reussis;
  
  // Extractions based on number of successful deliveries
  const total_extractions = terminalCmds.length * TOTAL_EXTRACTION_PER_UNIT;
  
  // Retenue based on percentage of net revenue
  const retenue_charges = ca_net_produits > 0 ? Math.round(ca_net_produits * RETENUE_PERCENT) : 0;

  // Profit Net Brut = CA Net - COGS - Dépenses Fixes - Pertes Logistiques
  const profit_net_brut = ca_net_produits - cogs_total - depenses_fixes_total - pertes_livraison;
  
  // Profit Net Réel = Profit Net Brut - Extractions - Retenue
  const profit_net_reel = profit_net_brut - total_extractions - retenue_charges;
  
  const marge_brute_percent = ca_net_produits > 0 ? Math.round(((ca_net_produits - cogs_total) / ca_net_produits) * 100) : 0;
  const marge_nette_percent = ca_net_produits > 0 ? Math.round((profit_net_reel / ca_net_produits) * 100) : 0;

  // Global success rate
  const totalRelevant = (commandes || []).filter(c => ['livree', 'terminee', 'retour_livreur', 'retour_stock', 'echouee', 'absent'].includes(c.statut_commande?.toLowerCase())).length;
  const taux_succes = totalRelevant > 0 ? Math.round((terminalCmds.length / totalRelevant) * 100) : 0;

  return {
    ca_brut,
    ca_net_produits,
    cogs_total,
    frais_livraison_total: frais_livraison_reussis + pertes_livraison,
    depenses_fixes_total,
    total_extractions,
    retenue_charges,
    profit_net_brut,
    profit_net_reel,
    taux_succes,
    marge_brute_percent,
    marge_nette_percent,
    ca_global_vendu: ca_net_produits,
    total_sorties: depenses_fixes_total,
    cout_achat_total: cogs_total,
    benefice_caisse: profit_net_reel
  };
};

export const calculateStockValue = (produits: any[]): number => {
  return produits.reduce((acc, p) => acc + (Number(p.stock_actuel || 0) * Number(p.prix_achat || 0)), 0);
};

// IDEA 1: Marketing ROI Analysis
export const calculateMarketingROI = (revenue: number, ads_spend: number, client_count: number) => {
  const roas = ads_spend > 0 ? Number((revenue / ads_spend).toFixed(2)) : 0;
  const cac = client_count > 0 ? Math.round(ads_spend / client_count) : 0;
  return { roas, cac };
};

// IDEA 2: Predictive Cash Flow (30-day)
export const projectCashFlow = (history: { revenue: number, profit: number }[], current_cash: number) => {
  if (history.length === 0) return { day15: current_cash, day30: current_cash };
  
  const avgProfitPerDay = history.reduce((acc, h) => acc + h.profit, 0) / history.length;
  const day15 = Math.round(current_cash + (avgProfitPerDay * 15));
  const day30 = Math.round(current_cash + (avgProfitPerDay * 30));
  
  return { day15, day30, avg_velocity: Math.round(avgProfitPerDay) };
};

// IDEA 5: Geographical Profitability
export interface GeoProfit {
  commune: string;
  total_commandes: number;
  livrees: number;
  taux_succes: number;
  ca_net: number;
  profit_net: number;
}

export const analyzeGeographicalProfit = (commandes: (Commande & { lignes?: LigneCommande[] })[]): GeoProfit[] => {
  const geoMap: { [key: string]: GeoProfit } = {};

  (commandes || []).forEach(c => {
    const commune = c.commune_livraison || 'Inconnu';
    const s = c.statut_commande?.toLowerCase();
    const isSuccess = ['livree', 'terminee'].includes(s);
    
    if (!geoMap[commune]) {
      geoMap[commune] = {
        commune,
        total_commandes: 0,
        livrees: 0,
        taux_succes: 0,
        ca_net: 0,
        profit_net: 0
      };
    }

    const g = geoMap[commune];
    g.total_commandes++;
    
    if (isSuccess) {
      g.livrees++;
      const shipping = c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : DEFAULT_SHIPPING_FEE;
      const rev = (Number(c.montant_total) || 0) - shipping;
      let cost = 0;
      (c.lignes || []).forEach(l => { cost += (l.quantite * (l.prix_achat_unitaire || 0)); });
      
      const extractions = TOTAL_EXTRACTION_PER_UNIT;
      const retenue = Math.round(rev * RETENUE_PERCENT);

      g.ca_net += rev;
      g.profit_net += (rev - cost - extractions - retenue);
    } else {
      // Failed delivery still costs us something
      const loss = c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : DEFAULT_SHIPPING_FEE;
      g.profit_net -= loss;
    }
  });

  return Object.values(geoMap).map(g => {
    g.taux_succes = Math.round((g.livrees / g.total_commandes) * 100);
    return g;
  }).sort((a, b) => b.profit_net - a.profit_net);
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

    const shipping = c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : DEFAULT_SHIPPING_FEE;
    const rev = (Number(c.montant_total) || 0) - shipping;
    let cost = 0;
    (c.lignes || []).forEach(l => {
      cost += (l.quantite * (l.prix_achat_unitaire || 0));
    });

    const extractions = TOTAL_EXTRACTION_PER_UNIT;
    const retenue = Math.round(rev * RETENUE_PERCENT);

    groups[key].revenue += rev;
    groups[key].profit += (rev - cost - extractions - retenue);
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
          // Loss estimate: if it failed, we likely paid delivery estimated at DEFAULT_SHIPPING_FEE CFA or the order's delivery fee
          const shipping = c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : DEFAULT_SHIPPING_FEE;
          const shareOfFrais = shipping / (c.lignes?.length || 1);
          p.frais_perte_livraison += Math.round(shareOfFrais);
        }
      });
    }
  });

  return Object.values(productMap).map(p => {
    // Basic profit before extractions and retenue per product (hard to split retenue perfectly per line without rounding noise)
    p.profit_net = p.ca_produits - p.cogs - p.frais_perte_livraison;
    // Apply average extractions per unit sold
    p.profit_net -= (p.ventes_reussies * TOTAL_EXTRACTION_PER_UNIT);
    // Apply retention
    p.profit_net -= Math.round(p.ca_produits * RETENUE_PERCENT);
    
    p.roi_percent = p.cogs > 0 ? Math.round((p.profit_net / p.cogs) * 100) : 0;
    return p;
  }).sort((a, b) => b.profit_net - a.profit_net);
};

export const getHourlyDistribution = (commandes: Commande[]) => {
  const hours = Array(24).fill(0);
  (commandes || []).forEach(c => {
    const date = new Date(c.date_creation);
    if (!isNaN(date.getTime())) {
      hours[date.getHours()]++;
    }
  });
  return hours.map((count, hr) => ({ hour: hr, count }));
};
