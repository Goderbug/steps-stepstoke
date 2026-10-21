// Reproducible validation of source and the production export. Writes actual process results.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
await mkdir("docs/validation/raw", { recursive: true });
const records = [];
const run = async (label, executable, args) => {
  const record = { label, command: [executable, ...args], startedAt: new Date().toISOString() };
  const log = createWriteStream(`docs/validation/raw/${label}-final.log`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    child.on("error", reject); child.on("close", resolve);
  });
  log.end(`\nexit_code=${code}\n`);
  records.push({ ...record, finishedAt: new Date().toISOString(), exitCode: code });
  await writeFile("docs/validation/raw/commands.json", JSON.stringify(records, null, 2));
  console.log(`${label}: exit ${code}`);
  if (code !== 0) process.exit(code ?? 1);
};
await run("typecheck", "npm", ["run", "typecheck"]);
await run("vitest", "npm", ["run", "test:unit", "--", "--reporter=default", "--reporter=json", "--outputFile=docs/validation/raw/vitest.json"]);
await run("build", "npm", ["run", "build"]);
// Bind browser evidence to the exact production export and all executable source/test inputs.
const checked = [];
async function pin(path) {
  const info = await lstat(path);
  assert.ok(!info.isSymbolicLink(), `Unexpected symlink: ${path}`);
  if (info.isDirectory()) for (const child of (await readdir(path)).sort()) await pin(`${path}/${child}`);
  else checked.push({ path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") });
}
for (const path of ["src", "tests", "scripts", "public", "dist", "package.json", "package-lock.json", "index.html", "tsconfig.json", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]) await pin(path);
await run("e2e", process.execPath, ["tests/run-browsers.mjs", ...process.argv.slice(2)]);
for (const row of checked) assert.equal(createHash("sha256").update(await readFile(row.path)).digest("hex"), row.sha256, `Changed during validation: ${row.path}`);
await writeFile("docs/validation/raw/tested-tree.json", JSON.stringify({ recordedAt: new Date().toISOString(), pins: checked }, null, 2) + "\n");
