import { open, lstat, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { LIMITS, verifyFile } from './index.mjs';

// Explicit operator-selected paths only. This module never resolves paths from a result manifest.
export async function readArtifactFile(filename, maximum = LIMITS.html) {
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || maximum > LIMITS.html) throw new Error('Invalid read limit');
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximum) throw new Error('Expected a bounded regular file');
    const buffer = Buffer.alloc(maximum + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maximum) throw new Error('File exceeds limit');
    return buffer.subarray(0, total);
  } finally {
    await handle.close();
  }
}

// Checks actual dist shape and bytes. It does not execute or certify arbitrary HTML/JS behavior.
export async function verifyHTMLDist(directory, descriptor, selectedImages = []) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Expected a real dist directory');
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.length !== 1 || entries[0].name !== 'index.html' || !entries[0].isFile()) throw new Error('dist must contain only a regular index.html');
  if (descriptor.path !== 'dist/index.html' || descriptor.mediaType !== 'text/html') throw new Error('Wrong HTML output mapping');
  const raw = await readArtifactFile(join(directory, 'index.html'), LIMITS.html);
  const result = verifyFile(descriptor, raw);
  const html = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  if (!Array.isArray(selectedImages) || selectedImages.length > LIMITS.inputs) throw new Error('Input count limit');
  let total = 0;
  for (const input of selectedImages) {
    if (input.descriptor.mediaType !== 'image/png') throw new Error('Only PNG input slots are enabled');
    verifyFile(input.descriptor, input.bytes);
    total += input.bytes.length;
    if (total > LIMITS.imagesTotal) throw new Error('Selected image aggregate limit');
    const uri = `data:image/png;base64,${Buffer.from(input.bytes).toString('base64')}`;
    if (!html.includes(uri)) throw new Error('Selected image bytes not embedded exactly');
  }
  return { ...result, distShapeVerified: true, selectedImagesVerified: selectedImages.length, behavior: 'NOT_EXECUTED_OR_PROVEN' };
}
