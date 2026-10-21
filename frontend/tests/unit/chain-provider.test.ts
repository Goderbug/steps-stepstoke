import { describe, it, expect, vi } from "vitest";
import { ChainAdapter, type LocalConfig, type Provider } from "../../src/domain/chainAdapter";
import config from "../../public/local-config.json";
import { draftProblems } from "../../src/ui/ProposeForm";
import type { Checkpoint } from "../../src/domain/types";
import { DEMO_ACCOUNTS } from "../../src/domain/fixtureAdapter";

// Isolated wallet fault injection; actual chain behavior is exercised by browser-chain.mjs.
describe("selected provider safety", () => {
  it("does not sign through a previously selected provider when another provider has the same account/chain", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [DEMO_ACCOUNTS[0].address];
      if (method === "eth_chainId") return "0x7a69";
      if (method === "eth_getTransactionCount") return "0x0";
      if (method === "eth_sendTransaction") throw new Error("must not send");
      return "0x";
    });
    const first = { request } as Provider;
    const next = { request } as Provider;
    let selections = 0;
    const adapter = new ChainAdapter(config as LocalConfig, async () => ++selections === 1 ? first : next);
    adapter.verify = vi.fn(async () => {});
    adapter.provider.request = vi.fn(async ({ method }) => method === "eth_getTransactionCount" ? "0x0" : "0x");
    await expect(adapter.createBranch({ ...DEMO_ACCOUNTS[0], chainId: 31337 }, { title: "Provider safety", goal: "A fixed public goal" })).rejects.toThrow("所选钱包提供方已变更");
    expect(request.mock.calls.some(([a]) => a.method === "eth_sendTransaction")).toBe(false);
  });
});

it("uses A1 name limits for CLI-produced names rather than fixture slot restrictions", async () => {
  const adapter = new ChainAdapter(config as LocalConfig, async () => null);
  const caps = await adapter.getCapabilities();
  const targetKey = "Legacy_Name_" + "A".repeat(52);
  expect(targetKey.length).toBe(64);
  const draft = { kind: "document" as const, mode: "create" as const, targetKey, inputKeys: [], requirement: "A valid requirement" };
  expect(draftProblems(caps, { assets: [] } as unknown as Checkpoint, draft)).toEqual([]);
  expect(draftProblems(caps, { assets: [] } as unknown as Checkpoint, { ...draft, targetKey: targetKey + "A" })).toContain("目标名称使用字母、数字、下划线或连字符，最长 64 字节");
});
