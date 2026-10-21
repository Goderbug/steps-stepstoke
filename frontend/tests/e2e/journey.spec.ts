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
  await expect(page.getByText("演示模式").first()).toBeVisible();
}
const form = (page: Page) => page.locator("#propose form");
async function propose(page: Page, kind: string, key: string, requirement: string, update = false, inputs: string[] = []) {
  const f = form(page);
  await f.getByRole("combobox", { name: "类型", exact: true }).selectOption(kind);
  await f.getByLabel(update ? "更新" : "新建", { exact: true }).check();
  if (update) await f.getByRole("combobox", { name: "目标资产", exact: true }).selectOption(key);
  else await f.getByLabel("新槽位名称").fill(key);
  for (const input of inputs) await f.getByRole("checkbox", { name: new RegExp(`^${input} ·`) }).check();
  await f.getByRole("textbox", { name: /^要求/ }).fill(requirement);
  await f.getByRole("button", { name: "预览提案" }).click();
  if (kind === "html") await expect(f.getByText("网站发布", { exact: true }).locator(".." )).toContainText("关");
  await f.getByRole("button", { name: "签名并提交提案" }).dblclick();
  await expect(page.getByText("提案已提交。", { exact: false })).toBeVisible();
}
async function sponsor(page: Page, title: string, parent: string | null) {
  await page.getByLabel("回调结果").selectOption("accepted");
  const row = page.locator("#proposals > ul > li", { hasText: title });
  await row.getByRole("button", { name: "资助此提案" }).click();
  await expect(row.getByText("IMD 动作", { exact: true }).locator("..")).toContainText(parent ? `job.continue，父作业 ${parent}` : "job.open（分支首次执行）");
  await expect(row.getByText("授权对象", { exact: true }).locator("..")).toContainText("A1 分支合约");
  await row.getByRole("button", { name: "1. 授权精确额度" }).click();
  await row.getByRole("button", { name: "2. 购买执行" }).dblclick();
  await expect(page.locator("#progress > ul > li").first().locator(".stage", { hasText: "绑定" })).toContainText("已确认");
}

test("two accounts execute all six functions with downloaded HTML-image-HTML retention and a historical fork", async ({ page }, info) => {
  await demo(page);
  const walletRequests = await page.evaluate(() => {
    (window as unknown as { __walletCalls: string[] }).__walletCalls = [];
    Object.defineProperty(window, "ethereum", { configurable: true, value: { request: ({ method }: { method: string }) => { (window as unknown as { __walletCalls: string[] }).__walletCalls.push(method); throw new Error("Demo must not use the real wallet"); } } });
    return 0;
  });
  expect(walletRequests).toBe(0);
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("双账户保留资产旅程");
  await page.getByLabel("固定目标（创建后不能修改）").fill("建立一个单页网站，生成封面，保留历史并提供说明文档。");
  await page.getByRole("button", { name: "预览创建" }).click();
  await page.getByRole("button", { name: "签名并创建" }).dblclick();
  await page.getByRole("link", { name: "打开项目", exact: true }).click();
  const branchId = page.url().split("/b/")[1];
  await expect(page.getByRole("heading", { name: "双账户保留资产旅程", exact: true })).toBeVisible();
  await expect(page.getByText("这个版本还没有资产", { exact: false })).toBeVisible();
  await expect(page.locator("#progress > ul > li")).toHaveCount(0);
  // A proposes; B explicitly sponsors the older of two current proposals.
  await propose(page, "html", "landing", "第一轮站点，保留原始标记。");
  await propose(page, "document", "alternative", "另一个当前提案，不要求先选择它。");
  await expect(page.locator("#proposals .tag-accent", { hasText: "当前" })).toHaveCount(2);
  await page.getByLabel("演示签名账户").selectOption("1");
  await sponsor(page, "新建单页网站 · landing", null);
  await expect(page.getByRole("heading", { name: "资产 · 第 1 轮（当前）", exact: true })).toBeVisible();

  const evidence: object[] = [];
  await mkdir("../docs/validation/integration/frontend/files", { recursive: true });
  const download = async (key: string, revision: number, ext: string) => {
    const row = page.locator("#assets > ul > li", { hasText: new RegExp(`^${key} `) });
    await row.getByRole("button", { name: "下载并校验" }).click();
    await expect(row.getByText("已校验：与 A1 描述一致")).toBeVisible();
    const pending = page.waitForEvent("download");
    await row.getByRole("link", { name: "下载已校验文件" }).click();
    const d = await pending;
    const path = `../docs/validation/integration/frontend/files/${info.project.name}-${key}-r${revision}.${ext}`;
    await d.saveAs(path);
    const bytes = await readFile(path);
    const sha256 = `0x${createHash("sha256").update(bytes).digest("hex")}`;
    await expect(row).toContainText(sha256);
    const stored = await page.evaluate(({ branchId, key }) => {
      const state = JSON.parse(localStorage.getItem("w1.fixture.v1")!);
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
  await propose(page, "image", "cover", "生成单张封面图片。");
  await page.getByLabel("演示签名账户").selectOption("0");
  await sponsor(page, "新建图片 · cover", `fx-job-${branchId}-1`);
  await expect(page.getByRole("heading", { name: "资产 · 第 2 轮（当前）", exact: true })).toBeVisible();
  const cover = await download("cover", 2, "png");
  expect(cover.toString("base64")).toBe(PNG_AMBER_B64);
  await expect(page.getByRole("img", { name: "cover 第 2 轮图片" })).toBeVisible();

  await propose(page, "html", "landing", "使用第一轮 HTML 与第二轮图片，保留原始标记。", true, ["cover"]);
  const p = page.locator("#proposals > ul > li", { hasText: "更新单页网站 · landing" });
  await expect(p).toContainText("landing@第 1 轮");
  await expect(p).toContainText("cover@第 2 轮");
  await page.getByLabel("演示签名账户").selectOption("1");
  await sponsor(page, "更新单页网站 · landing", `fx-job-${branchId}-2`);
  await expect(page.getByRole("heading", { name: "资产 · 第 3 轮（当前）", exact: true })).toBeVisible();
  const r3 = await download("landing", 3, "html");
  expect(r3.toString()).toContain("marker:R1");
  expect(r3.toString()).toContain("marker:R3");
  expect(r3.toString()).toContain(`data:image/png;base64,${cover.toString("base64")}`);
  expect(r3.equals(r1)).toBe(false);
  await expect(page.frameLocator("iframe.frame").locator("img")).toHaveAttribute("src", `data:image/png;base64,${cover.toString("base64")}`);

  await propose(page, "document", "guide", "说明如何资助与分叉。");
  await sponsor(page, "新建文档 · guide", `fx-job-${branchId}-3`);
  await expect(page.getByRole("heading", { name: "资产 · 第 4 轮（当前）", exact: true })).toBeVisible();
  const md = await download("guide", 4, "md");
  expect(md.toString()).toContain("# guide");
  await expect(page.locator("#assets > ul > li", { hasText: /^landing / })).toContainText("第 3 轮");
  await expect(page.locator("#assets > ul > li", { hasText: /^cover / })).toContainText("第 2 轮");
  await expect(page.locator("#progress > ul > li")).toHaveCount(4);
  // A historical R1 fork copies only its R1 HTML, even though the parent now has R4 assets.
  const historic = page.locator("#history > ol > li", { hasText: "第 1 轮 · 执行轮次" });
  await historic.getByRole("button", { name: "从此检查点分叉" }).click();
  await historic.getByLabel("分叉方向（创建后固定）").fill("从第一轮重新发展，不复制后来的图片或文档。");
  await historic.getByRole("button", { name: "预览分叉" }).click();
  await historic.getByRole("button", { name: "签名并分叉" }).dblclick();
  await historic.getByRole("link", { name: "打开分叉分支" }).click();
  await expect(page.getByText("尚无（首次执行需单独资助，使用 job.open）")).toBeVisible();
  await expect(page.locator("#assets > ul > li")).toHaveCount(1);
  await expect(page.getByText("还没有提案", { exact: false })).toBeVisible();
  const forked = await download("landing", 0, "html");
  expect(forked.equals(r1)).toBe(true);
  await expect(page.locator("#assets")).toContainText(`来源：分支 ${branchId}`);
  await expect(page.locator("#progress > ul > li")).toHaveCount(0);
  await propose(page, "document", "child-guide", "子分支独立执行。");
  const childRow = page.locator("#proposals > ul > li", { hasText: "新建文档 · child-guide" });
  await childRow.getByRole("button", { name: "资助此提案" }).click();
  await expect(childRow).toContainText("job.open（分支首次执行）");
  expect(await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls)).toEqual([]);
  await writeFile(`../docs/validation/integration/frontend/files/${info.project.name}-journey.json`, JSON.stringify({ mode: "fixture-only", realWalletRequests: [], checks: "Six flows; four executed rounds; exact retained HTML/PNG; historical R1 fork; independent Node SHA-256 checks", files: evidence }, null, 2));
  await page.screenshot({ scale: "css", path: `../docs/validation/integration/frontend/screenshots/${info.project.name}-historical-fork.jpg`, type: "jpeg", quality: 50 });
});

test("account and network changes invalidate proposal and create confirmations", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("旧账户预览");
  await page.getByLabel("固定目标（创建后不能修改）").fill("固定目标");
  await page.getByRole("button", { name: "预览创建" }).click();
  await expect(page.getByRole("button", { name: "签名并创建" })).toBeVisible();
  await page.getByLabel("演示签名账户").selectOption("1");
  await expect(page.getByRole("button", { name: "签名并创建" })).toHaveCount(0);
  await page.goto("./#/demo/b/fx-branch-1");
  await form(page).getByLabel("新槽位名称").fill("new-slot");
  await form(page).getByRole("textbox", { name: /^要求/ }).fill("旧网络提案");
  await form(page).getByRole("button", { name: "预览提案" }).click();
  await expect(page.getByRole("button", { name: "签名并提交提案" })).toBeVisible();
  await page.getByLabel("模拟钱包在错误网络").check();
  await expect(page.getByRole("button", { name: "签名并提交提案" })).toHaveCount(0);
});

test("resetting the demo clears cached projects and prepared forms from the project list", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("重置缓存测试项目");
  await page.getByLabel("固定目标（创建后不能修改）").fill("这个模拟项目应在重置后消失。");
  await page.getByRole("button", { name: "预览创建" }).click();
  await page.getByRole("button", { name: "签名并创建" }).click();
  await expect(page.getByRole("link", { name: "重置缓存测试项目", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重置演示数据", exact: true }).dblclick();
  await expect(page.getByRole("link", { name: "重置缓存测试项目", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "创建项目根分支", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "中继站示例项目", exact: true })).toBeVisible();
  await expect(page.locator(".list > li")).toHaveCount(2);
});

test("preview navigation, forms, wallet messages and storage are inert; version changes do not reuse verified bytes", async ({ page }) => {
  await demo(page, "#/demo/b/fx-branch-sec");
  await page.evaluate(() => { (window as unknown as { __previewMessages: unknown[] }).__previewMessages = []; window.addEventListener("message", (event) => (window as unknown as { __previewMessages: unknown[] }).__previewMessages.push(event.data)); });
  await page.locator("#assets > ul > li", { hasText: /^evil-site / }).getByRole("button", { name: "下载并校验" }).click();
  const frame = page.frameLocator("iframe.frame");
  await expect(frame.locator("#evil")).toHaveText("恶意 HTML 测试");
  await expect(frame.locator("script, form, input, button, iframe, [href], meta[http-equiv='refresh']")).toHaveCount(0);
  await frame.getByText("顶层跳转链接").click();
  expect(page.url()).toContain("#/demo/b/fx-branch-sec");
  expect(page.context().pages()).toHaveLength(1);
  expect(await page.evaluate(() => ({ messages: (window as unknown as { __previewMessages: unknown[] }).__previewMessages, storage: localStorage.getItem("w1.pwned") }))).toEqual({ messages: [], storage: null });
  expect(await page.locator("iframe.frame").evaluate((node) => { try { return (node as HTMLIFrameElement).contentWindow?.localStorage.length; } catch { return "SecurityError"; } })).toBe("SecurityError");
  await page.goto("./#/demo/b/fx-branch-1");
  const site = () => page.locator("#assets > ul > li", { hasText: /^site / });
  await site().getByRole("button", { name: "下载并校验" }).click();
  await expect(site().getByText("已校验：与 A1 描述一致")).toBeVisible();
  await page.getByLabel("查看的版本").selectOption("fx-branch-1:1");
  await expect(site()).toContainText("第 1 轮");
  await expect(page.frameLocator("iframe.frame").locator("img")).toHaveCount(0);
  await expect(page.frameLocator("iframe.frame").locator("h1")).toHaveText("中继站示例页");
});
