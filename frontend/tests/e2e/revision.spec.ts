import { funding, prepare, disclose, demoSettings, failureControls, selectFile, selectRound, identity } from "./actions";
import { test, expect } from "./harness";
import type { Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Regression cases for the reviewed revision findings. Fixture adapter only; no A1 or real wallet.
async function openDemo(page: Page, hash = "#/demo") {
  await page.goto(`./${hash}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByText("Demo mode").first()).toBeVisible();
  await demoSettings(page);
  if (hash.includes("/b/")) { await failureControls(page); await disclose(page, /^Complete asset table|^Branch, network|^Proposal details/); }
}

const fixtureState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("platform.fixture.v1") ?? "{}"));
const recovery = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("w1.recovery.v1") ?? "[]"));

test("refused retry goes through a fresh fee/spender review and the new account's exact allowance; an unknown retry is journaled by its own hash/nonce", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("refused");
  const row = page.locator("#proposals li", { hasText: "Update Markdown · notes" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).click();
  const refused = page.locator("#progress > ul > li").first();
  await expect(refused.locator(".stage", { hasText: "Callback" })).toContainText("Refused (status 1)");

  await identity(page, "Demo signing account", "1");
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("missing");
  await failureControls(page);
  await page.getByLabel("Purchase receipt").selectOption("unknown");
  const before = await fixtureState(page);
  await page.locator("#progress > ul > li").first().getByRole("button", { name: "Review identical paid retry" }).click();
  const panel = funding(page);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("refused attempt 1");
  await expect(panel).toContainText("Approval spender");
  await expect(panel).toContainText("Current price");
  await expect(panel).toContainText("job.continue");
  await expect(panel.getByRole("button", { name: "2. Purchase identical retry" })).toBeDisabled();
  // Opening the review signs nothing.
  const opened = await fixtureState(page);
  expect(opened.sponsorships).toHaveLength(before.sponsorships.length);
  expect(opened.nonces).toEqual(before.nonces);

  await panel.getByRole("button", { name: "1. Approve exact amount" }).click();
  await expect(panel.getByRole("button", { name: "1. Approval confirmed" })).toBeDisabled();
  const approved = await fixtureState(page);
  const bAddr = Object.keys(approved.nonces).find((k) => !(k in before.nonces))!;
  expect(Object.entries(approved.allowances).find(([k]) => k.startsWith(`${bAddr}:`))?.[1]).toBe("25000000000000000000");
  await panel.getByRole("button", { name: "2. Purchase identical retry" }).click();

  const retry = page.locator("#progress > ul > li").first();
  await expect(retry).toContainText("Attempt 2");
  await expect(retry.locator(".stage", { hasText: "Purchase" })).toContainText("Unknown; reconcile");
  await expect(retry.locator(".stage", { hasText: "Callback" })).toContainText("Not started");
  const after = await fixtureState(page);
  const sp = after.sponsorships.find((x: { attempt: number }) => x.attempt === 2);
  expect(sp.sponsor).toBe(bAddr);
  expect(after.nonces[bAddr]).toBe(2); // approval + purchase, both by B
  const branchAddr = after.branches.find((b: { id: string }) => b.id === "fx-branch-1").address;
  expect(after.allowances[`${bAddr}:${branchAddr}`]).toBe("0"); // exact amount consumed by B's own retry purchase
  const rec = await recovery(page);
  expect(rec.map((r: { sponsorshipId: string }) => r.sponsorshipId)).toContain(sp.id);
  const own = rec.find((r: { sponsorshipId: string }) => r.sponsorshipId === sp.id);
  expect(own.txHash).toBe(sp.txHash);
  expect(own.nonce).toBe(sp.nonce);
  expect(own.account).toBe(bAddr);

  // After a reload the retry reconciles by its own hash/nonce; nothing is purchased again.
  await page.reload();
  // Recovery hints belong to the account that signed: reconcile once B is the selected account again.
  await identity(page, "Demo signing account", "1");
  const shortHash = `${sp.txHash.slice(0, 6)}…${sp.txHash.slice(-4)}`;
  await expect(page.getByText(`Original transaction ${shortHash} / nonce ${sp.nonce}:`, { exact: false })).toBeVisible();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Callback" })).toContainText("Pending");
  const settled = await fixtureState(page);
  expect(settled.sponsorships).toHaveLength(after.sponsorships.length);
  expect(settled.nonces[bAddr]).toBe(2);
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-retry-review.jpg`, fullPage: false });
});

test("sponsorship progress shows the complete purchase hash and sponsor with copy controls", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await openDemo(page, "#/demo/b/fx-branch-1");
  await page.getByLabel("Callback outcome").selectOption("missing");
  const row = page.locator("#proposals li", { hasText: "Update Markdown · notes" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).click();
  const progress = page.locator("#progress > ul > li").first();
  await expect(progress.locator(".stage", { hasText: "Callback" })).toContainText("Pending");
  const state = await fixtureState(page);
  const sp = state.sponsorships[0];
  await disclose(page, /^Transaction and attempt identity$/);
  await expect(progress.locator("code", { hasText: sp.txHash })).toHaveText(sp.txHash);
  await expect(progress.locator("code", { hasText: sp.sponsor })).toHaveText(sp.sponsor);
  await expect(progress.getByRole("button", { name: "Copy transaction hash" })).toBeVisible();
  await expect(progress.getByRole("button", { name: "Copy sponsor" })).toBeVisible();
  await expect(progress).toContainText(`nonce ${sp.nonce} · chain 31337`);
});

test("switching a populated draft to image yields a create draft with no inputs", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const form = await prepare(page);
  await form.getByLabel("Type").selectOption({ label: "HTML page" });
  await form.getByLabel("site · HTML page · round 3").check();
  await form.getByLabel("New asset name").fill("cover-new");
  await form.getByLabel("Requirement").fill("A new cover");
  await form.getByLabel("Type").selectOption({ label: "PNG image" });
  await expect(form.getByLabel("site · HTML page · round 3")).not.toBeChecked();
  await expect(form.getByLabel("New asset name")).toHaveValue("cover-new");
  await form.getByRole("button", { name: "Review proposal" }).click();
  await expect(form.getByRole("button", { name: "Sign and submit proposal" })).toBeVisible();
  await expect(form.getByLabel("Review proposal")).toContainText("Create PNG image · Asset slot cover-new");

  // An update draft switched to image returns to create and drops the forced target input.
  await form.getByRole("button", { name: "Back to edit" }).click();
  await form.getByLabel("Type").selectOption({ label: "HTML page" });
  await form.getByLabel("Update").check();
  await form.getByLabel("Target asset").selectOption("site");
  await expect(form.getByLabel(/site · HTML page · round 3/)).toBeChecked();
  await form.getByLabel("Type").selectOption({ label: "PNG image" });
  await expect(form.getByLabel("Create")).toBeChecked();
  await expect(form.getByLabel("Update")).not.toBeChecked();
  await expect(form.getByLabel("New asset name")).toHaveValue("");
  await expect(form.getByLabel(/site · HTML page · round 3/)).not.toBeChecked();
  await form.getByLabel("New asset name").fill("banner2");
  await form.getByRole("button", { name: "Review proposal" }).click();
  await expect(form.getByRole("button", { name: "Sign and submit proposal" })).toBeVisible();
});

test("a verified single output updates the file stage; a wide Markdown table stays readable in its own scroll region", async ({ page }) => {
  await openDemo(page, "#/demo");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Project title").fill("Single file verification");
  await page.getByLabel(/Fixed goal/).fill("Verify file stage and wide tables");
  await page.getByRole("button", { name: "Review creation" }).click();
  await page.getByRole("button", { name: "Sign and create" }).click();
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page.getByRole("heading", { name: "Single file verification" })).toBeVisible();
  const form = await prepare(page);
  await form.getByLabel("New asset name").fill("wide-table");
  const cells = (c: string) => `| ${Array(20).fill(c).join(" | ")} |`;
  await form.getByLabel("Requirement").fill(`${cells("A")}\n${cells("---")}\n${cells("B")}`);
  await form.getByRole("button", { name: "Review proposal" }).click();
  await form.getByRole("button", { name: "Sign and submit proposal" }).click();
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("accepted");
  const row = page.locator("#proposals li", { hasText: "Create Markdown · wide-table" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).click();
  const progress = page.locator("#progress > ul > li").first();
  await expect(progress.locator(".stage", { hasText: "Binding" })).toContainText("Confirmed");
  await expect(progress.locator(".stage", { hasText: "File verification" })).toContainText("Pending");

  const asset = page.locator("#assets");
  await selectRound(page, 1);
  await selectFile(page, "wide-table");
  await expect(asset.getByText("Verified locally · SHA-256, length, media")).toBeVisible();
  await expect(progress.locator(".stage", { hasText: "File verification" })).toContainText("Verified locally");
  await expect(progress).toContainText("local observation");

  const region = asset.getByRole("region", { name: "Document table (scroll horizontally)" });
  await expect(region).toBeVisible();
  const m = await region.evaluate((el) => {
    const ths = Array.from(el.querySelectorAll("th"));
    const glyph = (cell: Element) => { const r = document.createRange(); r.selectNodeContents(cell); return r.getBoundingClientRect(); };
    const rects = ths.map(glyph);
    let overlap = 0;
    for (let i = 1; i < rects.length; i++) overlap = Math.max(overlap, rects[i - 1].right - rects[i].left);
    const preview = el.closest(".preview")!;
    const panel = el.closest("#assets")!;
    const download = preview.querySelector<HTMLAnchorElement>("a[download]")!;
    const box = (node: Element) => {
      const { left, right, width } = node.getBoundingClientRect();
      return { left, right, width };
    };
    return { minCell: Math.min(...ths.map((t) => t.getBoundingClientRect().width)), glyph: rects[0].width, overlap,
      region: box(el), preview: box(preview), panel: box(panel), download: box(download),
      children: Array.from(preview.children).map(box), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
      hostOverflow: document.documentElement.scrollWidth - innerWidth, vw: innerWidth };
  });
  expect(m.minCell).toBeGreaterThan(m.glyph);
  expect(m.overlap).toBeLessThanOrEqual(0);
  expect(m.hostOverflow).toBe(0);
  expect(m.clientWidth).toBeLessThan(m.scrollWidth);
  for (const child of [m.preview, m.region, m.download, ...m.children]) {
    expect(child.left).toBeGreaterThanOrEqual(m.panel.left);
    expect(child.right).toBeLessThanOrEqual(m.panel.right);
    expect(child.right).toBeLessThanOrEqual(m.vw);
  }
  await region.focus();
  await expect(region).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await asset.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-wide-table.jpg` });

  const link = asset.getByRole("link", { name: "Download verified file" });
  await link.scrollIntoViewIfNeeded();
  const clickable = await link.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(clickable).toBe(true);
  await mkdir("../docs/validation/platform-ux-v1/final/fixtures/raw", {recursive:true});
  await writeFile(`../docs/validation/platform-ux-v1/final/fixtures/raw/${test.info().project.name}-table-measurements.json`, JSON.stringify({ ...m, clickable, scrollLeft: await region.evaluate((el) => el.scrollLeft) }, null, 2));

  const downloaded = page.waitForEvent("download");
  await link.click();
  expect((await downloaded).suggestedFilename()).toBe("wide-table.md");
  await expect(progress.locator(".stage", { hasText: "File verification" })).toContainText("Verified locally");
});

test("an unavailable output marks the file stage failed without a verified badge", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("accepted");
  const row = page.locator("#proposals li", { hasText: "Update Markdown · notes" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).click();
  const progress = page.locator("#progress > ul > li").first();
  await expect(progress.locator(".stage", { hasText: "Binding" })).toContainText("Confirmed");
  // Make the newly bound output unavailable in the fixture store, then verify it.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("platform.fixture.v1")!);
    const cp = s.checkpoints.find((c: {id:string}) => c.id === "fx-branch-1:4");
    const output = cp.assets.find((a: {assetKey:string}) => a.assetKey === "notes");
    s.files[`${output.producerJobId}:${output.descriptor.path}`].available = false;
    localStorage.setItem("platform.fixture.v1", JSON.stringify(s));
  });
  await page.reload();
  const asset = page.locator("#assets");
  await selectRound(page, 4);
  await selectFile(page, "notes");
  await expect(asset.getByText(/File unavailable/)).toBeVisible();
  await expect(asset.getByText("Verified locally · SHA-256, length, media")).toHaveCount(0);
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "File verification" })).toContainText("Local verification failed");
});
