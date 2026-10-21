import { useActionScope } from "./actionScope";
import { signingAccount } from "../domain/types";
import { useRef, useState } from "react";
import type { RelayAdapter } from "../domain/adapter";
import { utf8Length } from "../domain/files";
import type { DisplayAccount as Account, AssetKind, Branch, Capabilities, Checkpoint, Proposal, ProposalMode } from "../domain/types";
import { KIND_LABEL, short } from "./format";

interface Props { adapter: RelayAdapter; account: Account; branch: Branch; latest: Checkpoint; caps: Capabilities; prefill: Proposal | null; onDone: () => void }

/** Validates a draft against the capability budgets A1 reports. Returns problems in plain words. */
export function draftProblems(caps: Capabilities, latest: Checkpoint, d: { kind: AssetKind; mode: ProposalMode; targetKey: string; inputKeys: string[]; requirement: string }): string[] {
  const out: string[] = [];
  if (!caps.enabledKinds.includes(d.kind)) out.push(`A1 configuration has disabled ${KIND_LABEL[d.kind]}`);
  if (caps.maxAssetNameBytes) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(d.targetKey)) out.push("Use letters, numbers, underscores or hyphens, up to 64 bytes");
  } else if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(d.targetKey)) out.push("Use lowercase letters, numbers and hyphens, up to 32 characters");
  const existing = latest.assets.find((a) => a.assetKey === d.targetKey);
  if (d.mode === "create" && existing) out.push(`Asset slot ${d.targetKey} already exists; choose Update`);
  if (d.mode === "create" && latest.assets.length >= caps.maxAssets) out.push(`Asset capacity reached: ${caps.maxAssets}, only existing assets can be updated`);
  if (d.mode === "update" && !existing) out.push("Select an existing asset to update");
  if (d.mode === "update" && existing && existing.kind !== d.kind) out.push("The update type must match the target asset");
  if (d.mode === "update" && !d.inputKeys.includes(d.targetKey)) out.push("The update target must be included as an input");
  if (d.inputKeys.length > caps.maxInputs) out.push(`Maximum inputs: ${caps.maxInputs} items`);
  if (new Set(d.inputKeys).size !== d.inputKeys.length) out.push("Input assets cannot be repeated");
  if (d.inputKeys.some((key) => !latest.assets.some((a) => a.assetKey === key))) out.push("Inputs must come from the current checkpoint");
  if (caps.maxOutputs < 1) out.push("A1 configuration does not allow output assets");
  if (d.kind === "image" && d.mode === "update" && !caps.imageEditing) out.push("Image editing is disabled in A1");
  if (d.kind === "image" && d.inputKeys.length > 0) out.push("Image inputs and editing are disabled in A1");
  if (!d.requirement.trim()) out.push("Describe the work to propose");
  const bytes = utf8Length(d.requirement);
  if (bytes > (caps.maxTextBytes ?? caps.maxRequestBodyBytes)) out.push(`Requirement contains ${bytes} bytes, exceeds request text limit ${caps.maxTextBytes ?? caps.maxRequestBodyBytes} bytes`);
  if (caps.maxTextBytes && d.mode === "create") {
    const kinds = new Set(latest.assets.map(a => a.kind)); kinds.add(d.kind);
    if (latest.assets.length + 1 + 3 - kinds.size > caps.maxAssets) out.push("Reserve slots for the remaining asset types");
    if (d.kind === "html" && latest.assets.some(a => a.kind === "html")) out.push("HTML output is fixed to dist/index.html. Update the existing HTML asset");
  }
  if (caps.maxTextBytes && d.kind === "document" && latest.assets.some(a => d.inputKeys.includes(a.assetKey) && a.kind !== "document")) out.push("Markdown accepts Markdown inputs only");
  const inputBytes = latest.assets.filter((a) => d.inputKeys.includes(a.assetKey)).reduce((n, a) => n + a.descriptor.bytes, 0);
  if (d.kind === "html" && inputBytes > caps.maxBytes.html) out.push(`Combined input size: ${inputBytes} bytes, exceeds HTML limit ${caps.maxBytes.html}`);
  return out;
}

export function ProposeForm({ adapter, account, branch, latest, caps, prefill, onDone }: Props) {
  const [kind, setKind] = useState<AssetKind>(prefill?.kind ?? caps.enabledKinds[0]);
  const [mode, setMode] = useState<ProposalMode>(prefill?.mode ?? "create");
  const [targetKey, setTargetKey] = useState(prefill?.targetKey ?? "");
  const [inputs, setInputs] = useState<string[]>(prefill?.inputs.map((i) => i.assetKey).filter((k) => latest.assets.some((a) => a.assetKey === k)) ?? []);
  const [requirement, setRequirement] = useState(prefill?.requirement ?? "");
  const [publish, setPublish] = useState(false);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const lock = useRef(false);
  const assertActive = useActionScope(`${account.address}:${account.chainId}:${latest.id}:${review}:${kind}:${mode}:${targetKey}:${inputs.join(",")}:${requirement}:${publish}`);

  const effectiveInputs = mode === "update" && targetKey && !inputs.includes(targetKey) ? [...inputs, targetKey] : inputs;
  const effectivePublish = kind === "html" && caps.sitePublication && publish;
  const problems = draftProblems(caps, latest, { kind, mode, targetKey, inputKeys: effectiveInputs, requirement });
  const updatable = latest.assets.filter((a) => a.kind === kind);
  const wrongNet = !account.address || account.chainId !== caps.chainId;
  const edit = <T,>(f: (v: T) => void) => (v: T) => { f(v); setReview(false); setMsg(null); };
  /** A type change never carries incompatible choices: single images are create-only with no inputs. */
  const changeKind = (next: AssetKind) => {
    setKind(next);
    const target = latest.assets.find((x) => x.assetKey === targetKey);
    if (next === "image") {
      if (mode === "update") setTargetKey("");
      setMode("create");
      setInputs([]);
    } else if (mode === "update" && target && target.kind !== next) {
      setTargetKey("");
      setInputs(inputs.filter((k) => k !== targetKey));
    }
  };

  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await adapter.propose(signingAccount(account, assertActive), { branchId: branch.id, anchor: latest.id, kind, mode, targetKey, inputKeys: effectiveInputs, requirement, publish: effectivePublish });
      setMsg({ ok: true, text: "Proposal submitted. Anyone can fund this or another eligible proposal." });
      setReview(false);
      setRequirement("");
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="form" aria-labelledby="propose-title" onSubmit={(e) => { e.preventDefault(); setReview(true); }} noValidate>
      <h3 id="propose-title">{prefill ? "Resubmit proposal" : "Propose work"}</h3>
      <p className="hint">Proposing costs gas only. Funding is separate. Current checkpoint: {latest.id}. </p>
      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <select aria-label="Type" value={kind} onChange={(e) => edit(changeKind)(e.target.value as AssetKind)}>
            {caps.enabledKinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <fieldset className="field">
          <legend>Mode</legend>
          <div className="seg">
            <label><input type="radio" name="mode" checked={mode === "create"} onChange={() => edit(setMode)("create")} />Create </label>
            <label><input type="radio" name="mode" checked={mode === "update"} onChange={() => edit(setMode)("update")} disabled={kind === "image"} />Update </label>
          </div>
        </fieldset>
      </div>
      {mode === "create" ? (
        <label className="field">
          <span>New asset name</span>
          <input value={targetKey} onChange={(e) => edit(setTargetKey)(e.target.value.trim())} placeholder="e.g. intro" autoComplete="off" spellCheck={false} />
        </label>
      ) : (
        <label className="field">
          <span>Target asset</span>
          <select aria-label="Target asset" value={targetKey} onChange={(e) => edit(setTargetKey)(e.target.value)}>
            <option value="">Select an asset</option>
            {updatable.map((a) => <option key={a.assetKey} value={a.assetKey}>{a.assetKey} (round {a.revision})</option>)}
          </select>
        </label>
      )}
      <fieldset className="field">
        <legend>Input assets at the current checkpoint</legend>
        {latest.assets.length === 0 && <p className="hint">No input assets at this checkpoint.</p>}
        {latest.assets.map((a) => {
          const forced = mode === "update" && a.assetKey === targetKey;
          return (
            <label key={a.assetKey} className="check">
              <input type="checkbox" checked={forced || inputs.includes(a.assetKey)} disabled={forced || kind === "image"}
                onChange={(e) => edit(setInputs)(e.target.checked ? [...inputs, a.assetKey] : inputs.filter((k) => k !== a.assetKey))} />
              <span>{a.assetKey} · {KIND_LABEL[a.kind]} · round {a.revision} {forced ? " (required update input)" : ""}</span>
            </label>
          );
        })}
      </fieldset>
      <label className="field">
        <span>Requirement</span>
        <textarea aria-label="Requirement" rows={3} value={requirement} onChange={(e) => edit(setRequirement)(e.target.value)} aria-describedby="req-len" />
        <span id="req-len" className="hint">{utf8Length(requirement)} / {caps.maxTextBytes ?? caps.maxRequestBodyBytes} bytes (complete request body limit {caps.maxRequestBodyBytes})</span>
      </label>
      {kind === "html" && caps.sitePublication && (
        <label className="check">
          <input type="checkbox" checked={publish} onChange={(e) => edit(setPublish)(e.target.checked)} />
          <span>Request website publication after execution (off by default; a URL is not acceptance)</span>
        </label>
      )}
      {review && problems.length > 0 && (
        <ul className="alert alert-error" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {!(review && problems.length === 0) && <button className="btn btn-primary" type="submit">Review proposal</button>}
      {review && problems.length === 0 && (
        <div className="confirm" aria-label="Review proposal">
          <h4>Review before signing</h4>
          <dl className="facts">
            <div><dt>Branch</dt><dd>{branch.projectTitle} ({branch.id})</dd></div>
            <div><dt>Work</dt><dd>{mode === "create" ? "Create " : "Update "}{KIND_LABEL[kind]} · Asset slot {targetKey}</dd></div>
            <div><dt>Input versions</dt><dd>{effectiveInputs.length ? latest.assets.filter((a) => effectiveInputs.includes(a.assetKey)).map((a) => `${a.assetKey}@${a.revision}  ${short(a.descriptor.sha256)}`).join(", ") : "None"}</dd></div>
            <div><dt>Requirement</dt><dd className="req">{requirement}</dd></div>
            <div><dt>Publication</dt><dd>{effectivePublish ? "On" : "Off"}</dd></div>
            <div><dt>Anchor checkpoint</dt><dd>{latest.id}</dd></div>
            <div><dt>Signing account</dt><dd>{account.label} {short(account.address)}</dd></div>
            <div><dt>Cost</dt><dd>Gas only. Execution requires separate funding</dd></div>
          </dl>
          {wrongNet && <p className="alert alert-error" role="alert">Connect a wallet on the correct network to sign.</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy || wrongNet} onClick={submit}>{busy ? "Confirming transaction…" : "Sign and submit proposal"}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setReview(false)}>Back to edit</button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "alert alert-ok" : "alert alert-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </form>
  );
}
