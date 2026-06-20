import { createClient } from '@insforge/sdk';

const insforge = createClient(
  process.env.VITE_INSFORGE_URL,
  process.env.VITE_INSFORGE_ANON_KEY
);

async function check() {
  const { data: prod, error } = await insforge.database.from('produits').select('id, nom, stock_actuel').ilike('nom', '%Couvre Chaussures%');
  if (error) console.error("Error:", error);
  console.log("Product:", prod);

  if (prod && prod.length > 0) {
    const { data: mvt } = await insforge.database.from('mouvements_stock').select('*').eq('produit_id', prod[0].id).order('date', { ascending: false }).limit(5);
    console.log("Recent movements:", mvt);
    
    // Calculate full stock
    const { data: all_mvt } = await insforge.database.from('mouvements_stock').select('type_mouvement, quantite').eq('produit_id', prod[0].id);
    let calc = 0;
    if (all_mvt) {
      all_mvt.forEach(m => {
         if (m.type_mouvement === 'entree' || m.type_mouvement === 'retour') calc += m.quantite;
         if (m.type_mouvement === 'sortie') calc -= m.quantite;
      });
    }
    console.log("Calculated stock from movements:", calc);
  }
}
check();
