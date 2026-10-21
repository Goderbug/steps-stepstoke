#!/usr/bin/env python3
"""Verify archived bytes; optionally verify every immutable predecessor blob. Writes nothing."""
import hashlib, json, lzma, pathlib, subprocess, sys, tarfile
root=pathlib.Path(__file__).resolve().parent.parent
index=json.loads(lzma.decompress((root/'docs/history/imported-index.json.xz').read_bytes()))
with tarfile.open(root/'docs/history'/index['archive'],'r:xz') as archive:
 for row in index['entries']:
  if row['storage']=='archive': raw=archive.extractfile(row['path']).read()
  elif '--predecessor' in sys.argv: raw=subprocess.check_output(['git','show',index['commit']+':'+row['path']],cwd=root)
  else: continue
  assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],row['path']
  if '--predecessor' in sys.argv:
   blob=subprocess.check_output(['git','rev-parse',index['commit']+':'+row['path']],cwd=root).decode().strip()
   assert blob==row['gitBlob'],row['path']
print('PASS: archive bytes'+(' and every predecessor blob' if '--predecessor' in sys.argv else '')+' match the recorded immutable index')

extra=root/'docs/history/integration-predecessor.json'
if extra.exists():
 for row in json.loads(extra.read_text())['entries']:
  assert row['storage']=='verified-immutable-predecessor' and len(row['commit'])==40
  if '--predecessor' in sys.argv:
   data=subprocess.check_output(['git','show',row['commit']+':'+row['path']],cwd=root)
   assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
   assert subprocess.check_output(['git','rev-parse',row['commit']+':'+row['path']],cwd=root).decode().strip()==row['gitBlob']
 print('PASS: integration predecessor references'+(' independently byte-verified' if '--predecessor' in sys.argv else ' indexed; use --predecessor for object verification'))
