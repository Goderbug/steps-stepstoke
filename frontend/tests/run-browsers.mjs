// Uses the already supplied Chromium when requested; the locked test runner stays unchanged.
// WebKit is installed separately with the locked Playwright CLI. No browser binaries ship in Git.
import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const extra = {};
if (args.includes("--imd-chromium")) {
  args.splice(args.indexOf("--imd-chromium"), 1);
  const { chromium } = await import("/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs");
  extra.W1_CHROMIUM_EXECUTABLE = chromium.executablePath().replace(/chromium-(\d+)\/chrome-linux64\/chrome$/, "chromium_headless_shell-$1/chrome-headless-shell-linux64/chrome-headless-shell");
}
const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...args], {
  stdio: "inherit", env: { ...process.env, ...extra },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
