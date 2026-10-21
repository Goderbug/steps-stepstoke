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
    await expect(adapter.createBranch({ ...DEMO_ACCOUNTS[0], chainId: 31337 }, { title: "Provider safety", goal: "A fixed public goal" })).rejects.toThrow("Selected wallet provider changed");
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
  expect(draftProblems(caps, { assets: [] } as unknown as Checkpoint, { ...draft, targetKey: targetKey + "A" })).toContain("Use letters, numbers, underscores or hyphens, up to 64 bytes");
});

it("keeps only bounded public RPC reads alive across navigation and preserves large simulation bytes",async()=>{
  const {httpProvider}=await import('../../src/domain/chainAdapter');
  const fetch=vi.fn(async(_url: RequestInfo|URL,_init?: RequestInit)=>({ok:true,json:async()=>({result:'0x1'})}));vi.stubGlobal('fetch',fetch);
  try {
    const provider=httpProvider('http://127.0.0.1:8545');
    await provider.request({method:'eth_getTransactionReceipt',params:['0x'+'12'.repeat(32)]});
    expect(fetch.mock.calls[0][1]?.keepalive).toBe(true);
    const data='0x'+'ab'.repeat(32768);await provider.request({method:'eth_call',params:[{data},'latest']});
    expect(fetch.mock.calls[1][1]?.keepalive).toBe(false);expect(JSON.parse(String(fetch.mock.calls[1][1]?.body)).params[0].data).toBe(data);
    await provider.request({method:'eth_sendTransaction',params:[{}]});expect(fetch.mock.calls[2][1]?.keepalive).toBe(false);
  }finally{vi.unstubAllGlobals();}
});
