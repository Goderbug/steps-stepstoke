#!/usr/bin/env python3
"""Offline candidate integrity/size check. --write refreshes two delivered evidence reports."""
import hashlib,json,pathlib,subprocess,sys,tarfile,collections
root=pathlib.Path(__file__).resolve().parent.parent
folder=root/'docs/validation/rc-v1'
protected=['foundry.toml','foundry.lock','remappings.txt','.gitmodules','lib','package.json','package-lock.json','frontend/package.json','frontend/package-lock.json','.github','.env','node_modules']
subprocess.run(['git','diff','--exit-code','--',*protected],cwd=root,check=True,stdout=subprocess.DEVNULL)
raw=subprocess.check_output(['git','ls-files','-c','-o','--exclude-standard','-z'],cwd=root).decode().split('\0')
paths=sorted({p for p in raw if p and not p.startswith(('.git/','.imd/','out/','cache/','test/scratch/')) and 'node_modules' not in p.split('/') and (root/p).is_file()})
assert 'launch.json' not in paths,'Only the later manifest stage creates launch.json'
assert '.imd-blocked.json' not in paths,'Candidate must not contain a blocked-job marker'
for path in paths:
 assert not any(part=='.git' or part=='.github' or part.startswith('.env') for part in path.split('/')),path
release=json.loads((root/'config/release.json').read_text())
gate=json.loads((root/'config/production-gate.json').read_text())
for value in [release,gate]:
 assert value['productionDeployment'] is None and value['liveCompatibility']=='NOT_RUN' and value['productionReady'] is False
assert json.loads((root/'dist/ethereum-config.json').read_text())['productionDeployment'] is None
assert json.loads((root/'frontend/public/local-config.json').read_text())==json.loads((root/'dist/local-config.json').read_text())
index=json.loads((folder/'archive-index.json').read_text());archive=folder/index['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest()==index['sha256'] and archive.stat().st_size==index['bytes']
with tarfile.open(archive) as tar:
 assert sorted(tar.getnames())==sorted(r['path'] for r in index['entries'])
 for row in index['entries']:
  data=tar.extractfile(row['path']).read();assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
manifestPath=folder/'source-manifest.json'
sourcePaths=[p for p in paths if not p.startswith(('docs/validation/','docs/history/'))]
manifest={'baseline':'d29eedf8e7d6608ed109972c179b367ac07ce91f','algorithm':'SHA-256','scope':'All delivered source, tests, dependencies, ABI, config, tools and static export; evidence/history archives have separate indexes.','files':[{'path':p,'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in sourcePaths]}
if '--write' in sys.argv:manifestPath.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
else:assert json.loads(manifestPath.read_text())==manifest,'Source/export manifest drift'
reportPath=folder/'delivery-size.json';reportRelative=str(reportPath.relative_to(root));manifestRelative=str(manifestPath.relative_to(root))
paths=sorted(set(paths+[reportRelative,manifestRelative]));groups=collections.Counter()
for p in paths:
 if p!=reportRelative:groups[p.split('/')[0]]+=(root/p).stat().st_size
base=sum(groups.values());reportBytes=0
for _ in range(10):
 measured=dict(groups);measured['docs']=measured.get('docs',0)+reportBytes
 report={'bytes':base+reportBytes,'limitBytes':8388608,'withinLimit':base+reportBytes<=8388608,'fileCount':len(paths),'byTopLevel':dict(sorted(measured.items())),'excludes':['.git/','.imd/ (provided inputs)','out/','cache/','test/scratch/','node_modules/'],'includesThisReport':True,'baselineTrackedBytes':20440428}
 encoded=json.dumps(report,indent=2)+'\n'
 if len(encoded.encode())==reportBytes:break
 reportBytes=len(encoded.encode())
else:raise AssertionError('size report did not converge')
assert report['withinLimit'],report
if '--write' in sys.argv:reportPath.write_text(encoded)
else:assert json.loads(reportPath.read_text())==report,'Payload size report drift'
print(json.dumps({'ok':True,'sourceFiles':len(sourcePaths),'payloadFiles':len(paths),'bytes':report['bytes'],'limitBytes':8388608,'protectedPaths':'UNCHANGED','currentArchive':'VERIFIED','productionReady':False},indent=2))
