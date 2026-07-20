import { InsForge } from '@insforge/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {} as any);

class TestInsForge extends InsForge {
  constructor(url: string, key: string) {
    super(url, key);
  }
}

async function run() {
  const url = env.VITE_INSFORGE_URL;
  const key = env.VITE_INSFORGE_ANON_KEY;
  console.log("URL:", url);
  const response = await fetch(`${url}/rest/v1/mouvements_stock?select=*&order=date.desc&limit=5`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
