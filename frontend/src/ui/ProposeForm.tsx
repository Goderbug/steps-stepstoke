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
  if (!caps.enabledKinds.includes(d.kind)) out.push(`A1 配置未启用${KIND_LABEL[d.kind]}`);
  if (caps.maxAssetNameBytes) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(d.targetKey)) out.push("目标名称使用字母、数字、下划线或连字符，最长 64 字节");
  } else if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(d.targetKey)) out.push("目标槽位只能用小写字母、数字和连字符，最长 32 个字符");
  const existing = latest.assets.find((a) => a.assetKey === d.targetKey);
  if (d.mode === "create" && existing) out.push(`槽位 ${d.targetKey} 已存在，请选择“更新”`);
  if (d.mode === "create" && latest.assets.length >= caps.maxAssets) out.push(`资产已达容量上限 ${caps.maxAssets}，只能更新已有槽位`);
  if (d.mode === "update" && !existing) out.push("更新需要选择一个已有的目标资产");
  if (d.mode === "update" && existing && existing.kind !== d.kind) out.push("更新的类型必须与目标资产一致");
  if (d.mode === "update" && !d.inputKeys.includes(d.targetKey)) out.push("更新时目标资产必须作为输入");
  if (d.inputKeys.length > caps.maxInputs) out.push(`输入最多 ${caps.maxInputs} 个`);
  if (new Set(d.inputKeys).size !== d.inputKeys.length) out.push("输入资产不能重复");
  if (d.inputKeys.some((key) => !latest.assets.some((a) => a.assetKey === key))) out.push("输入资产必须来自当前检查点");
  if (caps.maxOutputs < 1) out.push("A1 配置不允许输出资产");
  if (d.kind === "image" && d.mode === "update" && !caps.imageEditing) out.push("A1 未启用图片编辑，不能更新图片");
  if (d.kind === "image" && d.inputKeys.length > 0) out.push("A1 未启用图片参考或编辑，图片工作不能选择输入");
  if (!d.requirement.trim()) out.push("请写下这项工作的要求");
  const bytes = utf8Length(d.requirement);
  if (bytes > (caps.maxTextBytes ?? caps.maxRequestBodyBytes)) out.push(`要求有 ${bytes} 字节，超过请求体上限 ${caps.maxTextBytes ?? caps.maxRequestBodyBytes} 字节`);
  if (caps.maxTextBytes && d.mode === "create") {
    const kinds = new Set(latest.assets.map(a => a.kind)); kinds.add(d.kind);
    if (latest.assets.length + 1 + 3 - kinds.size > caps.maxAssets) out.push("需要为尚未出现的类型保留槽位");
    if (d.kind === "html" && latest.assets.some(a => a.kind === "html")) out.push("HTML 固定输出 dist/index.html，请更新已有 HTML");
  }
  if (caps.maxTextBytes && d.kind === "document" && latest.assets.some(a => d.inputKeys.includes(a.assetKey) && a.kind !== "document")) out.push("Markdown 只能使用 Markdown 输入");
  const inputBytes = latest.assets.filter((a) => d.inputKeys.includes(a.assetKey)).reduce((n, a) => n + a.descriptor.bytes, 0);
  if (d.kind === "html" && inputBytes > caps.maxBytes.html) out.push(`输入合计 ${inputBytes} 字节，超过 HTML 上限 ${caps.maxBytes.html}`);
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
      await adapter.propose(signingAccount(account), { branchId: branch.id, anchor: latest.id, kind, mode, targetKey, inputKeys: effectiveInputs, requirement, publish: effectivePublish });
      setMsg({ ok: true, text: "提案已提交。它与其他当前提案并列，等待任何人资助。" });
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
      <h3 id="propose-title">{prefill ? "重新提交提案" : "提出工作"}</h3>
      <p className="hint">提交提案只花 gas，不会购买 AI。提案绑定当前检查点 {latest.id}。</p>
      <div className="field-row">
        <label className="field">
          <span>类型</span>
          <select value={kind} onChange={(e) => edit(changeKind)(e.target.value as AssetKind)}>
            {caps.enabledKinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <fieldset className="field">
          <legend>方式</legend>
          <div className="seg">
            <label><input type="radio" name="mode" checked={mode === "create"} onChange={() => edit(setMode)("create")} />新建</label>
            <label><input type="radio" name="mode" checked={mode === "update"} onChange={() => edit(setMode)("update")} disabled={kind === "image"} />更新</label>
          </div>
        </fieldset>
      </div>
      {mode === "create" ? (
        <label className="field">
          <span>新槽位名称</span>
          <input value={targetKey} onChange={(e) => edit(setTargetKey)(e.target.value.trim())} placeholder="例如 intro" autoComplete="off" spellCheck={false} />
        </label>
      ) : (
        <label className="field">
          <span>目标资产</span>
          <select value={targetKey} onChange={(e) => edit(setTargetKey)(e.target.value)}>
            <option value="">请选择</option>
            {updatable.map((a) => <option key={a.assetKey} value={a.assetKey}>{a.assetKey}（第 {a.revision} 轮）</option>)}
          </select>
        </label>
      )}
      <fieldset className="field">
        <legend>输入资产（当前检查点中的真实版本）</legend>
        {latest.assets.length === 0 && <p className="hint">当前没有资产可作输入。</p>}
        {latest.assets.map((a) => {
          const forced = mode === "update" && a.assetKey === targetKey;
          return (
            <label key={a.assetKey} className="check">
              <input type="checkbox" checked={forced || inputs.includes(a.assetKey)} disabled={forced || kind === "image"}
                onChange={(e) => edit(setInputs)(e.target.checked ? [...inputs, a.assetKey] : inputs.filter((k) => k !== a.assetKey))} />
              <span>{a.assetKey} · {KIND_LABEL[a.kind]} · 第 {a.revision} 轮{forced ? "（更新目标，必须输入）" : ""}</span>
            </label>
          );
        })}
      </fieldset>
      <label className="field">
        <span>要求</span>
        <textarea rows={3} value={requirement} onChange={(e) => edit(setRequirement)(e.target.value)} aria-describedby="req-len" />
        <span id="req-len" className="hint">{utf8Length(requirement)} / {caps.maxTextBytes ?? caps.maxRequestBodyBytes} 字节（完整请求体上限 {caps.maxRequestBodyBytes}）</span>
      </label>
      {kind === "html" && caps.sitePublication && (
        <label className="check">
          <input type="checkbox" checked={publish} onChange={(e) => edit(setPublish)(e.target.checked)} />
          <span>执行后发布网站（默认关闭；网址不代表内容被接受）</span>
        </label>
      )}
      {review && problems.length > 0 && (
        <ul className="alert alert-error" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {!(review && problems.length === 0) && <button className="btn btn-primary" type="submit">预览提案</button>}
      {review && problems.length === 0 && (
        <div className="confirm" aria-label="提案预览">
          <h4>签名前确认</h4>
          <dl className="facts">
            <div><dt>分支</dt><dd>{branch.projectTitle}（{branch.id}）</dd></div>
            <div><dt>工作</dt><dd>{mode === "create" ? "新建" : "更新"}{KIND_LABEL[kind]} · 槽位 {targetKey}</dd></div>
            <div><dt>输入版本</dt><dd>{effectiveInputs.length ? latest.assets.filter((a) => effectiveInputs.includes(a.assetKey)).map((a) => `${a.assetKey}@第 ${a.revision} 轮 ${short(a.descriptor.sha256)}`).join("、") : "无"}</dd></div>
            <div><dt>要求</dt><dd className="req">{requirement}</dd></div>
            <div><dt>网站发布</dt><dd>{effectivePublish ? "开" : "关"}</dd></div>
            <div><dt>绑定检查点</dt><dd>{latest.id}</dd></div>
            <div><dt>签名账户</dt><dd>{account.label} {short(account.address)}</dd></div>
            <div><dt>费用</dt><dd>只需 gas；执行需要之后单独资助</dd></div>
          </dl>
          {wrongNet && <p className="alert alert-error" role="alert">请连接钱包并切换到此模式的链。</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy || wrongNet} onClick={submit}>{busy ? "等待签名…" : "签名并提交提案"}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setReview(false)}>返回修改</button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "alert alert-ok" : "alert alert-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </form>
  );
}
