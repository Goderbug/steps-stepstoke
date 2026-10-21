// Reproducible clean build and strict verification. Never refreshes fingerprints or settings.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
for (const [command, args] of [['forge', ['build', '--offline', '--force']], [process.execPath, ['tools/check-release.mjs']]]) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
