import { useState } from "react";
import type { RelayAdapter } from "../domain/adapter";
import type { Capabilities, Checkpoint } from "../domain/types";
import { FilePreview } from "../preview/FilePreview";
import { CopyId, KIND_LABEL } from "../ui/format";
import { EvidenceDisclosure } from "./platform";

/** The complete selected snapshot, with file origins retained independently of execution head. */
export function ArtifactViewer({ checkpoint: cp, adapter, caps, children }: { checkpoint: Checkpoint; adapter: RelayAdapter; caps: Capabilities; children?: React.ReactNode }) {
  const preferred = cp.assets.find(a => cp.changed.includes(a.assetKey)) ?? cp.assets.find(a => a.kind === "html") ?? cp.assets[0];
  const [key, setKey] = useState(preferred?.assetKey ?? "");
  const asset = cp.assets.find(a => a.assetKey === key) ?? preferred;
  return <section id="assets" data-branch-id={cp.branchId} className="artifact-viewer" aria-labelledby="output-title" tabIndex={-1}>
    <div className="panel-head"><div><h2 id="output-title">{cp.createdBy === "round" ? `Round ${cp.revision} output` : cp.createdBy === "fork" ? "Inherited snapshot" : "Starting point"}</h2><p className="meta">Selected checkpoint · {cp.createdBy === "round" ? "Accepted execution" : "No completed paid round"}</p></div>{children}</div>
    {cp.assets.length > 1 && <div className="asset-tabs" role="group" aria-label="Files in selected snapshot">{cp.assets.map(a => <button key={a.assetKey} data-asset-key={a.assetKey} className={a.assetKey===asset?.assetKey ? "asset-tab active" : "asset-tab"} aria-pressed={a.assetKey===asset?.assetKey} onClick={() => setKey(a.assetKey)}>{a.descriptor.path}<span className="tag">{KIND_LABEL[a.kind]}</span></button>)}</div>}
    {asset ? <><FilePreview asset={asset} adapter={adapter} caps={caps} /><p className="meta origin-line">File origin: {asset.originBranchId} · checkpoint {asset.originCheckpoint} · producer job {asset.producerJobId}. {cp.changed.includes(asset.assetKey) ? "Changed in this checkpoint." : "Retained from an earlier checkpoint."}</p></> : <div className="empty"><h3>The first output starts here</h3><p>Prepare a proposal at the current checkpoint. Approval and funding happen separately.</p></div>}
    <EvidenceDisclosure title={`Complete asset table (${cp.assets.length}) and checkpoint evidence`}>
      <p className="hint">The latest execution is not the origin of every file. Select any file above to verify its exact bytes.</p>
      <div className="table-scroll" role="region" aria-label="Asset provenance table" tabIndex={0}><table><thead><tr><th>File / version</th><th>Original branch</th><th>Original checkpoint</th><th>Producer job</th><th>Descriptor</th></tr></thead><tbody>{cp.assets.map(a => <tr key={a.assetKey}><th scope="row">{a.descriptor.path}<br/>{a.assetKey}@{a.revision}</th><td>{a.originBranchId}</td><td>{a.originCheckpoint}</td><td>{a.producerJobId}</td><td>{a.descriptor.bytes} bytes<br/>{a.descriptor.mediaType}<br/><CopyId value={a.descriptor.sha256} label={`${a.assetKey} SHA-256`} /></td></tr>)}</tbody></table></div>
      <dl className="facts"><div><dt>Checkpoint</dt><dd><CopyId value={cp.id} label="checkpoint ID" /></dd></div><div><dt>Execution job</dt><dd>{cp.jobId ?? "None"}</dd></div><div><dt>Funder</dt><dd>{cp.funder ?? "None"}</dd></div><div><dt>Manifest keccak256</dt><dd>{cp.manifestKeccak ? <CopyId value={cp.manifestKeccak} label="manifest keccak256" /> : "None"}</dd></div><div><dt>Git / publication</dt><dd>{cp.git.state} / {cp.site.state}. External URLs do not establish acceptance. {cp.git.url && <EvidenceLink href={cp.git.url}>View Git evidence</EvidenceLink>} {cp.site.url && <EvidenceLink href={cp.site.url}>View publication evidence</EvidenceLink>}</dd></div></dl>
    </EvidenceDisclosure>
  </section>;
}

function EvidenceLink({href,children}:{href:string;children:React.ReactNode}) {
  return /^https:\/\//i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>Unsafe evidence link disabled</span>;
}
