
import { insforge } from './src/lib/insforge';

async function checkProducts() {
  const { data, error } = await insforge.database
    .from('produits')
    .select('nom, sku')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Products:', JSON.stringify(data, null, 2));
  }
}

checkProducts();
