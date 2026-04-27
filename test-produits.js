import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const { data, error } = await insforge.database
    .from('produits')
    .select('*, categories(nom)')
    .order('nom');

  if (error) {
    console.error("ERROR produits:", error);
  } else {
    console.log("SUCCESS produits:", data?.length);
  }
}
run();
