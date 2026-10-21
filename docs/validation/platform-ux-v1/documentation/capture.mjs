// Run after npm ci --prefix frontend and npm run build --prefix frontend.
const root = new URL('../../../../', import.meta.url);
const { chromium, webkit } = await import(new URL('frontend/node_modules/playwright/index.mjs', root));
const { startPreview } = await import(new URL('frontend/scripts/static-preview.mjs', root));
import { writeFile } from 'node:fs/promises';
const out = new URL('./', import.meta.url);
const server = await startPreview(0);
const report = {classification:'DOCUMENTATION_RENDERED_SAMPLE_NOT_LIVE_ACCEPTANCE',captures:[],webkit:'NOT_RUN'};
let browser;
try {
 browser = await chromium.launch();
 for(const width of [1440,390]) {
  const page = await browser.newPage({viewport:{width,height:width===390?844:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/#/demo/b/fx-branch-1`);
  await page.getByRole('heading',{name:'Round 3 output'}).waitFor();
  await page.getByText('Verified locally · SHA-256, length, media',{exact:true}).first().waitFor();
  await page.frameLocator('iframe').getByRole('heading', {name:'Introducing CTO Relay'}).waitFor();
  const path=`screenshots/chromium-workspace-${width}.jpg`;
  if(width===390) await page.locator('iframe').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({path:new URL(path,out).pathname,type:'jpeg',quality:75,fullPage:width!==390});
  report.captures.push({width,path,captureScope:width===390?"selected-output viewport":"full page",pageErrors:errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  await page.close();
 }
 try {const engine=await webkit.launch();await engine.close();report.webkit='AVAILABLE_NOT_EXERCISED';}
 catch(e){report.webkit='NOT_RUN_MISSING_HOST_LIBRARIES';report.webkitLaunchError=e.message;}
}finally{await browser?.close();await new Promise(r=>server.close(r));}
await writeFile(new URL('rendered-samples.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({captures:report.captures,webkit:report.webkit}));
