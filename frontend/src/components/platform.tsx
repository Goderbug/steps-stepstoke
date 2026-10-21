import type { RelayAdapter } from "../domain/adapter";
import type { Capabilities } from "../domain/types";
import { VerifiedThumbnail } from "./VerifiedThumbnail";
import type { ReactNode } from "react";
import type { Branch, Checkpoint, Proposal, Sponsorship } from "../domain/types";
import { STAGES } from "../domain/types";
import { CopyId, KIND_LABEL, STAGE_LABEL, STATE_LABEL } from "../ui/format";

export function EvidenceDisclosure({ title = "Evidence and provenance", children, open }: { title?: string; children: ReactNode; open?: boolean }) {
  return <details className="evidence" open={open}><summary>{title}</summary><div className="evidence-body">{children}</div></details>;
}

export function ProjectHeader({ title, goal, branch, back, children }: { title: string; goal: string; branch?: Branch; back?: string; children?: ReactNode }) {
  return <section className="project-header" aria-labelledby="project-title">
    {back && <a className="back-link" href={back}>← All projects</a>}
    <div className="panel-head"><h1 id="project-title">{title}</h1>{children}</div>
    <p className="project-goal">{goal}</p>
    {branch?.direction && <p className="hint">Fork direction: {branch.direction}</p>}
  </section>;
}

export function RoundItem({ checkpoint: cp, selected, latest, onSelect, thumbnail }: { thumbnail?: ReactNode; checkpoint: Checkpoint; selected: boolean; latest: boolean; onSelect: () => void }) {
  const label = cp.createdBy === "round" ? `Round ${cp.revision}` : cp.createdBy === "fork" ? "Inherited start" : "Project created";
  return <li className={selected ? "round-item selected" : "round-item"}>
    <button type="button" className="round-button" aria-label={`Select ${label}${latest ? ", Latest" : ""}${selected ? ", Selected" : ""}`} aria-current={selected ? "step" : undefined} onClick={onSelect}>
      {thumbnail}<span className="round-number mono">{String(cp.revision).padStart(2, "0")}</span>
      <span className="round-info"><strong>{label}</strong><span className="meta">{cp.createdBy === "round" ? cp.changed.map(k => KIND_LABEL[cp.assets.find(a => a.assetKey === k)?.kind ?? "document"]).filter((x, i, a) => a.indexOf(x) === i).join(" + ") : cp.createdBy === "fork" ? "Snapshot inherited; no paid round" : "Fixed goal; no paid round"}</span></span>
      <span className="round-labels">{latest && <span className="tag">Latest</span>}{selected && <span className="tag tag-accent">Selected</span>}</span>
    </button>
  </li>;
}

export function SequenceRail({ checkpoints, selectedId, latestId, onSelect, adapter, caps }: { adapter?: RelayAdapter; caps?: Capabilities; checkpoints: Checkpoint[]; selectedId: string; latestId: string; onSelect: (id: string) => void }) {
  return <section className="sequence" aria-labelledby="sequence-title"><div className="section-heading"><h2 id="sequence-title">Sequence</h2><span className="meta">Accepted checkpoints in chain order</span></div>
    <ol className="sequence-rail">{[...checkpoints].sort((a,b) => a.revision-b.revision).map(cp => <RoundItem key={cp.id} checkpoint={cp} thumbnail={adapter && caps && cp.assets.find(a=>cp.changed.includes(a.assetKey)&&a.kind==="image") ? <VerifiedThumbnail asset={cp.assets.find(a=>cp.changed.includes(a.assetKey)&&a.kind==="image")!} adapter={adapter} caps={caps}/> : undefined} selected={cp.id===selectedId} latest={cp.id===latestId} onSelect={() => onSelect(cp.id)} />)}</ol>
  </section>;
}

export function ContributionCard({ proposal: p, children }: { proposal: Proposal; children?: ReactNode }) {
  return <article className="contribution-card">
    <div className="panel-head"><h3>{p.mode === "create" ? "Create" : "Update"} {KIND_LABEL[p.kind]} <span className="meta">· {p.targetKey}</span></h3><span className={p.status==="current" ? "tag tag-accent" : "tag"}>{p.status === "current" ? "Eligible" : p.status === "stale" ? "Stale anchor" : "Funded"}</span></div>
    <p className="req">{p.requirement}</p>
    <EvidenceDisclosure title="Proposal details"><dl className="facts"><div><dt>Proposal</dt><dd><CopyId value={p.id} label="proposal ID" /></dd></div><div><dt>Anchor</dt><dd><CopyId value={p.anchor} label="proposal anchor" /></dd></div><div><dt>Inputs</dt><dd>{p.inputs.length ? p.inputs.map(i => `${i.assetKey}@${i.revision}`).join(", ") : "None"}</dd></div><div><dt>Proposer</dt><dd><CopyId value={p.proposer} label="proposer" /></dd></div><div><dt>Publication</dt><dd>{p.publish ? "Requested; observed separately" : "Not requested"}</dd></div></dl></EvidenceDisclosure>
    {children}
  </article>;
}

export function BuildStatus({ sponsorship: sp, files }: { sponsorship: Sponsorship; files?: { state: Sponsorship["stages"]["files"]; text: string } }) {
  return <ol className="stages" aria-label="Independent execution stages">{STAGES.map(s => <li key={s} className={`stage st-${s==="files" && files ? files.state : sp.stages[s]}`}><span>{STAGE_LABEL[s]}</span><strong>{s==="files" && files ? files.text : STATE_LABEL[sp.stages[s]]}</strong></li>)}</ol>;
}
