import { execSync } from 'child_process';

try {
  execSync(`npx -y @insforge/cli db query "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('commandes', 'lignes_commandes', 'clients');"`, { stdio: 'inherit' });
} catch (e) {
  console.error("Failed");
}
