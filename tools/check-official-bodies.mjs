#!/usr/bin/env node
// Encode exact candidate bodies on an OWN disposable chain. Optional free validation only.
// Never opens an order, quotes, signs on a public chain, or treats HTTP as settlement.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {ContractFactory,JsonRpcProvider,keccak256,toBeHex} from '../vendor/ethers/ethers.mjs';
const root=new URL('../',import.meta.url);
const read=async p=>readFile(new URL(p,root));
const a=JSON.parse(await read('out/RelayEncoder.sol/RelayEncoder.json'));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const node=spawn('anvil',['--host','127.0.0.1','--port',String(port),'--silent'],{stdio:'ignore'});
const provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,31337,{cacheTimeout:-1,staticNetwork:true});provider.pollingInterval=20;
try {
 for(let n=0;;n++){try{await provider.send('eth_chainId',[]);break;}catch(e){if(n===100)throw e;await new Promise(r=>setTimeout(r,25));}}
 const actor=await provider.getSigner(0);const e=await new ContractFactory(a.abi,a.bytecode.object,actor).deploy();await e.waitForDeployment();
 const mdRaw=await read('test/fixtures/public/observed-one-file.json'),md=JSON.parse(mdRaw);
 const htmlRaw=await read('test/fixtures/html-1.html.result.json'),html=JSON.parse(htmlRaw);
 const asset=(m,raw,kind)=>{const f=m.files[0];return {key:toBeHex(1,32),kind,name:f.name,path:f.path,fileHash:'0x'+f.hash,mediaType:f.mediaType,size:f.bytes,submissionHash:'0x'+f.submissionHash,producer:actor.address,jobId:m.jobId,resultHash:keccak256(raw),revision:1};};
 // Public latest parent observed as blocked at the checked source date; never an invented ID.
 const parent='baa5160f-9f52-4da3-b570-dde53dfa845b';
 const rows=[];
 for(const scenario of ['root-open','root-continue','historical-child-open','historical-child-continue'])for(let profile=0;profile<5;profile++) {
  const continuing=scenario.endsWith('continue'),child=scenario.startsWith('historical');
  const update=profile===1||profile===3, kind=profile<2?0:profile<4?1:2;
  const current=update?[profile===1?asset(md,mdRaw,0):asset(html,htmlRaw,1)]:child?[asset(md,mdRaw,0)]:[];
  const p={anchor:toBeHex(0,32),profile,target:toBeHex(child&&!update?2:1,32),inputs:update?[toBeHex(1,32)]:child&&profile!==4?[toBeHex(1,32)]:[],outputName:update?current[0].name:kind===0?'notes':kind===1?'site':'illustration',outputPath:update?current[0].path:kind===0?'artifacts/notes.md':kind===1?'artifacts/index.html':'artifacts/illustration.png',text:profile===4?'Generate one square PNG showing a green tree.':kind===0?'Write a concise Markdown report on the project goal.':'Create a self-contained project introduction page.',publish:false};
  const [action,body]=await e.encode('Maintain a public relay project.',child?'Continue from the explicitly selected historical checkpoint.':'',continuing?parent:'',p,current);
  const raw=Buffer.from(body.slice(2),'hex');const input=JSON.parse(raw.toString('utf8'));
  assert.ok(raw.length<=16384);assert.equal(input.shape,'chain');
  const packet={action:continuing?'job.continue':'job.open',input};
  const row={scenario,classification:'EXACT_ENCODER_VECTOR; selected descriptors do not prove a live STEPS callback',historicalChild:child,independentProjectFirstOpen:child&&!continuing,profile,action,bodyHash:keccak256(raw),bodyBytes:raw.length,rawBodyHex:raw.toString('hex'),packet,inputEvidence:profile===1||(child&&profile!==3)?'public observed accepted Markdown descriptor; no callback authentication claimed':profile===3?'LOCAL HTML FIXTURE ONLY; invalid_artifacts expected from official API':'no selected inputs',parentEvidence:continuing?'public blocked latest parent; free syntax check does not authenticate the candidate payer':'new project'};
  if(process.argv.includes('--free-check')) {
   const sent=JSON.stringify(packet);const res=await fetch('https://api.imd.fun/requests/check',{method:'POST',headers:{'content-type':'application/json'},body:sent,signal:AbortSignal.timeout(30000)});
   row.freeCheck={url:'https://api.imd.fun/requests/check',sent,status:res.status,rawResponse:await res.text()};
  }
  rows.push(row);
 }
 console.log(JSON.stringify({classification:'EXACT_CANDIDATE_ENCODING; FREE_CHECK_IS_NOT_LIVE_EXECUTION',checkedAt:new Date().toISOString(),liveCompatibility:'NOT_RUN',productionReady:false,rows},null,2));
} finally {provider.destroy();node.kill();}
