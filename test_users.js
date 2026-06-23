import { createClient } from '@insforge/sdk';

const insforgeUrl = "https://qt3suekz.eu-central.insforge.app";
const insforgeAnonKey = "ik_eec392fa390ce31a8fe9833700c2cf12";

const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey
});

async function run() {
  const { data, error } = await insforge.database.from('users').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Users:", JSON.stringify(data, null, 2));
  if (error) console.error("Error:", error);
}

run();
