import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const cleanId = '53a9f';
  // Attempt to use the computed column 'ref_text'
  const { data, error } = await insforge.database
    .from('commandes')
    .select('id, ref_text')
    .or(`ref_text.ilike.%${cleanId}%`)
    .limit(1);

  console.log("Error:", error);
  console.log("Data:", data);
}
run();
