import { useEffect, useState } from "react";
import type { RelayAdapter } from "../domain/adapter";
import { imageDimensions, safeFileName, verifyFile, type VerifyResult } from "../domain/files";
import type { AssetVersion, Capabilities } from "../domain/types";
import { isolatedSrcDoc, renderMarkdown } from "./sanitize";
import { CopyId, KIND_LABEL } from "../ui/format";
import { recordVerification } from "../ui/verification";

type Load =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; bytes: Uint8Array; result: VerifyResult };

/** Fetches the actual bytes of one asset version, verifies them against the A1 descriptor and previews safely. */
export function FilePreview({ asset, adapter, caps }: { asset: AssetVersion; adapter: RelayAdapter; caps: Capabilities }) {
  // Reset synchronously on version change: old verified bytes never flash as the new version.
  return <VerifiedPreview key={JSON.stringify([asset.producerJobId, asset.descriptor.path, asset.descriptor.sha256, asset.descriptor.bytes, asset.kind, asset.descriptor.mediaType, caps.maxBytes[asset.kind], caps.mediaTypes[asset.kind]])} asset={asset} adapter={adapter} caps={caps} />;
}

function VerifiedPreview({ asset, adapter, caps }: { asset: AssetVersion; adapter: RelayAdapter; caps: Capabilities }) {
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const d = asset.descriptor;

  useEffect(() => {
    let live = true;
    setLoad({ phase: "loading" });
    adapter
      .fetchFile(d, asset.producerJobId)
      .then(async (bytes) => {
        const result = await verifyFile(bytes, d, asset.kind, caps.maxBytes[asset.kind], caps.mediaTypes[asset.kind]);
        if (result.ok && asset.kind === "image") {
          const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: d.mediaType }));
          const image = new Image();
          image.src = url;
          let decoded = false;
          try { await image.decode(); decoded = true; } catch { /* matching hashes do not establish a decodable image */ }
          finally { URL.revokeObjectURL(url); }
          result.checks.push({ name: "图片解码", ok: decoded, detail: decoded ? "浏览器成功解码" : "图片损坏，无法解码" });
          result.ok = decoded;
        }
        if (live) {
          recordVerification(asset, result.ok ? "verified" : "failed");
          setLoad({ phase: "done", bytes, result });
        }
      })
      .catch((e: Error) => {
        if (!live) return;
        recordVerification(asset, "failed");
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

  return (
    <div className="preview" aria-live="polite">
      <dl className="facts">
        <div><dt>文件</dt><dd>{d.name}（{KIND_LABEL[asset.kind]}，{d.mediaType}）</dd></div>
        <div><dt>描述长度</dt><dd>{d.bytes} 字节</dd></div>
        <div><dt>描述 SHA-256</dt><dd><CopyId value={d.sha256} label="文件 SHA-256" /></dd></div>
        <div><dt>生产作业</dt><dd><CopyId value={asset.producerJobId} label="生产作业" /></dd></div>
      </dl>
      {load.phase === "loading" && <p className="state-line">正在下载并校验实际文件…</p>}
      {load.phase === "error" && (
        <p className="alert alert-error" role="alert">无法获取文件：{load.message}。不显示内容，也不标记为已校验。</p>
      )}
      {load.phase === "done" && (
        <>
          <ul className="checks">
            {load.result.checks.map((c) => (
              <li key={c.name} className={c.ok ? "check-ok" : "check-bad"}>
                <span aria-hidden="true">{c.ok ? "✓" : "✕"}</span> {c.name}：{c.ok ? "通过" : "不通过"}，{c.detail}
              </li>
            ))}
          </ul>
          {verified ? (
            <p className="badge badge-ok">已校验：与 A1 描述一致</p>
          ) : (
            <p className="alert alert-error" role="alert">校验失败：内容不予预览，也不提供下载。请让生产方重新提交正确的文件或绑定。</p>
          )}
        </>
      )}
      {verified && asset.kind === "html" && text !== null && (
        <iframe
          className="frame"
          title={`${d.name} 隔离预览`}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={isolatedSrcDoc(text)}
        />
      )}
      {verified && asset.kind === "document" && text !== null && (
        <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      )}
      {verified && asset.kind === "image" && blobUrl && (
        <figure className="img-box">
          <img
            src={blobUrl}
            alt={`${asset.assetKey} 第 ${asset.revision} 轮图片`}
          />
          <figcaption>{imageDimensions(load.phase === "done" ? load.bytes : new Uint8Array())?.width} × {imageDimensions(load.phase === "done" ? load.bytes : new Uint8Array())?.height} 像素</figcaption>
        </figure>
      )}
      {verified && blobUrl && (
        <a className="btn btn-secondary" href={blobUrl} download={safeFileName(d.name)}>
          下载已校验文件
        </a>
      )}
    </div>
  );
}
