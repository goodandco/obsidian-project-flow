import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const vaultPath = process.env.E2E_VAULT_PATH;
  if (!vaultPath) {
    throw new Error(
      'E2E_VAULT_PATH env var is required.\n' +
      'Usage: E2E_VAULT_PATH=/path/to/your/vault npm run test:e2e'
    );
  }

  const resolvedVault = path.resolve(vaultPath);
  console.log(`[e2e] Deploying plugin to vault: ${resolvedVault}`);
  execSync(`node scripts/deploy.mjs "${resolvedVault}"`, { stdio: 'inherit' });
  console.log('[e2e] Deploy complete. Launching tests...');
}
