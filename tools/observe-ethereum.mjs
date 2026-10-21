#!/usr/bin/env node
// No keys, accounts, signing or chain switch. Reads the SAME inventoried export as the UI.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPublicHandoff } from '../sdk/handoff.mjs';
import { verifyDeploymentConfig } from '../sdk/config.mjs';
import { PUBLIC_SERVICES } from '../sdk/public.mjs';
const [dist='dist',overrideRPC] = process.argv.slice(2);
try {
  const config=await loadPublicHandoff({base:'',fetch:async path=>{try{return new Response(await readFile(resolve(dist,path)));}catch(e){if(e.code==='ENOENT')return new Response('',{status:404});throw e;}}});
  const rpc=overrideRPC??config.rpcURL??PUBLIC_SERVICES.rpc,url=new URL(rpc);
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('Credential-free HTTPS RPC required');
  const allowed=new Set(['eth_call','eth_chainId','eth_getCode','eth_getBlockByNumber','eth_getTransactionReceipt','debug_traceTransaction']);let id=0;
  const provider={async request({method,params=[]}){
    if(!allowed.has(method))throw new Error('Read-only method required');
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(30000)});
    const b=await r.json();if(!r.ok||b.error)throw new Error(b.error?.message??'RPC unavailable');return b.result;
  }};
  const release=JSON.parse(await readFile(new URL('../config/release.json',import.meta.url)));
  const problems=await verifyDeploymentConfig(provider,config,release);
  if(problems.length)throw new Error(problems.join(', '));
  console.log(JSON.stringify({validity:'VERIFIED_DEPLOYMENT',identity:config.identity,chainId:1,deploymentBlock:config.deploymentBlock,contracts:config.contracts,liveCompatibility:'NOT_RUN',productionReady:false},null,2));
}catch(e){console.error(JSON.stringify({ok:false,error:e.message,liveCompatibility:'NOT_RUN',productionReady:false}));process.exitCode=1;}
