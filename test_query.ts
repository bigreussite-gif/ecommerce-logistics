import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function test() {
  const start = '2026-03-20T00:00:00Z';
  const end = '2026-03-31T23:59:59Z';
  const { data, error } = await insforge.database
    .from('lignes_commandes')
    .select('id, nom_produit, commandes!inner(statut_commande, date_creation, date_livraison_effective)')
    .or(`and(date_livraison_effective.gte.${start},date_livraison_effective.lte.${end}),and(date_livraison_effective.is.null,date_creation.gte.${start},date_creation.lte.${end})`, { foreignTable: 'commandes' });
    
  console.log('Error:', error);
  console.log('Result Count:', data?.length);
  if (data && data.length > 0) {
    console.log('Sample Row:', JSON.stringify(data[0], null, 2));
  }
}

test();
