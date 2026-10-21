// Run from repository root. Local utility check only; W1 signing evidence is browser-chain.mjs.
import {startLocal} from '../../scripts/local-setup.mjs';
import * as sdk from '../../../sdk/browser.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const local=await startLocal();
const result={kind:'ACTUAL_LOCAL_UTILITY_CHECK_NOT_BROWSER_EVIDENCE',productionDeployment:null,liveCompatibility:'NOT_RUN'};
try {
 await writeFile('test/scratch/local-session.json',JSON.stringify({config:local.config,accounts:local.accounts,writer:local.writer,treasury:local.treasury}));
 const from=local.accounts[0],factory=local.config.contracts.factory;
 const read=async(b,m,a=[]) => (await sdk.queryState(local.provider,sdk.readState(b,m,a)))[0];
 const send=(name,t) => local.send(name,{...t,from});
 const made=await send('SDK utility create',sdk.createProject(factory,'Mock command utility check'));
 const event=made.logs.map(l=>{try{return sdk.interfaces.factory.parseLog(l)}catch{return null}}).find(l=>l?.name==='BranchCreated');
 const branch=event.args.branch;
 const p={anchor:await read(branch,'anchor'),profile:0,target:`0x${'11'.repeat(32)}`,inputs:[],outputName:'manual',outputPath:'docs/manual.md',text:'Manual local command check',publish:false};
 await send('SDK utility propose',sdk.proposeWork(branch,p,[]));
 const fee=500000000000000000n;
 await send('SDK utility exact allowance',sdk.approveExact(local.release.imd,branch,fee));
 await send('SDK utility sponsor',sdk.sponsorProposal(branch,1,fee,[]));
 const {stdout,stderr}=await promisify(execFile)(process.execPath,['frontend/scripts/local-deliver.mjs','--branch',branch,'--job','manual-local-job']);
 result.command=JSON.parse(stdout);result.stderr=stderr;
 if(Number(await read(branch,'phase'))!==3)throw new Error('callback not recorded');
 const a=await read(branch,'attempt',[1]);
 const raw=new Uint8Array(await readFile(result.command.rawResultFile));
 const manifest=sdk.verifyManifest(raw,a.outcome);
 await send('SDK utility bind',sdk.bindResult(branch,raw,a.outcome,[]));
 const fileURL=new URL(`${manifest.jobId}/${manifest.file.path}`,local.config.artifactBase);
 const file=new Uint8Array(await(await fetch(fileURL)).arrayBuffer());
 result.verifiedFile=sdk.verifyFile(manifest.file,file);
 result.latestJobId=await read(branch,'latestJobId');
 if(result.latestJobId!=='manual-local-job')throw new Error('wrong bound job');
 result.purchases=String(BigInt(await local.provider.request({method:'eth_call',params:[{to:local.release.intake,data:local.intakeI.encodeFunctionData('count')},'latest']})));
 if(result.purchases!=='1')throw new Error('unexpected purchase');
 result.result='PASS';result.trace=local.trace;
} catch(e){result.result='FAIL';result.error=e.stack;process.exitCode=1}finally{await local.close();await writeFile('docs/validation/integration/frontend/local-command-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
