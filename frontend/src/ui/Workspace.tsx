import { signingAccount } from "../domain/types";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RelayAdapter } from "../domain/adapter";
import { FixtureAdapter, type CallbackOutcome } from "../domain/fixtureAdapter";
import { STAGES, type DisplayAccount as Account, type Branch, type Capabilities, type Checkpoint, type Proposal, type Sponsorship } from "../domain/types";
import { FilePreview } from "../preview/FilePreview";
import { CopyId, KIND_LABEL, STAGE_LABEL, STATE_LABEL, formatTime, short } from "./format";
import { ProposeForm } from "./ProposeForm";
import { SponsorPanel } from "./SponsorPanel";
import { loadRecovery, removeRecovery } from "./recovery";
import { useVerificationVersion, verificationOf } from "./verification";

interface Props { adapter: RelayAdapter; branchId: string; account: Account }

export function Workspace({ adapter, branchId, account }: Props) {
  const qc = useQueryClient();
  const branch = useQuery({ queryKey: ["branch", adapter.kind, branchId], queryFn: () => adapter.getBranch(branchId) });
  const history = useQuery({ queryKey: ["history", adapter.kind, branchId], queryFn: () => adapter.getHistory(branchId) });
  const proposals = useQuery({ queryKey: ["proposals", adapter.kind, branchId], queryFn: () => adapter.getProposals(branchId) });
  const sponsorships = useQuery({ queryKey: ["sponsorships", adapter.kind, branchId], queryFn: () => adapter.getSponsorships(branchId), refetchInterval: adapter.kind === "live" ? 3000 : false });
  const caps = useQuery({ queryKey: ["caps", adapter.kind], queryFn: () => adapter.getCapabilities() });
  const [chosen, setChosen] = useState<string | null>(null);
  const [sponsorFor, setSponsorFor] = useState<string | null>(null);
  const [forkFrom, setForkFrom] = useState<string | null>(null);
  const [resubmit, setResubmit] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const who = `${account.address}:${account.chainId}`;
  const prevWho = useRef(who);

  const refresh = () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "caps" });

  // An action prepared for one wallet or network is never kept for another.
  useEffect(() => {
    if (prevWho.current === who) return;
    prevWho.current = who;
    if (sponsorFor || forkFrom) setNotice("账户或网络已变更，已丢弃为之前账户准备的操作。请重新预览。");
    setSponsorFor(null);
    setForkFrom(null);
  }, [who, sponsorFor, forkFrom]);

  // Reconcile any locally remembered transaction by its original hash and nonce. Never re-purchase.
  useEffect(() => {
    const recs = loadRecovery().filter((r) => r.branchId === branchId && r.adapterKind === adapter.kind && r.chainId === account.chainId && r.account.toLowerCase() === account.address.toLowerCase());
    if (!recs.length) { if (adapter.kind === "live") setRecovery("本机没有可用记录；当前状态从链上尝试与检查点恢复，不会自动重购。"); return; }
    let live = true;
    Promise.all(recs.map((r) => adapter.reconcile(r).then((sp) => ({ r, sp })))).then((res) => {
      if (!live) return;
      const lines = res.map(({ r, sp }) => {
        if (!sp) return `交易 ${short(r.txHash ?? "")} 在链上未找到，保持未知；不会自动重新购买。`;
        if (sp.stages.purchase !== "unknown") removeRecovery(r.sponsorshipId);
        return `交易 ${short(r.txHash ?? "")}（nonce ${r.nonce}）对账结果：购买${STATE_LABEL[sp.stages.purchase]}，回调${STATE_LABEL[sp.stages.callback]}。`;
      });
      setRecovery(lines.join(" "));
      refresh();
    }, (e: Error) => live && setRecovery(`对账失败：${e.message}。本地记录仍保留，不会自动重新购买。`));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, branchId, who]);

  if (branch.isPending || history.isPending || caps.isPending) return <p className="state-line">正在读取分支…</p>;
  if (branch.isError) return <p className="alert alert-error" role="alert">读取分支失败：{(branch.error as Error).message} <a href={adapter.kind === "fixture" ? "#/demo" : "#/local"}>返回项目列表</a></p>;
  if (history.isError || caps.isError) return <p className="alert alert-error" role="alert">读取历史或能力配置失败。<button className="btn btn-link" onClick={refresh}>重试</button></p>;

  const b = branch.data;
  const cps = history.data;
  const latest = cps.find((c) => c.id === b.latestCheckpoint);
  // Branch and history are separate reads; while one is newer than the other, wait instead of mixing them.
  if (!latest) return <p className="state-line" role="status">正在同步最新检查点…</p>;
  const view = cps.find((c) => c.id === chosen) ?? latest;
  const wrongNet = !account.address || account.chainId !== caps.data.chainId;
  const fixture = adapter instanceof FixtureAdapter ? adapter : null;
  const isLatestAttempt = (sp: Sponsorship) => !sponsorships.data?.some((other) => other.proposalId === sp.proposalId && other.attempt > sp.attempt);
  const outstanding = sponsorships.data?.some((sp) => isLatestAttempt(sp) && (sp.stages.purchase === "unknown" || sp.stages.purchase === "pending" || sp.stages.callback === "pending" || sp.stages.callback === "refused" || sp.stages.binding === "failed"));

  return (
    <div className="ws">
      <section className="panel ws-head" aria-labelledby="ws-title">
        <p className="crumb"><a href={adapter.kind === "fixture" ? "#/demo" : "#/local"}>公开项目</a> / {b.parent ? "分叉分支" : "根分支"}</p>
        <h1 id="ws-title">{b.projectTitle}</h1>
        <p className="goal"><span className="label">目标</span>{b.goal}</p>
        {b.direction && <p className="goal"><span className="label">分叉方向</span>{b.direction}</p>}
        <nav className="jump" aria-label="工作区分区">
          <a href="#assets" onClick={jump("assets")}>资产</a>
          <a href="#proposals" onClick={jump("proposals")}>提案</a>
          <a href="#progress" onClick={jump("progress")}>资助进度</a>
          <a href="#history" onClick={jump("history")}>历史与分叉</a>
        </nav>
        <dl className="facts facts-grid">
          <div><dt>当前账户</dt><dd>{account.label} <CopyId value={account.address} label="当前账户" /></dd></div>
          <div><dt>网络</dt><dd>{wrongNet ? <span className="warn-text">链 {account.chainId}，与目标链 {caps.data.chainId} 不一致，操作已禁用</span> : `${caps.data.chainName} ${caps.data.chainId}`}</dd></div>
          <div><dt>分支</dt><dd><CopyId value={b.id} label="分支编号" /></dd></div>
          <div><dt>分支合约（授权对象）</dt><dd>{b.address ? <CopyId value={b.address} label="分支合约地址" /> : "不可用"}</dd></div>
          <div><dt>IMD 项目与最新作业</dt><dd>{b.imdProjectId ? <>{b.imdProjectId} · {b.head}</> : "尚无（首次执行需单独资助，使用 job.open）"}</dd></div>
          {b.parent && <div><dt>分叉自</dt><dd><a href={`#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.parent.branchId}`}>{b.parent.branchId}</a> 的检查点 {b.parent.checkpointId}</dd></div>}
        </dl>
        <label className="field field-inline">
          <span>查看的版本</span>
          <select value={view.id} onChange={(e) => setChosen(e.target.value)}>
            {cps.map((c) => <option key={c.id} value={c.id}>第 {c.revision} 轮{c.id === latest.id ? "（当前）" : ""}</option>)}
          </select>
        </label>
        {b.frozen && <p className="alert alert-error" role="alert">该分支的购买已冻结（状态 2 或未知失败）。不会自动解锁、退款或修复。</p>}
      </section>

      {notice && <p className="alert alert-warn" role="status">{notice} <button className="btn btn-link" onClick={() => setNotice(null)}>知道了</button></p>}
      {recovery && <p className="alert alert-warn" role="status">{recovery}</p>}

      <div className="ws-grid">
        <section id="assets" className="panel" aria-labelledby="assets-title" tabIndex={-1}>
          <h2 id="assets-title">资产 · 第 {view.revision} 轮{view.id === latest.id ? "（当前）" : "（历史版本）"}</h2>
          <AssetList cp={view} adapter={adapter} caps={caps.data} />
        </section>

        <section id="proposals" className="panel" aria-labelledby="prop-title" tabIndex={-1}>
          <h2 id="prop-title">提案</h2>
          <p className="hint">任何当前提案都可以被资助，没有先来先选或只选最新。资助者不能修改提案内容。</p>
          {outstanding && <p className="alert alert-warn" role="status">分支有尚未完成的请求。等待原交易、回调或修正绑定；不会重新购买。</p>}
          {proposals.isPending && <p className="state-line">正在读取提案…</p>}
          {proposals.isError && <p className="alert alert-error" role="alert">提案读取失败。<button className="btn btn-link" onClick={() => proposals.refetch()}>重试</button></p>}
          {proposals.data && proposals.data.length === 0 && <p className="empty">还没有提案。用下面的表单提出第一项工作。</p>}
          <ul className="list">
            {proposals.data?.slice().sort((x, y) => order(x) - order(y)).map((p) => (
              <li key={p.id} className="row row-col">
                <ProposalSummary p={p} cps={cps} />
                {p.status === "current" && (
                  <div className="actions">
                    <button className="btn btn-primary" disabled={b.frozen || wrongNet || outstanding} aria-expanded={sponsorFor === p.id} onClick={() => setSponsorFor(sponsorFor === p.id ? null : p.id)}>
                      {sponsorFor === p.id ? "收起资助" : "资助此提案"}
                    </button>
                  </div>
                )}
                {p.status === "stale" && (
                  <div className="actions">
                    <span className="hint">绑定的检查点 {p.anchor} 已不是当前检查点，不能资助。</span>
                    <button className="btn btn-secondary" onClick={() => { setResubmit(p); document.getElementById("propose")?.scrollIntoView(); }}>按当前检查点重新提交</button>
                  </div>
                )}
                {sponsorFor === p.id && (
                  <SponsorPanel key={who} adapter={adapter} account={account} branch={b} proposal={p} latest={latest}
                    onDone={() => { setSponsorFor(null); refresh(); document.getElementById("progress")?.focus(); }} />
                )}
              </li>
            ))}
          </ul>
          <div id="propose">
            <ProposeForm key={`${who}:${latest.id}:${resubmit?.id ?? ""}`} adapter={adapter} account={account} branch={b} latest={latest} caps={caps.data} prefill={resubmit}
              onDone={() => { setResubmit(null); refresh(); }} />
          </div>
        </section>

        <section id="progress" className="panel" aria-labelledby="progress-title" tabIndex={-1}>
          <div className="actions"><h2 id="progress-title">资助进度</h2><button className="btn btn-quiet" onClick={refresh}>刷新链上状态</button></div>
          {fixture && <DemoOutcome fixture={fixture} />}
          {sponsorships.isPending && <p className="state-line">正在读取资助进度…</p>}
          {sponsorships.isError && <p className="alert alert-error" role="alert">资助进度读取失败。<button className="btn btn-link" onClick={() => sponsorships.refetch()}>重试</button></p>}
          {sponsorships.data && sponsorships.data.length === 0 && <p className="empty">这个分支还没有资助。资助一个当前提案后，各阶段会分别显示在这里。</p>}
          <ul className="list">
            {sponsorships.data?.slice().reverse().map((sp) => (
              <SponsorshipRow key={`${who}:${sp.id}`} sp={sp} canRetry={isLatestAttempt(sp)} adapter={adapter} account={account} fixture={fixture} wrongNet={wrongNet} onChange={refresh}
                branch={b} latest={latest} cps={cps} chainId={caps.data.chainId} proposal={proposals.data?.find((p) => p.id === sp.proposalId) ?? null} />
            ))}
          </ul>
        </section>

        <section id="history" className="panel" aria-labelledby="history-title" tabIndex={-1}>
          <h2 id="history-title">历史与分叉</h2>
          <p className="hint">分叉复制所选历史检查点的资产，不复制最新状态、提案、IMD 项目或发布身份。子分支的执行需要单独资助。</p>
          <ol className="list">
            {cps.map((c) => (
              <li key={c.id} className="row row-col">
                <CheckpointSummary c={c} latestId={latest.id} />
                <div className="actions">
                  <button className="btn btn-quiet" onClick={() => { setChosen(c.id); document.getElementById("assets")?.focus(); }}>查看此版本资产</button>
                  {c.revision > 0 && c.createdBy !== "create" && c.assets.length > 0 && (
                    <button className="btn btn-secondary" disabled={wrongNet} aria-expanded={forkFrom === c.id} onClick={() => setForkFrom(forkFrom === c.id ? null : c.id)}>从此检查点分叉</button>
                  )}
                </div>
                {forkFrom === c.id && <ForkForm key={who} adapter={adapter} account={account} branch={b} cp={c} onDone={() => setForkFrom(null)} />}
                {fixture && c.git.state === "pending" && (
                  <button className="btn btn-link demo-only" onClick={() => { fixture.observeGit(c.id); refresh(); }}>演示：观察到 Git 提交</button>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

const order = (p: Proposal) => (p.status === "current" ? 0 : p.status === "sponsored" ? 1 : 2);
const jump = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  const el = document.getElementById(id);
  el?.scrollIntoView({ block: "start" });
  el?.focus({ preventScroll: true });
};

function AssetList({ cp, adapter, caps }: { cp: Checkpoint; adapter: RelayAdapter; caps: Capabilities }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!cp.assets.length) return <p className="empty">这个版本还没有资产。提出一项“新建”工作并资助后，生成的文件会出现在这里。</p>;
  return (
    <ul className="list">
      {cp.assets.map((a) => (
        <li key={a.assetKey} className="row row-col">
          <div className="row-main">
            <p className="row-title">{a.assetKey} <span className="tag">{KIND_LABEL[a.kind]}</span> <span className="tag">第 {a.revision} 轮</span>{cp.changed.includes(a.assetKey) && <span className="tag tag-accent">本轮更新</span>}</p>
            <p className="meta">来源：{a.originBranchId === cp.branchId ? "本分支" : `分支 ${a.originBranchId}`} 检查点 {a.originCheckpoint} · 作业 {a.producerJobId} · {a.descriptor.bytes} 字节</p>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" aria-expanded={open === a.assetKey} onClick={() => setOpen(open === a.assetKey ? null : a.assetKey)}>
              {open === a.assetKey ? "收起" : "下载并校验"}
            </button>
          </div>
          {open === a.assetKey && <FilePreview asset={a} adapter={adapter} caps={caps} />}
        </li>
      ))}
    </ul>
  );
}

function ProposalSummary({ p, cps }: { p: Proposal; cps: Checkpoint[] }) {
  const status = { current: "当前", stale: "已过期", sponsored: "已资助" }[p.status];
  return (
    <div className="row-main">
      <p className="row-title">
        {p.mode === "create" ? "新建" : "更新"}{KIND_LABEL[p.kind]} · {p.targetKey}{" "}
        <span className={p.status === "current" ? "tag tag-accent" : "tag"}>{status}</span>
      </p>
      <p className="meta">提案 <CopyId value={p.id} label="提案编号" /></p>
      <p className="req">{p.requirement}</p>
      <p className="meta">
        输入：{p.inputs.length ? p.inputs.map((i) => `${i.assetKey}@第 ${i.revision} 轮`).join("、") : "无"} · 绑定检查点 {p.anchor}
        {cps.some((c) => c.id === p.anchor) ? "" : "（不在本分支）"} · 网站发布：{p.publish ? "开" : "关"} · 提议者 {short(p.proposer)}
      </p>
    </div>
  );
}

function CheckpointSummary({ c, latestId }: { c: Checkpoint; latestId: string }) {
  const kind = { create: "创建", round: "执行轮次", fork: "分叉起点" }[c.createdBy];
  return (
    <div className="row-main">
      <p className="row-title">第 {c.revision} 轮 · {kind} {c.id === latestId && <span className="tag tag-accent">当前</span>}</p>
      <p className="meta">
        变更：{c.changed.length ? c.changed.join("、") : "无"} · 资助者：{c.funder ? <CopyId value={c.funder} label="历史资助者" /> : "无"} · 作业：{c.jobId ?? "无"} · {formatTime(c.at)}
      </p>
      <p className="meta">资产：{c.assets.length ? c.assets.map((a) => `${a.assetKey}@第 ${a.revision} 轮（${a.originCheckpoint}）`).join("、") : "无"}</p>
      {c.manifestKeccak && <p className="meta">清单 keccak256（不是文件 SHA-256）：<CopyId value={c.manifestKeccak} label="清单 keccak256" /></p>}
      <p className="meta">
        Git：{observed(c.git)}{c.git.url && <> · <SafeLink href={c.git.url}>打开提交</SafeLink></>} · 网站：{observed(c.site)}
        {c.site.url && <> · <SafeLink href={c.site.url}>打开网站</SafeLink>（网址不代表内容被接受）</>}
      </p>
    </div>
  );
}

const observed = (s: Checkpoint["git"]) =>
  ({ not_requested: "未请求", pending: "等待观察", observed: `已观察 ${formatTime(s.observedAt)}`, unavailable: "不可用" })[s.state];

function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!/^https:\/\//i.test(href)) return <span>{children}（链接不安全，已禁用）</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function DemoOutcome({ fixture }: { fixture: FixtureAdapter }) {
  const [, force] = useState(0);
  useEffect(() => fixture.subscribeControls(() => force((n) => n + 1)), [fixture]);
  const c = fixture.controls;
  const set = (patch: Partial<typeof c>) => { Object.assign(fixture.controls, patch); force((n) => n + 1); };
  return (
    <fieldset className="demo-box">
      <legend>演示控制（只影响下一次演示签名）</legend>
      <label className="field field-inline">
        <span>回调结果</span>
        <select value={c.callbackOutcome} onChange={(e) => set({ callbackOutcome: e.target.value as CallbackOutcome })}>
          <option value="missing">不到达（保持等待）</option>
          <option value="accepted">接受并绑定</option>
          <option value="refused">状态 1 拒绝</option>
          <option value="failed">状态 2 失败</option>
          <option value="bad_binding">接受但绑定无效</option>
        </select>
      </label>
      <label className="field field-inline">
        <span>购买交易</span>
        <select value={c.txOutcome} onChange={(e) => set({ txOutcome: e.target.value as "ok" | "unknown" })}>
          <option value="ok">正常回执</option>
          <option value="unknown">无回执（未知）</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={c.rejectNextSignature} onChange={(e) => set({ rejectNextSignature: e.target.checked })} />
        <span>下一次签名被拒绝</span>
      </label>
    </fieldset>
  );
}

/** The file stage after binding: a local observation of this checkpoint's actual output bytes, never chain truth. */
function fileStage(sp: Sponsorship, cps: Checkpoint[]): { state: Sponsorship["stages"]["files"]; text: string; note: string | null } {
  const base = { state: sp.stages.files, text: STATE_LABEL[sp.stages.files], note: null };
  if (sp.stages.files !== "pending" || !sp.checkpointId) return base;
  const cp = cps.find((c) => c.id === sp.checkpointId);
  const outputs = cp?.assets.filter((a) => cp.changed.includes(a.assetKey) && a.originCheckpoint === cp.id) ?? [];
  if (!outputs.length) return base;
  const seen = outputs.map(verificationOf);
  if (seen.includes("failed")) return { state: "failed", text: "本机校验失败", note: "本轮输出的实际文件与 A1 描述不一致或不可用；绑定记录不变，文件不获得已校验标记。" };
  if (seen.every((r) => r === "verified")) return { state: "confirmed", text: "本机已校验", note: `本轮输出 ${outputs.map((a) => a.assetKey).join("、")} 的实际字节已在本页面校验（SHA-256、长度、类型）；这是本机观察，不代表链上验证，重新加载后需要再次校验。` };
  return base;
}

function SponsorshipRow({ sp, canRetry, adapter, account, fixture, wrongNet, onChange, branch, latest, cps, chainId, proposal }: { sp: Sponsorship; canRetry: boolean; adapter: RelayAdapter; account: Account; fixture: FixtureAdapter | null; wrongNet: boolean; onChange: () => void; branch: Branch; latest: Checkpoint; cps: Checkpoint[]; chainId: number; proposal: Proposal | null }) {
  useVerificationVersion();
  const files = fileStage(sp, cps);
  const [retrying, setRetrying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lock = useRef(false);
  const run = async (f: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setErr(null);
    try { await f(); onChange(); } catch (e) { setErr((e as Error).message); } finally { lock.current = false; setBusy(false); }
  };
  return (
    <li className="row row-col" data-testid={`sp-${sp.id}`}>
      <div className="row-main">
        <p className="row-title">提案 {sp.proposalId} · 第 {sp.attempt} 次尝试</p>
        <dl className="facts">
          <div><dt>资助者</dt><dd><CopyId value={sp.sponsor} label="资助者地址" /></dd></div>
          <div><dt>购买交易</dt><dd>{sp.txHash ? <CopyId value={sp.txHash} label="交易哈希" /> : "无"} · nonce {sp.nonce ?? "无"} · 链 {chainId}</dd></div>
        </dl>
        <ol className="stages">
          {STAGES.map((s) => s === "files"
            ? <li key={s} className={`stage st-${files.state}`}><span>{STAGE_LABEL[s]}</span><span>{files.text}</span></li>
            : <li key={s} className={`stage st-${sp.stages[s]}`}><span>{STAGE_LABEL[s]}</span><span>{STATE_LABEL[sp.stages[s]]}</span></li>
          )}
        </ol>
        {sp.note && <p className="hint">{sp.note}</p>}
        {files.note && <p className="hint">{files.note}</p>}
      </div>
      <div className="actions">
        {sp.stages.callback === "refused" && canRetry && (
          <button className="btn btn-primary" disabled={busy || wrongNet || !proposal} aria-expanded={retrying} onClick={() => setRetrying(!retrying)}>{retrying ? "收起重试" : "用相同请求体重试（需再次支付）"}</button>
        )}
        {(sp.stages.binding === "failed" || sp.stages.binding === "pending") && adapter.kind === "fixture" && (
          <button className="btn btn-primary" disabled={busy || wrongNet} onClick={() => run(() => adapter.resubmitBinding(signingAccount(account), sp.id))}>提交修正后的绑定清单（不重新购买）</button>
        )}
        {fixture && sp.stages.callback === "pending" && (
          <button className="btn btn-link demo-only" disabled={busy} onClick={() => run(() => fixture.deliverCallback(sp.id))}>演示：回调到达</button>
        )}
      </div>
      {adapter.kind === "live" && (sp.stages.binding === "failed" || sp.stages.binding === "pending") && <BindingForm disabled={busy || wrongNet} onBind={(raw) => run(() => adapter.resubmitBinding(signingAccount(account), sp.id, raw))} />}
      {retrying && proposal && sp.stages.callback === "refused" && canRetry && !wrongNet && (
        <SponsorPanel adapter={adapter} account={account} branch={branch} proposal={proposal} latest={latest} retryOf={sp}
          onDone={() => { setRetrying(false); onChange(); document.getElementById("progress")?.focus(); }} />
      )}
      {err && <p className="alert alert-error" role="alert">{err}</p>}
    </li>
  );
}

function ForkForm({ adapter, account, branch, cp, onDone }: { adapter: RelayAdapter; account: Account; branch: Branch; cp: Checkpoint; onDone: () => void }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<Branch | null>(null);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setErr(null);
    try {
      const child = await adapter.fork(signingAccount(account), { branchId: branch.id, checkpointId: cp.id, direction });
      setMade(child);
      await qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (made) return <p className="alert alert-ok" role="status">已创建分叉分支。它还没有 IMD 项目，执行需要单独资助。 <a href={`#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${made.id}`} onClick={onDone}>打开分叉分支</a></p>;
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (direction.trim()) setReview(true); }} aria-label={`从第 ${cp.revision} 轮分叉`}>
      <label className="field">
        <span>分叉方向（创建后固定）</span>
        <textarea rows={2} value={direction} onChange={(e) => { setDirection(e.target.value); setReview(false); }} required />
      </label>
      {!review && <button className="btn btn-primary" type="submit" disabled={!direction.trim()}>预览分叉</button>}
      {review && (
        <div className="confirm">
          <h3>签名前确认</h3>
          <dl className="facts">
            <div><dt>来源</dt><dd>{branch.projectTitle} · 检查点 {cp.id}（第 {cp.revision} 轮，不是最新状态）</dd></div>
            <div><dt>复制的资产</dt><dd>{cp.assets.map((a) => `${a.assetKey}@第 ${a.revision} 轮`).join("、")}</dd></div>
            <div><dt>不复制</dt><dd>提案、父分支 IMD 项目与最新作业、发布身份</dd></div>
            <div><dt>方向</dt><dd>{direction.trim()}</dd></div>
            <div><dt>签名账户</dt><dd>{account.label} {short(account.address)}</dd></div>
            <div><dt>费用</dt><dd>只需 gas；不会购买 AI</dd></div>
          </dl>
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "等待签名…" : "签名并分叉"}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setReview(false)}>返回修改</button>
          </div>
        </div>
      )}
      {err && <p className="alert alert-error" role="alert">{err}</p>}
    </form>
  );
}

function BindingForm({ disabled, onBind }: { disabled: boolean; onBind: (raw: Uint8Array) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  return <form className="form" onSubmit={async e => { e.preventDefault(); if (!file) return; setError(null); try { if (file.size > 32768) throw new Error("原始结果超过 32768 字节，不能改写或解锁。请保留此风险记录。"); const raw = new Uint8Array(await file.arrayBuffer()); await onBind(raw); } catch (err) { setError((err as Error).message); } }}>
    <label className="field"><span>原始 result.json（回调 keccak 认证，最多 32768 字节）</span><input type="file" accept=".json,application/json" disabled={disabled} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <p className="hint">只绑定认证的原始字节。修正文件选择或见证不会再次购买；超出有限清单限制的认证结果可能永久无法绑定。</p>
    <button className="btn btn-primary" disabled={disabled || !file}>提交原始结果绑定（不重新购买）</button>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
  </form>;
}
