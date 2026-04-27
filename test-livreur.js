import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('id, livreur_id, agent_appel_id, livreur:users!commandes_livreur_id_fkey(nom_complet)')
    .limit(1);

  console.log("Error:", error);
  console.log("Data:", data);
}
run();
