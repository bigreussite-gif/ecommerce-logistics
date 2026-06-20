import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const insforge = createClient(
  process.env.VITE_INSFORGE_URL!,
  process.env.VITE_INSFORGE_ANON_KEY!
);

async function check() {
  const { data: prod } = await insforge.from('produits').select('id, nom, stock_actuel').ilike('nom', '%Couvre Chaussures%');
  console.log("Product:", prod);

  if (prod && prod.length > 0) {
    const { data: mvt } = await insforge.from('mouvements_stock').select('*').eq('produit_id', prod[0].id).order('date', { ascending: false }).limit(5);
    console.log("Recent movements:", mvt);
  }
}
check();
