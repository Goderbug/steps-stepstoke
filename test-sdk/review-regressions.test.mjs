import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {keccak256,toBeHex} from '../vendor/ethers/ethers.mjs';
import * as relay from '../sdk/index.mjs';
const key=n=>toBeHex(n,32);
const branch='0x2000000000000000000000000000000000000002';
const raw=readFileSync(new URL('../test/fixtures/document.md.result.json',import.meta.url));
const result=JSON.parse(raw);
const asset={key:key(1),kind:0,name:'main',path:'artifacts/main.md',fileHash:'0x'+result.files[0].hash,mediaType:'text/markdown',size:result.files[0].bytes,submissionHash:'0x'+result.files[0].submissionHash,producer:branch,jobId:result.jobId,resultHash:keccak256(raw),revision:1};
const proposal={anchor:key(10),profile:0,target:key(2),inputs:[],outputName:'new',outputPath:'artifacts/new.md',text:'New asset',publish:false};
const bytes=x=>Buffer.from(JSON.stringify(x));
test('review: new writes cannot reuse a different slot name or path',()=>{
 for(const change of [{outputName:'main'},{outputPath:'artifacts/main.md'},{outputName:'main',outputPath:'artifacts/main.md'}]) assert.throws(()=>relay.validateProposal({...proposal,...change},[asset]));
 assert.equal(relay.validateProposal(proposal,[asset]).proposal.target,key(2));
 const update={...proposal,target:key(1),profile:1,inputs:[key(1)],outputName:'main',outputPath:'artifacts/main.md'};
 assert.equal(relay.validateProposal(update,[asset]).proposal.target,key(1));
 const oldOther={...asset,key:key(3),jobId:'independent-historical-job'};
 assert.equal(relay.canonicalWitness([asset,oldOther]).length,2,'historical provenance remains readable');
 assert.throws(()=>relay.validateProposal(update,[asset,oldOther]));
});
test('review: file and directory prefix collisions are rejected in both directions',()=>{
 assert.throws(()=>relay.validateProposal({...proposal,outputPath:'artifacts/main.md/child.md'},[asset]));
 assert.throws(()=>relay.validateProposal({...proposal,outputPath:'artifacts/main.md'},[{...asset,path:'artifacts/main.md/child.md'}]));
 const update={...proposal,target:key(1),profile:1,inputs:[key(1)],outputName:'main',outputPath:'artifacts/main.md'};
 assert.throws(()=>relay.validateProposal(update,[asset,{...asset,key:key(3),name:'child',path:'artifacts/main.md/child.md'}]));
 for(const outputPath of ['artifacts/sibling.md','artifacts/main.md-extra/file.md']) assert.equal(relay.validateProposal({...proposal,outputPath},[asset]).proposal.outputPath,outputPath);
});
test('review: top-level dist is reserved for the single HTML slot',()=>{
 for(const [profile,outputPath] of [[0,'dist/main.md'],[4,'dist/logo.png'],[4,'dist/nested/logo.png']]) assert.throws(()=>relay.validateProposal({...proposal,profile,outputPath},[]));
 assert.equal(relay.validateProposal({...proposal,outputPath:'artifacts/dist/main.md'},[]).proposal.outputPath,'artifacts/dist/main.md');
 const html={...asset,kind:1,name:'site',path:'artifacts/index.html',mediaType:'text/html'};
 assert.throws(()=>relay.validateProposal({...proposal,profile:2,outputPath:'artifacts/index.html'},[html]));
 assert.throws(()=>relay.canonicalWitness([{...asset,path:'dist/main.md'}]));
 const bad=bytes({...result,files:[{...result.files[0],path:'dist/main.md'}]});assert.throws(()=>relay.verifyManifest(bad,keccak256(bad)));
});
test('review: authenticated metadata does not exhaust output parser budgets',()=>{
 const extended={...result,files:[...result.files],source:Array.from({length:40},(_,i)=>({node:'step'+i,hash:'a'.repeat(64),url:'https://api.imd.fun/bundles/'+'b'.repeat(64)})),summary:'x'.repeat(5000)};
 extended.files[0]={...extended.files[0],description:'d'.repeat(2048)};
 const data=bytes(extended);assert.ok(data.length>8192);
 const checked=relay.verifyManifest(data,keccak256(data));assert.equal(checked.file.hash,'0x'+result.files[0].hash);
 const tx=relay.bindResult(branch,data,keccak256(data),[]);assert.equal(relay.interfaces.branch.decodeFunctionData('bind',tx.data)[0],'0x'+data.toString('hex'));
 assert.throws(()=>relay.bindResult(branch,data,keccak256(raw),[]),'raw hash still authenticates metadata');
});
test('review: skipped metadata still rejects malformed JSON, duplicate keys and invalid Unicode',()=>{
 const prefix=raw.toString().trim().slice(0,-1);
 for(const tail of ['"metadata":{"x":1,"\\u0078":2}}','"metadata":[{"x":1,"x":2}]}','"metadata":"\\ud800"}','"metadata":"\\uffff"}','"metadata":[1,]}','"metadata":01}','"metadata":true}{}']){const b=Buffer.from(prefix+','+tail);assert.throws(()=>relay.verifyManifest(b,keccak256(b)),tail);}
 const bad=Buffer.concat([Buffer.from(prefix+',"metadata":"'),Buffer.from([0xc0,0x80]),Buffer.from('"}')]);assert.throws(()=>relay.verifyManifest(bad,keccak256(bad)));
 const valid=bytes({...result,metadata:'café 🚀'});assert.equal(relay.verifyManifest(valid,keccak256(valid)).jobId,result.jobId);
});
test('review: manifest envelope and required output limits remain explicit',()=>{
 const big=bytes({...result,summary:'x'.repeat(32768)});assert.throws(()=>relay.verifyManifest(big,keccak256(big)));
 const long=bytes({...result,files:[{...result.files[0],name:'x'.repeat(1025)}]});assert.throws(()=>relay.verifyManifest(long,keccak256(long)));
 const many={...result,metadata:Object.fromEntries(Array.from({length:129},(_,i)=>['k'+i,i]))};const b=bytes(many);assert.throws(()=>relay.verifyManifest(b,keccak256(b)));
 const dense=bytes({...result,metadata:Array(512).fill(0)});assert.throws(()=>relay.verifyManifest(dense,keccak256(dense)));
 const keys=bytes({...result,metadata:Object.fromEntries(Array.from({length:10},(_,i)=>['k'.repeat(205)+i,0]))});assert.throws(()=>relay.verifyManifest(keys,keccak256(keys)));
});
test('review: combined manifest work budget accepts the boundary and rejects one byte over',()=>{
 // Root, array, 350 numbers, string = 353 values; 2 decoded key bytes; 1 key comparison.
 const envelope={x:Array(350).fill(0),p:''};
 const target=65536-96*353-8*2-4;
 envelope.p='a'.repeat(target-bytes(envelope).length);
 const exact=bytes(envelope);assert.equal(exact.length,target);
 assert.ok(exact.length<relay.MANIFEST_LIMITS.rawBytes);
 assert.deepEqual(Object.keys(relay.strictManifestJSON(exact)),[]);
 envelope.p+='a';assert.throws(()=>relay.strictManifestJSON(bytes(envelope)));
});
test('audit 28bdccb2: segment-ending simple escapes are charged eight work units, exactly as the contract',()=>{
 const L=relay.MANIFEST_LIMITS;
 // Close an open root object (members keys costing values/keyBytes/comparisons/flushes) with a
 // numeric pad array and spaces so the document costs exactly the work budget.
 const exact=(open,members,values,keyBytes,comparisons,flushes)=>{
  const fixed=Buffer.byteLength(open)+9+96*(values+1)+8*(keyBytes+3)+4*(comparisons+members)+L.segmentFlushWork*flushes;
  const numbers=Math.min(Math.floor((L.work-fixed)/98),L.totalValues-values-1);assert.ok(numbers>=1);
  const raw=Buffer.from(open+',"pad":['+Array(numbers).fill('0').join(',')+']}'+' '.repeat(L.work-fixed-98*numbers));
  assert.ok(raw.length<=L.rawBytes);return raw;
 };
 const check=(raw,field,expected)=>{assert.equal(relay.strictManifestJSON(raw)[field].length,expected);assert.throws(()=>relay.strictManifestJSON(Buffer.concat([raw,Buffer.from(' ')])));};
 // Five retained name/path pairs of ("a\n" x 512): every escape ends a one-byte segment.
 const text='a\n'.repeat(512);
 const files=JSON.stringify(Array.from({length:5},()=>({name:text,path:text})));
 check(exact('{"state":"completed","files":'+files,2,3+15,10+40,1+5,2*5*512),'files',5);
 // A run of consecutive simple escapes is one flush; a plain byte inside the run makes two.
 check(exact('{"state":"'+'\\n'.repeat(1000)+'"',1,2,5,0,1),'state',1000);
 check(exact('{"state":"'+'\\n'.repeat(500)+'a'+'\\n'.repeat(500)+'"',1,2,5,0,2),'state',1001);
 // \u escapes and ignored metadata strings are not charged; a simple escape after \u is.
 check(exact('{"state":"'+'a\\u0041'.repeat(170)+'"',1,2,5,0,0),'state',340);
 check(exact('{"state":"ok","meta":"'+'a\\n'.repeat(4000)+'"',2,3,9,1,0),'state',2);
 check(exact('{"state":"'+'\\u0041\\n'.repeat(100)+'"',1,2,5,0,100),'state',200);
 // The audit's full 32,768-byte alternating shape is refused by the budget, as on chain.
 const audit={jobId:'metadata-limits-job',projectId:'metadata-project',state:'completed',source:[],files:Array.from({length:10},(_,i)=>({name:'a\n'.repeat(500)+i,path:'a\n'.repeat(500)+i}))};
 let auditRaw=JSON.stringify(audit);auditRaw+=' '.repeat(32768-Buffer.byteLength(auditRaw));
 assert.throws(()=>relay.strictManifestJSON(Buffer.from(auditRaw)));
});
test('review 16331cb9: twenty standard file entries verify; the retained-token cap is twice the value budget',()=>{
 const L=relay.MANIFEST_LIMITS;
 assert.equal(L.retainedTokens,2*L.totalValues);
 const hex=i=>i.toString(16).padStart(64,'0');
 const result=extras=>{
  const files=Array.from({length:extras},(_,i)=>({name:'f'+i,path:'src/f'+i+'.txt',hash:hex(i),mediaType:'text/plain',bytes:12,submissionHash:hex(i+1000)}));
  files.push({name:'main',path:'artifacts/main.md',hash:hex(1),mediaType:'text/markdown',bytes:64,submissionHash:hex(2)});
  return Buffer.from(JSON.stringify({jobId:'job-many-files',projectId:'project-a',state:'completed',files}));
 };
 // 9 root tokens + 20 * 13 = 269 retained tokens, under 5 KB: accepted, exactly as the verifier now accepts it.
 const twenty=result(19);assert.ok(twenty.length<5000);
 assert.equal(relay.strictManifestJSON(twenty).files.length,20);
 // For standard entries the unchanged combined work budget is now the first limit reached.
 let extras=19;const work=raw=>{const files=JSON.parse(raw).files.length;return raw.length+96*(5+7*files)+8*(24+40*files)+4*(6+15*files);};
 while(work(result(extras+1))<=L.work)extras++;
 assert.ok(extras+1>20&&9+13*(extras+2)<L.retainedTokens&&5+7*(extras+2)<L.totalValues);
 assert.equal(relay.strictManifestJSON(result(extras)).files.length,extras+1);
 assert.throws(()=>relay.strictManifestJSON(result(extras+1)));
});
