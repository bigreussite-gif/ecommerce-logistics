import dotenv from 'dotenv';
dotenv.config();

const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/lignes_commandes?select=quantite,commande_id,commandes!inner(id,statut_commande)&produit_id=eq.ecfcb718-dff7-4467-bc5b-4395fb8bcab4&commandes.statut_commande=in.(nouvelle,validee)`;

fetch(url, {
  headers: {
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
  }
}).then(res => res.json()).then(console.log).catch(console.error);
