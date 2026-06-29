import { execSync } from 'child_process';

const queries = [
  "CREATE INDEX IF NOT EXISTS idx_cmd_client ON public.commandes(client_id);",
  "CREATE INDEX IF NOT EXISTS idx_cmd_fr ON public.commandes(feuille_route_id);",
  "CREATE INDEX IF NOT EXISTS idx_cmd_livreur ON public.commandes(livreur_id);",
  "CREATE INDEX IF NOT EXISTS idx_cmd_statut ON public.commandes(statut_commande);",
  "CREATE INDEX IF NOT EXISTS idx_cmd_date ON public.commandes(date_commande DESC);",
  "CREATE INDEX IF NOT EXISTS idx_lcmd_cmd ON public.lignes_commandes(commande_id);",
  "CREATE INDEX IF NOT EXISTS idx_lcmd_prod ON public.lignes_commandes(produit_id);",
  "CREATE INDEX IF NOT EXISTS idx_mvt_prod ON public.mouvements_stock(produit_id);",
  "CREATE INDEX IF NOT EXISTS idx_mvt_date ON public.mouvements_stock(date_mouvement DESC);",
  "CREATE INDEX IF NOT EXISTS idx_clients_tel ON public.clients(telephone);",
  "CREATE INDEX IF NOT EXISTS idx_appels_cmd ON public.appels_commandes(commande_id);",
  "CREATE INDEX IF NOT EXISTS idx_appels_agent ON public.appels_commandes(agent_id);"
];

for (const q of queries) {
  try {
    console.log(`Running: ${q}`);
    execSync(`npx -y @insforge/cli db query "${q}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed on query: ${q}`);
  }
}

execSync(`npx -y @insforge/cli db query "NOTIFY pgrst, 'reload schema';"`, { stdio: 'inherit' });
console.log("Indexes creation complete!");
