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
