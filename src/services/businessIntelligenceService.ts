import { Commande, Depense, Produit } from '../types';
import { 
  calculateProfitMetrics, 
  calculateLogisticalStats, 
  calculateProductROI,
  ProfitStats,
  LogisticalStats,
  ProductROI
} from './financialService';

export interface BusinessAlert {
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric?: string;
  action?: string;
}

export interface BusinessHealth {
  score: number; // 0 to 100
  status: 'Critique' | 'Fragile' | 'Stable' | 'Excellent';
  financials: ProfitStats;
  logistics: LogisticalStats;
  topProducts: ProductROI[];
  worstProducts: ProductROI[];
  alerts: BusinessAlert[];
  advice: string[];
}

export const analyzeBusinessHealth = (
  commandes: Commande[], 
  depenses: Depense[], 
  produits: Produit[]
): BusinessHealth => {
  // 1. Calculate base metrics
  const financials = calculateProfitMetrics(commandes as any, depenses);
  const logistics = calculateLogisticalStats(commandes);
  const productRois = calculateProductROI(commandes as any);

  // 2. Derive advanced lists
  const sortedProducts = [...productRois].filter(p => p.ventes_reussies > 0 || p.echecs > 0);
  const topProducts = sortedProducts.slice(0, 5); // Best performing
  const worstProducts = [...sortedProducts].reverse().filter(p => p.profit_net <= 0).slice(0, 5); // Money losers

  // 3. Generate Alerts & Advice (The "Trous" & "Conseils")
  const alerts: BusinessAlert[] = [];
  const advice: string[] = [];

  // Financial Alerts
  if (financials.marge_nette_percent < 10) {
    alerts.push({
      type: 'danger',
      title: 'Marge Nette Critique',
      message: `Votre marge nette est de ${financials.marge_nette_percent}%. L'entreprise génère très peu de vrai profit sur ses ventes.`,
      metric: `${financials.marge_nette_percent}%`,
      action: 'Réduisez vos coûts fixes ou augmentez les prix de vente.'
    });
    advice.push('Analysez d\'urgence vos dépenses fixes (publicité, abonnements) qui rongent votre marge brute.');
  } else if (financials.marge_nette_percent < 25) {
    alerts.push({
      type: 'warning',
      title: 'Marge Nette Faible',
      message: `Votre marge nette est de ${financials.marge_nette_percent}%. Il y a un risque si les frais de publicité ou logistiques augmentent.`,
      metric: `${financials.marge_nette_percent}%`,
      action: 'Optimisez les coûts logistiques.'
    });
  } else {
    alerts.push({
      type: 'success',
      title: 'Excellente Rentabilité',
      message: `Votre marge nette de ${financials.marge_nette_percent}% indique un modèle d'affaires sain.`,
      metric: `${financials.marge_nette_percent}%`
    });
  }

  if (financials.flux_tresorerie < 0) {
    alerts.push({
      type: 'danger',
      title: 'Hémorragie de Trésorerie',
      message: `Il sort plus de cash qu'il n'en rentre (${financials.flux_tresorerie.toLocaleString()} FCFA).`,
      metric: `${financials.flux_tresorerie.toLocaleString()} FCFA`,
      action: 'Bloquez les dépenses non essentielles et relancez les encaissements livreurs.'
    });
    advice.push('Vérifiez si des livreurs ou des partenaires n\'ont pas encore versé les fonds collectés (Écarts de caisse).');
  }

  // Logistics Alerts
  if (logistics.taux_succes > 0 && logistics.taux_succes < 65) {
    alerts.push({
      type: 'danger',
      title: 'Logistique Inefficace (Taux d\'Échec Élevé)',
      message: `Seules ${logistics.taux_succes}% des commandes sorties sont livrées. Les retours vous coûtent cher en frais de transport perdus.`,
      metric: `${logistics.taux_succes}%`,
      action: 'Renforcez la confirmation téléphonique avant expédition.'
    });
    advice.push('Mettez en place une politique stricte : aucune commande ne sort sans confirmation téléphonique le jour même.');
  } else if (logistics.taux_succes >= 80) {
    alerts.push({
      type: 'success',
      title: 'Logistique Performante',
      message: `Taux de livraison réussi de ${logistics.taux_succes}%. Vos livreurs sont efficaces.`,
      metric: `${logistics.taux_succes}%`
    });
  }

  // Product Alerts (Trous dans le catalogue)
  if (worstProducts.length > 0) {
    alerts.push({
      type: 'warning',
      title: 'Produits "Toxiques"',
      message: `${worstProducts.length} produits vous font perdre de l'argent (ROAS ou coût de retour trop élevé).`,
      metric: `${worstProducts.length} Produits`,
      action: 'Stoppez la publicité sur ces produits ou déstockez-les.'
    });
    advice.push(`Le produit "${worstProducts[0].nom}" vous fait perdre de l'argent (ROI: ${worstProducts[0].roi_percent}%). Envisagez de le retirer.`);
  }

  // 4. Calculate Global Health Score (0 - 100)
  // Weighting: 
  // - Margin (Target 30%) -> 40 points
  // - Success Rate (Target 85%) -> 40 points
  // - Cashflow (Positive = 20 points)
  
  let scoreMargin = Math.min((financials.marge_nette_percent / 30) * 40, 40);
  if (scoreMargin < 0) scoreMargin = 0;

  let scoreSuccess = Math.min((logistics.taux_succes / 85) * 40, 40);
  if (logistics.total_sortis === 0) scoreSuccess = 20; // Neutral if no data

  let scoreCash = financials.flux_tresorerie >= 0 ? 20 : 0;
  if (financials.flux_tresorerie > financials.depenses_fixes_total) scoreCash = 25; // Bonus

  let totalScore = Math.round(scoreMargin + scoreSuccess + scoreCash);
  totalScore = Math.max(0, Math.min(100, totalScore));

  let status: BusinessHealth['status'] = 'Excellent';
  if (totalScore < 40) status = 'Critique';
  else if (totalScore < 65) status = 'Fragile';
  else if (totalScore < 85) status = 'Stable';

  if (totalScore >= 85) {
    advice.push('Tout est au vert ! C\'est le moment idéal pour investir dans la croissance (Scale) et tester de nouveaux marchés.');
  }

  return {
    score: totalScore,
    status,
    financials,
    logistics,
    topProducts,
    worstProducts,
    alerts,
    advice
  };
};
