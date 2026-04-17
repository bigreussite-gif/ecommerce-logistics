import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qt3suekz.eu-central.insforge.app';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDkxMTR9.tn9QKXXIqU9-8vdFwCZ2ry96ft5iEuwhg98Yi52dXxo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const startDate = "2020-01-01T00:00:00Z";
  const endDate = new Date().toISOString();
  const terminalStats = '(livree,terminee,echouee,retour_livreur,retour_stock,annulee,retour_client)';
  
  const filterString = `and(date_livraison_effective.gte.${startDate},date_livraison_effective.lte.${endDate}),and(updated_at.gte.${startDate},updated_at.lte.${endDate},statut_commande.in.${terminalStats})`;
  
  console.log("Testing filter:", filterString);
  
  const { data, error } = await supabase
    .from('commandes')
    .select('id')
    .or(filterString)
    .limit(5);

  if (error) {
    console.error("FAILED! Error:", error);
  } else {
    console.log("SUCCESS! Result count:", data?.length);
  }
}

test();
