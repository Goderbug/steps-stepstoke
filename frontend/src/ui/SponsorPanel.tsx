import { signingAccount } from "../domain/types";
import { useEffect, useRef, useState } from "react";
import type { RelayAdapter } from "../domain/adapter";
import { StaleProposalError, type DisplayAccount as Account, type Branch, type Checkpoint, type FeeQuote, type Proposal, type Sponsorship } from "../domain/types";
import { CopyId, formatUnits, parseUnits } from "./format";
import { saveRecovery } from "./recovery";
import { useActionScope } from "./actionScope";
import { EvidenceDisclosure } from "../components/platform";

interface Props { adapter: RelayAdapter; account: Account; branch: Branch; proposal: Proposal; latest: Checkpoint; onDone: () => void; retryOf?: Sponsorship }

/** Quote -> confirmed exact approval -> explicit purchase. No automatic transaction chaining. */
export function SponsorPanel({ adapter, account, branch, proposal, latest, onDone, retryOf }: Props) {
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [maxFee, setMaxFee] = useState("");
  const [step, setStep] = useState<"review" | "approved">("review");
  const [busy, setBusy] = useState<null | "approve" | "purchase" | "quote">("quote");
  const [err, setErr] = useState<string | null>(null);
  const lock = useRef(false);
  const approvedAmount = useRef<bigint | null>(null);
  const assertActive = useActionScope(`${adapter.identity ?? adapter.kind}:${account.address}:${account.chainId}:${proposal.id}:${latest.id}`);
  useEffect(() => {
    let active = true;
    adapter.quoteFee(proposal.id).then(q => { if (active) { setQuote(q); setMaxFee(formatUnits(q.price, q.decimals)); setBusy(null); } }, (e: Error) => { if (active) { setErr(`Unable to read price: ${e.message}`); setBusy(null); } });
    return () => { active = false; };
  }, [adapter, proposal.id]);
  const maxFeeWei = quote ? parseUnits(maxFee, quote.decimals) : null;
  const feeErr = quote && (maxFeeWei === null ? "Enter a valid amount" : maxFeeWei < quote.price ? "Maximum fee is below the current price" : null);
  const act = async (kind: "approve" | "purchase") => {
    if (lock.current || maxFeeWei === null) return;
    lock.current = true; setBusy(kind); setErr(null);
    try {
      const q = await adapter.quoteFee(proposal.id); assertActive(); setQuote(q);
      if (q.anchor !== proposal.anchor || q.anchor !== latest.id) throw new StaleProposalError();
      if (q.price <= 0n || q.spender.toLowerCase() !== branch.address?.toLowerCase() || q.action !== (branch.head ? "job.continue" : "job.open") || q.parentJobId !== branch.head || (q.proposalId && q.proposalId !== proposal.id)) throw new Error("Quote no longer matches the branch, proposal, spender or parent job. Review again.");
      if (q.price > maxFeeWei) throw new Error("Price exceeds your maximum fee. Review again.");
      if (quote?.bodyHash && q.bodyHash !== quote.bodyHash) throw new Error("Request body changed. Review again.");
      if (kind === "approve") {
        await adapter.approve(signingAccount(account, assertActive), q, q.price); assertActive();
        approvedAmount.current = q.price; setStep("approved");
      } else {
        if (approvedAmount.current !== q.price) { setStep("review"); throw new Error("Price differs from the confirmed approval. Approve the exact current price again."); }
        const signer = signingAccount(account, assertActive);
        const sp = retryOf ? await adapter.retryRefused(signer, retryOf.id, maxFeeWei, q) : await adapter.sponsor(signer, proposal.id, maxFeeWei, q);
        if (account.address) saveRecovery({ sponsorshipId: sp.id, branchId: branch.id, proposalId: proposal.id, account: account.address, txHash: sp.txHash, nonce: sp.nonce, savedAt: new Date().toISOString(), chainId: account.chainId, adapterKind: adapter.kind, identity: adapter.identity });
        onDone();
      }
    } catch (e) { setErr((e as Error).message); }
    finally { lock.current = false; setBusy(null); }
  };
  return <div className="funding-review" aria-label={retryOf ? "Review paid retry" : "Review funding"} aria-busy={busy !== null}>
    <ol className="funding-steps"><li>1. Review proposal</li><li aria-current={step === "review" ? "step" : undefined}>2. Approve tokens</li><li aria-current={step === "approved" ? "step" : undefined}>3. Purchase execution</li></ol>
    <h3>{proposal.mode === "create" ? "Create" : "Update"} {proposal.targetKey}</h3><p className="req">{proposal.requirement}</p>
    <p className="hint">Sponsors cannot edit proposals. Approval and purchase each require your confirmation.</p>
    {retryOf && <p className="alert alert-warn">Authenticated status 1 refused attempt {retryOf.attempt}. This retry pays again for the identical request body, snapshot and proposal.</p>}
    {busy === "quote" && <p className="state-line">Reading current price and checkpoint…</p>}
    <dl className="facts"><div><dt>Current price</dt><dd className="price">{quote ? `${formatUnits(quote.price, quote.decimals)} ${quote.token}` : "Reading…"}</dd></div><div><dt>USD context</dt><dd>Unavailable</dd></div><div><dt>Approval spender</dt><dd>{quote && <CopyId value={quote.spender} label="approval spender" />}</dd></div></dl>
    <EvidenceDisclosure title="Exact proposal, inputs and request"><dl className="facts"><div><dt>Proposal</dt><dd><CopyId value={proposal.id} label="proposal ID" /></dd></div><div><dt>Checkpoint</dt><dd><CopyId value={proposal.anchor} label="anchor checkpoint" /></dd></div><div><dt>Inputs</dt><dd>{proposal.inputs.map(i => <div key={i.assetKey}>{i.assetKey}@{i.revision} · <CopyId value={i.sha256} label="input SHA-256" /></div>)}</dd></div><div><dt>IMD action / parent</dt><dd>{quote?.action} / {quote?.parentJobId ?? "None; first execution"}</dd></div><div><dt>Publication</dt><dd>{proposal.publish ? "Requested; a URL does not establish acceptance" : "Not requested"}</dd></div></dl>{quote?.bodyText && <><pre className="req">{quote.bodyText}</pre><p className="meta">{quote.bodyBytes} / 16384 bytes · keccak {quote.bodyHash}</p></>}</EvidenceDisclosure>
    {quote && <label className="field"><span>Maximum fee ({quote.token})</span><input aria-label={`Maximum fee (${quote.token})`} inputMode="decimal" disabled={busy !== null} value={maxFee} onChange={e => { setMaxFee(e.target.value); setStep("review"); }} aria-invalid={!!feeErr} aria-describedby="fee-hint" /><span id="fee-hint" className={feeErr ? "field-err" : "hint"}>{feeErr ?? "Approve the exact current price. Maximum fee is a purchase cap, never an allowance."}</span></label>}
    {step === "approved" && <p className="alert alert-ok" role="status">Approval confirmed for the exact price. Purchase is a separate action.</p>}
    {err && <p className="alert alert-error" role="alert">{err}</p>}
    <div className="actions"><button className={step === "review" ? "btn btn-primary" : "btn btn-secondary"} disabled={!quote || !!feeErr || busy !== null || step === "approved"} onClick={() => act("approve")}>{busy === "approve" ? "Confirming approval…" : step === "approved" ? "1. Approval confirmed" : "1. Approve exact amount"}</button><button className={step === "approved" ? "btn btn-primary" : "btn btn-secondary"} disabled={!quote || !!feeErr || busy !== null || step !== "approved"} onClick={() => act("purchase")}>{busy === "purchase" ? "Confirming purchase…" : retryOf ? "2. Purchase identical retry" : "2. Purchase execution"}</button></div>
  </div>;
}
