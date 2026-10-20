import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
import { verifyManifest } from '../sdk/index.mjs';
import { ArtifactFetchError, fetchPublicArtifact, readArtifactFile, verifyHTMLDist } from '../sdk/files.mjs';

test('actual HTML directory rejects symlinks/extras and verifies exact inline image bytes without execution', async () => {
  const scratch = new URL('../test/scratch/', import.meta.url);
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(join(scratch.pathname, 'html-check-'));
  try {
    const fixtures = new URL('../test/fixtures/', import.meta.url);
    const raw = await readFile(new URL('html-3.html.result.json', fixtures));
    const pngRaw = await readFile(new URL('image-2.png.result.json', fixtures));
    const descriptor = verifyManifest(raw, keccak256(raw)).file;
    const png = { descriptor: verifyManifest(pngRaw, keccak256(pngRaw)).file, bytes: await readFile(new URL('image-2.png', fixtures)) };
    const html = await readFile(new URL('html-3.html', fixtures));
    await writeFile(join(dir, 'index.html'), html);
    const result = await verifyHTMLDist(dir, descriptor, [png]);
    assert.equal(result.distShapeVerified, true);
    assert.equal(result.selectedImagesVerified, 1);
    assert.equal(result.behavior, 'NOT_EXECUTED_OR_PROVEN');
    await writeFile(join(dir, 'extra.txt'), 'extra');
    await assert.rejects(verifyHTMLDist(dir, descriptor));
    await rm(join(dir, 'extra.txt'));
    await rm(join(dir, 'index.html'));
    await symlink(new URL('html-3.html', fixtures).pathname, join(dir, 'index.html'));
    await assert.rejects(verifyHTMLDist(dir, descriptor));
    await assert.rejects(readArtifactFile(join(dir, 'index.html')));
    await rm(join(dir, 'index.html'));
    await writeFile(join(dir, 'index.html'), html);
    await assert.rejects(readArtifactFile(join(dir, 'index.html'), 10));
    const corrupted = { ...png, bytes: Buffer.from(png.bytes) };
    corrupted.bytes[12] ^= 1;
    await assert.rejects(verifyHTMLDist(dir, descriptor, [corrupted]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('public artifact fetcher rejects local, credentialed and unsupported sources before any artifact is read', async () => {
  const fixtures = new URL('../test/fixtures/', import.meta.url);
  const raw = await readFile(new URL('document.md.result.json', fixtures));
  const descriptor = verifyManifest(raw, keccak256(raw)).file;
  for (const [url, code] of [
    ['http://example.com/file.md', 'UNSAFE_URL'],
    ['https://127.0.0.1/file.md', 'UNSAFE_URL'],
    ['https://[::1]/file.md', 'UNSAFE_URL'],
    ['https://user:secret@example.com/file.md', 'UNSAFE_URL'],
    ['file:///tmp/file.md', 'UNSAFE_URL'],
    ['https://localhost/file.md', 'PRIVATE_NETWORK']
  ]) {
    await assert.rejects(fetchPublicArtifact(url, descriptor), error => error instanceof ArtifactFetchError && error.code === code);
  }
  await assert.rejects(fetchPublicArtifact('https://example.com/file.md', { mediaType: 'application/octet-stream' }), error => error.code === 'INVALID_DESCRIPTOR');
});
