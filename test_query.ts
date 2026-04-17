import { insforge } from './src/lib/insforge';

async function test() {
  const startDate = "2020-01-01T00:00:00Z";
  const endDate = new Date().toISOString();
  const terminalStats = '(livree,terminee,echouee,retour_livreur,retour_stock,annulee,retour_client)';
  
  const filterString = `and(date_livraison_effective.gte.${startDate},date_livraison_effective.lte.${endDate}),and(updated_at.gte.${startDate},updated_at.lte.${endDate},statut_commande.in.${terminalStats})`;
  
  console.log("Filter string:", filterString);
  
  try {
    const { data: orders, error: orderError } = await insforge.database
      .from('commandes')
      .select('id, statut_commande, updated_at')
      .or(filterString)
      .limit(5); // Limit for testing

    if (orderError) {
      console.error("Order Error:", orderError);
    } else {
      console.log("Success! Found", orders?.length, "orders.");
    }
  } catch (err) {
    console.error("Global Error:", err);
  }
}

test();
