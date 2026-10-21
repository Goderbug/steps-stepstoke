import { signingAccount } from "../domain/types";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RelayAdapter } from "../domain/adapter";
import type { DisplayAccount as Account } from "../domain/types";
import { FIXTURE_CHAIN_ID } from "../domain/fixtureAdapter";
import { utf8Length } from "../domain/files";
import { CopyId, formatTime, short } from "./format";

export function ProjectList({ adapter, account }: { adapter: RelayAdapter; account: Account }) {
  const q = useQuery({ queryKey: ["branches", adapter.kind], queryFn: () => adapter.listBranches() });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <section className="panel" aria-labelledby="list-title">
        <div className="panel-head">
          <h1 id="list-title">公开项目</h1>
          <button className="btn btn-primary" aria-expanded={creating} aria-controls="create-form" onClick={() => setCreating((v) => !v)}>
            {creating ? "收起创建表单" : "创建项目"}
          </button>
        </div>
        <p className="lede">每个项目从一个根分支开始，目标创建后不能修改。创建只花 gas，不会购买 AI。</p>
        {creating && <CreateBranchForm key={`${account.address}:${account.chainId}`} adapter={adapter} account={account} onDone={() => setCreating(false)} />}
        {q.isPending && <p className="state-line">正在读取项目…</p>}
        {q.isError && <p className="alert alert-error" role="alert">读取失败：{(q.error as Error).message} <button className="btn btn-link" onClick={() => q.refetch()}>重试</button></p>}
        {q.data && q.data.length === 0 && <p className="empty">还没有项目。创建第一个项目，写下它的固定目标。</p>}
        {q.data && q.data.length > 0 && (
          <ul className="list">
            {q.data.map((b) => (
              <li key={b.id} className="row">
                <div className="row-main">
                  <a className="row-title" href={`#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.id}`}>{b.projectTitle}</a>
                  <p className="row-goal">{b.direction ? `分叉方向：${b.direction}` : b.goal}</p>
                  <p className="meta">
                    {b.parent ? "分叉分支" : "根分支"} · 创建者 {short(b.creator)} · {formatTime(b.createdAt)}
                    {b.imdProjectId ? "" : " · 尚无 IMD 项目"}
                  </p>
                </div>
                <a className="btn btn-secondary" href={`#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.id}`} aria-label={`打开 ${b.projectTitle}`}>打开</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CreateBranchForm({ adapter, account, onDone }: { adapter: RelayAdapter; account: Account; onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string; href?: string } | null>(null);
  const lock = useRef(false);
  const caps = useQuery({ queryKey: ["caps", adapter.kind], queryFn: () => adapter.getCapabilities() });
  const wrongNet = !account.address || account.chainId !== (caps.data?.chainId ?? FIXTURE_CHAIN_ID);
  const titleErr = review && !title.trim() ? "请填写项目名称" : null;
  const goalErr = review && !goal.trim() ? "请填写项目目标" : null;

  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const b = await adapter.createBranch(signingAccount(account), { title, goal });
      await qc.invalidateQueries({ queryKey: ["branches"] });
      setMsg({ kind: "ok", text: `已创建「${b.projectTitle}」。`, href: `#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.id}` });
      setTitle("");
      setGoal("");
      setReview(false);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <form id="create-form" className="form" onSubmit={(e) => { e.preventDefault(); setReview(true); }} noValidate>
      <h2>创建项目根分支</h2>
      <label className="field">
        <span>项目名称</span>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setReview(false); }} aria-invalid={!!titleErr} aria-describedby={titleErr ? "title-err" : undefined} maxLength={80} autoComplete="off" />
        {titleErr && <span id="title-err" className="field-err">{titleErr}</span>}
      </label>
      <label className="field">
        <span>固定目标（创建后不能修改）</span>
        <textarea rows={3} value={goal} onChange={(e) => { setGoal(e.target.value); setReview(false); }} aria-invalid={!!goalErr} aria-describedby={goalErr ? "goal-err" : "goal-len"} />
        <span id="goal-len" className="hint">{utf8Length(goal)} 字节</span>
        {goalErr && <span id="goal-err" className="field-err">{goalErr}</span>}
      </label>
      {!review && <button className="btn btn-primary" type="submit">预览创建</button>}
      {review && title.trim() && goal.trim() && (
        <div className="confirm" aria-label="创建预览">
          <h3>签名前确认</h3>
          <dl className="facts">
            <div><dt>项目名称</dt><dd>{title.trim()}</dd></div>
            <div><dt>固定目标</dt><dd>{goal.trim()}</dd></div>
            <div><dt>签名账户</dt><dd><CopyId value={account.address} label="签名账户" />（{account.label}）</dd></div>
            <div><dt>费用</dt><dd>只需 gas；不会购买 AI。名称和目标一同固定在链上，完整文本最多 512 字节；执行需要之后单独资助</dd></div>
          </dl>
          {wrongNet && <p className="alert alert-error" role="alert">请连接钱包并切换到此模式的链。</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy || wrongNet} onClick={submit}>{busy ? "等待签名…" : "签名并创建"}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setReview(false)}>返回修改</button>
          </div>
        </div>
      )}
      {msg && (
        <p className={msg.kind === "ok" ? "alert alert-ok" : "alert alert-error"} role={msg.kind === "ok" ? "status" : "alert"}>
          {msg.text} {msg.href && <a href={msg.href} onClick={onDone}>打开项目</a>}
        </p>
      )}
    </form>
  );
}
