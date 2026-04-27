import { createClient } from '@insforge/sdk';

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
  
  console.log("Filter string:", filterString);
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone), lignes:lignes_commandes(*, produits(prix_achat))')
    .or(filterString)
    .order('date_creation', { ascending: false });

  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("SUCCESS:", data?.length);
  }
}
run();
