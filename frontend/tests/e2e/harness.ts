import { test as base, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

export { expect };
export const test = base.extend<{ audit: void }>({
  audit: [async ({ page }, use, info) => {
    const errors: string[] = [], external: string[] = [], resources: string[] = [], consoleLog: { type: string; text: string }[] = [];
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleLog.push({ type: m.type(), text: m.text() }); });
    page.on("response", (r) => { if (r.status() >= 400) resources.push(`${r.status()} ${r.url()}`); });
    await page.route(/^https?:\/\//, (route) => {
      if (new URL(route.request().url()).origin === "http://127.0.0.1:4173") return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    await use();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => null);
    const id = `${info.project.name}-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 110)}`;
    await mkdir("../docs/validation/integration/frontend/browser", { recursive: true });
    // The explicit cross-origin isolation probe causes WebKit to report its successful sandbox
    // denials. Preserve them as evidence; only that exact diagnostic in that test is expected.
    const expectedBlock = (m: { type: string; text: string }) => info.project.name.startsWith("webkit")
      && info.title.startsWith("preview navigation, forms, wallet messages and storage are inert;")
      && m.text === "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";
    const consoleErrors = consoleLog.filter((m) => m.type === "error" && !expectedBlock(m));
    const expectedSecurityBlocks = consoleLog.filter(expectedBlock);
    await writeFile(`../docs/validation/integration/frontend/browser/${id}.json`, JSON.stringify({ test: info.title, engine: info.project.name, viewport: page.viewportSize(), status: errors.length || external.length || resources.length || consoleErrors.length || (overflow ?? 0) > 0 ? "failed" : info.status, horizontalOverflow: overflow, pageErrors: errors, externalAttempts: external, httpErrors: resources, unexpectedConsoleErrors: consoleErrors, expectedSecurityBlocks, console: consoleLog }, null, 2));
    expect(errors, "uncaught page errors").toEqual([]);
    expect(external, "unexpected network attempts (previews must stay offline)").toEqual([]);
    expect(resources, "failed HTTP resources").toEqual([]);
    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(overflow, "host document horizontal overflow").toBe(0);
  }, { auto: true }],
});
