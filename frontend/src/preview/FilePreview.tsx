import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { RelayAdapter } from "../domain/adapter";
import { imageDimensions, safeFileName, verifyFile, type VerifyResult } from "../domain/files";
import type { AssetVersion, Capabilities } from "../domain/types";
import { isolatedSrcDoc, renderMarkdown } from "./sanitize";
import { sdk } from "../domain/sdk";
import { CopyId, KIND_LABEL } from "../ui/format";
import { EvidenceDisclosure } from "../components/platform";
import { recordVerification, verificationKey } from "../ui/verification";

type Load =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; bytes: Uint8Array; result: VerifyResult };

/** Native keyboard scrolling of overflow regions differs across WebKit and Chromium. */
function scrollMarkdownTable(event: KeyboardEvent<HTMLDivElement>) {
  const region = event.target;
  // Only handle keys on our focused table wrapper, never on a link inside the document.
  if (!(region instanceof HTMLElement) || !region.matches('.table-scroll[role="region"]') ||
      event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      region.scrollWidth <= region.clientWidth) return;
  const end = region.scrollWidth - region.clientWidth;
  const next = event.key === "ArrowRight" ? region.scrollLeft + 40 :
    event.key === "ArrowLeft" ? region.scrollLeft - 40 :
    event.key === "Home" ? 0 : event.key === "End" ? end : null;
  if (next === null) return;
  event.preventDefault();
  region.scrollLeft = Math.max(0, Math.min(end, next));
}

/** Fetches the actual bytes of one asset version, verifies them against the A1 descriptor and previews safely. */
export function FilePreview({ asset, adapter, caps }: { asset: AssetVersion; adapter: RelayAdapter; caps: Capabilities }) {
  // Reset synchronously on version change: old verified bytes never flash as the new version.
  return <VerifiedPreview key={JSON.stringify([verificationKey(asset, adapter.identity), caps.maxBytes[asset.kind], caps.mediaTypes[asset.kind]])} asset={asset} adapter={adapter} caps={caps} />;
}

function VerifiedPreview({ asset, adapter, caps }: { asset: AssetVersion; adapter: RelayAdapter; caps: Capabilities }) {
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const d = asset.descriptor;

  const lifetime = useRef(true);
  useEffect(() => { lifetime.current = true; return () => { lifetime.current = false; }; }, []);
  async function verifyBytes(bytes: Uint8Array) {
        const result = await verifyFile(bytes, d, asset.kind, caps.maxBytes[asset.kind], caps.mediaTypes[asset.kind]);
        if (result.ok && asset.kind === "image") {
          const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: d.mediaType }));
          const image = new Image();
          image.src = url;
          let decoded = false;
          try { await image.decode(); decoded = true; } catch { /* matching hashes do not establish a decodable image */ }
          finally { URL.revokeObjectURL(url); }
          result.checks.push({ name: "Image decode", ok: decoded, detail: decoded ? "Decoded by the browser" : "Image could not be decoded" });
          result.ok = decoded;
        }
    return result;
  }
  const manual = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > caps.maxBytes[asset.kind] || file.size !== d.bytes) throw new Error("Selected file length does not match the authenticated descriptor");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await verifyBytes(bytes);
      if (!lifetime.current) return;
      recordVerification(asset, result.ok ? "verified" : "failed", adapter.identity);
      setLoad({ phase:"done", bytes, result });
    } catch (e) { if (lifetime.current) { recordVerification(asset, "failed", adapter.identity); setLoad({ phase:"error", message:(e as Error).message }); } }
  };

  useEffect(() => {
    let live = true;
    setLoad({ phase: "loading" });
    adapter
      .fetchFile(d, asset.producerJobId)
      .then(async (bytes) => {
        const result = await verifyBytes(bytes);
        if (live) {
          recordVerification(asset, result.ok ? "verified" : "failed", adapter.identity);
          setLoad({ phase: "done", bytes, result });
        }
      })
      .catch((e: Error) => {
        if (!live) return;
        recordVerification(asset, "failed", adapter.identity);
        setLoad({ phase: "error", message: e.message });
      });
    return () => { live = false; };
  }, [adapter, asset, caps, d]);

  const verified = load.phase === "done" && load.result.ok;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!verified || load.phase !== "done") { setBlobUrl(null); return; }
    // Downloads use octet-stream so the browser saves rather than renders; images use their sniffed type.
    const type = asset.kind === "image" ? d.mediaType : "application/octet-stream";
    const url = URL.createObjectURL(new Blob([load.bytes as BlobPart], { type }));
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [verified, load, asset.kind, d.mediaType]);

  const text = load.phase === "done" && verified && asset.kind !== "image" ? new TextDecoder().decode(load.bytes) : null;

  return <div className="preview" aria-live="polite">
    {load.phase === "loading" && <p className="state-line">Retrieving and verifying exact bytes…</p>}
    {load.phase === "error" && <p className="alert alert-error" role="alert">File unavailable: {load.message}. Preview and download are unavailable; this file is not verified.</p>}
    {adapter.routeBase === "ethereum" && !verified && load.phase !== "loading" && <div className="form"><p className="hint">If the official host blocks browser reads, download the original file, then select it here. Only matching bytes receive a verified preview. File checks cannot settle a round.</p><a className="btn btn-secondary" href={sdk.artifactURL(d.sha256)} target="_blank" rel="noopener noreferrer">Open official file (unverified)</a><label className="field"><span>Select original file to verify</span><input type="file" onChange={e => void manual(e.target.files?.[0])} /></label></div>}
    {load.phase === "done" && !verified && <p className="alert alert-error" role="alert">Verification failed. Preview and download are unavailable. The producer must supply the correct file or binding.</p>}
    {verified && <div className="preview-state"><span className="badge badge-ok">Verified locally · SHA-256, length, media</span>{blobUrl && <a className="btn btn-secondary" href={blobUrl} download={safeFileName(d.path)}>Download verified file</a>}</div>}
    {verified && asset.kind === "html" && text !== null && <iframe className="frame" title={`${d.name} isolated preview`} sandbox="" referrerPolicy="no-referrer" srcDoc={isolatedSrcDoc(text)} />}
    {verified && asset.kind === "document" && text !== null && <div className="md" onKeyDown={scrollMarkdownTable} dangerouslySetInnerHTML={{__html:renderMarkdown(text)}} />}
    {verified && asset.kind === "image" && blobUrl && <figure className="img-box"><img src={blobUrl} alt={`${asset.assetKey} from round ${asset.revision}`} /><figcaption>{imageDimensions(load.phase === "done" ? load.bytes : new Uint8Array())?.width} × {imageDimensions(load.phase === "done" ? load.bytes : new Uint8Array())?.height} pixels · natural aspect ratio</figcaption></figure>}
    <EvidenceDisclosure title="File verification details"><dl className="facts"><div><dt>File</dt><dd>{d.path} · {KIND_LABEL[asset.kind]} · {d.mediaType}</dd></div><div><dt>Descriptor length</dt><dd>{d.bytes} bytes</dd></div><div><dt>Descriptor SHA-256</dt><dd><CopyId value={d.sha256} label="file SHA-256" /></dd></div><div><dt>Producer job</dt><dd><CopyId value={asset.producerJobId} label="producer job" /></dd></div></dl>{load.phase === "done" && <ul className="checks">{load.result.checks.map(c => <li key={c.name} className={c.ok ? "check-ok" : "check-bad"}>{c.name}: {c.ok ? "Pass" : "Fail"} · {c.detail}</li>)}</ul>}<p className="hint">Exact descriptor and version keyed bytes. Verification is a local observation. HTML is isolated; Markdown is sanitized.</p></EvidenceDisclosure>
  </div>;
}
