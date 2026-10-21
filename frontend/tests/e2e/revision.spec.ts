import { test, expect } from "./harness";
import type { Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Regression cases for the reviewed revision findings. Fixture adapter only; no A1 or real wallet.
async function openDemo(page: Page, hash = "#/demo") {
  await page.goto(`./${hash}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByText("演示模式").first()).toBeVisible();
}

const fixtureState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("w1.fixture.v1") ?? "{}"));
const recovery = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("w1.recovery.v1") ?? "[]"));

test("refused retry goes through a fresh fee/spender review and the new account's exact allowance; an unknown retry is journaled by its own hash/nonce", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await page.getByLabel("回调结果").selectOption("refused");
  const row = page.locator("#proposals li", { hasText: "更新文档 · notes" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).click();
  const refused = page.locator("#progress > ul > li").first();
  await expect(refused.locator(".stage", { hasText: "回调" })).toContainText("已拒绝（状态 1）");

  await page.getByLabel("演示签名账户").selectOption({ index: 1 });
  await page.getByLabel("回调结果").selectOption("missing");
  await page.getByLabel("购买交易").selectOption("unknown");
  const before = await fixtureState(page);
  await page.locator("#progress > ul > li").first().getByRole("button", { name: "用相同请求体重试（需再次支付）" }).click();
  const panel = page.locator("#progress > ul > li").first().getByLabel("重试资助预览");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("第 2 次尝试");
  await expect(panel).toContainText("授权对象");
  await expect(panel).toContainText("当前价格");
  await expect(panel).toContainText("job.continue");
  await expect(panel.getByRole("button", { name: "2. 购买重试" })).toBeDisabled();
  // Opening the review signs nothing.
  const opened = await fixtureState(page);
  expect(opened.sponsorships).toHaveLength(before.sponsorships.length);
  expect(opened.nonces).toEqual(before.nonces);

  await panel.getByRole("button", { name: "1. 授权精确额度" }).click();
  await expect(panel.getByRole("button", { name: "1. 已授权" })).toBeDisabled();
  const approved = await fixtureState(page);
  const bAddr = Object.keys(approved.nonces).find((k) => !(k in before.nonces))!;
  expect(Object.entries(approved.allowances).find(([k]) => k.startsWith(`${bAddr}:`))?.[1]).toBe("25000000000000000000");
  await panel.getByRole("button", { name: "2. 购买重试" }).click();

  const retry = page.locator("#progress > ul > li").first();
  await expect(retry).toContainText("第 2 次尝试");
  await expect(retry.locator(".stage", { hasText: "购买交易" })).toContainText("未知，待对账");
  await expect(retry.locator(".stage", { hasText: "回调" })).toContainText("未开始");
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
  await page.getByLabel("演示签名账户").selectOption({ index: 1 });
  const shortHash = `${sp.txHash.slice(0, 6)}…${sp.txHash.slice(-4)}`;
  await expect(page.getByText(`交易 ${shortHash}（nonce ${sp.nonce}）对账结果`)).toBeVisible();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "回调" })).toContainText("等待中");
  const settled = await fixtureState(page);
  expect(settled.sponsorships).toHaveLength(after.sponsorships.length);
  expect(settled.nonces[bAddr]).toBe(2);
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../docs/validation/integration/acceptance/fixtures/screenshots/${test.info().project.name}-retry-review.jpg`, fullPage: false });
});

test("sponsorship progress shows the complete purchase hash and sponsor with copy controls", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await openDemo(page, "#/demo/b/fx-branch-1");
  const row = page.locator("#proposals li", { hasText: "更新文档 · notes" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).click();
  const progress = page.locator("#progress > ul > li").first();
  await expect(progress.locator(".stage", { hasText: "回调" })).toContainText("等待中");
  const state = await fixtureState(page);
  const sp = state.sponsorships[0];
  await expect(progress.locator("code", { hasText: sp.txHash })).toHaveText(sp.txHash);
  await expect(progress.locator("code", { hasText: sp.sponsor })).toHaveText(sp.sponsor);
  await expect(progress.getByRole("button", { name: "复制交易哈希" })).toBeVisible();
  await expect(progress.getByRole("button", { name: "复制资助者地址" })).toBeVisible();
  await expect(progress).toContainText(`nonce ${sp.nonce} · 链 31337`);
});

test("switching a populated draft to image yields a create draft with no inputs", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const form = page.locator("form", { has: page.getByRole("heading", { name: "提出工作" }) });
  await form.getByLabel("类型").selectOption({ label: "单页网站" });
  await form.getByLabel("site · 单页网站 · 第 3 轮").check();
  await form.getByLabel("新槽位名称").fill("cover-new");
  await form.getByLabel("要求").fill("一张新的封面");
  await form.getByLabel("类型").selectOption({ label: "图片" });
  await expect(form.getByLabel("site · 单页网站 · 第 3 轮")).not.toBeChecked();
  await expect(form.getByLabel("新槽位名称")).toHaveValue("cover-new");
  await form.getByRole("button", { name: "预览提案" }).click();
  await expect(form.getByRole("button", { name: "签名并提交提案" })).toBeVisible();
  await expect(form.getByLabel("提案预览")).toContainText("新建图片 · 槽位 cover-new");

  // An update draft switched to image returns to create and drops the forced target input.
  await form.getByRole("button", { name: "返回修改" }).click();
  await form.getByLabel("类型").selectOption({ label: "单页网站" });
  await form.getByLabel("更新").check();
  await form.getByLabel("目标资产").selectOption("site");
  await expect(form.getByLabel(/site · 单页网站 · 第 3 轮/)).toBeChecked();
  await form.getByLabel("类型").selectOption({ label: "图片" });
  await expect(form.getByLabel("新建")).toBeChecked();
  await expect(form.getByLabel("更新")).not.toBeChecked();
  await expect(form.getByLabel("新槽位名称")).toHaveValue("");
  await expect(form.getByLabel(/site · 单页网站 · 第 3 轮/)).not.toBeChecked();
  await form.getByLabel("新槽位名称").fill("banner2");
  await form.getByRole("button", { name: "预览提案" }).click();
  await expect(form.getByRole("button", { name: "签名并提交提案" })).toBeVisible();
});

test("a verified single output updates the file stage; a wide Markdown table stays readable in its own scroll region", async ({ page }) => {
  await openDemo(page, "#/demo");
  await page.getByRole("button", { name: "创建项目" }).click();
  await page.getByLabel("项目名称").fill("单文件验证状态");
  await page.getByLabel(/固定目标/).fill("验证文件阶段与宽表格");
  await page.getByRole("button", { name: "预览创建" }).click();
  await page.getByRole("button", { name: "签名并创建" }).click();
  await page.getByRole("link", { name: "打开项目" }).click();
  await expect(page.getByRole("heading", { name: "单文件验证状态" })).toBeVisible();
  const form = page.locator("form", { has: page.getByRole("heading", { name: "提出工作" }) });
  await form.getByLabel("新槽位名称").fill("wide-table");
  const cells = (c: string) => `| ${Array(20).fill(c).join(" | ")} |`;
  await form.getByLabel("要求").fill(`${cells("甲")}\n${cells("---")}\n${cells("乙")}`);
  await form.getByRole("button", { name: "预览提案" }).click();
  await form.getByRole("button", { name: "签名并提交提案" }).click();
  await page.getByLabel("回调结果").selectOption("accepted");
  const row = page.locator("#proposals li", { hasText: "新建文档 · wide-table" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).click();
  const progress = page.locator("#progress > ul > li").first();
  await expect(progress.locator(".stage", { hasText: "绑定" })).toContainText("已确认");
  await expect(progress.locator(".stage", { hasText: "文件校验" })).toContainText("等待中");

  const asset = page.locator("#assets li", { hasText: "wide-table" });
  await asset.getByRole("button", { name: "下载并校验" }).click();
  await expect(asset.getByText("已校验：与 A1 描述一致")).toBeVisible();
  await expect(progress.locator(".stage", { hasText: "文件校验" })).toContainText("本机已校验");
  await expect(progress).toContainText("不代表链上验证");

  const region = asset.getByRole("region", { name: "文档表格（可横向滚动）" });
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
  await asset.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../docs/validation/integration/acceptance/fixtures/screenshots/${test.info().project.name}-wide-table.jpg` });

  const link = asset.getByRole("link", { name: "下载已校验文件" });
  await link.scrollIntoViewIfNeeded();
  const clickable = await link.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(clickable).toBe(true);
  await writeFile(`../docs/validation/integration/acceptance/fixtures/raw/${test.info().project.name}-table-measurements.json`, JSON.stringify({ ...m, clickable, scrollLeft: await region.evaluate((el) => el.scrollLeft) }, null, 2));

  const downloaded = page.waitForEvent("download");
  await link.click();
  expect((await downloaded).suggestedFilename()).toBe("wide-table.md");
  await expect(progress.locator(".stage", { hasText: "文件校验" })).toContainText("本机已校验");
});

test("an unavailable output marks the file stage failed without a verified badge", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await page.getByLabel("回调结果").selectOption("accepted");
  const row = page.locator("#proposals li", { hasText: "更新文档 · notes" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).click();
  const progress = page.locator("#progress > ul > li").first();
  await expect(progress.locator(".stage", { hasText: "绑定" })).toContainText("已确认");
  // Make the newly bound output unavailable in the fixture store, then verify it.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("w1.fixture.v1")!);
    for (const k of Object.keys(s.files)) if (k.startsWith("fx-job-fx-branch-1-4:")) s.files[k].available = false;
    localStorage.setItem("w1.fixture.v1", JSON.stringify(s));
  });
  await page.reload();
  const asset = page.locator("#assets li", { hasText: "notes" });
  await asset.getByRole("button", { name: "下载并校验" }).click();
  await expect(asset.getByText(/无法获取文件/)).toBeVisible();
  await expect(asset.getByText("已校验：与 A1 描述一致")).toHaveCount(0);
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "文件校验" })).toContainText("本机校验失败");
});
