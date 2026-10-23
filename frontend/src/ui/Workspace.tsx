import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { branchRoute, type RelayAdapter } from "../domain/adapter";
import { signingAccount, type DisplayAccount as Account, type Branch, type Checkpoint, type Proposal, type Sponsorship } from "../domain/types";
import { CopyId, STATE_LABEL, short } from "./format";
import { ProposeForm } from "./ProposeForm";
import { loadRecovery, removeRecovery, isLatestAttempt as latestAttempt } from "./recovery";
import { useVerificationVersion, verificationOf } from "./verification";
import { useActionScope } from "./actionScope";
import { readWorkspaceSnapshot } from "./snapshot";
import { ProjectHeader, SequenceRail, ContributionCard, BuildStatus, EvidenceDisclosure } from "../components/platform";
import { ArtifactViewer } from "../components/ArtifactViewer";
import { FundingSheet } from "../components/FundingSheet";
import { Sheet } from "../components/Sheet";

interface Props { adapter: RelayAdapter; branchId: string; account: Account }
export function Workspace({ adapter, branchId, account }: Props) {
  const qc = useQueryClient();
  const snapshot = useQuery({ queryKey: ["snapshot", adapter.identity ?? adapter.kind, branchId], queryFn: () => readWorkspaceSnapshot(adapter, branchId) });
  const proposals = useQuery({ queryKey: ["proposals", adapter.identity ?? adapter.kind, branchId], queryFn: () => adapter.getProposals(branchId) });
  const sponsorships = useQuery({ queryKey: ["sponsorships", adapter.identity ?? adapter.kind, branchId], queryFn: () => adapter.getSponsorships(branchId), refetchInterval: adapter.kind === "live" ? (adapter.routeBase === "ethereum" ? 15000 : 3000) : false });
  const caps = useQuery({ queryKey: ["caps", adapter.identity ?? adapter.kind], queryFn: () => adapter.getCapabilities() });
  const [chosen, setChosen] = useState<string | null>(null);
  const [sponsorFor, setSponsorFor] = useState<string | null>(null);
  const [forkFrom, setForkFrom] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const sheetOpener = useRef<HTMLButtonElement | null>(null);
  const [resubmit, setResubmit] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const who = `${adapter.identity ?? adapter.kind}:${branchId}:${account.address}:${account.chainId}`;
  const prevWho = useRef(who);
  const refresh = () => qc.invalidateQueries({ predicate: q => q.queryKey[0] !== "caps" });
  useEffect(() => { if (snapshot.data?.consistent) setChosen(old => old ?? snapshot.data.branch.latestCheckpoint); }, [snapshot.data]);
  useEffect(() => {
    if (prevWho.current === who) return;
    prevWho.current = who; setSponsorFor(null); setForkFrom(null); setPreparing(false);
    setNotice("Account or network changed. Preparation cancelled; review again before signing.");
  }, [who]);
  useEffect(() => {
    const recs = loadRecovery().filter(r => r.branchId === branchId && r.adapterKind === adapter.kind && r.identity === adapter.identity && r.chainId === account.chainId && r.account.toLowerCase() === account.address.toLowerCase());
    if (!recs.length) return;
    let active = true;
    Promise.all(recs.map(async r => ({ r, sp: await adapter.reconcile(r) }))).then(rows => {
      if (!active) return;
      setRecovery(rows.map(({r,sp}) => {
        if (!sp) return `Original transaction ${short(r.txHash ?? "")} remains unknown. No automatic purchase.`;
        if (sp.stages.purchase !== "unknown") removeRecovery(r.sponsorshipId);
        return `Original transaction ${short(r.txHash ?? "")} / nonce ${r.nonce}: purchase ${STATE_LABEL[sp.stages.purchase]}, callback ${STATE_LABEL[sp.stages.callback]}.`;
      }).join(" ")); refresh();
    }, (e: Error) => active && setRecovery(`Reconciliation failed: ${e.message}. Original records retained; no automatic purchase.`));
    return () => { active = false; };
  }, [adapter, branchId, who]);
  if (snapshot.isPending || caps.isPending) return <p className="state-line" role="status">Reading project and sequence…</p>;
  if (snapshot.isError || caps.isError) return <div className="alert alert-error" role="alert"><h1>Project read unavailable</h1><p>{(snapshot.error ?? caps.error)?.message}</p><button className="btn btn-secondary" onClick={() => { snapshot.refetch(); caps.refetch(); }}>Retry read</button></div>;
  const {branch: b, checkpoints: cps, consistent} = snapshot.data;
  const latest = cps.find(c => c.id === b.latestCheckpoint);
  if (!consistent || !latest) return <section className="panel"><h1>Project reads are out of sync</h1><p className="alert alert-warn" role="status">Read-only. Branch and history disagree; actions are paused. Retry fetches both reads together without a wallet or reload.</p><button className="btn btn-primary" disabled={snapshot.isFetching} onClick={() => snapshot.refetch()}>{snapshot.isFetching ? "Reading both…" : "Retry reads"}</button></section>;
  const view = cps.find(c => c.id === chosen) ?? latest;
  const wrongNet = !account.address || account.chainId !== caps.data.chainId || (adapter.kind === "live" && !adapter.capabilities.realWalletSigning);
  const isLatestAttempt = (sp: Sponsorship) => latestAttempt(sponsorships.data, sp);
  const outstanding = sponsorships.data?.some(sp => isLatestAttempt(sp) && (["unknown","pending"].includes(sp.stages.purchase) || ["pending","refused"].includes(sp.stages.callback) || ["pending","failed"].includes(sp.stages.binding)));
  const selectedProposal = proposals.data?.find(p => p.id === sponsorFor);
  const canFork = view.revision > 0 && view.createdBy === "round" && view.assets.length > 0;
  const base = adapter.kind === "fixture" ? "demo" : (adapter.routeBase ?? "local");
  return <div className="ws">
    <ProjectHeader title={b.projectTitle} goal={b.goal} branch={b} back={`#/${base}`} />
    {notice && <p className="alert alert-warn" role="status">{notice}<button className="btn btn-link" onClick={() => setNotice(null)}>Dismiss</button></p>}
    {b.frozen && <p className="alert alert-error" role="alert">Purchases frozen after status 2 or an unknown failure. No automatic unlock, refund or repair.</p>}
    <SequenceRail adapter={adapter} caps={caps.data} checkpoints={cps} selectedId={view.id} latestId={latest.id} onSelect={setChosen} />
    {view.id !== latest.id && <p className="selection-note">Viewing history is read-only. Continue always prepares at the current checkpoint. <button className="btn btn-link" onClick={() => setChosen(latest.id)}>Select latest</button></p>}
    <ArtifactViewer key={view.id} checkpoint={view} adapter={adapter} caps={caps.data}>{canFork && <button className="btn btn-secondary" disabled={wrongNet} onClick={e => { sheetOpener.current = e.currentTarget; setForkFrom(view.id); }}>Historical Fork</button>}</ArtifactViewer>
    <section className="next-action" aria-labelledby="next-title"><div><h2 id="next-title">What comes next?</h2><p>{outstanding ? "An attempt is unresolved. Review its status before funding again." : "Prepare work at the current checkpoint, or fund an eligible contribution."}</p><p className="meta">Continue opens preparation only. Proposal, approval and payment stay separate.</p></div><div className="actions"><button className="btn btn-primary" disabled={b.frozen} onClick={e => { sheetOpener.current = e.currentTarget; setResubmit(null); setPreparing(true); }}>Continue</button><a className="btn btn-secondary" href="#proposals" onClick={jump("proposals")}>{proposals.isSuccess ? `View contributions (${proposals.data.filter(p => p.status === "current").length})` : "View contributions"}</a></div></section>
    <section id="proposals" className="work-section" aria-labelledby="contributions-title" tabIndex={-1}><div className="section-heading"><h2 id="contributions-title">Contributions</h2><span className="meta">Every eligible proposal can be funded</span></div>
      {outstanding && <p className="alert alert-warn" role="status">Wait for the original transaction or callback, or correct its binding. No automatic repurchase.</p>}
      {proposals.isPending && <p className="state-line">Reading proposals…</p>}
      {proposals.isError && <p role="alert">Proposal read failed. <button className="btn btn-link" onClick={() => proposals.refetch()}>Retry</button></p>}
      {proposals.isSuccess && proposals.data.length === 0 && <p className="empty">No proposals yet. Continue opens the preparation form.</p>}
      <ul className="list">{[...(proposals.data ?? [])].sort((a,b) => order(a)-order(b)).map(p => <li key={p.id}><ContributionCard proposal={p}>{p.status === "current" && <button className="btn btn-secondary" disabled={b.frozen || wrongNet || outstanding} onClick={e => { sheetOpener.current = e.currentTarget; setSponsorFor(p.id); }}>Review funding</button>}{p.status === "stale" && <button className="btn btn-quiet" onClick={e => { sheetOpener.current = e.currentTarget; setResubmit(p); setPreparing(true); }}>Prepare at current checkpoint</button>}</ContributionCard></li>)}</ul>
      {wrongNet && <p className="hint">Browse freely. Use Connect wallet in the header and select {caps.data.chainName} to sign.</p>}
    </section>
    <section id="progress" className="work-section" aria-labelledby="progress-title" tabIndex={-1}><div className="section-heading"><h2 id="progress-title">Funding and build status</h2><button className="btn btn-quiet" onClick={refresh}>Refresh chain state</button></div>
      {recovery && <p className="alert alert-warn" role="status">{recovery}</p>}
      {sponsorships.isPending && <p className="state-line">Reading attempts…</p>}
      {sponsorships.isError && <p role="alert">Attempt read failed. <button className="btn btn-link" onClick={() => sponsorships.refetch()}>Retry</button></p>}
      {sponsorships.isSuccess && sponsorships.data.length === 0 && <p className="empty">No funding attempts recorded for this branch.</p>}
      <ul className="list">{sponsorships.data?.slice().reverse().map(sp => <SponsorshipRow key={`${who}:${sp.id}`} {...{sp,adapter,account,wrongNet}} canRetry={isLatestAttempt(sp)} onChange={refresh} branch={b} latest={latest} cps={cps} chainId={caps.data.chainId} proposal={proposals.data?.find(p => p.id===sp.proposalId) ?? null} />)}</ul>
    </section>
    <EvidenceDisclosure title="Branch, network and execution identity"><dl className="facts"><div><dt>Chain</dt><dd>{caps.data.chainName} · {caps.data.chainId}</dd></div><div><dt>Branch / spender</dt><dd><CopyId value={b.address ?? b.id} label="Branch" /></dd></div><div><dt>Latest checkpoint</dt><dd><CopyId value={latest.id} label="latest checkpoint" /></dd></div><div><dt>Selected checkpoint</dt><dd><CopyId value={view.id} label="selected checkpoint" /></dd></div><div><dt>IMD project / latest execution</dt><dd>{b.imdProjectId ?? "None"} / {b.head ?? "None"}</dd></div>{b.parent && <div><dt>Fork provenance</dt><dd><a href={branchRoute(adapter, b.parent.branchId)}>{b.parent.branchId}</a> · {b.parent.checkpointId}</dd></div>}</dl></EvidenceDisclosure>
    {selectedProposal && <FundingSheet returnFocusTo={sheetOpener.current} key={who} adapter={adapter} account={account} branch={b} proposal={selectedProposal} latest={latest} onClose={() => setSponsorFor(null)} onDone={() => { setSponsorFor(null); refresh(); document.getElementById("progress")?.focus(); }} />}
    {preparing && <Sheet returnFocusTo={sheetOpener.current} title="Prepare a contribution" onClose={() => setPreparing(false)}><ProposeForm key={`${who}:${latest.id}:${resubmit?.id ?? ""}`} adapter={adapter} account={account} branch={b} latest={latest} caps={caps.data} prefill={resubmit} onDone={() => { setResubmit(null); setPreparing(false); refresh(); }} /></Sheet>}
    {forkFrom && <Sheet returnFocusTo={sheetOpener.current} title="Historical Fork" onClose={() => setForkFrom(null)}><ForkForm key={who} adapter={adapter} account={account} branch={b} cp={cps.find(c => c.id===forkFrom)!} onDone={() => setForkFrom(null)} /></Sheet>}
  </div>;
}
const order = (p: Proposal) => p.status === "current" ? 0 : p.status === "sponsored" ? 1 : 2;
const jump = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({block:"start"}); document.getElementById(id)?.focus({preventScroll:true}); };

function fileStage(sp: Sponsorship, cps: Checkpoint[], identity?: string) {
  const base = {state:sp.stages.files, text:STATE_LABEL[sp.stages.files], note:null as string | null};
  if (sp.stages.files !== "pending" || !sp.checkpointId) return base;
  const cp = cps.find(c => c.id === sp.checkpointId);
  const outputs = cp?.assets.filter(a => cp.changed.includes(a.assetKey) && a.originCheckpoint===cp.id) ?? [];
  const seen = outputs.map(a => verificationOf(a, identity));
  if (seen.includes("failed")) return {...base,state:"failed" as const,text:"Local verification failed",note:"Output bytes are unavailable or disagree with the descriptor. Binding remains a separate record."};
  if (seen.length && seen.every(r => r === "verified")) return {...base,state:"confirmed" as const,text:"Verified locally",note:"SHA-256, length and media checked in this page. This is a local observation; reload requires verification again."};
  return base;
}

function SponsorshipRow({ sp, canRetry, adapter, account, wrongNet, onChange, branch, latest, cps, chainId, proposal }: { sp: Sponsorship; canRetry: boolean; adapter: RelayAdapter; account: Account; wrongNet: boolean; onChange: () => void; branch: Branch; latest: Checkpoint; cps: Checkpoint[]; chainId: number; proposal: Proposal | null }) {
  useVerificationVersion(); const files = fileStage(sp,cps,adapter.identity);
  const [observation,setObservation] = useState<unknown>(null);
  const retryOpener = useRef<HTMLButtonElement | null>(null);
  const [retrying,setRetrying] = useState(false), [busy,setBusy] = useState(false), [err,setErr] = useState<string | null>(null);
  const lock = useRef(false); const assertActive = useActionScope(`${adapter.identity ?? adapter.kind}:${account.address}:${account.chainId}:${sp.id}`);
  const run = async (f: () => Promise<unknown>) => { if(lock.current)return; lock.current=true;setBusy(true);setErr(null);try{await f();onChange();}catch(e){setErr((e as Error).message);}finally{lock.current=false;setBusy(false);} };
  return <li className="attempt" data-testid={`sp-${sp.id}`}><h3>Attempt {sp.attempt} <span className="meta">· {sp.checkpointId ? "Bound to checkpoint" : "Not a completed round"}</span></h3><BuildStatus sponsorship={sp} files={files} />{sp.note && <p className="hint">{sp.note}</p>}{files.note && <p className="hint">{files.note}</p>}<EvidenceDisclosure title="Transaction and attempt identity"><dl className="facts"><div><dt>Proposal</dt><dd>{sp.proposalId}</dd></div><div><dt>Sponsor</dt><dd><CopyId value={sp.sponsor} label="sponsor" /></dd></div><div><dt>Original transaction</dt><dd>{sp.txHash ? <CopyId value={sp.txHash} label="transaction hash" /> : "Unknown"} · nonce {sp.nonce ?? "unknown"} · chain {chainId}</dd></div>{sp.replacementHash && <><div><dt>Replacement transaction</dt><dd><CopyId value={sp.replacementHash} label="replacement transaction hash" /></dd></div><div><dt>Replacement outcome</dt><dd>{sp.replacementState ?? "Unknown"}</dd></div></>}</dl></EvidenceDisclosure>
    {adapter.routeBase === "ethereum" && adapter.observeAdmission && <EvidenceDisclosure title="Official admission, execution and Git observations"><p className="hint">Read-only HTTP observations, correlated to the on-chain request and Branch payer. They cannot settle a round, grant a retry or override its callback.</p><button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => { setObservation(await adapter.observeAdmission!(sp.id)); })}>Read official job status</button>{observation !== null && <pre className="req">{JSON.stringify(observation,null,2)}</pre>}</EvidenceDisclosure>}
    <div className="actions">{sp.stages.callback === "refused" && canRetry && <button className="btn btn-secondary" disabled={busy || wrongNet || !proposal} onClick={e => { retryOpener.current = e.currentTarget; setRetrying(true); }}>Review identical paid retry</button>}</div>
    {adapter.fetchOriginalResult && sp.stages.binding === "pending" && <button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => {
      const raw = await adapter.fetchOriginalResult!(sp.id);
      const url = URL.createObjectURL(new Blob([raw as BlobPart], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "result.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    })}>Download original result</button>}
    {adapter.kind === "live" && ["failed","pending"].includes(sp.stages.binding) && <BindingForm disabled={busy || wrongNet} onBind={raw => run(() => adapter.resubmitBinding(signingAccount(account,assertActive),sp.id,raw))} />}
    {retrying && proposal && <FundingSheet returnFocusTo={retryOpener.current} adapter={adapter} account={account} branch={branch} proposal={proposal} latest={latest} retryOf={sp} onClose={() => setRetrying(false)} onDone={() => {setRetrying(false);onChange();}} />}
    {err && <p className="alert alert-error" role="alert">{err}</p>}
  </li>;
}
function ForkForm({adapter,account,branch,cp,onDone}:{adapter:RelayAdapter;account:Account;branch:Branch;cp:Checkpoint;onDone:()=>void}) {
  const qc=useQueryClient(); const [direction,setDirection]=useState("");const [review,setReview]=useState(false),[busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null),[made,setMade]=useState<Branch|null>(null);const lock=useRef(false);
  const assertActive=useActionScope(`${adapter.identity ?? adapter.kind}:${account.address}:${account.chainId}:${cp.id}:${review}:${direction}`);
  const submit=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setErr(null);try{const child=await adapter.fork(signingAccount(account,assertActive),{branchId:branch.id,checkpointId:cp.id,direction});assertActive();setMade(child);await qc.invalidateQueries({queryKey:["branches"]});}catch(e){setErr((e as Error).message);}finally{lock.current=false;setBusy(false);}};
  if(made)return <p className="alert alert-ok" role="status">Fork created. It has no IMD project and needs its own later funding. <a href={branchRoute(adapter, made.id)} onClick={onDone}>Open fork</a></p>;
  return <form className="form" aria-label="Prepare historical fork" onSubmit={e=>{e.preventDefault();if(direction.trim())setReview(true);}}><p>Fork the exact selected snapshot. This creates a child branch, without purchasing execution.</p><dl className="facts"><div><dt>Selected checkpoint</dt><dd><CopyId value={cp.id} label="fork checkpoint" /></dd></div><div><dt>Inherited files</dt><dd>{cp.assets.map(a=>`${a.assetKey}@${a.revision}`).join(", ")}</dd></div></dl><label className="field"><span>Fork direction (fixed after creation)</span><textarea required rows={3} value={direction} onChange={e=>{setDirection(e.target.value);setReview(false);}} /></label>{!review?<button className="btn btn-primary" disabled={!direction.trim()}>Review fork</button>:<div className="confirm"><h3>Review before signing</h3><p>{direction}</p><p className="hint">Gas only. File provenance is retained. Proposals, the parent IMD project, execution head and publication identity are not copied.</p><div className="actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy?"Confirming fork…":"Sign and fork"}</button><button type="button" className="btn btn-quiet" onClick={()=>setReview(false)}>Back to edit</button></div></div>}{err&&<p className="alert alert-error" role="alert">{err}</p>}</form>;
}
function BindingForm({disabled,onBind}:{disabled:boolean;onBind:(raw:Uint8Array)=>Promise<void>}) {
  const [file,setFile]=useState<File|null>(null),[err,setErr]=useState<string|null>(null);
  return <form className="form" onSubmit={async e=>{e.preventDefault();if(!file)return;setErr(null);try{if(file.size>32768)throw new Error("Raw result exceeds 32768 bytes. Preserve the record; it cannot be rewritten or unlocked.");await onBind(new Uint8Array(await file.arrayBuffer()));}catch(e){setErr((e as Error).message);}}}><label className="field"><span>Original callback-authenticated result.json (up to 32768 bytes)</span><input type="file" accept=".json,application/json" disabled={disabled} onChange={e=>setFile(e.target.files?.[0]??null)}/></label><p className="hint">Bind exact authenticated bytes. Correcting file selection or witness does not purchase again. Oversized authenticated results may remain unbindable.</p><button className="btn btn-secondary" disabled={disabled||!file}>Bind original result without purchase</button>{err&&<p role="alert">{err}</p>}</form>;
}
