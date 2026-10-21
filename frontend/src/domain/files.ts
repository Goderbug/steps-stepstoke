import type { AssetKind, FileDescriptor, Hex } from "./types";

export async function sha256Hex(bytes: Uint8Array): Promise<Hex> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const utf8 = (s: string) => new TextEncoder().encode(s);
export const utf8Length = (s: string) => utf8(s).length;

/** Detects the real image format from magic bytes. SVG and anything else is rejected. */
export function sniffImage(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

// W1 preview policy, independent of A1's file byte budgets. Check dimensions before decoding.
export const MAX_PREVIEW_IMAGE_SIDE = 4096;
export function imageDimensions(b: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const type = sniffImage(b);
  if (type === "image/png" && b.length >= 33 && view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "image/jpeg") {
    let pos = 2;
    while (pos + 4 <= b.length) {
      if (b[pos++] !== 0xff) return null;
      while (b[pos] === 0xff) pos++;
      const marker = b[pos++];
      if (marker === 0xd9 || marker === 0xda || pos + 2 > b.length) return null;
      const size = view.getUint16(pos);
      if (size < 2 || pos + size > b.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 8) {
        return { width: view.getUint16(pos + 5), height: view.getUint16(pos + 3) };
      }
      pos += size;
    }
  }
  if (type === "image/webp" && b.length >= 30 && view.getUint32(4, true) + 8 === b.length) {
    const tag = String.fromCharCode(...b.slice(12, 16));
    if (tag === "VP8X") return { width: 1 + b[24] + (b[25] << 8) + (b[26] << 16), height: 1 + b[27] + (b[28] << 8) + (b[29] << 16) };
    if (tag === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (tag === "VP8L" && b[20] === 0x2f) return { width: 1 + b[21] + ((b[22] & 0x3f) << 8), height: 1 + (b[22] >> 6) + (b[23] << 2) + ((b[24] & 0xf) << 10) };
  }
  return null;
}

export interface VerifyResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  actualSha256: Hex;
  actualBytes: number;
}

/** Verifies fetched bytes against the A1 descriptor: length, SHA-256, media type and size cap. */
export async function verifyFile(
  bytes: Uint8Array,
  descriptor: FileDescriptor,
  kind: AssetKind,
  maxBytes: number,
  allowedTypes: string[],
): Promise<VerifyResult> {
  const actualSha256 = await sha256Hex(bytes);
  const checks: VerifyResult["checks"] = [];
  checks.push({ name: "长度", ok: bytes.length === descriptor.bytes, detail: `实际 ${bytes.length} 字节，描述 ${descriptor.bytes} 字节` });
  checks.push({ name: "SHA-256", ok: actualSha256 === descriptor.sha256.toLowerCase(), detail: actualSha256 === descriptor.sha256.toLowerCase() ? "与描述一致" : `实际 ${actualSha256}` });
  checks.push({ name: "大小上限", ok: bytes.length <= maxBytes, detail: `上限 ${maxBytes} 字节` });
  let formatOk = allowedTypes.includes(descriptor.mediaType);
  let formatDetail = descriptor.mediaType;
  if (kind === "image") {
    const sniffed = sniffImage(bytes);
    formatOk = formatOk && sniffed === descriptor.mediaType;
    formatDetail = sniffed ? `文件头为 ${sniffed}` : "文件头不是 PNG、JPEG 或 WebP";
    const size = imageDimensions(bytes);
    checks.push({ name: "图片资源上限", ok: !!size && size.width > 0 && size.height > 0 && size.width <= MAX_PREVIEW_IMAGE_SIDE && size.height <= MAX_PREVIEW_IMAGE_SIDE, detail: size ? `${size.width} × ${size.height}，预览每边最多 ${MAX_PREVIEW_IMAGE_SIDE} 像素` : "缺少有效图片尺寸头" });
  } else {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      formatOk = false;
      formatDetail = "不是有效的 UTF-8 文本";
    }
  }
  checks.push({ name: "格式", ok: formatOk, detail: formatDetail });
  return { ok: checks.every((c) => c.ok), checks, actualSha256, actualBytes: bytes.length };
}

/** A download file name that cannot escape into a path or carry control characters. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\p{L}\p{N}._-]/gu, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 96) || "file";
}

export const toBase64 = (b: Uint8Array) => {
  let raw = "";
  for (let offset = 0; offset < b.length; offset += 8192) raw += String.fromCharCode(...b.subarray(offset, offset + 8192));
  return btoa(raw);
};
export const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
