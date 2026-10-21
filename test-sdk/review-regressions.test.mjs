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
