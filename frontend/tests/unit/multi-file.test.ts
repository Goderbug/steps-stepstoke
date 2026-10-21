// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hexlify, keccak256 } from "ethers";
import { ChainAdapter, type LocalConfig } from "../../src/domain/chainAdapter";
import config from "../../public/local-config.json";

const branch = "0x" + "11".repeat(20);
const digest = "0x" + "22".repeat(32);
const hash = "aa".repeat(32);
const output = { name: "main", path: "artifacts/main.md", hash, mediaType: "text/markdown", bytes: 32, submissionHash: "bb".repeat(32) };
beforeEach(() => vi.stubGlobal("location", new URL("http://localhost/")));
afterEach(() => vi.unstubAllGlobals());

function history(files: object[]) {
  const raw = new TextEncoder().encode(JSON.stringify({ jobId: "accepted-job", projectId: "accepted-project", state: "completed", files }));
  const wallet = vi.fn(async () => null);
  const adapter = new ChainAdapter(config as LocalConfig, wallet);
  const internal = adapter as any;
  internal.checkBranch = vi.fn(async () => {});
  internal.time = vi.fn(async () => "2026-10-21T00:00:00Z");
  internal.read = vi.fn(async (_branch: string, method: string) => {
    if (method === "attempt") return { proposalId: 7n, sponsor: branch };
    if (method === "proposal") return { outputName: output.name, outputPath: output.path };
    if (method === "checkpoint") return { digest };
    throw new Error(`Unexpected read ${method}`);
  });
  internal.historyData = vi.fn(async () => ({
    history: [{ revision: 1n, digest, witness: [{ key: digest, kind: 0, name: output.name, path: output.path, size: 32, mediaType: output.mediaType, fileHash: "0x" + hash, producer: branch, revision: 1n, jobId: "accepted-job" }] }],
    checkpoints: { "1": { resultHash: keccak256(raw) } },
    logs: [{ parsed: { name: "Bound", args: { revision: 1n, attempt: 1n, rawManifest: hexlify(raw) } } }],
    cpLogs: [{ parsed: { args: { revision: 1n } }, blockNumber: "0x64" }],
  }));
  return { adapter, internal, wallet };
}

describe("multi-file authenticated browser history", () => {
  it("reads the purchase's proposal and displays only its accepted output without a wallet", async () => {
    const { adapter, internal, wallet } = history([{ name: "data", path: "artifacts/data.json", mediaType: "application/json", bytes: 999999999 }, output]);
    const rows = await adapter.getHistory(branch);
    expect(rows[0].jobId).toBe("accepted-job");
    expect(rows[0].assets).toHaveLength(1);
    expect(rows[0].assets[0].descriptor.path).toBe("artifacts/main.md");
    expect(rows[0].changed).toEqual(["main"]);
    expect(internal.read).toHaveBeenCalledWith(branch, "proposal", [7n]);
    expect(wallet).not.toHaveBeenCalled();
  });
  it("rejects ambiguous or missing declared output instead of guessing an extra file", async () => {
    for (const files of [[{ ...output, path: "artifacts/other.md" }, output], [{ name: "data", path: "artifacts/data.json" }]]) {
      const { adapter, wallet } = history(files);
      await expect(adapter.getHistory(branch)).rejects.toThrow(/Ambiguous|missing/);
      expect(wallet).not.toHaveBeenCalled();
    }
  });
});
