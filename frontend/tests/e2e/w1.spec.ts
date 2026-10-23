import { funding, prepare, disclose, demoSettings, failureControls, selectFile, selectRound, identity } from "./actions";
import { test, expect } from "./harness";
import type { Page } from "@playwright/test";

async function openDemo(page: Page, hash = "#/demo") {
  await page.goto(`./${hash}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByText("Demo mode").first()).toBeVisible();
  await demoSettings(page);
  if (hash.includes("/b/")) { await failureControls(page); await disclose(page, /^Complete asset table|^Branch, network|^Proposal details/); }
}

test("configuration checks actual handoff without fixtures or a connect wall", async ({ page }) => {
  await page.goto("./#/configuration");
  await expect(page.getByRole("heading", { name: "Public projects" })).toBeVisible();
  await disclose(page, /^Deployment status/);
  await expect(page.getByText("HANDOFF_PRESENT_UNVERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByText("productionReady: false", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await expect(page.getByText("Relay introduction")).toHaveCount(0);
  await expect(page.locator(".demo-bar, .pill-demo")).toHaveCount(0);
});

test("first screen at phone width shows the product and its main action", async ({ page }) => {
  await openDemo(page);
  const create = page.getByRole("button", { name: "Create project" });
  await expect(create).toBeInViewport();
  await expect(page.getByRole("link", { name: "Relay introduction", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-demo-home.jpg` });
});

test("create root branch with fixed goal (account A), double click sends one signature", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Review creation" }).click();
  await expect(page.getByText("Enter a project title")).toBeVisible();
  await page.getByLabel("Project title").fill("Test project");
  await page.getByLabel("Fixed goal (cannot change after creation)").fill("Build a test website");
  await page.getByRole("button", { name: "Review creation" }).click();
  await expect(page.getByText("Gas only. Title and goal", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Sign and create" }).dblclick();
  await expect(page.getByText("Created project: Test project.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Test project", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page.getByText("The first output starts here")).toBeVisible();
  await disclose(page, /^Branch, network/);
  await expect(page.getByText("None / None")).toBeVisible();
});

test("propose, sponsor with exact allowance (account B), callback, binding, retained assets", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await identity(page, "Demo signing account", "1");
  // History shows HTML R1 -> image R2 -> HTML R3 provenance.
  await expect(page.locator("#assets").getByRole("rowheader", { name: /site@3/ })).toBeVisible();
  // Propose a document create; update target is mandatory input on updates.
  const form = await prepare(page);
  await form.getByLabel("New asset name").fill("faq");
  await form.getByLabel("Requirement").fill("Write frequently asked questions.");
  await form.getByRole("button", { name: "Review proposal" }).click();
  await form.getByRole("button", { name: "Sign and submit proposal" }).click();
  await expect(page.getByRole("dialog", { name: "Prepare a contribution" })).toHaveCount(0);
  // Existing current proposals stay current.
  await expect(page.locator("#proposals .tag-accent", { hasText: "Eligible" })).toHaveCount(3);

  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("accepted");
  const row = page.locator("#proposals li", { hasText: "Update HTML page · site" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await expect(funding(page).getByText("job.continue / fx-job-3")).toBeVisible();
  await expect(funding(page).getByText("Sponsors cannot edit proposals", { exact: false })).toBeVisible();
  await expect(funding(page).getByRole("button", { name: "2. Purchase execution" })).toBeDisabled();
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).dblclick();
  const sp = page.locator("#progress > ul > li").first();
  await expect(sp.getByText("Binding confirmed")).toHaveCount(0);
  await expect(sp.locator(".stage", { hasText: "Binding" })).toContainText("Confirmed");
  await expect(sp.locator(".stage", { hasText: "Git" })).toContainText("Pending");
  await expect(page.locator("#progress > ul > li")).toHaveCount(1);
  // New checkpoint R4 keeps untouched notes R1 and cover R2.
  await selectRound(page, 4);
  await expect(page.getByRole("heading", { name: "Round 4 output" })).toBeVisible();
  await expect(page.locator("#assets")).toContainText("cover@2");
  await selectFile(page, "site");
  await expect(page.locator("#assets")).toContainText("notes@1");
  // Other proposals bound to R3 are now stale and cannot be sponsored.
  await expect(page.locator("#proposals li", { hasText: "Update Markdown · notes" })).toContainText("Prepare at current checkpoint");
  // Verify the produced HTML: sha/length/format, sandboxed preview.
  await selectFile(page, "site");
  await expect(page.getByText("Verified locally · SHA-256, length, media")).toBeVisible();
  await expect(page.locator("iframe.frame")).toHaveAttribute("sandbox", "");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download verified file" }).click();
  expect((await download).suggestedFilename()).toBe("site.html");
});

test("stale proposal resubmission, sign rejection, account and network change", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const stale = page.locator("#proposals li", { hasText: "Create PNG image · banner" });
  await expect(stale).toContainText("Stale anchor");
  await expect(stale.getByRole("button", { name: "Review funding" })).toHaveCount(0);
  await stale.getByRole("button", { name: "Prepare at current checkpoint" }).click();
  await expect(page.getByRole("heading", { name: "Resubmit proposal" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Rejection returns to idle with a message; nothing is recorded.
  await identity(page, "Reject next simulated signature", true);
  const row = page.locator("#proposals li", { hasText: "Update Markdown · notes" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await expect(funding(page).getByText("Signature rejected in the wallet")).toBeVisible();
  await expect(page.getByLabel("Reject next simulated signature")).not.toBeChecked();
  await expect(funding(page).getByRole("button", { name: "1. Approve exact amount" })).toBeEnabled();

  // Switching account discards the prepared action.
  await identity(page, "Demo signing account", "1");
  await expect(page.getByText("Account or network changed. Preparation cancelled; review again before signing.")).toBeVisible();
  await expect(funding(page)).toHaveCount(0);

  // Wrong network disables actions.
  await identity(page, "Simulate wrong network", true);
  await expect(row.getByRole("button", { name: "Review funding" })).toBeDisabled();
  await expect(page.getByText(/select Local demo chain/)).toBeVisible();
});

test("missing callback stays pending; refused retry; bad binding resubmits without repurchase; status 2 freezes", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const sponsor = async (title: string) => {
    const row = page.locator("#proposals li", { hasText: title });
    await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
    await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
    await funding(page).getByRole("button", { name: "2. Purchase execution" }).click();
  };
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("missing");
  await sponsor("Update Markdown · notes");
  const first = page.locator("#progress > ul > li").first();
  await expect(first.locator(".stage", { hasText: "Callback" })).toContainText("Pending");
  await page.reload();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Callback" })).toContainText("Pending");
  await expect(page.getByRole("link", { name: "Download verified file" })).toBeVisible();
  await page.locator("#progress > ul > li").first().getByRole("button", { name: "Demo: deliver callback" }).click();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Binding" })).toContainText("Confirmed");
  await selectRound(page, 4);
  await expect(page.getByRole("heading", { name: "Round 4 output" })).toBeVisible();

  // New proposal on R4, refused (status 1), explicit identical retry.
  const form = await prepare(page);
  await form.getByLabel("New asset name").fill("faq");
  await form.getByLabel("Requirement").fill("Frequently asked questions");
  await form.getByRole("button", { name: "Review proposal" }).click();
  await form.getByRole("button", { name: "Sign and submit proposal" }).click();
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("refused");
  await sponsor("Create Markdown · faq");
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Callback" })).toContainText("Refused (status 1)");
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("bad_binding");
  const refused = page.locator("#progress > ul > li").first();
  await refused.getByRole("button", { name: "Review identical paid retry" }).click();
  await expect(funding(page).getByRole("heading", { name: "Review identical paid retry" })).toBeVisible();
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase identical retry" }).click();
  const retry = page.locator("#progress > ul > li").first();
  await expect(retry).toContainText("Attempt 2");
  await expect(retry.locator(".stage", { hasText: "Binding" })).toContainText("Failed");
  await retry.getByRole("button", { name: "Correct binding without purchase" }).click();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Binding" })).toContainText("Confirmed");
  await expect(page.locator("#progress > ul > li")).toHaveCount(3);
  await selectRound(page, 5);
  await expect(page.getByRole("heading", { name: "Round 5 output" })).toBeVisible();

  // Status 2 freezes purchases on this branch.
  await prepare(page);
  await form.getByLabel("New asset name").fill("faq2");
  await form.getByLabel("Requirement").fill("Write another note");
  await form.getByRole("button", { name: "Review proposal" }).click();
  await form.getByRole("button", { name: "Sign and submit proposal" }).click();
  await failureControls(page);
  await page.getByLabel("Callback outcome").selectOption("failed");
  await sponsor("Create Markdown · faq2");
  await expect(page.getByText("Purchases frozen", {exact:false})).toBeVisible();
});

test("unknown purchase reconciles by original hash/nonce after reload, never repurchases", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await failureControls(page);
  await page.getByLabel("Purchase receipt").selectOption("unknown");
  const row = page.locator("#proposals li", { hasText: "Update Markdown · notes" });
  await row.getByRole("button", { name: "Review funding" }).click();
  await disclose(page, /^Exact proposal/);
  await funding(page).getByRole("button", { name: "1. Approve exact amount" }).click();
  await funding(page).getByRole("button", { name: "2. Purchase execution" }).click();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "Purchase" })).toContainText("Unknown; reconcile");
  await page.reload();
  await expect(page.getByText(/Original transaction.*purchase Confirmed/)).toBeVisible();
  await expect(page.locator("#progress > ul > li")).toHaveCount(1);
});

test("fork an accepted historical checkpoint copies that asset set only", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await selectRound(page, 2);
  const r2 = page.getByRole("dialog", { name: "Historical Fork" });
  await page.getByRole("button", { name: "Historical Fork", exact: true }).click();
  await r2.getByLabel("Fork direction (fixed after creation)").fill("Develop an English introduction");
  await r2.getByRole("button", { name: "Review fork" }).click();
  await expect(r2.getByText("notes@1, site@1, cover@2")).toBeVisible();
  await r2.getByRole("button", { name: "Sign and fork" }).click();
  await r2.getByRole("link", { name: "Open fork" }).click();
  await expect(page.getByText("Fork direction", { exact: false }).first()).toBeVisible();
  await disclose(page, /^Branch, network/);
  await expect(page.getByText("None / None")).toBeVisible();
  await selectFile(page, "site");
  await expect(page.locator("#assets")).toContainText("site@1");
  await expect(page.locator("#assets")).toContainText("File origin: fx-branch-1");
  await expect(page.getByText("No proposals yet", { exact: false })).toBeVisible();
  // Copied historical bytes still verify against their original producer job.
  await selectFile(page, "cover");
  await expect(page.getByText("Verified locally · SHA-256, length, media")).toBeVisible();
  await expect(page.getByRole("img", { name: "cover from round 2" })).toBeVisible();
});

test("workspace layout at this project's width has no horizontal scroll", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await expect(page.getByRole("heading", { name: "Relay introduction" })).toBeVisible();
  await page.getByText("Demo settings", {exact:true}).click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByRole("button", { name: /^Select Round 3,/ })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("Demo mode").first()).toBeInViewport();
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-workspace-first.jpg` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await selectFile(page, "site");
  await expect(page.getByText("Verified locally · SHA-256, length, media")).toBeVisible();
  await page.screenshot({ scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-workspace.jpg`, type: "jpeg", quality: 55, fullPage: false });
});

test("malicious files stay isolated and broken files never get a verified badge", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-sec");
  const open = (key: string) => selectFile(page, key);

  await open("evil-site");
  const frame = page.locator("iframe.frame");
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(page.frameLocator("iframe.frame").locator("#evil")).toHaveText("Hostile HTML fixture");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem("w1.pwned"))).toBeNull();
  expect(page.url()).toContain("#/demo/b/fx-branch-sec");
  expect(await page.title()).not.toBe("SCRIPT_RAN");
  expect(page.context().pages()).toHaveLength(1);

  await open("evil-notes");
  await expect(page.locator(".md h1")).toHaveText("Hostile Markdown fixture");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__mdScriptRan ?? (window as unknown as Record<string, unknown>).__mdOnerror ?? null)).toBeNull();
  await expect(page.locator(".md script, .md img, .md iframe")).toHaveCount(0);
  await expect(page.locator(".md a", { hasText: "Unsafe link" })).not.toHaveAttribute("href", /.*/);
  await expect(page.locator(".md a", { hasText: "Safe HTTPS link" })).toHaveAttribute("rel", "noopener noreferrer nofollow");

  await open("tampered");
  await expect(page.locator("#assets").getByText("SHA-256: Fail")).toBeVisible();
  await expect(page.locator("#assets").getByRole("link", { name: "Download verified file" })).toHaveCount(0);

  await open("missing");
  await expect(page.getByText("File unavailable: File unavailable (404)", { exact: false })).toBeVisible();

  await open("fake-png");
  await expect(page.locator("#assets").getByText(/Format: Fail/)).toBeVisible();
  await expect(page.locator("#assets").locator("img")).toHaveCount(0);
  await open("broken-png");
  const broken = page.locator("#assets");
  await expect(broken).toContainText("Image decode: Fail");
  await expect(broken.getByText("Verified locally · SHA-256, length, media")).toHaveCount(0);
  await expect(broken.locator("img, a[download]")).toHaveCount(0);
  await open("oversized-png");
  const oversized = page.locator("#assets");
  await expect(oversized).toContainText("Image resource limit: Fail");
  await expect(oversized.locator("img, a[download]")).toHaveCount(0);
  await page.screenshot({ scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-security.jpg`, type: "jpeg", quality: 55, fullPage: false });
});

test("keyboard: skip link, focus ring, connect sheet traps and restores focus", async ({ page }) => {
  await page.goto("./#/configuration");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  const connect = page.getByRole("button", { name: "Connect wallet" });
  await connect.focus();
  const outline = await connect.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("solid");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Connect wallet" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(connect).toBeFocused();
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../test/scratch/regression-screenshots/${test.info().project.name}-live.jpg` });
});
