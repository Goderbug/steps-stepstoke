// Targeted rendered measurements supplement the pinned taste@1 probe and the interaction suite.
// The server is static, temporary and owned by this bounded foreground command.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
const { chromium } = await import(process.argv.includes("--imd-chromium")
  ? "/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs" : "playwright");
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://static.test").pathname;
  const relative = path === "/" ? "index.html" : path.slice(1);
  if (relative.includes("..")) { res.writeHead(400).end(); return; }
  try {
    const bytes = await readFile(`dist/${relative}`);
    res.setHeader("Content-Type", ({ js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png" })[relative.split(".").pop()] ?? "text/html");
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [], outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/^https?:\/\//, (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    outside.push(route.request().url()); return route.abort();
  });
  await page.goto(`${origin}/#/demo/b/fx-branch-1`);
  await page.locator("#ws-title").waitFor();
  const measurements = [];
  const measure = async (name, selector) => {
    const value = await page.locator(selector).first().evaluate((element) => {
      const style = getComputedStyle(element);
      let background = element;
      while (background.parentElement && getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)") background = background.parentElement;
      return { foreground: style.color, background: getComputedStyle(background).backgroundColor, fontSize: style.fontSize, weight: style.fontWeight };
    });
    const luminance = (rgb) => {
      const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => x / 255).map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const first = luminance(value.foreground), second = luminance(value.background);
    const ratio = (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
    assert.ok(ratio >= 4.5, `${name} contrast ${ratio}`);
    measurements.push({ name, selector, ...value, ratio: Number(ratio.toFixed(3)), threshold: 4.5 });
  };
  await measure("body", "body");
  await measure("primary button", ".btn-primary:not(:disabled)");
  await measure("secondary metadata", "#assets .meta");
  await measure("demo warning", ".demo-bar");
  const mobileInputSize = await page.getByLabel("演示签名账户").evaluate((el) => getComputedStyle(el).fontSize);
  assert.equal(mobileInputSize, "16px");
  const jump = await page.locator(".jump").boundingBox();
  assert.ok(jump && jump.y + jump.height <= 844, "workspace shortcuts must fit the first phone screen");
  await page.goto(`${origin}/#/demo/b/fx-branch-sec`);
  await page.locator("#assets > ul > li", { hasText: /^tampered / }).getByRole("button", { name: "下载并校验" }).click();
  await page.locator(".alert-error").waitFor();
  await measure("file verification error", ".alert-error");
  await page.locator("#assets > ul > li", { hasText: /^evil-notes / }).getByRole("button", { name: "下载并校验" }).click();
  await page.locator(".badge-ok").waitFor();
  await measure("verified descriptor badge", ".badge-ok");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page.locator(".btn").first().evaluate((el) => getComputedStyle(el).transitionDuration);
  assert.equal(reducedMotion, "0s");
  assert.deepEqual(errors, []); assert.deepEqual(outside, []);
  const result = { status: "passed", mode: "fixture-only", viewport: { width: 390, height: 844 }, measurements, mobileInputSize, workspaceShortcuts: jump, reducedMotion, pageErrors: errors, externalRequests: outside, limitations: "Opaque preview content, disabled states, all interactive backgrounds, native zoom and physical screen readers are outside this targeted contrast sample." };
  await writeFile("docs/validation/raw/design-measurements.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); server.close(); }
