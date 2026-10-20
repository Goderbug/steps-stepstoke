import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('abi/', root), { recursive: true });
for (const name of ['RelayFactory', 'RelayBranch', 'RelayEncoder', 'RelayVerifier', 'IIntake']) {
  const artifact = JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root), 'utf8'));
  await writeFile(new URL(`abi/${name}.json`, root), JSON.stringify(artifact.abi, null, 2) + '\n');
}
