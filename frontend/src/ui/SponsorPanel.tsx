import { signingAccount } from "../domain/types";
import { useEffect, useRef, useState } from "react";
import type { RelayAdapter } from "../domain/adapter";
import { StaleProposalError, type DisplayAccount as Account, type Branch, type Checkpoint, type FeeQuote, type Proposal, type Sponsorship } from "../domain/types";
import { CopyId, KIND_LABEL, formatTime, formatUnits, parseUnits } from "./format";
import { saveRecovery } from "./recovery";
import { useActionScope } from "./actionScope";

interface Props {
  adapter: RelayAdapter; account: Account; branch: Branch; proposal: Proposal; latest: Checkpoint; onDone: () => void;
  /** A status-1 refused attempt: the same review, fresh quote and exact allowance, then an identical-body retry. */
  retryOf?: Sponsorship;
}

/** Preview and two-step sponsorship: exact allowance to the A1 Branch, then purchase. Refreshes anchor and fee before each signature. */
export function SponsorPanel({ adapter, account, branch, proposal, latest, onDone, retryOf }: Props) {
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [maxFee, setMaxFee] = useState("");
  const [step, setStep] = useState<"review" | "approved">("review");
  const [busy, setBusy] = useState<null | "approve" | "purchase" | "quote">("quote");
  const [err, setErr] = useState<string | null>(null);
  const lock = useRef(false);
  const approvedAmount = useRef<bigint | null>(null);
  const assertActive = useActionScope();

  useEffect(() => {
    let live = true;
    adapter.quoteFee(proposal.id).then(
      (q) => { if (live) { setQuote(q); setMaxFee(formatUnits(q.price, q.decimals)); setBusy(null); } },
      (e: Error) => { if (live) { setErr(`无法获取当前价格：${e.message}`); setBusy(null); } },
    );
    return () => { live = false; };
  }, [adapter, proposal.id]);

  const maxFeeWei = quote ? parseUnits(maxFee, quote.decimals) : null;
  const feeErr = quote && (maxFeeWei === null ? "请输入有效金额" : maxFeeWei < quote.price ? "最高费用低于当前价格" : null);

  /** Re-reads anchor and price right before a signature; refuses if either moved. */
  const fresh = async (): Promise<FeeQuote> => {
    const q = await adapter.quoteFee(proposal.id);
    assertActive();
    setQuote(q);
    if (q.anchor !== proposal.anchor) throw new StaleProposalError();
    if (q.price <= 0n || q.spender !== branch.address || q.action !== (branch.head ? "job.continue" : "job.open") || q.parentJobId !== branch.head) throw new Error("报价与当前分支、授权对象或父作业不一致，请重新读取");
    if (maxFeeWei === null || q.price > maxFeeWei) throw new Error(`价格已变为 ${formatUnits(q.price, q.decimals)} ${q.token}，高于你的最高费用，请重新确认`);
    return q;
  };

  const act = async (kind: "approve" | "purchase") => {
    if (lock.current || maxFeeWei === null) return;
    lock.current = true;
    setBusy(kind);
    setErr(null);
    try {
      const q = await fresh();
      if (kind === "approve") {
        await adapter.approve(signingAccount(account), q, q.price);
        approvedAmount.current = q.price;
        setStep("approved");
      } else {
        if (approvedAmount.current === null || approvedAmount.current !== q.price) {
          setStep("review");
          throw new Error("当前价格不等于已确认的授权额度，请重新授权当前精确价格");
        }
        const sp = retryOf
          ? await adapter.retryRefused(signingAccount(account), retryOf.id, maxFeeWei, q)
          : await adapter.sponsor(signingAccount(account), proposal.id, maxFeeWei, q);
        if (account.address) saveRecovery({ sponsorshipId: sp.id, branchId: branch.id, proposalId: proposal.id, account: account.address, txHash: sp.txHash, nonce: sp.nonce, savedAt: new Date().toISOString(), chainId: account.chainId, adapterKind: adapter.kind });
        onDone();
      }
    } catch (e) {
      const m = (e as Error).message;
      setErr(e instanceof StaleProposalError ? `${m}。资助者不能修改提案内容。` : m);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const inputs = proposal.inputs.map((i) => latest.assets.find((a) => a.assetKey === i.assetKey && a.revision === i.revision));
  return (
    <div className="confirm" aria-label={retryOf ? "重试资助预览" : "资助预览"} aria-busy={busy !== null}>
      <h3>{retryOf ? "重试资助预览" : "资助预览"}</h3>
      {retryOf && <p className="hint">第 {retryOf.attempt} 次尝试被已认证的回调状态 1 拒绝。本次是第 {retryOf.attempt + 1} 次尝试：使用相同请求体、快照与提案，需要重新授权并再次支付；不会替换父作业、要求或文件。</p>}
      {busy === "quote" && <p className="state-line">正在读取当前价格与检查点…</p>}
      <dl className="facts">
        <div><dt>提案</dt><dd><CopyId value={proposal.id} label="提案编号" /></dd></div>
        <div><dt>工作</dt><dd>{proposal.mode === "create" ? "新建" : "更新"}{KIND_LABEL[proposal.kind]} · 目标槽位 {proposal.targetKey}</dd></div>
        <div><dt>输入版本</dt><dd>{proposal.inputs.length ? proposal.inputs.map((i, n) => (
          <span key={i.assetKey} className="block">{i.assetKey}@第 {i.revision} 轮 · SHA-256 <CopyId value={i.sha256} label={`${i.assetKey} 输入 SHA-256`} />{inputs[n] ? "" : "（不在当前检查点）"}</span>
        )) : "无"}</dd></div>
        <div><dt>要求</dt><dd className="req">{proposal.requirement}</dd></div>
        <div><dt>分支</dt><dd>{branch.projectTitle} · 检查点 {proposal.anchor}</dd></div>
        <div><dt>发布影响</dt><dd>{proposal.publish ? "执行后请求发布网站；网址出现不代表内容被接受" : "不发布网站"}</dd></div>
        {quote && <>
          <div><dt>IMD 动作</dt><dd>{quote.action}{quote.parentJobId ? `，父作业 ${quote.parentJobId}` : "（分支首次执行）"}</dd></div>
          <div><dt>当前价格</dt><dd>{formatUnits(quote.price, quote.decimals)} {quote.token} · 报价于 {formatTime(quote.quotedAt)} · 美元估值不可用</dd></div>
          <div><dt>授权对象</dt><dd>A1 分支合约 <CopyId value={quote.spender} label="授权对象地址" />（不是 IMD 作业合约）</dd></div>
        </>}
      </dl>
      {quote?.bodyText && <details><summary>查看完整请求体 · {quote.bodyBytes} 字节 / 16384</summary><pre className="req">{quote.bodyText}</pre><p className="hint">请求体 keccak：{quote.bodyHash}</p></details>}
      {quote && (
        <label className="field">
          <span>最高费用（{quote.token}）</span>
          <input inputMode="decimal" disabled={busy !== null} value={maxFee} onChange={(e) => { setMaxFee(e.target.value); setStep("review"); }} aria-invalid={!!feeErr} aria-describedby="fee-hint" />
          <span id="fee-hint" className={feeErr ? "field-err" : "hint"}>{feeErr ?? "只授权当前精确价格，最高费用是购买上限；签名前会重新读取价格和检查点。"}</span>
        </label>
      )}
      {err && <p className="alert alert-error" role="alert">{err}</p>}
      <div className="actions">
        <button className="btn btn-primary" disabled={!quote || !!feeErr || busy !== null || step === "approved"} onClick={() => act("approve")}>
          {busy === "approve" ? "等待授权签名…" : step === "approved" ? "1. 已授权" : "1. 授权精确额度"}
        </button>
        <button className="btn btn-primary" disabled={!quote || !!feeErr || busy !== null || step !== "approved"} onClick={() => act("purchase")}>
          {busy === "purchase" ? "等待购买签名…" : retryOf ? "2. 购买重试" : "2. 购买执行"}
        </button>
      </div>
    </div>
  );
}
