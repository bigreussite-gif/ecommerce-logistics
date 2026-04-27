import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const { data, error } = await insforge.database
    .from('depenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error("ERROR depenses:", error);
  } else {
    console.log("SUCCESS depenses:", data?.length);
  }
}
run();
