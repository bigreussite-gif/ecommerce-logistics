import { createClient } from '@insforge/sdk';
const insforge = createClient(process.env.VITE_INSFORGE_URL, process.env.VITE_INSFORGE_ANON_KEY);
async function run() {
  const { data, error } = await insforge.database.from('commandes')
    .select('statut_commande, id')
    .in('statut_commande', ['nouvelle', 'a_rappeler', 'en_attente_appel', 'validee', 'en_cours_livraison']);
  
  if (error) console.error(error);
  
  const counts = {};
  data.forEach(d => {
     counts[d.statut_commande] = (counts[d.statut_commande] || 0) + 1;
  });
  console.log(counts);
}
run();
