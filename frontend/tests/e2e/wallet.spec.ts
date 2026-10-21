import { test, expect } from "./harness";

// A temporary in-browser EIP-1193/6963 test provider. No private key or RPC, no real signing.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type Callback = (...args: unknown[]) => void;
    const listeners = new Map<string, Set<Callback>>();
    const calls: string[] = [];
    let accounts: string[] = [], chain = "0x1", reject = false;
    const emit = (event: string, value: unknown) => listeners.get(event)?.forEach((fn) => fn(value));
    const provider = {
      on(event: string, fn: Callback) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(fn); return provider; },
      removeListener(event: string, fn: Callback) { listeners.get(event)?.delete(fn); return provider; },
      async request({ method }: { method: string; params?: unknown }) {
        calls.push(method);
        if (method === "eth_accounts") return accounts;
        if (method === "eth_chainId") return chain;
        if (method === "wallet_requestPermissions") return [{ parentCapability: "eth_accounts" }];
        if (method === "eth_requestAccounts") {
          if (reject) throw Object.assign(new Error("User rejected"), { code: 4001 });
          accounts = ["0x1111111111111111111111111111111111111111"];
          return accounts;
        }
        if (method === "wallet_switchEthereumChain") { chain = "0x1"; emit("chainChanged", chain); return null; }
        throw new Error(`Unexpected wallet method ${method}`);
      },
    };
    // Modern injected wallets can expose only EIP-6963, without window.ethereum.
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "bba57317-f486-4222-a9ec-64a067d8a144", name: "W1 临时测试钱包", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "test.w1.fixture" }, provider } }));
    window.addEventListener("eip6963:requestProvider", announce);
    window.addEventListener("w1:test-wallet", (e) => {
      const detail = (e as CustomEvent<{ account?: string; chain?: string; reject?: boolean }>).detail;
      if (detail.account) { accounts = [detail.account]; emit("accountsChanged", accounts); }
      if (detail.chain) { chain = detail.chain; emit("chainChanged", chain); }
      if (detail.reject !== undefined) reject = detail.reject;
    });
    Object.assign(window, { __testWalletCalls: calls });
    announce();
  });
});

test("EIP-6963 named browser wallet connects on desktop and phone, switches chain and observes account changes", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "连接钱包", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "连接钱包" });
  await expect(sheet.getByRole("button", { name: "W1 临时测试钱包" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "浏览器钱包", exact: true })).toHaveCount(0);
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  // The named injected wallet remains selectable inside an emulated phone's wallet browser.
  await sheet.getByRole("button", { name: "W1 临时测试钱包" }).click();
  await expect(page.getByRole("button", { name: "断开", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "断开", exact: true })).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await expect(page.getByText("0x1111111111111111111111111111111111111111", { exact: true })).toBeVisible();
  await page.evaluate(() => dispatchEvent(new CustomEvent("w1:test-wallet", { detail: { account: "0x2222222222222222222222222222222222222222", chain: "0x7a69" } })));
  await expect(page.getByText("0x2222222222222222222222222222222222222222", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "切换到 Ethereum" }).click();
  await expect(page.getByRole("button", { name: "切换到 Ethereum" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "创建项目", exact: true })).toBeDisabled();
  const calls = await page.evaluate(() => (window as unknown as { __testWalletCalls: string[] }).__testWalletCalls);
  expect(calls).toContain("wallet_switchEthereumChain");
  expect(calls.filter((x) => /sendTransaction|sign/i.test(x))).toEqual([]);
  await page.getByRole("button", { name: "断开", exact: true }).click();
  await expect(page.getByRole("button", { name: "连接钱包", exact: true })).toBeVisible();
});

test("wallet rejection leaves reads available; dialog wraps focus and restores it", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => dispatchEvent(new CustomEvent("w1:test-wallet", { detail: { reject: true } })));
  const connect = page.getByRole("button", { name: "连接钱包", exact: true });
  await connect.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "连接钱包" });
  const first = sheet.getByRole("button", { name: "关闭", exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await sheet.locator(":focus").count()).toBe(1);
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await sheet.getByRole("button", { name: "W1 临时测试钱包" }).click();
  await expect(sheet.getByText("你在钱包中取消了连接。")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "W1 临时测试钱包" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(connect).toBeFocused();
  await expect(page.getByRole("heading", { name: "公开项目", exact: true })).toBeVisible();
});
