// Reproduces a list read interrupted by a full navigation. No wallet, transaction or fixture.
import { chromium, webkit, expect } from '@playwright/test';
import { startLocal } from '../../scripts/local-setup.mjs';
import { startPreview } from '../../scripts/static-preview.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as sdk from '../../../sdk/browser.mjs';
const engine=process.argv.includes('--chromium')?'chromium':'webkit';
const label=process.argv.includes('--before')?'before':'after';
const local=await startLocal({rpcPort:8555,artifactPort:8556});
const server=await startPreview(4185);
await writeFile(resolve(local.root,'dist/local-config.json'),JSON.stringify(local.config));
const out=resolve(local.root,'docs/validation/platform-ux-v1/final/navigation');await mkdir(out,{recursive:true});
const report={engine,label,classification:'ACTUAL_LOCAL_READ_ONLY_NAVIGATION_RACE',errors:[],consoleErrors:[],interruptedReads:0,iterations:0};
let browser;
try {
 browser=await ({chromium,webkit}[engine]).launch({executablePath:engine==='webkit'?process.env.W1_WEBKIT_EXECUTABLE:process.env.W1_CHROMIUM_EXECUTABLE});
 const page=await browser.newPage();
 page.on('pageerror',e=>report.errors.push({message:e.message,stack:e.stack}));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 const selector=sdk.interfaces.factory.getFunction('branchCount').selector;
 for(let i=0;i<6;i++) {
  let entered,release;const reached=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let held=false;
  const handler=async route=>{const data=route.request().postDataJSON();if(!held&&data?.method==='eth_call'&&data.params[0].data===selector){held=true;report.interruptedReads++;entered();await gate;}await route.continue().catch(e=>{report.routeCancellation=String(e);});};
  await page.route(local.config.rpcURL+'/**',handler);
  await page.goto('http://127.0.0.1:4185/preview/#/local');await reached;
  // Start the replacement document before releasing the older read.
  const next=page.goto('http://127.0.0.1:4185/preview/#/local');release();await next;
  await expect(page.getByText('No projects yet.',{exact:false})).toBeVisible();await page.unroute(local.config.rpcURL+'/**',handler);
  report.iterations++;
 }
 report.status=report.errors.length||report.consoleErrors.length?'FAIL':'PASS';if(report.status==='FAIL')process.exitCode=1;
} catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));await local.close();await writeFile(resolve(out,engine+'-'+label+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
