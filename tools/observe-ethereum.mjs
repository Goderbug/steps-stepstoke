#!/usr/bin/env node
// No keys, accounts, signing or chain switch. Reads the SAME inventoried export as the UI.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPublicHandoff } from '../sdk/handoff.mjs';
import { verifyDeploymentConfig } from '../sdk/config.mjs';
import { createPublicReadProvider } from '../sdk/public-rpc.mjs';
const [dist='dist',overrideRPC] = process.argv.slice(2);
try {
  const config=await loadPublicHandoff({base:'',fetch:async path=>{try{return new Response(await readFile(resolve(dist,path)));}catch(e){if(e.code==='ENOENT')return new Response('',{status:404});throw e;}}});
  const provider=createPublicReadProvider({rpcUrls:overrideRPC?[overrideRPC]:config.rpcURLs});
  const release=JSON.parse(await readFile(new URL('../config/release.json',import.meta.url)));
  const problems=await verifyDeploymentConfig(provider,config,release);
  if(problems.length)throw new Error(problems.join(', '));
  console.log(JSON.stringify({validity:'VERIFIED_DEPLOYMENT',identity:config.identity,chainId:1,deploymentBlock:config.deploymentBlock,contracts:config.contracts,liveCompatibility:'NOT_RUN',productionReady:false},null,2));
}catch(e){console.error(JSON.stringify({ok:false,error:e.message,liveCompatibility:'NOT_RUN',productionReady:false}));process.exitCode=1;}
