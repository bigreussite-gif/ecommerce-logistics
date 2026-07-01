import { insforge } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

insforge.init(process.env.VITE_INSFORGE_PROJECT_URL, process.env.VITE_INSFORGE_API_KEY);

async function run() {
  const { data, error } = await insforge.database.from('mouvements_stock').select('*').limit(5);
  console.log("Mouvements:", data);
  console.log("Error:", error);
}
run();
