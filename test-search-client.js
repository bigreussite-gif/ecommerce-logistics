import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: 'https://qt3suekz.eu-central.insforge.app',
  anonKey: 'ik_eec392fa390ce31a8fe9833700c2cf12'
});

async function run() {
  const cleanId = 'soro';
  // Attempt to use the computed column 'ref_text' and embedded fields
  const { data, error } = await insforge.database
    .from('commandes')
    .select('id, ref_text, clients!inner(nom_complet, telephone)')
    .or(`ref_text.ilike.%${cleanId}%,clients.nom_complet.ilike.%${cleanId}%,clients.telephone.ilike.%${cleanId}%`)
    .limit(1);

  console.log("Error:", error);
  console.log("Data:", data);
}
run();
