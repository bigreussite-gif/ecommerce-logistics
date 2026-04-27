import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const startDate = "2026-04-01T00:00:00.000Z";
  const endDate = "2026-04-30T23:59:59.999Z";
  const start = `"${startDate}"`;
  const end = `"${endDate}"`;

  let query = insforge.database
    .from('lignes_commandes')
    .select('*, commandes!inner(statut_commande, date_creation, date_livraison_effective)');

  query = query.or(`and(date_livraison_effective.gte.${start},date_livraison_effective.lte.${end}),and(date_livraison_effective.is.null,date_creation.gte.${start},date_creation.lte.${end})`, { foreignTable: 'commandes' });

  const { data, error } = await query;

  if (error) {
    console.error("ERROR top:", error);
  } else {
    console.log("SUCCESS top:", data?.length);
  }
}
run();
