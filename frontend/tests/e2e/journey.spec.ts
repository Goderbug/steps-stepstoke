import { funding, prepare, disclose, demoSettings, failureControls, selectFile, selectRound, identity } from "./actions";
import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { test, expect } from "./harness";
import { PNG_AMBER_B64 } from "../../src/domain/fixtures";

async function demo(page: Page, hash = "#/demo") {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByText("Demo mode").first()).toBeVisible();
  await demoSettings(page);
  if (hash.includes("/b/")) { await failureControls(page); await disclose(page, /^Complete asset table|^Branch, network|^Proposal details/); }
}
const form = (page: Page) => page.getByRole("dialog", { name: "Prepare a contribution" });
async function propose(page: Page, kind: string, key: string, requirement: string, update = false, inputs: string[] = []) {
  const f = await prepare(page);
  await f.getByRole("combobox", { name: "Type", exact: true }).selectOption(kind);
  await f.getByLabel(update ? "Update" : "Create", { exact: true }).check();
  if (update) await f.getByRole("combobox", { name: "Target asset", exact: true }).selectOption(key);
  else await f.getByLabel("New asset name").fill(key);
  for (const input of inputs) await f.getByRole("checkbox", { name: new RegExp(`^${input} ·`) }).check();
  await f.getByRole("textbox", { name: /^Requirement/ }).fill(requirement);
  await f.getByRole("button", { name: "Review proposal" }).click();
  if (kind === "html") await expect(f.getByText("Publication", { exact: true }).locator(".." )).toContainText("Off");
  await f.getByRole("button", { name: "Sign and submit proposal" }).dblclick();
  await expect(page.getByRole("dialog", { name: "Prepare a contribution" })).toHaveCount(0);
}
async function sponsor(page: Page, title: string, parent: string | null) {
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("accepted");
  const row = page.locator("#proposals > ul > li", { hasText: title });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await expect(funding(page).getByText("IMD action / parent", { exact: true }).locator("..")).toContainText(parent ? `job.continue / ${parent}` : "job.open / None; first execution");
  await expect(funding(page).getByText("Approval spender", { exact: true }).locator("..")).toContainText(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("platform.fixture.v1")!); return s.branches.find((b: {id:string}) => b.id === location.hash.split("/").at(-1)).address; }));
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).dblclick();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Binding" })).toContainText("Confirmed");
}

test("two accounts execute all six functions with downloaded HTML-image-HTML retention and a historical fork", async ({ page }, info) => {
  await demo(page);
  const walletRequests = await page.evaluate(() => {
    (window as unknown as { __walletCalls: string[] }).__walletCalls = [];
    Object.defineProperty(window, "ethereum", { configurable: true, value: { request: ({ method }: { method: string }) => { (window as unknown as { __walletCalls: string[] }).__walletCalls.push(method); throw new Error("Demo must not use the real wallet"); } } });
    return 0;
  });
  expect(walletRequests).toBe(0);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Project title", { exact: true }).fill("Two account retention journey");
  await page.getByLabel("Fixed goal (cannot change after creation)").fill("Build an HTML page with a cover, history and notes.");
  await page.getByRole("button", { name: "Review creation" }).click();
  await page.getByRole("button", { name: "Sign and create" }).dblclick();
  await page.getByRole("link", { name: "Open project", exact: true }).click();
  const branchId = page.url().split("/b/")[1];
  await expect(page.getByRole("heading", { name: "Two account retention journey", exact: true })).toBeVisible();
  await expect(page.getByText("The first output starts here", { exact: false })).toBeVisible();
  await expect(page.locator("#progress > ul > li")).toHaveCount(0);
  // A proposes; B explicitly sponsors the older of two current proposals.
  await propose(page, "html", "landing", "First round page with original markers.");
  await propose(page, "document", "alternative", "Another eligible proposal remains selectable.");
  await expect(page.locator("#proposals .tag-accent", { hasText: "Eligible" })).toHaveCount(2);
  await identity(page, "Demo signing account", "1");
  await sponsor(page, "Create HTML page · landing", null);
  await selectRound(page, 1);
  await expect(page.getByRole("heading", { name: "Round 1 output", exact: true })).toBeVisible();

  const evidence: object[] = [];
  await mkdir("../docs/validation/platform-ux-v1/final/fixtures/files", { recursive: true });
  const download = async (key: string, revision: number, ext: string) => {
    const row = page.locator("#assets");
    await selectFile(page, key);
    await expect(row.getByText("Verified locally · SHA-256, length, media")).toBeVisible();
    const pending = page.waitForEvent("download");
    await row.getByRole("link", { name: "Download verified file" }).click();
    const d = await pending;
    const path = `../docs/validation/platform-ux-v1/final/fixtures/files/${info.project.name}-${key}-r${revision}.${ext}`;
    await d.saveAs(path);
    const bytes = await readFile(path);
    const sha256 = `0x${createHash("sha256").update(bytes).digest("hex")}`;
    await expect(row).toContainText(sha256);
    const stored = await page.evaluate(({ branchId, key }) => {
      const state = JSON.parse(localStorage.getItem("platform.fixture.v1")!);
      const branch = state.branches.find((b: { id: string }) => b.id === branchId);
      return state.checkpoints.find((c: { id: string }) => c.id === branch.latestCheckpoint).assets.find((a: { assetKey: string }) => a.assetKey === key);
    }, { branchId: page.url().split("/b/")[1], key });
    expect(bytes.length).toBe(stored.descriptor.bytes);
    expect(sha256).toBe(stored.descriptor.sha256);
    evidence.push({ file: path, sha256, bytes: bytes.length, producerJob: stored.producerJobId, assetRevision: stored.revision, provenance: stored.originCheckpoint });
    return bytes;
  };
  const r1 = await download("landing", 1, "html");
  expect(r1.toString()).toContain("marker:R1");
  await propose(page, "image", "cover", "Generate one cover image.");
  await identity(page, "Demo signing account", "0");
  await sponsor(page, "Create PNG image · cover", `fx-job-${branchId}-1`);
  await selectRound(page, 2);
  await expect(page.getByRole("heading", { name: "Round 2 output", exact: true })).toBeVisible();
  const cover = await download("cover", 2, "png");
  expect(cover.toString("base64")).toBe(PNG_AMBER_B64);
  await expect(page.getByRole("img", { name: "cover from round 2" })).toBeVisible();

  await propose(page, "html", "landing", "Use first round HTML and second round PNG; retain original markers.", true, ["cover"]);
  const p = page.locator("#proposals > ul > li", { hasText: "Update HTML page · landing" });
  await disclose(page, /^Proposal details/);
  await expect(p).toContainText("landing@1");
  await expect(p).toContainText("cover@2");
  await identity(page, "Demo signing account", "1");
  await sponsor(page, "Update HTML page · landing", `fx-job-${branchId}-2`);
  await selectRound(page, 3);
  await expect(page.getByRole("heading", { name: "Round 3 output", exact: true })).toBeVisible();
  const r3 = await download("landing", 3, "html");
  expect(r3.toString()).toContain("marker:R1");
  expect(r3.toString()).toContain("marker:R3");
  expect(r3.toString()).toContain(`data:image/png;base64,${cover.toString("base64")}`);
  expect(r3.equals(r1)).toBe(false);
  await expect(page.frameLocator("iframe.frame").locator("img")).toHaveAttribute("src", `data:image/png;base64,${cover.toString("base64")}`);

  await propose(page, "document", "guide", "Explain funding and forks.");
  await sponsor(page, "Create Markdown · guide", `fx-job-${branchId}-3`);
  await selectRound(page, 4);
  await expect(page.getByRole("heading", { name: "Round 4 output", exact: true })).toBeVisible();
  const md = await download("guide", 4, "md");
  expect(md.toString()).toContain("# guide");
  await disclose(page, /^Complete asset table/);
  await expect(page.locator("#assets")).toContainText("landing@3");
  await expect(page.locator("#assets")).toContainText("cover@2");
  await expect(page.locator("#progress > ul > li")).toHaveCount(4);
  // A historical R1 fork copies only its R1 HTML, even though the parent now has R4 assets.
  await selectRound(page, 1);
  const historic = page.getByRole("dialog", { name: "Historical Fork" });
  await page.getByRole("button", { name: "Historical Fork", exact: true }).click();
  await historic.getByLabel("Fork direction (fixed after creation)").fill("Start from round one without later images or notes.");
  await historic.getByRole("button", { name: "Review fork" }).click();
  await historic.getByRole("button", { name: "Sign and fork" }).dblclick();
  await historic.getByRole("link", { name: "Open fork" }).click();
  await disclose(page, /^Branch, network/);
  await expect(page.getByText("None / None")).toBeVisible();
  await disclose(page, /^Complete asset table/);
  await expect(page.locator("#assets tbody tr")).toHaveCount(1);
  await expect(page.getByText("No proposals yet", { exact: false })).toBeVisible();
  const forked = await download("landing", 0, "html");
  expect(forked.equals(r1)).toBe(true);
  await expect(page.locator("#assets")).toContainText(`File origin: ${branchId}`);
  await expect(page.locator("#progress > ul > li")).toHaveCount(0);
  await propose(page, "document", "child-guide", "Independent child execution.");
  const childRow = page.locator("#proposals > ul > li", { hasText: "Create Markdown · child-guide" });
  await childRow.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await expect(funding(page)).toContainText("job.open / None; first execution");
  expect(await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls)).toEqual([]);
  await writeFile(`../docs/validation/platform-ux-v1/final/fixtures/files/${info.project.name}-journey.json`, JSON.stringify({ mode: "fixture-only", realWalletRequests: [], checks: "Six flows; four executed rounds; exact retained HTML/PNG; historical R1 fork; independent Node SHA-256 checks", files: evidence }, null, 2));
  await page.screenshot({ scale: "css", path: `../test/scratch/regression-screenshots/${info.project.name}-historical-fork.jpg`, type: "jpeg", quality: 50 });
});

test("account and network changes invalidate proposal and create confirmations", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Project title", { exact: true }).fill("Previous account preview");
  await page.getByLabel("Fixed goal (cannot change after creation)").fill("Fixed goal");
  await page.getByRole("button", { name: "Review creation" }).click();
  await expect(page.getByRole("button", { name: "Sign and create" })).toBeVisible();
  await identity(page, "Demo signing account", "1");
  await expect(page.getByRole("button", { name: "Sign and create" })).toHaveCount(0);
  await page.goto("./#/demo/b/fx-branch-1");
  await prepare(page);
  await form(page).getByLabel("New asset name").fill("new-slot");
  await form(page).getByRole("textbox", { name: /^Requirement/ }).fill("Previous network proposal");
  await form(page).getByRole("button", { name: "Review proposal" }).click();
  await expect(page.getByRole("button", { name: "Sign and submit proposal" })).toBeVisible();
  await identity(page, "Simulate wrong network", true);
  await expect(page.getByRole("button", { name: "Sign and submit proposal" })).toHaveCount(0);
});

test("resetting the demo clears cached projects and prepared forms from the project list", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Project title", { exact: true }).fill("Reset cache project");
  await page.getByLabel("Fixed goal (cannot change after creation)").fill("This demo project disappears on reset.");
  await page.getByRole("button", { name: "Review creation" }).click();
  await page.getByRole("button", { name: "Sign and create" }).click();
  await expect(page.getByRole("link", { name: "Reset cache project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset demo data", exact: true }).dblclick();
  await expect(page.getByRole("link", { name: "Reset cache project", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Create a project", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Relay introduction", exact: true })).toBeVisible();
  await expect(page.locator(".list > li")).toHaveCount(2);
});

test("preview navigation, forms, wallet messages and storage are inert; version changes do not reuse verified bytes", async ({ page }) => {
  await demo(page, "#/demo/b/fx-branch-sec");
  await page.evaluate(() => { (window as unknown as { __previewMessages: unknown[] }).__previewMessages = []; window.addEventListener("message", (event) => (window as unknown as { __previewMessages: unknown[] }).__previewMessages.push(event.data)); });
  await selectFile(page, "evil-site");
  const frame = page.frameLocator("iframe.frame");
  await expect(frame.locator("#evil")).toHaveText("Hostile HTML fixture");
  await expect(frame.locator("script, form, input, button, iframe, [href], meta[http-equiv='refresh']")).toHaveCount(0);
  await frame.getByText("Top navigation attempt").click();
  expect(page.url()).toContain("#/demo/b/fx-branch-sec");
  expect(page.context().pages()).toHaveLength(1);
  expect(await page.evaluate(() => ({ messages: (window as unknown as { __previewMessages: unknown[] }).__previewMessages, storage: localStorage.getItem("w1.pwned") }))).toEqual({ messages: [], storage: null });
  expect(await page.locator("iframe.frame").evaluate((node) => { try { return (node as HTMLIFrameElement).contentWindow?.localStorage.length; } catch { return "SecurityError"; } })).toBe("SecurityError");
  await page.goto("./#/demo/b/fx-branch-1");
  const site = () => page.locator("#assets");
  await selectFile(page, "site");
  await expect(site().getByText("Verified locally · SHA-256, length, media")).toBeVisible();
  await page.getByRole("button", { name: /^Select Round 1(?:,|$)/ }).click();
  await selectFile(page, "site");
  await expect(site()).toContainText("site@1");
  await expect(page.frameLocator("iframe.frame").locator("img")).toHaveCount(0);
  await expect(page.frameLocator("iframe.frame").locator("h1")).toHaveText("Introducing CTO Relay");
});
