import { createClient } from '@insforge/sdk';

const insforgeUrl = "https://qt3suekz.eu-central.insforge.app";
const insforgeAnonKey = "ik_eec392fa390ce31a8fe9833700c2cf12";
const insforge = createClient({ baseUrl: insforgeUrl, anonKey: insforgeAnonKey });

async function run() {
  const { data, error } = await insforge.auth.signInWithPassword({
    email: '0000000000@livreur.com', // fake email
    password: 'wrong'
  });
  console.log("Auth error:", error);
}

run();
