
import { insforge } from './src/lib/insforge';

async function debugProducts() {
  const { data, error } = await insforge.database
    .from('produits')
    .select('id, nom, sku, actif');
  
  if (error) {
    console.error('DB Error:', error);
    return;
  }
  
  console.log('--- PRODUCT CATALOG DEBUG ---');
  console.log('Total Products:', data?.length);
  data?.forEach(p => {
    console.log(`- NAME: "${p.nom}" | SKU: "${p.sku}" | UPPER_SKU: "${(p.sku || '').trim().toUpperCase()}" | ACTIF: ${p.actif}`);
  });
  console.log('-----------------------------');
}

debugProducts();
