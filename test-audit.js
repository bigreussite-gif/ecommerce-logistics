import { createClient } from '@insforge/sdk';
import { calculateProfitMetrics, generateTimeSeriesData } from './src/services/financialService.ts';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const startDate = "2026-04-01T00:00:00.000Z";
  const endDate = "2026-04-30T23:59:59.999Z";
  const terminalStats = '(livree,terminee,echouee,retour_livreur,retour_stock,annulee,retour_client)';
  const start = `"${startDate}"`;
  const end = `"${endDate}"`;

  const filterString = `and(date_livraison_effective.gte.${start},date_livraison_effective.lte.${end}),and(updated_at.gte.${start},updated_at.lte.${end},statut_commande.in.${terminalStats})`;
  
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone), lignes:lignes_commandes(*, produits(prix_achat))')
    .or(filterString)
    .order('date_creation', { ascending: false });
    
  if (orderError) throw orderError;
  
  const { data: expenses, error: expError } = await insforge.database
    .from('depenses')
    .select('*')
    .order('date', { ascending: false });

  if (expError) throw expError;

  console.log(`Fetched ${orders.length} orders and ${expenses.length} expenses.`);

  try {
    const metrics = calculateProfitMetrics(orders, expenses);
    console.log("Metrics success", Object.keys(metrics).length);
  } catch (err) {
    console.error("calculateProfitMetrics Error:", err.message);
  }

  try {
    const timeseries = generateTimeSeriesData(orders, expenses, 'daily');
    console.log("Timeseries success", timeseries.length);
  } catch (err) {
    console.error("generateTimeSeriesData Error:", err.message);
  }
}
run();
