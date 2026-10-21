import { useEffect, useRef, useState } from "react";
import type { RelayAdapter } from "../domain/adapter";
import type { AssetVersion, Capabilities } from "../domain/types";
import { verifyFile } from "../domain/files";

/** Only visible, bounded PNG versions are fetched; failure never receives a verification label. */
export function VerifiedThumbnail({ asset, adapter, caps }: { asset: AssetVersion; adapter: RelayAdapter; caps: Capabilities }) {
  const ref=useRef<HTMLSpanElement>(null);const [visible,setVisible]=useState(false);const [url,setUrl]=useState<string|null>(null);const [failed,setFailed]=useState(false);
  useEffect(()=>{if(!ref.current)return;if(!("IntersectionObserver" in window)){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}});observer.observe(ref.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!visible)return;let active=true;let blob:string|null=null;(async()=>{const d=asset.descriptor;if(d.bytes>caps.maxBytes.image)throw new Error("Thumbnail exceeds byte limit");const bytes=await adapter.fetchFile(d,asset.producerJobId);const result=await verifyFile(bytes,d,asset.kind,caps.maxBytes.image,caps.mediaTypes.image);if(!result.ok)throw new Error("Unverified thumbnail");blob=URL.createObjectURL(new Blob([bytes as BlobPart],{type:d.mediaType}));const img=new Image();img.src=blob;await img.decode();if(active)setUrl(blob);else URL.revokeObjectURL(blob);})().catch(()=>{if(active)setFailed(true);if(blob)URL.revokeObjectURL(blob);});return()=>{active=false;if(blob)URL.revokeObjectURL(blob);};},[visible,asset,adapter,caps]);
  return <span ref={ref} className="verified-thumbnail" title={url?"Verified local thumbnail":failed?"Thumbnail unavailable":"Thumbnail waiting for verification"}>{url?<img loading="lazy" src={url} alt="Verified PNG thumbnail" onError={()=>{setUrl(null);setFailed(true);}}/>:<span>{failed?"No preview":"PNG"}</span>}</span>;
}
