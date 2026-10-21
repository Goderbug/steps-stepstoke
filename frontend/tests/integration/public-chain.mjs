#!/usr/bin/env node
// Real candidate code on an OWN disposable chain reconfigured to chain 1. HTTPS transport
// routes are fulfilled in Playwright from that node and exact local fixture bytes. No public
// transactions, public deployment, keys or production-ready configuration are involved.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startLocal} from '../../scripts/local-setup.mjs';
import * as sdk from '../../../sdk/browser.mjs';
import {observeDeployment} from '../../../sdk/config.mjs';
import {importDeployment} from '../../../tools/import-deployment.mjs';
import {abiHash} from '../../../sdk/handoff.mjs';
import {Interface,getCreate2Address,toUtf8Bytes,keccak256,toBeHex} from '../../../vendor/ethers/ethers.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const local=await startLocal({rpcPort:18645,artifactPort:18646,configOut:'/tmp/steps-public-chain-local-config.json'});
let browser,preview;
const report={scope:'ACTUAL_LOCAL_CHAIN_1; HTTPS ROUTES ARE LOCAL TEST TRANSPORT',productionDeployment:null,liveCompatibility:'NOT_RUN',productionReady:false,checks:[],rpcMethods:[],pageErrors:[]};
const send=(label,tx,from=local.accounts[0])=>local.send(label,{from,...tx});
const read=async(branch,method,args=[])=>(await sdk.queryState(local.provider,sdk.readState(branch,method,args)))[0];
try {
 await local.provider.request({method:'anvil_setChainId',params:[1]});
 assert.equal(await local.provider.request({method:'eth_chainId'}),'0x1');
 // Deploy the named applications in an actual atomic CREATE2 batch, as required by the importer.
 const artifact=async(name,file=name)=>JSON.parse(await readFile(resolve(root,`out/${file}.sol/${name}.json`)));
 const probeArtifact=await artifact('NamedBatchProbe','LaunchCompatibility.t');
 const probeReceipt=await send('public local batch probe',{data:probeArtifact.bytecode.object});
 const names=['RelayEncoder','RelayVerifier','RelayFactory'],addresses=[],codes=[],salts=[];
 for(const name of names){const a=await artifact(name),salt=keccak256(toUtf8Bytes(name)),code=a.bytecode.object+new Interface(a.abi).encodeDeploy(name==='RelayFactory'?addresses:[]).slice(2);salts.push(salt);codes.push(code);addresses.push(getCreate2Address(probeReceipt.contractAddress,salt,keccak256(code)));}
 const deploymentReceipt=await send('public local atomic batch',{to:probeReceipt.contractAddress,data:new Interface(probeArtifact.abi).encodeFunctionData('deployAll',[codes,salts])});
 local.config.contracts.factory=addresses[2];local.config.contracts.encoder=addresses[0];local.config.contracts.verifier=addresses[1];

 const receipt=await send('public adapter fixture: direct root',sdk.createProject(local.config.contracts.factory,'Ethereum adapter local rehearsal'));
 const branch=receipt.logs.map(l=>{try{return sdk.interfaces.factory.parseLog(l)}catch{return null}}).find(e=>e?.name==='BranchCreated').args.branch;
 const singleResult=await readFile(resolve(root,'test/fixtures/document.md.result.json')),file=await readFile(resolve(root,'test/fixtures/document.md'));
 const m=JSON.parse(singleResult);
 const raw=Buffer.from(JSON.stringify({...m,files:[{name:'producer-data',path:'artifacts/producer-data.json',mediaType:'application/json',bytes:999999999},...m.files]}));
 const p={anchor:await read(branch,'anchor'),profile:0,target:toBeHex(1,32),inputs:[],outputName:m.files[0].name,outputPath:m.files[0].path,text:'Prepare the report.',publish:false};
 await send('public adapter fixture: proposal',sdk.proposeWork(branch,p,[]));
 const fee=500000000000000000n;
 await send('public adapter fixture: exact approval',sdk.approveExact(local.release.imd,branch,fee));
 await send('public adapter fixture: purchase',sdk.sponsorProposal(branch,1,fee,[]));
 const attempt=await read(branch,'attempt',[1]);
 await send('public adapter fixture: callback',{to:local.release.intake,data:local.intakeI.encodeFunctionData('complete',[attempt.requestId,raw])},local.writer);
 const bound=await send('public adapter fixture: bind',sdk.bindResult(branch,raw,keccak256(raw),[]));
 const witness=sdk.decodeCheckpoint(bound.logs.find(l=>{try{return sdk.interfaces.branch.parseLog(l)?.name==='CheckpointWritten'}catch{return false}})).witness;
 assert.equal(witness.length,1);assert.equal(witness[0].name,p.outputName);
 report.multiFile={listedFiles:2,acceptedAssets:1,resultHash:keccak256(raw)};
 const pendingRaw=await readFile(resolve(root,'test/fixtures/document-updated.md.result.json'));
 const update={...p,anchor:await read(branch,'anchor'),profile:1,inputs:[p.target],text:'Update the report.'};
 await send('public adapter fixture: update proposal',sdk.proposeWork(branch,update,witness));
 await send('public adapter fixture: second exact approval',sdk.approveExact(local.release.imd,branch,fee));
 await send('public adapter fixture: second purchase',sdk.sponsorProposal(branch,2,fee,witness));
 const pendingAttempt=await read(branch,'attempt',[2]);
 await send('public adapter fixture: record original pending bytes',{to:local.release.intake,data:local.intakeI.encodeFunctionData('complete',[pendingAttempt.requestId,pendingRaw])},local.writer);
 const observed=await observeDeployment(local.provider,{release:local.release,factory:local.config.contracts.factory,chainId:1});
 const h={version:1,launchId:'DISPOSABLE_LOCAL_PUBLIC_BROWSER_TEST',chainId:1,sourceCommit:execFileSync('git',['rev-parse','HEAD']).toString().trim(),attestationHash:keccak256(toUtf8Bytes('LOCAL BROWSER TEST ONLY')).slice(2),contracts:await Promise.all(names.map(async(name,i)=>({name,address:addresses[i],abiHash:abiHash((await artifact(name)).abi)})))};
 const evidence={classification:'DISPOSABLE_LOCAL_BROWSER_TEST_ONLY',sourceCommit:h.sourceCommit,attestationHash:h.attestationHash,transactionHash:deploymentReceipt.transactionHash,blockNumber:Number(BigInt(deploymentReceipt.blockNumber)),blockHash:deploymentReceipt.blockHash,build:local.release.frozenBuild,productionGate:JSON.parse(await readFile(resolve(root,'config/production-gate.json')))};
 await writeFile('/tmp/steps-public-browser-handoff.json',JSON.stringify(h));await writeFile('/tmp/steps-public-browser-evidence.json',JSON.stringify(evidence));await writeFile('/tmp/steps-public-browser-network.json',JSON.stringify({network:{rpcUrl:'https://steps-rpc.example.test/'}}));
 const handoff=await importDeployment({handoffPath:'/tmp/steps-public-browser-handoff.json',networkPath:'/tmp/steps-public-browser-network.json',evidencePath:'/tmp/steps-public-browser-evidence.json',dist:resolve(root,'dist'),provider:local.provider,release:local.release});
 report.observation=observed;report.branch=branch;
 preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--port','4179','--host','127.0.0.1','--strictPort'],{cwd:resolve(root,'frontend'),stdio:'ignore'});
 for(let n=0;;n++){try{if((await fetch('http://127.0.0.1:4179/')).ok)break;}catch{}if(n===100)throw Error('preview unavailable');await new Promise(r=>setTimeout(r,25));}
 browser=await chromium.launch({executablePath:process.env.W1_CHROMIUM_EXECUTABLE});const page=await browser.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.route('https://steps-rpc.example.test/',async route=>{const r=route.request().postDataJSON();assert.ok(['eth_call','eth_getCode','eth_getLogs','eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getTransactionCount','debug_traceTransaction'].includes(r.method),'read-only public transport');report.rpcMethods.push(r.method);try{await route.fulfill({json:{jsonrpc:'2.0',id:r.id,result:await local.provider.request(r)}});}catch(e){await route.fulfill({json:{jsonrpc:'2.0',id:r.id,error:{code:-32000,message:e.message}}});}});
 // Public runtime reads dist/imd-deployment.json and its actual inventoried files.
 // HTTPS RPC transport remains explicitly local; no config route replaces runtime verification.
 await page.route('https://api.imd.fun/artifacts/'+m.files[0].hash,route=>route.fulfill({body:file,contentType:'text/markdown'}));
 await page.route('https://gateway.pinata.cloud/ipfs/fixture/result.json',route=>route.fulfill({body:pendingRaw,contentType:'application/json'}));
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
 // Reproduce a transport refusal, then verify a manually selected original without a server.
 await page.route('https://api.imd.fun/artifacts/'+m.files[0].hash,route=>route.abort('failed'));
 await page.reload();
 await expect(page.getByLabel('Select original file to verify')).toBeVisible();
 await page.getByLabel('Select original file to verify').setInputFiles({name:'wrong.md',mimeType:'text/markdown',buffer:Buffer.alloc(file.length)});
 await expect(page.getByText('Verification failed. Preview and download are unavailable. The producer must supply the correct file or binding.')).toBeVisible();
 await page.getByLabel('Select original file to verify').setInputFiles({name:'original.md',mimeType:'text/markdown',buffer:file});
 await expect(page.getByText('Verified locally · SHA-256, length, media')).toBeVisible();
 report.checks.push('CORS/transport failure supports explicit manual original selection; wrong bytes refused and correct bytes locally verified without settlement');
 assert.equal(Number(await read(branch,'attemptCount')),2);
 report.checks.push('No wallet transaction or implicit chain switch through public transport; production gates remain closed');
 report.transactions=local.trace;
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();if(preview)preview.kill();await local.close();}
