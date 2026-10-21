// Supplemental rendered observations on production components; not a full accessibility audit.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './static-preview.mjs';
const server=await startPreview(4177),browser=await chromium.launch({headless:true});
const out=new URL('../../docs/validation/platform-ux-v1/',import.meta.url);await mkdir(new URL('screenshots/',out),{recursive:true});
const rows=[];
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  for(const route of ['#/','#/demo','#/demo/b/fx-branch-1','#/showcase']){
   await page.goto(`http://127.0.0.1:4177/preview/${route}`);await page.waitForLoadState('networkidle');
   rows.push(await page.evaluate(({width,route})=>{const buttons=[...document.querySelectorAll('button,a.btn,input:not([type=checkbox]):not([type=radio]),select,textarea')].filter(e=>e.getClientRects().length);return {width,route,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,title:document.title,lang:document.documentElement.lang,smallControls:buttons.map(e=>({text:e.textContent?.trim().slice(0,60)||e.getAttribute('aria-label'),height:e.getBoundingClientRect().height})).filter(e=>e.height<44),bodySize:getComputedStyle(document.body).fontSize,bodyFamily:getComputedStyle(document.body).fontFamily};},{width,route}));
  }
  await page.goto('http://127.0.0.1:4177/preview/#/demo/b/fx-branch-1');await page.getByRole('button',{name:'Continue',exact:true}).click();const input=page.getByLabel('New asset name',{exact:true});await input.focus();
  rows.push(await input.evaluate(e=>({kind:'Focused input',width:document.documentElement.clientWidth,outline:getComputedStyle(e).outlineColor,outlineWidth:getComputedStyle(e).outlineWidth,border:getComputedStyle(e).borderColor})));
  if(width===390)await page.screenshot({path:new URL(`screenshots/focus-${width}.jpg`,out).pathname,type:'jpeg',quality:50,scale:'css'});
  await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});rows.push(await page.getByRole('button',{name:'Continue',exact:true}).evaluate(e=>({kind:'Reduced motion',transition:getComputedStyle(e).transitionDuration})));
  await page.close();
 }
 await writeFile(new URL('rendered-review.json',out),JSON.stringify(rows,null,2)+'\n');
 if(rows.some(r=>r.overflow>0||r.smallControls?.length))throw new Error('Rendered layout or control size check failed');
 console.log('PASS: four widths, four routes; no page overflow; controls >=44px; focused inputs and reduced motion recorded.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
