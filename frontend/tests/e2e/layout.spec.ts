import { disclose, selectFile } from "./actions";
import { test, expect } from "./harness";

test("long identifiers, prose, Markdown code and failed verification reflow at the configured width", async ({ page }, info) => {
  await page.goto("./#/demo/b/fx-branch-1");
  await expect(page.getByRole("heading", { name: "Relay introduction", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem("platform.fixture.v1")!);
    const branch = state.branches.find((b: { id: string }) => b.id === "fx-branch-1");
    branch.projectTitle = "W".repeat(80);
    branch.goal = "longgoal".repeat(128);
    state.proposals[0].requirement = "longrequirement".repeat(512);
    const checkpoint = state.checkpoints.find((c: { id: string }) => c.id === "fx-branch-1:3");
    checkpoint.assets.find((a: { assetKey: string }) => a.assetKey === "site").descriptor.name = "long-filename-".repeat(10) + ".html";
    const notes = checkpoint.assets.find((a: { assetKey: string }) => a.assetKey === "notes");
    const markdown = "# Layout test\n\n```text\n" + "long-code-token".repeat(512) + "\n```\n";
    const bytes = new TextEncoder().encode(markdown);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    notes.descriptor.bytes = bytes.length;
    notes.descriptor.sha256 = "0x" + [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
    state.files[`${notes.producerJobId}:${notes.descriptor.path}`].b64 = btoa(String.fromCharCode(...bytes));
    localStorage.setItem("platform.fixture.v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "W".repeat(80), exact: true })).toBeVisible();
  await selectFile(page, "site");
  await expect(page.getByText("Verified locally · SHA-256, length, media")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await selectFile(page, "notes");
  await expect(page.locator(".md pre")).toContainText("long-code-token".repeat(512));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ scale: "css", path: `../test/scratch/regression-screenshots/${info.project.name}-long-values.jpg`, type: "jpeg", quality: 50 });
  await page.goto("./#/demo/b/fx-branch-sec");
  await selectFile(page, "tampered");
  await expect(page.getByText("SHA-256: Fail", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("static export works beneath a gateway subpath with local metadata and assets", async ({ page, baseURL }) => {
  // The real static preview serves unchanged dist bytes under /preview/.
  await page.goto(`${baseURL}#/configuration`);
  await expect(page.getByRole("heading", { name: "Public projects", exact: true })).toBeVisible();
  await disclose(page, /^Deployment status/);
  await expect(page.getByText("HANDOFF_PRESENT_UNVERIFIED", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("STEPS · Stepstoke · Open Workshop");
  const metadata = await page.locator("meta[property='og:image']").getAttribute("content");
  expect(metadata).toBe("./og.png");
  expect(await page.locator(".brand img").evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const paths = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname));
  expect(paths.filter((path) => /\.(js|css|svg)$/.test(path)).every((path) => path.startsWith("/preview/"))).toBe(true);
  await page.getByRole("link", { name: "Demo", exact: true }).click();
  await expect(page.getByRole("link", { name: "Relay introduction", exact: true })).toBeVisible();
});
