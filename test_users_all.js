import { createClient } from '@insforge/sdk';

const insforgeUrl = "https://qt3suekz.eu-central.insforge.app";
const insforgeAnonKey = "ik_eec392fa390ce31a8fe9833700c2cf12";

const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey
});

async function run() {
  const { data, error } = await insforge.database.from('users').select('*').order('created_at', { ascending: false });
  console.log("Count:", data?.length);
  if (data && data.length > 0) {
    console.log("Top 5:", JSON.stringify(data.slice(0, 5), null, 2));
    const recentVTC = data.find(u => u.type_livreur === 'VTC');
    console.log("Recent VTC:", recentVTC);
  }
  if (error) console.error("Error:", error);
}

run();
