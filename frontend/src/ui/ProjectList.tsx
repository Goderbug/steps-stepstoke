import { ProjectHeader } from "../components/platform";
import { useActionScope } from "./actionScope";
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
      <section className="project-list" aria-label="Project list">
        <ProjectHeader title="Projects" goal="Build in rounds. Browse public goals, inspect outputs, then choose what to move forward.">
          <button className="btn btn-primary" aria-expanded={creating} aria-controls="create-form" onClick={() => setCreating(v => !v)}>{creating ? "Close creation" : "Create project"}</button>
        </ProjectHeader>
        {creating && <CreateBranchForm key={`${account.address}:${account.chainId}`} adapter={adapter} account={account} onDone={() => setCreating(false)} />}
        {q.isPending && <p className="state-line">Reading projects…</p>}
        {q.isError && <p className="alert alert-error" role="alert">Read failed: {(q.error as Error).message} <button className="btn btn-link" onClick={() => q.refetch()}>Retry</button></p>}
        {q.data && q.data.length === 0 && <p className="empty">No projects yet. Create a project with a fixed public goal.</p>}
        {q.data && q.data.length > 0 && (
          <ul className="list">
            {q.data.map((b) => (
              <li key={b.id} className="row">
                <div className="row-main">
                  <a className="row-title" href={`#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.id}`}>{b.projectTitle}</a>
                  <p className="row-goal">{b.direction ? `Fork direction: ${b.direction}` : b.goal}</p>
                  <p className="meta">
                    {b.parent ? "Fork branch" : "Root branch"} · Created by {short(b.creator)} · {formatTime(b.createdAt)}
                    {b.imdProjectId ? "" : " · No IMD project yet"}
                  </p>
                </div>
                <a className="btn btn-secondary" href={`#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.id}`} aria-label={`Open ${b.projectTitle}`}>Open</a>
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
  const assertActive = useActionScope(`${account.address}:${account.chainId}:${review}:${title}:${goal}`);
  const caps = useQuery({ queryKey: ["caps", adapter.kind], queryFn: () => adapter.getCapabilities() });
  const wrongNet = !account.address || account.chainId !== (caps.data?.chainId ?? FIXTURE_CHAIN_ID);
  const titleErr = review && !title.trim() ? "Enter a project title" : null;
  const goalErr = review && !goal.trim() ? "Enter a fixed goal" : null;

  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const b = await adapter.createBranch(signingAccount(account, assertActive), { title, goal });
      await qc.invalidateQueries({ queryKey: ["branches"] });
      setMsg({ kind: "ok", text: `Created project: ${b.projectTitle}.`, href: `#/${adapter.kind === "fixture" ? "demo" : "local"}/b/${b.id}` });
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
      <h2>Create a project</h2>
      <label className="field">
        <span>Project title</span>
        <input aria-label="Project title" value={title} onChange={(e) => { setTitle(e.target.value); setReview(false); }} aria-invalid={!!titleErr} aria-describedby={titleErr ? "title-err" : undefined} maxLength={80} autoComplete="off" />
        {titleErr && <span id="title-err" className="field-err">{titleErr}</span>}
      </label>
      <label className="field">
        <span>Fixed goal (cannot change after creation)</span>
        <textarea aria-label="Fixed goal (cannot change after creation)" rows={3} value={goal} onChange={(e) => { setGoal(e.target.value); setReview(false); }} aria-invalid={!!goalErr} aria-describedby={goalErr ? "goal-err" : "goal-len"} />
        <span id="goal-len" className="hint">{utf8Length(goal)} bytes</span>
        {goalErr && <span id="goal-err" className="field-err">{goalErr}</span>}
      </label>
      {!review && <button className="btn btn-primary" type="submit">Review creation</button>}
      {review && title.trim() && goal.trim() && (
        <div className="confirm" aria-label="Review creation">
          <h3>Review before signing</h3>
          <dl className="facts">
            <div><dt>Project title</dt><dd>{title.trim()}</dd></div>
            <div><dt>Fixed goal</dt><dd>{goal.trim()}</dd></div>
            <div><dt>Signing account</dt><dd><CopyId value={account.address} label="Signing account" /> ({account.label})</dd></div>
            <div><dt>Cost</dt><dd>Gas only. Title and goal are fixed on chain, up to 512 bytes combined. Execution requires separate funding.</dd></div>
          </dl>
          {wrongNet && <p className="alert alert-error" role="alert">Connect a wallet on the correct network to sign.</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy || wrongNet} onClick={submit}>{busy ? "Confirming transaction…" : "Sign and create"}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setReview(false)}>Back to edit</button>
          </div>
        </div>
      )}
      {msg && (
        <p className={msg.kind === "ok" ? "alert alert-ok" : "alert alert-error"} role={msg.kind === "ok" ? "status" : "alert"}>
          {msg.text} {msg.href && <a href={msg.href} onClick={onDone}>Open project</a>}
        </p>
      )}
    </form>
  );
}
