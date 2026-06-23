import { createClient } from '@insforge/sdk';

const insforgeUrl = "https://qt3suekz.eu-central.insforge.app";
const insforgeAnonKey = "ik_eec392fa390ce31a8fe9833700c2cf12";

const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey
});

async function run() {
  const newUser = {
    id: crypto.randomUUID(),
    nom_complet: 'TEST NO VTC',
    email: 'testnovtc@livreur.com',
    role: 'LIVREUR',
    telephone: '987654321',
    actif: true
  };
  const { data, error } = await insforge.database.from('users').insert([newUser]).select();
  console.log("Insert Result:", data);
  if (error) console.error("Insert Error:", error);
}

run();
