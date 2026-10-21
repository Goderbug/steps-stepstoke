import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SponsorPanel } from "../../src/ui/SponsorPanel";
import { loadRecovery, saveRecovery } from "../../src/ui/recovery";
import { FixtureAdapter, DEMO_ACCOUNTS, FIXTURE_CHAIN_ID } from "../../src/domain/fixtureAdapter";
import { fromBase64, imageDimensions, sha256Hex, toBase64, verifyFile } from "../../src/domain/files";
import { isolatedSrcDoc, renderMarkdown } from "../../src/preview/sanitize";
import { PNG_GREEN_B64 } from "../../src/domain/fixtures";
import type { RecoveryRecord } from "../../src/domain/adapter";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("untrusted previews and resource bounds", () => {
  it("strips refresh, links, form targets, active content and non-raster image sources", () => {
    const html = isolatedSrcDoc(`<meta http-equiv="refresh" content="0;url=https://evil.invalid"><a href="https://evil.invalid" target="_top" ping="https://evil.invalid">go</a><form action="https://evil.invalid"><button formaction="https://evil.invalid">send</button></form><iframe srcdoc="x"></iframe><img src="data:image/svg+xml,<svg onload='alert(1)'/>"><script>parent.ethereum.request({method:'eth_sendTransaction'})</script>`);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("script,iframe,form,button,[href],[target],[action],[formaction],[ping],img[src],meta[http-equiv='refresh']")).toHaveLength(0);
    expect(doc.querySelector("meta[http-equiv='Content-Security-Policy']")?.getAttribute("content")).toContain("default-src 'none'");
  });

  it("keeps inline CSS and inline raster images but removes Markdown remote resources and CSS", () => {
    const html = isolatedSrcDoc(`<style>h1{color:red}</style><h1>Hello</h1><img src="data:image/png;base64,${PNG_GREEN_B64}">`);
    expect(html).toContain("h1{color:red}");
    expect(html).toContain(`data:image/png;base64,${PNG_GREEN_B64}`);
    const md = renderMarkdown(`<style>body{display:none}</style><svg onload="alert(1)"></svg><a href="javascript:alert(1)">x</a><img src="https://evil.invalid"><object data="x"></object>`);
    expect(md).not.toMatch(/<style|<svg|<img|<object|javascript:/i);
  });

  it("blocks CSS network sources, oversized inline images and Markdown DOM/focus clobbering", () => {
    const huge = fromBase64(PNG_GREEN_B64);
    new DataView(huge.buffer).setUint32(16, 100000);
    const html = isolatedSrcDoc(`<style>@import 'https://evil.invalid';body{background:url('https://evil.invalid')}</style><p style="background:image-set(url('https://evil.invalid'))">x</p><img src="data:image/png;base64,${toBase64(huge)}">`);
    expect(html).not.toContain("https://evil.invalid");
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("img")?.hasAttribute("src")).toBe(false);
    const md = renderMarkdown('<a id="main" name="ethereum" tabindex="1" autofocus>test</a>');
    expect(md).not.toMatch(/id=|name=|tabindex|autofocus/);
  });

  it("rejects matching-hash images with truncated headers or dimensions beyond preview limits", async () => {
    const png = fromBase64(PNG_GREEN_B64);
    expect(imageDimensions(png)).toEqual({ width: 16, height: 16 });
    const huge = png.slice();
    new DataView(huge.buffer).setUint32(16, 100000);
    for (const bytes of [png.slice(0, 12), huge]) {
      const d = { name: "x.png", path: "x.png", mediaType: "image/png", bytes: bytes.length, sha256: await sha256Hex(bytes) };
      const result = await verifyFile(bytes, d, "image", 1024, ["image/png"]);
      expect(result.ok).toBe(false);
      expect(result.checks.find((c) => c.name === "图片资源上限")?.ok).toBe(false);
    }
  });

  it("rejects invalid UTF-8 even with the expected length/hash and MIME", async () => {
    const bytes = new Uint8Array([0xff, 0xfe]);
    const d = { name: "x.md", path: "x.md", mediaType: "text/markdown", bytes: 2, sha256: await sha256Hex(bytes) };
    expect((await verifyFile(bytes, d, "document", 100, ["text/markdown"])).ok).toBe(false);
  });

  it("round-trips full allowed-size bytes without overflowing the JavaScript argument stack", async () => {
    const bytes = new Uint8Array(2 * 1024 * 1024).map((_, i) => i % 251);
    const roundtrip = fromBase64(toBase64(bytes));
    expect(roundtrip.length).toBe(bytes.length);
    expect(await sha256Hex(roundtrip)).toBe(await sha256Hex(bytes));
  });
});

describe("wallet action lifetime and recovery", () => {
  it("does not request approval after a delayed quote completes for an unmounted wallet form", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    const b = await a.getBranch("fx-branch-1");
    const p = (await a.getProposals(b.id))[0];
    const latest = (await a.getHistory(b.id))[0];
    const q = await a.quoteFee(p.id);
    let resolve!: (value: typeof q) => void;
    const deferred = new Promise<typeof q>((r) => { resolve = r; });
    vi.spyOn(a, "quoteFee").mockResolvedValueOnce(q).mockReturnValueOnce(deferred);
    const approve = vi.spyOn(a, "approve");
    const view = render(<SponsorPanel adapter={a} account={DEMO_ACCOUNTS[0]} branch={b} proposal={p} latest={latest} onDone={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "1. 授权精确额度" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    view.unmount();
    resolve(q);
    await deferred;
    await Promise.resolve();
    expect(approve).not.toHaveBeenCalled();
  });

  it.each(["spender", "anchor", "price", "parentJobId"])("refuses a refreshed quote with changed %s before signing", async (field) => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    const b = await a.getBranch("fx-branch-1"), p = (await a.getProposals(b.id))[0], latest = (await a.getHistory(b.id))[0];
    const q = await a.quoteFee(p.id);
    const bad = { ...q, [field]: field === "price" ? q.price + 1n : field === "spender" ? DEMO_ACCOUNTS[1].address : "changed" };
    vi.spyOn(a, "quoteFee").mockResolvedValueOnce(q).mockResolvedValueOnce(bad);
    const approve = vi.spyOn(a, "approve");
    render(<SponsorPanel adapter={a} account={DEMO_ACCOUNTS[0]} branch={b} proposal={p} latest={latest} onDone={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "1. 授权精确额度" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByRole("alert");
    expect(approve).not.toHaveBeenCalled();
  });

  it("approves the current exact price rather than maxFee and requires new approval if the price rises", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    const b = await a.getBranch("fx-branch-1"), p = (await a.getProposals(b.id))[0], latest = (await a.getHistory(b.id))[0];
    const q = await a.quoteFee(p.id);
    vi.spyOn(a, "quoteFee").mockResolvedValueOnce(q).mockResolvedValueOnce(q).mockResolvedValue({ ...q, price: q.price + 1n });
    const approve = vi.spyOn(a, "approve"), purchase = vi.spyOn(a, "sponsor");
    render(<SponsorPanel adapter={a} account={DEMO_ACCOUNTS[0]} branch={b} proposal={p} latest={latest} onDone={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "1. 授权精确额度" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "100" } });
    fireEvent.click(button);
    const buy = screen.getByRole("button", { name: "2. 购买执行" });
    await waitFor(() => expect(buy).toBeEnabled());
    expect(approve).toHaveBeenCalledWith(DEMO_ACCOUNTS[0], q, q.price);
    fireEvent.click(buy);
    await screen.findByText("当前价格不等于已确认的授权额度，请重新授权当前精确价格");
    expect(purchase).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "1. 授权精确额度" })).toBeEnabled();
  });

  it("treats corrupt storage as absent and handles storage denial without converting a purchase to a failure", () => {
    localStorage.setItem("w1.recovery.v1", '[null,42,{"sponsorshipId":"fake"}]');
    expect(loadRecovery()).toEqual([]);
    const record: RecoveryRecord = { sponsorshipId: "sp", branchId: "b", proposalId: "p", account: DEMO_ACCOUNTS[0].address, txHash: `0x${"11".repeat(32)}`, nonce: 1, savedAt: "2026-10-20", chainId: FIXTURE_CHAIN_ID, adapterKind: "fixture" };
    expect(saveRecovery(record)).toBe(true);
    expect(loadRecovery()).toEqual([record]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage denied"); });
    expect(saveRecovery(record)).toBe(false);
  });

  it("requires original chain/account/hash/nonce/branch/proposal for reconciliation; never purchases", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    a.controls.txOutcome = "unknown";
    const q = await a.quoteFee("fx-prop-1");
    await a.approve(DEMO_ACCOUNTS[0], q, q.price);
    const sp = await a.sponsor(DEMO_ACCOUNTS[0], "fx-prop-1", q.price, q);
    const r: RecoveryRecord = { sponsorshipId: sp.id, branchId: sp.branchId, proposalId: sp.proposalId, account: sp.sponsor, txHash: sp.txHash, nonce: sp.nonce, savedAt: sp.updatedAt, chainId: FIXTURE_CHAIN_ID, adapterKind: "fixture" };
    for (const patch of [{ chainId: 1 }, { adapterKind: "live" as const }, { account: DEMO_ACCOUNTS[1].address }, { nonce: 999 }, { branchId: "elsewhere" }, { proposalId: "elsewhere" }, { txHash: `0x${"00".repeat(32)}` as const }]) {
      expect(await a.reconcile({ ...r, ...patch })).toBeNull();
    }
    expect((await a.reconcile(r))?.stages.purchase).toBe("confirmed");
    expect(await a.getSponsorships(sp.branchId)).toHaveLength(1);
  });
});

describe("fixture purchase exclusion (not A1 integration)", () => {
  it("allows only one outstanding request while a callback is missing or a tx is unknown", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 1 });
    const q1 = await a.quoteFee("fx-prop-1"), q2 = await a.quoteFee("fx-prop-2");
    await a.approve(DEMO_ACCOUNTS[0], q1, q1.price);
    await a.approve(DEMO_ACCOUNTS[1], q2, q2.price);
    const first = a.sponsor(DEMO_ACCOUNTS[0], "fx-prop-1", q1.price, q1);
    await expect(a.sponsor(DEMO_ACCOUNTS[1], "fx-prop-2", q2.price, q2)).rejects.toThrow("尚未完成");
    await first;
    await expect(a.sponsor(DEMO_ACCOUNTS[1], "fx-prop-2", q2.price, q2)).rejects.toThrow("尚未完成");
    expect(await a.getSponsorships("fx-branch-1")).toHaveLength(1);
    expect((await a.getBranch("fx-branch-1")).latestCheckpoint).toBe("fx-branch-1:3");
  });

  it("an identical status-1 retry is explicit, single-use and has no new revision until binding", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    a.controls.callbackOutcome = "refused";
    const q = await a.quoteFee("fx-prop-1");
    await a.approve(DEMO_ACCOUNTS[0], q, q.price);
    const sp = await a.sponsor(DEMO_ACCOUNTS[0], "fx-prop-1", q.price, q);
    const before = await a.getProposals("fx-branch-1");
    const rq = await a.quoteFee("fx-prop-1");
    await expect(a.retryRefused(DEMO_ACCOUNTS[1], sp.id, 0n, rq)).rejects.toThrow("最高费用");
    // B has no allowance of its own: the retry cannot fabricate an approval.
    await expect(a.retryRefused(DEMO_ACCOUNTS[1], sp.id, rq.price, rq)).rejects.toThrow("授权额度不足");
    await expect(a.retryRefused(DEMO_ACCOUNTS[1], sp.id, rq.price, { ...rq, spender: DEMO_ACCOUNTS[0].address })).rejects.toThrow("报价不属于");
    await a.approve(DEMO_ACCOUNTS[1], rq, rq.price);
    a.controls.callbackOutcome = "bad_binding";
    const retry = await a.retryRefused(DEMO_ACCOUNTS[1], sp.id, rq.price, rq);
    expect(retry.proposalId).toBe(sp.proposalId);
    expect(retry.attempt).toBe(2);
    expect(retry.sponsor).toBe(DEMO_ACCOUNTS[1].address);
    expect(retry.txHash).not.toBe(sp.txHash);
    expect((await a.getBranch("fx-branch-1")).latestCheckpoint).toBe("fx-branch-1:3");
    await expect(a.retryRefused(DEMO_ACCOUNTS[1], sp.id, rq.price, rq)).rejects.toThrow("未重试");
    expect(await a.getProposals("fx-branch-1")).toEqual(before);
    await a.resubmitBinding(DEMO_ACCOUNTS[1], retry.id);
    expect(await a.getSponsorships("fx-branch-1")).toHaveLength(2);
    expect((await a.getBranch("fx-branch-1")).latestCheckpoint).toBe("fx-branch-1:4");
    await expect(a.resubmitBinding(DEMO_ACCOUNTS[1], retry.id)).rejects.toThrow("失败的绑定");
  });

  it("an unknown retry receipt stays unknown and reconciles by the retry's own hash and nonce", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    a.controls.callbackOutcome = "refused";
    const q = await a.quoteFee("fx-prop-1");
    await a.approve(DEMO_ACCOUNTS[0], q, q.price);
    const sp = await a.sponsor(DEMO_ACCOUNTS[0], "fx-prop-1", q.price, q);
    const rq = await a.quoteFee("fx-prop-1");
    await a.approve(DEMO_ACCOUNTS[1], rq, rq.price);
    a.controls.callbackOutcome = "missing";
    a.controls.txOutcome = "unknown";
    const retry = await a.retryRefused(DEMO_ACCOUNTS[1], sp.id, rq.price, rq);
    expect(retry.stages.approval).toBe("confirmed");
    expect(retry.stages.purchase).toBe("unknown");
    expect(retry.stages.callback).toBe("not_started");
    const rec = { sponsorshipId: retry.id, branchId: "fx-branch-1", proposalId: "fx-prop-1", account: DEMO_ACCOUNTS[1].address, chainId: 31337, adapterKind: "fixture" as const, savedAt: "x" };
    expect(await a.reconcile({ ...rec, txHash: sp.txHash, nonce: sp.nonce })).toBeNull();
    const done = await a.reconcile({ ...rec, txHash: retry.txHash, nonce: retry.nonce });
    expect(done?.stages.purchase).toBe("confirmed");
    expect(done?.stages.callback).toBe("pending");
    expect(await a.getSponsorships("fx-branch-1")).toHaveLength(2);
  });

  it("rejects signatures and freezes status 2 without an HTTP/time unlock", async () => {
    const a = await FixtureAdapter.create({ reset: true, latency: 0 });
    const q = await a.quoteFee("fx-prop-1");
    a.controls.rejectNextSignature = true;
    await expect(a.approve(DEMO_ACCOUNTS[0], q, q.price)).rejects.toThrow("拒绝");
    expect(await a.getSponsorships("fx-branch-1")).toHaveLength(0);
    await a.approve(DEMO_ACCOUNTS[0], q, q.price);
    a.controls.callbackOutcome = "failed";
    const sp = await a.sponsor(DEMO_ACCOUNTS[0], "fx-prop-1", q.price, q);
    await expect(a.retryRefused(DEMO_ACCOUNTS[1], sp.id, q.price, q)).rejects.toThrow("状态 1");
    await expect(a.sponsor(DEMO_ACCOUNTS[1], "fx-prop-2", q.price, q)).rejects.toThrow("冻结");
    expect((await a.getBranch("fx-branch-1")).frozen).toBe(true);
  });
});
