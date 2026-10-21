import { test, expect } from "./harness";
import type { Page } from "@playwright/test";

async function openDemo(page: Page, hash = "#/demo") {
  await page.goto(`./${hash}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByText("演示模式").first()).toBeVisible();
}

test("live mode fails closed with explicit A1_INTEGRATION_PENDING, no fixtures, no connect wall", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "公开项目" })).toBeVisible();
  await expect(page.getByText("A1_INTEGRATION_PENDING")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建项目" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "连接钱包" })).toBeVisible();
  await expect(page.getByText("中继站示例项目")).toHaveCount(0);
  await expect(page.locator(".demo-bar, .pill-demo")).toHaveCount(0);
});

test("first screen at phone width shows the product and its main action", async ({ page }) => {
  await openDemo(page);
  const create = page.getByRole("button", { name: "创建项目" });
  await expect(create).toBeInViewport();
  await expect(page.getByRole("link", { name: "中继站示例项目", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../docs/validation/integration/frontend/screenshots/${test.info().project.name}-demo-home.jpg` });
});

test("create root branch with fixed goal (account A), double click sends one signature", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "创建项目" }).click();
  await page.getByRole("button", { name: "预览创建" }).click();
  await expect(page.getByText("请填写项目名称")).toBeVisible();
  await page.getByLabel("项目名称").fill("测试项目");
  await page.getByLabel("固定目标（创建后不能修改）").fill("做一个测试网站");
  await page.getByRole("button", { name: "预览创建" }).click();
  await expect(page.getByText("只需 gas；不会购买 AI")).toBeVisible();
  await page.getByRole("button", { name: "签名并创建" }).dblclick();
  await expect(page.getByText("已创建「测试项目」。")).toBeVisible();
  await expect(page.getByRole("link", { name: "测试项目", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "打开项目" }).click();
  await expect(page.getByText("这个版本还没有资产")).toBeVisible();
  await expect(page.getByText("尚无（首次执行需单独资助，使用 job.open）")).toBeVisible();
});

test("propose, sponsor with exact allowance (account B), callback, binding, retained assets", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await page.getByLabel("演示签名账户").selectOption({ index: 1 });
  // History shows HTML R1 -> image R2 -> HTML R3 provenance.
  await expect(page.getByText("site@第 3 轮（fx-branch-1:3）")).toBeVisible();
  // Propose a document create; update target is mandatory input on updates.
  const form = page.locator("form", { has: page.getByRole("heading", { name: "提出工作" }) });
  await form.getByLabel("新槽位名称").fill("faq");
  await form.getByLabel("要求").fill("写一份常见问题。");
  await form.getByRole("button", { name: "预览提案" }).click();
  await form.getByRole("button", { name: "签名并提交提案" }).click();
  await expect(page.getByText("提案已提交")).toBeVisible();
  // Existing current proposals stay current.
  await expect(page.locator("#proposals .tag-accent", { hasText: "当前" })).toHaveCount(3);

  await page.getByLabel("回调结果").selectOption("accepted");
  const row = page.locator("#proposals li", { hasText: "更新单页网站 · site" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await expect(row.getByText("job.continue，父作业 fx-job-3")).toBeVisible();
  await expect(row.getByText("（不是 IMD 作业合约）")).toBeVisible();
  await expect(row.getByRole("button", { name: "2. 购买执行" })).toBeDisabled();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).dblclick();
  const sp = page.locator("#progress > ul > li").first();
  await expect(sp.getByText("绑定已确认")).toHaveCount(0);
  await expect(sp.locator(".stage", { hasText: "绑定" })).toContainText("已确认");
  await expect(sp.locator(".stage", { hasText: "Git" })).toContainText("等待中");
  await expect(page.locator("#progress > ul > li")).toHaveCount(1);
  // New checkpoint R4 keeps untouched notes R1 and cover R2.
  await expect(page.getByRole("heading", { name: "资产 · 第 4 轮（当前）" })).toBeVisible();
  await expect(page.locator("#assets li", { hasText: "cover" })).toContainText("第 2 轮");
  await expect(page.locator("#assets li", { hasText: "notes" })).toContainText("第 1 轮");
  // Other proposals bound to R3 are now stale and cannot be sponsored.
  await expect(page.locator("#proposals li", { hasText: "更新文档 · notes" })).toContainText("按当前检查点重新提交");
  // Verify the produced HTML: sha/length/format, sandboxed preview.
  await page.locator("#assets li", { hasText: "site" }).getByRole("button", { name: "下载并校验" }).click();
  await expect(page.getByText("已校验：与 A1 描述一致")).toBeVisible();
  await expect(page.locator("iframe.frame")).toHaveAttribute("sandbox", "");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载已校验文件" }).click();
  expect((await download).suggestedFilename()).toBe("site.html");
});

test("stale proposal resubmission, sign rejection, account and network change", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const stale = page.locator("#proposals li", { hasText: "新建图片 · banner" });
  await expect(stale).toContainText("已过期");
  await expect(stale.getByRole("button", { name: "资助此提案" })).toHaveCount(0);
  await stale.getByRole("button", { name: "按当前检查点重新提交" }).click();
  await expect(page.getByRole("heading", { name: "重新提交提案" })).toBeVisible();

  // Rejection returns to idle with a message; nothing is recorded.
  await page.getByLabel("下一次签名被拒绝").check();
  const row = page.locator("#proposals li", { hasText: "更新文档 · notes" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await expect(row.getByText("用户在钱包中拒绝了签名")).toBeVisible();
  await expect(page.getByLabel("下一次签名被拒绝")).not.toBeChecked();
  await expect(row.getByRole("button", { name: "1. 授权精确额度" })).toBeEnabled();

  // Switching account discards the prepared action.
  await page.getByLabel("演示签名账户").selectOption({ index: 1 });
  await expect(page.getByText("账户或网络已变更，已丢弃为之前账户准备的操作")).toBeVisible();
  await expect(page.getByRole("heading", { name: "资助预览" })).toHaveCount(0);

  // Wrong network disables actions.
  await page.getByLabel("模拟钱包在错误网络").check();
  await expect(row.getByRole("button", { name: "资助此提案" })).toBeDisabled();
  await expect(page.getByText("与目标链 31337 不一致")).toBeVisible();
});

test("missing callback stays pending; refused retry; bad binding resubmits without repurchase; status 2 freezes", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const sponsor = async (title: string) => {
    const row = page.locator("#proposals li", { hasText: title });
    await row.getByRole("button", { name: "资助此提案" }).click();
    await row.getByRole("button", { name: "1. 授权精确额度" }).click();
    await row.getByRole("button", { name: "2. 购买执行" }).click();
  };
  await page.getByLabel("回调结果").selectOption("missing");
  await sponsor("更新文档 · notes");
  const first = page.locator("#progress > ul > li").first();
  await expect(first.locator(".stage", { hasText: "回调" })).toContainText("等待中");
  await page.reload();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "回调" })).toContainText("等待中");
  await page.locator("#progress > ul > li").first().getByRole("button", { name: "演示：回调到达" }).click();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "绑定" })).toContainText("已确认");
  await expect(page.getByRole("heading", { name: "资产 · 第 4 轮（当前）" })).toBeVisible();

  // New proposal on R4, refused (status 1), explicit identical retry.
  const form = page.locator("form", { has: page.getByRole("heading", { name: "提出工作" }) });
  await form.getByLabel("新槽位名称").fill("faq");
  await form.getByLabel("要求").fill("常见问题");
  await form.getByRole("button", { name: "预览提案" }).click();
  await form.getByRole("button", { name: "签名并提交提案" }).click();
  await page.getByLabel("回调结果").selectOption("refused");
  await sponsor("新建文档 · faq");
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "回调" })).toContainText("已拒绝（状态 1）");
  await page.getByLabel("回调结果").selectOption("bad_binding");
  const refused = page.locator("#progress > ul > li").first();
  await refused.getByRole("button", { name: "用相同请求体重试（需再次支付）" }).click();
  await expect(refused.getByRole("heading", { name: "重试资助预览" })).toBeVisible();
  await refused.getByRole("button", { name: "1. 授权精确额度" }).click();
  await refused.getByRole("button", { name: "2. 购买重试" }).click();
  const retry = page.locator("#progress > ul > li").first();
  await expect(retry).toContainText("第 2 次尝试");
  await expect(retry.locator(".stage", { hasText: "绑定" })).toContainText("失败");
  await retry.getByRole("button", { name: "提交修正后的绑定清单（不重新购买）" }).click();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "绑定" })).toContainText("已确认");
  await expect(page.locator("#progress > ul > li")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "资产 · 第 5 轮（当前）" })).toBeVisible();

  // Status 2 freezes purchases on this branch.
  await form.getByLabel("新槽位名称").fill("faq2");
  await form.getByLabel("要求").fill("再来一份");
  await form.getByRole("button", { name: "预览提案" }).click();
  await form.getByRole("button", { name: "签名并提交提案" }).click();
  await page.getByLabel("回调结果").selectOption("failed");
  await sponsor("新建文档 · faq2");
  await expect(page.getByText("该分支的购买已冻结")).toBeVisible();
});

test("unknown purchase reconciles by original hash/nonce after reload, never repurchases", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await page.getByLabel("购买交易").selectOption("unknown");
  const row = page.locator("#proposals li", { hasText: "更新文档 · notes" });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).click();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "购买交易" })).toContainText("未知，待对账");
  await page.reload();
  await expect(page.getByText(/对账结果：购买已确认/)).toBeVisible();
  await expect(page.locator("#progress > ul > li")).toHaveCount(1);
});

test("fork an accepted historical checkpoint copies that asset set only", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  const r2 = page.locator("#history li", { hasText: "第 2 轮 · 执行轮次" });
  await r2.getByRole("button", { name: "从此检查点分叉" }).click();
  await r2.getByLabel("分叉方向（创建后固定）").fill("改做英文版");
  await r2.getByRole("button", { name: "预览分叉" }).click();
  await expect(r2.getByText("notes@第 1 轮、site@第 1 轮、cover@第 2 轮")).toBeVisible();
  await r2.getByRole("button", { name: "签名并分叉" }).click();
  await r2.getByRole("link", { name: "打开分叉分支" }).click();
  await expect(page.getByText("分叉方向").first()).toBeVisible();
  await expect(page.getByText("尚无（首次执行需单独资助，使用 job.open）")).toBeVisible();
  await expect(page.locator("#assets li", { hasText: "site" })).toContainText("第 1 轮");
  await expect(page.locator("#assets li", { hasText: "site" })).toContainText("来源：分支 fx-branch-1");
  await expect(page.getByText("还没有提案")).toBeVisible();
  // Copied historical bytes still verify against their original producer job.
  await page.locator("#assets li", { hasText: "cover" }).getByRole("button", { name: "下载并校验" }).click();
  await expect(page.getByText("已校验：与 A1 描述一致")).toBeVisible();
  await expect(page.getByRole("img", { name: "cover 第 2 轮图片" })).toBeVisible();
});

test("workspace layout at this project's width has no horizontal scroll", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-1");
  await expect(page.getByRole("heading", { name: "中继站示例项目" })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByRole("link", { name: "提案", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("演示模式").first()).toBeInViewport();
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../docs/validation/integration/frontend/screenshots/${test.info().project.name}-workspace-first.jpg` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.locator("#assets li", { hasText: "site" }).getByRole("button", { name: "下载并校验" }).click();
  await expect(page.getByText("已校验：与 A1 描述一致")).toBeVisible();
  await page.screenshot({ scale: "css", path: `../docs/validation/integration/frontend/screenshots/${test.info().project.name}-workspace.jpg`, type: "jpeg", quality: 55, fullPage: false });
});

test("malicious files stay isolated and broken files never get a verified badge", async ({ page }) => {
  await openDemo(page, "#/demo/b/fx-branch-sec");
  const open = (key: string) => page.locator("#assets li", { hasText: key }).first().getByRole("button", { name: "下载并校验" }).click();

  await open("evil-site");
  const frame = page.locator("iframe.frame");
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(page.frameLocator("iframe.frame").locator("#evil")).toHaveText("恶意 HTML 测试");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem("w1.pwned"))).toBeNull();
  expect(page.url()).toContain("#/demo/b/fx-branch-sec");
  expect(await page.title()).not.toBe("SCRIPT_RAN");
  expect(page.context().pages()).toHaveLength(1);

  await open("evil-notes");
  await expect(page.locator(".md h1")).toHaveText("恶意 Markdown");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__mdScriptRan ?? (window as unknown as Record<string, unknown>).__mdOnerror ?? null)).toBeNull();
  await expect(page.locator(".md script, .md img, .md iframe")).toHaveCount(0);
  await expect(page.locator(".md a", { hasText: "点我" })).not.toHaveAttribute("href", /.*/);
  await expect(page.locator(".md a", { hasText: "安全链接" })).toHaveAttribute("rel", "noopener noreferrer nofollow");

  await open("tampered");
  await expect(page.locator("#assets li", { hasText: "tampered" }).getByText("SHA-256：不通过")).toBeVisible();
  await expect(page.locator("#assets li", { hasText: "tampered" }).getByRole("link", { name: "下载已校验文件" })).toHaveCount(0);

  await open("missing");
  await expect(page.getByText(/无法获取文件：文件不可用（404）/)).toBeVisible();

  await open("fake-png");
  await expect(page.locator("#assets li", { hasText: "fake-png" }).getByText(/格式：不通过，文件头不是 PNG、JPEG 或 WebP/)).toBeVisible();
  await expect(page.locator("#assets li", { hasText: "fake-png" }).locator("img")).toHaveCount(0);
  await open("broken-png");
  const broken = page.locator("#assets > ul > li", { hasText: /^broken-png / });
  await expect(broken).toContainText("图片解码：不通过");
  await expect(broken.getByText("已校验：与 A1 描述一致")).toHaveCount(0);
  await expect(broken.locator("img, a[download]")).toHaveCount(0);
  await open("oversized-png");
  const oversized = page.locator("#assets > ul > li", { hasText: /^oversized-png / });
  await expect(oversized).toContainText("图片资源上限：不通过");
  await expect(oversized.locator("img, a[download]")).toHaveCount(0);
  await page.screenshot({ scale: "css", path: `../docs/validation/integration/frontend/screenshots/${test.info().project.name}-security.jpg`, type: "jpeg", quality: 55, fullPage: false });
});

test("keyboard: skip link, focus ring, connect sheet traps and restores focus", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();
  const connect = page.getByRole("button", { name: "连接钱包" });
  await connect.focus();
  const outline = await connect.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("solid");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "连接钱包" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(connect).toBeFocused();
  await page.screenshot({ type: "jpeg", quality: 45, scale: "css", path: `../docs/validation/integration/frontend/screenshots/${test.info().project.name}-live.jpg` });
});
