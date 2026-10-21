#!/usr/bin/env node
// Real candidate code on an OWN disposable chain reconfigured to chain 1. HTTPS transport
// routes are fulfilled in Playwright from that node and exact local fixture bytes. No public
// transactions, public deployment, keys or production-ready configuration are involved.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startLocal} from '../../scripts/local-setup.mjs';
import * as sdk from '../../../sdk/browser.mjs';
import {observeDeployment} from '../../../sdk/config.mjs';
import {keccak256,toBeHex} from '../../../vendor/ethers/ethers.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const local=await startLocal({rpcPort:18645,artifactPort:18646,configOut:'/tmp/steps-public-chain-local-config.json'});
let browser,preview;
const report={scope:'ACTUAL_LOCAL_CHAIN_1; HTTPS ROUTES ARE LOCAL TEST TRANSPORT',productionDeployment:null,liveCompatibility:'NOT_RUN',productionReady:false,checks:[],rpcMethods:[],pageErrors:[]};
const send=(label,tx,from=local.accounts[0])=>local.send(label,{from,...tx});
const read=async(branch,method,args=[])=>(await sdk.queryState(local.provider,sdk.readState(branch,method,args)))[0];
try {
 await local.provider.request({method:'anvil_setChainId',params:[1]});
 assert.equal(await local.provider.request({method:'eth_chainId'}),'0x1');
 const receipt=await send('public adapter fixture: direct root',sdk.createProject(local.config.contracts.factory,'Ethereum adapter local rehearsal'));
 const branch=receipt.logs.map(l=>{try{return sdk.interfaces.factory.parseLog(l)}catch{return null}}).find(e=>e?.name==='BranchCreated').args.branch;
 const raw=await readFile(resolve(root,'test/fixtures/document.md.result.json')),file=await readFile(resolve(root,'test/fixtures/document.md'));
 const m=JSON.parse(raw),p={anchor:await read(branch,'anchor'),profile:0,target:toBeHex(1,32),inputs:[],outputName:m.files[0].name,outputPath:m.files[0].path,text:'Prepare the report.',publish:false};
 await send('public adapter fixture: proposal',sdk.proposeWork(branch,p,[]));
 const fee=500000000000000000n;
 await send('public adapter fixture: exact approval',sdk.approveExact(local.release.imd,branch,fee));
 await send('public adapter fixture: purchase',sdk.sponsorProposal(branch,1,fee,[]));
 const attempt=await read(branch,'attempt',[1]);
 await send('public adapter fixture: callback',{to:local.release.intake,data:local.intakeI.encodeFunctionData('complete',[attempt.requestId,raw])},local.writer);
 const bound=await send('public adapter fixture: bind',sdk.bindResult(branch,raw,keccak256(raw),[]));
 const witness=sdk.decodeCheckpoint(bound.logs.find(l=>{try{return sdk.interfaces.branch.parseLog(l)?.name==='CheckpointWritten'}catch{return false}})).witness;
 const pendingRaw=await readFile(resolve(root,'test/fixtures/document-updated.md.result.json'));
 const update={...p,anchor:await read(branch,'anchor'),profile:1,inputs:[p.target],text:'Update the report.'};
 await send('public adapter fixture: update proposal',sdk.proposeWork(branch,update,witness));
 await send('public adapter fixture: second exact approval',sdk.approveExact(local.release.imd,branch,fee));
 await send('public adapter fixture: second purchase',sdk.sponsorProposal(branch,2,fee,witness));
 const pendingAttempt=await read(branch,'attempt',[2]);
 await send('public adapter fixture: record original pending bytes',{to:local.release.intake,data:local.intakeI.encodeFunctionData('complete',[pendingAttempt.requestId,pendingRaw])},local.writer);
 const observed=await observeDeployment(local.provider,{release:local.release,factory:local.config.contracts.factory,chainId:1});
 const config={...observed,rpcURL:'https://steps-rpc.example.test/',deploymentBlock:Number(BigInt(receipt.blockNumber)),ipfsGateway:'https://steps-gateway.example.test/ipfs/',productionGate:JSON.parse(await readFile(resolve(root,'config/production-gate.json')))};
 report.observation=observed;report.branch=branch;
 preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--port','4179','--host','127.0.0.1','--strictPort'],{cwd:resolve(root,'frontend'),stdio:'ignore'});
 for(let n=0;;n++){try{if((await fetch('http://127.0.0.1:4179/')).ok)break;}catch{}if(n===100)throw Error('preview unavailable');await new Promise(r=>setTimeout(r,25));}
 browser=await chromium.launch();const page=await browser.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.route('https://steps-rpc.example.test/',async route=>{const r=route.request().postDataJSON();assert.ok(['eth_call','eth_getCode','eth_getLogs','eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getTransactionCount'].includes(r.method),'read-only public transport');report.rpcMethods.push(r.method);try{await route.fulfill({json:{jsonrpc:'2.0',id:r.id,result:await local.provider.request(r)}});}catch(e){await route.fulfill({json:{jsonrpc:'2.0',id:r.id,error:{code:-32000,message:e.message}}});}});
 await page.route('**/ethereum-config.json',route=>route.fulfill({json:config}));
 await page.route('https://api.imd.fun/artifacts/'+m.files[0].hash,route=>route.fulfill({body:file,contentType:'text/markdown'}));
 await page.route('https://steps-gateway.example.test/ipfs/fixture/result.json',route=>route.fulfill({body:pendingRaw,contentType:'application/json'}));
 await page.goto('http://127.0.0.1:4179/#/ethereum');
 await expect(page.getByRole('link',{name:'Ethereum adapter local rehearsal',exact:true})).toBeVisible();
 report.checks.push('Configured public mode reads chain 1 and discovers actual registered full Branch without a wallet');
 await page.getByRole('link',{name:'Ethereum adapter local rehearsal',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Round 1 output'})).toBeVisible();
 await expect(page.getByText('Verified locally · SHA-256, length, media')).toBeVisible();
 const [downloaded]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download verified file'}).click()]);
 assert.deepEqual(await readFile(await downloaded.path()),file);
 report.checks.push('Public HTTPS artifact path verifies and downloads exact descriptor bytes from authenticated history');
 for(const summary of await page.locator('summary').all())if((await summary.textContent()).includes('Attempt'))await summary.click();
 const originalButton=page.getByRole('button',{name:'Download original result'});
 await expect(originalButton).toBeVisible();
 const [original]=await Promise.all([page.waitForEvent('download'),originalButton.click()]);
 assert.deepEqual(await readFile(await original.path()),pendingRaw);report.checks.push('Public original result download matches authenticated callback bytes; binding stays pending');
 assert.ok(!report.rpcMethods.some(m=>m==='eth_sendTransaction'||m.includes('switch')));assert.deepEqual(report.pageErrors,[]);
 report.checks.push('No wallet transaction or implicit chain switch through public transport; production gates remain closed');
 report.transactions=local.trace;
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();if(preview)preview.kill();await local.close();}
