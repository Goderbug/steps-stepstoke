// Pins the actual checked source/export and job observations, without modifying Git metadata.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, stat, writeFile } from "node:fs/promises";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const entries = [];
async function pin(path) {
  const metadata = await lstat(path);
  assert.ok(!metadata.isSymbolicLink(), `Symlink is not a complete source/runtime asset: ${path}`);
  if (metadata.isDirectory()) {
    for (const name of (await readdir(path)).sort()) await pin(`${path}/${name}`);
  } else {
    const bytes = await readFile(path);
    entries.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
}
for (const path of ["src", "tests", "scripts", "public", "dist", "package.json", "package-lock.json", "index.html", "tsconfig.json", "vite.config.ts", "vitest.config.ts", "playwright.config.ts", "README.md", "DESIGN.md", "REVIEW.md", "docs/A1-HANDOFF.md", "docs/validation/README.md", "docs/licenses"]) await pin(path);
entries.sort((a, b) => a.path.localeCompare(b.path));
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const tested = await json("docs/validation/raw/tested-tree.json");
for (const row of tested.pins) assert.equal(sha(await readFile(row.path)), row.sha256, `Changed since final validation; rebuild/retest first: ${row.path}`);
const commands = await json("docs/validation/raw/commands.json");
assert.equal(commands.length, 4);
assert.ok(commands.every((record) => record.exitCode === 0));
const unit = await json("docs/validation/raw/vitest.json");
const browser = await json("docs/validation/raw/e2e.json");
assert.equal(unit.numFailedTests, 0);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
const auditFiles = (await readdir("docs/validation/browser")).filter((name) => name.endsWith(".json")).sort();
const audits = await Promise.all(auditFiles.map((name) => json(`docs/validation/browser/${name}`)));
assert.equal(audits.length, browser.stats.expected);
assert.ok(audits.every((row) => row.status === "passed" && row.horizontalOverflow === 0 && row.pageErrors.length === 0 && row.externalAttempts.length === 0 && row.httpErrors.length === 0 && row.unexpectedConsoleErrors.length === 0));
const probe = await json("docs/validation/probe/taste.json");
assert.ok(probe.checks.every((check) => check.passed));
const design = await json("docs/validation/raw/design-measurements.json");
assert.equal(design.status, "passed");
const a1Path = "docs/validation/raw/a1-final.json";
const a1 = await json(a1Path);
const a1Source = await json("docs/validation/raw/a1-source-pins.json");
assert.equal(a1.delivery.repoUrl, a1Source.repo);
assert.equal(a1.delivery.commit, a1Source.commit);
assert.equal(a1Source.release.productionDeployment, null);
assert.equal(a1Source.release.productionReady, false);
const protectedPaths = ["package.json", "package-lock.json", "foundry.toml", "foundry.lock", "remappings.txt", ".gitmodules", "lib/", "vite.config.ts", "tsconfig.json", "vitest.config.ts", ".github/"];
const changedProtected = execFileSync("git", ["diff", "--name-only", "HEAD", "--", ...protectedPaths], { encoding: "utf8" }).trim();
assert.equal(changedProtected, "", "Protected configuration/dependencies changed");
const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const perProject = {};
for (const row of audits) {
  perProject[row.engine] ??= { viewport: row.viewport, passed: 0 };
  perProject[row.engine].passed++;
}
const candidates = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
let otherBytes = 0, fileCount = 0;
for (const path of new Set(candidates)) {
  if (path === "docs/validation/release.json" || path.startsWith(".imd/") || path.startsWith("test/scratch/") || path.split("/").some((part) => part === "node_modules" || part === ".git" || part.startsWith(".env"))) continue;
  try { const info = await stat(path); if (info.isFile()) { otherBytes += info.size; fileCount++; } }
  catch (error) { if (error.code !== "ENOENT") throw error; } // Deleted old hashed dist assets are not shipped.
}
const release = {
  workerEvidenceOnly: true,
  generatedAt: new Date().toISOString(),
  w1BaseCommit: baseCommit,
  finalDeliveryCommit: null,
  note: "The network assigns the delivery commit. These SHA-256 pins identify the actual tested working-tree source and export.",
  integrationStatus: "A1_INTEGRATION_PENDING",
  a1: {
    job: "https://api.imd.fun/jobs/d5530989-b886-4f9d-80dd-44d26d85ffd2",
    observedAt: (await stat(a1Path)).mtime.toISOString(),
    state: a1.state, delivery: a1.delivery, projectHead: a1.project?.head ?? null,
    submittedBodySha256FromAssignment: "3683b19c9c39d67b5c679641e4755e7914f471fe41329d1a3b2dfb1a34a58c77",
    submittedBodyPinVerification: "NOT_RUN: no exact submitted-body artifact supplied by public job metadata",
    actualRepo: a1Source.repo, actualCommit: a1Source.commit, importedFiles: [],
    inspectedFiles: { path: "docs/validation/raw/a1-source-pins.json", sha256: sha(await readFile("docs/validation/raw/a1-source-pins.json")) },
    localChain: "NOT_RUN: W1 browser adapter is not bridged to A1", mainnet: "NOT_RUN",
    dependencyReplay: { scope: "Unmodified A1 SDK/contract harness only; not W1 integration", report: "docs/validation/raw/a1-core-local-replay.json", sha256: sha(await readFile("docs/validation/raw/a1-core-local-replay.json")) },
    response: { path: a1Path, sha256: sha(await readFile(a1Path)) },
  },
  checks: {
    commands, unit: { passed: unit.numPassedTests, failed: unit.numFailedTests },
    browsers: { frameworkVersion: browser.config.version, ...browser.stats, perProject, expectedSecurityDenials: audits.reduce((n, row) => n + row.expectedSecurityBlocks.length, 0) },
    taste: { passed: probe.checks.filter((check) => check.passed).length, total: probe.checks.length },
    designSample: { passed: true, ratios: design.measurements.map((row) => ({ name: row.name, ratio: row.ratio })) },
    protectedConfigurationUnchanged: true,
    testedTree: { path: "docs/validation/raw/tested-tree.json", sha256: sha(await readFile("docs/validation/raw/tested-tree.json")) },
  },
  pins: entries,
  bundle: { fileCount: fileCount + 1, bytes: 0, limit: 8388608 },
};
let encoded;
for (let i = 0; i < 3; i++) { encoded = JSON.stringify(release, null, 2) + "\n"; release.bundle.bytes = otherBytes + Buffer.byteLength(encoded); }
encoded = JSON.stringify(release, null, 2) + "\n";
assert.ok(release.bundle.bytes <= release.bundle.limit, `Submission exceeds 8 MiB: ${release.bundle.bytes}`);
await writeFile("docs/validation/release.json", encoded);
console.log(JSON.stringify({ integration: release.integrationStatus, unitPassed: release.checks.unit.passed, browserPassed: browser.stats.expected, tastePassed: release.checks.taste.passed, bundle: release.bundle }, null, 2));
