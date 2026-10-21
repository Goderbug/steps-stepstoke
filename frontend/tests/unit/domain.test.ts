import { beforeEach, describe, expect, it } from "vitest";
import { createLiveAdapter } from "../../src/domain/liveAdapter";
import { DEMO_ACCOUNTS, FIXTURE_CAPABILITIES, FixtureAdapter } from "../../src/domain/fixtureAdapter";
import { sha256Hex, sniffImage, utf8, verifyFile, safeFileName, fromBase64 } from "../../src/domain/files";
import { PNG_GREEN_B64, EVIL_MD } from "../../src/domain/fixtures";
import { renderMarkdown, isolatedSrcDoc } from "../../src/preview/sanitize";
import { draftProblems } from "../../src/ui/ProposeForm";

beforeEach(() => localStorage.clear());

describe("live adapter (A1 not delivered)", () => {
  it("fails closed for every operation and advertises no capability", async () => {
    const a = createLiveAdapter();
    expect(a.status().state).toBe("A1_INTEGRATION_PENDING");
    expect(Object.values(a.capabilities).every((v) => v === false)).toBe(true);
    for (const call of [
      () => a.getCapabilities(), () => a.listBranches(), () => a.getBranch("x"),
      () => a.getHistory("x"), () => a.getProposals("x"), () => a.getSponsorships("x"), () => a.quoteFee("x"),
      () => a.createBranch(DEMO_ACCOUNTS[0], { title: "x", goal: "x" }),
      () => a.propose(DEMO_ACCOUNTS[0], {} as never), () => a.approve(DEMO_ACCOUNTS[0], {} as never, 1n),
      () => a.sponsor(DEMO_ACCOUNTS[0], "x", 1n, {} as never), () => a.retryRefused(DEMO_ACCOUNTS[0], "x", 1n, {} as never),
      () => a.resubmitBinding(DEMO_ACCOUNTS[0], "x"), () => a.fork(DEMO_ACCOUNTS[0], {} as never),
      () => a.reconcile({} as never), () => a.fetchFile({} as never, "j"),
    ]) await expect(call()).rejects.toThrow("A1_INTEGRATION_PENDING");
  });
});

describe("file verification", () => {
  it("distinguishes real SHA-256 and sniffs image magic bytes", async () => {
    const png = fromBase64(PNG_GREEN_B64);
    expect(sniffImage(png)).toBe("image/png");
    expect(sniffImage(utf8("<svg/>"))).toBeNull();
    const d = { name: "a.png", path: "a.png", mediaType: "image/png", bytes: png.length, sha256: await sha256Hex(png) };
    expect((await verifyFile(png, d, "image", 1 << 20, ["image/png"])).ok).toBe(true);
    const bad = png.slice(); bad[20] ^= 1;
    const r = await verifyFile(bad, d, "image", 1 << 20, ["image/png"]);
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "SHA-256")!.ok).toBe(false);
    expect((await verifyFile(png, d, "image", 10, ["image/png"])).ok).toBe(false);
  });
  it("sanitizes download file names", () => {
    expect(safeFileName("../../etc/x.html")).toBe("x.html");
    expect(safeFileName(".hidden")).toBe("hidden");
  });
});

describe("preview isolation", () => {
  it("strips scripts, handlers, frames and unsafe links from Markdown", () => {
    const html = renderMarkdown(EVIL_MD);
    expect(html).not.toMatch(/<script|onerror|<iframe|<img|javascript:/i);
    expect(html).toContain('href="https://example.org/docs"');
  });
  it("puts a restrictive CSP first in generated HTML", () => {
    const doc = isolatedSrcDoc("<script>x</script>");
    expect(doc).not.toContain("<script>");
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("<body>"));
    expect(doc).toContain("script-src 'none'");
    expect(doc).toContain("connect-src 'none'");
  });
});

describe("fixture adapter semantics", () => {
  it("R3 HTML used job R2 as parent and inputs HTML R1 + image R2; untouched assets persist", async () => {
    const a = await FixtureAdapter.create({ latency: 0, reset: true });
    const h = await a.getHistory("fx-branch-1");
    const r3 = h.find((c) => c.revision === 3)!;
    expect(r3.changed).toEqual(["site"]);
    expect(r3.assets.map((x) => `${x.assetKey}@${x.revision}`).sort()).toEqual(["cover@2", "notes@1", "site@3"]);
    const q = await a.quoteFee("fx-prop-2");
    expect(q.action).toBe("job.continue");
    expect(q.parentJobId).toBe("fx-job-3");
  });

  it("proposing does not invalidate other current proposals; update requires target as input", async () => {
    const a = await FixtureAdapter.create({ latency: 0, reset: true });
    const [A] = DEMO_ACCOUNTS;
    await expect(a.propose(A, { branchId: "fx-branch-1", anchor: "fx-branch-1:3", kind: "html", mode: "update", targetKey: "site", inputKeys: [], requirement: "x", publish: false })).rejects.toThrow("目标资产必须作为输入");
    await a.propose(A, { branchId: "fx-branch-1", anchor: "fx-branch-1:3", kind: "document", mode: "create", targetKey: "faq", inputKeys: [], requirement: "x", publish: false });
    const ps = await a.getProposals("fx-branch-1");
    expect(ps.filter((p) => p.status === "current")).toHaveLength(3);
  });

  it("sponsoring needs exact allowance, rejects stale anchors, and a missing callback stays pending", async () => {
    const a = await FixtureAdapter.create({ latency: 0, reset: true });
    const [A] = DEMO_ACCOUNTS;
    const q = await a.quoteFee("fx-prop-1");
    await expect(a.sponsor(A, "fx-prop-1", q.price, q)).rejects.toThrow("授权额度不足");
    await a.approve(A, q, q.price);
    const sp = await a.sponsor(A, "fx-prop-1", q.price, q);
    expect(sp.stages.callback).toBe("pending");
    expect(sp.stages.binding).toBe("not_started");
    const q0 = await a.quoteFee("fx-prop-0");
    await a.approve(A, q0, q0.price);
    await expect(a.sponsor(A, "fx-prop-0", q0.price, q0)).rejects.toThrow("需要重新提交");
  });

  it("fork copies the chosen historical asset set, not latest, proposals or project", async () => {
    const a = await FixtureAdapter.create({ latency: 0, reset: true });
    const child = await a.fork(DEMO_ACCOUNTS[1], { branchId: "fx-branch-1", checkpointId: "fx-branch-1:2", direction: "英文版" });
    expect(child.imdProjectId).toBeNull();
    expect(child.head).toBeNull();
    const [genesis] = await a.getHistory(child.id);
    expect(genesis.assets.map((x) => `${x.assetKey}@${x.revision}`).sort()).toEqual(["cover@2", "notes@1", "site@1"]);
    expect(await a.getProposals(child.id)).toHaveLength(0);
    await expect(a.fork(DEMO_ACCOUNTS[1], { branchId: "fx-branch-1", checkpointId: "fx-branch-1:0", direction: "x" })).rejects.toThrow();
  });
});

describe("proposal budgets come from capabilities", () => {
  it("enforces request body, input count and image-input rules", async () => {
    const a = await FixtureAdapter.create({ latency: 0, reset: true });
    const latest = (await a.getHistory("fx-branch-1"))[0];
    const caps = { ...FIXTURE_CAPABILITIES, maxRequestBodyBytes: 10, maxInputs: 1 };
    const p = draftProblems(caps, latest, { kind: "image", mode: "create", targetKey: "banner", inputKeys: ["site", "cover"], requirement: "一二三四五" });
    expect(p.join()).toMatch(/请求体上限/);
    expect(p.join()).toMatch(/输入最多 1 个/);
    expect(p.join()).toMatch(/图片参考或编辑/);
  });
});
