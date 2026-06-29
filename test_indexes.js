import { createClient } from '@insforge/sdk';

const insforgeUrl = "https://qt3suekz.eu-central.insforge.app";
const insforgeAnonKey = "ik_eec392fa390ce31a8fe9833700c2cf12";

const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey
});

async function run() {
  const t1 = Date.now();
  const { data, error } = await insforge.database.from('commandes').select('*, clients(*), lignes_commandes(*)').limit(50);
  const t2 = Date.now();
  console.log(`Fetch time: ${t2 - t1}ms`);
  if (error) console.error("Error:", error);
}

run();
