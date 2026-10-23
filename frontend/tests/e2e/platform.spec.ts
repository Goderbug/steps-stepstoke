import { test, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const out="../test/scratch/platform-browser-evidence";
const audit=new Map<string,{errors:string[];requests:string[];console:string[];expectedRequests:string[];expectedConsole:string[]}>();
test.beforeEach(async({page},info)=>{
  const row={errors:[] as string[],requests:[] as string[],console:[] as string[],expectedRequests:[] as string[],expectedConsole:[] as string[]};audit.set(info.testId,row);
  page.on("pageerror",e=>row.errors.push(e.message));page.on("console",m=>{if(m.type()==="error"){
    const expected=info.title.startsWith("Ethereum candidate has an explicit closed handoff") && new URL(m.location().url || "about:blank").pathname.endsWith("/imd-deployment.json") && /404/.test(m.text());
    (expected?row.expectedConsole:row.console).push(m.text());
  }});
  page.on("response",r=>{if(r.status()>=400){
    const expected=info.title.startsWith("Ethereum candidate has an explicit closed handoff") && r.status()===404 && new URL(r.url()).pathname.endsWith("/imd-deployment.json");
    (expected?row.expectedRequests:row.requests).push(`${r.status()} ${r.url()}`);
  }});
  await page.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===new URL(info.project.use.baseURL as string).origin?route.continue():route.abort());
});
test.afterEach(async({page},info)=>{
  const row=audit.get(info.testId)!;const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth).catch(()=>-1);
  await mkdir(`${out}/raw/browser`,{recursive:true});await writeFile(`${out}/raw/browser/${info.project.name}-${info.title.replace(/[^a-z0-9]+/gi,"-").slice(0,90)}.json`,JSON.stringify({...row,overflow,status:info.status},null,2));
  if(info.title.startsWith("Ethereum candidate has an explicit closed handoff")) expect(row.expectedRequests).toHaveLength(1);
  expect(row.errors).toEqual([]);expect(row.requests).toEqual([]);expect(row.console).toEqual([]);expect(overflow).toBe(0);
});
async function shot(page:any,info:any,name:string){if(!["chromium-desktop","chromium-mobile"].includes(info.project.name)||name==="showcase"||(name==="funding"&&info.project.name==="chromium-desktop"))return;await mkdir(`${out}/screenshots`,{recursive:true});await page.screenshot({path:`${out}/screenshots/${info.project.name}-${name}.jpg`,type:"jpeg",quality:48,scale:"css",fullPage:false});}
async function workspace(page:any){await page.goto("./#/demo/b/fx-branch-1");await expect(page.getByRole("heading",{name:"Round 3 output"})).toBeVisible();await expect(page.getByText("Verified locally · SHA-256, length, media",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Download verified file"})).toBeVisible();}
async function openFunding(page:any){await workspace(page);await page.getByRole("button",{name:"Review funding",exact:true}).first().click();const sheet=page.getByRole("dialog",{name:"Fund a contribution"});await expect(sheet.getByRole("button",{name:"1. Approve exact amount"})).toBeEnabled();return sheet;}

test("configuration identifies the product and gateway metadata",async({page},info)=>{
  await page.goto("./#/configuration");await expect(page).toHaveTitle("STEPS · Stepstoke · Open Workshop");const action=page.getByRole("link",{name:/Explore demo project/});await expect(page.getByRole("link",{name:"Verify and open projects",exact:true})).toBeInViewport();await expect(page.locator('html')).toHaveAttribute("lang","en");for(const name of ["description","og:title","og:image"]){expect(await page.locator(`meta[${name.startsWith("og")?"property":"name"}="${name}"]`).getAttribute("content")).toBeTruthy();}
  await shot(page,info,"home");await action.click();await expect(page.getByRole("heading",{name:"Round 3 output"})).toBeVisible();
});
test("project list and separate gas-only project creation",async({page})=>{
  await page.goto("./#/demo");await page.getByRole("button",{name:"Create project",exact:true}).click();await page.getByLabel("Project title",{exact:true}).fill("Workshop test project");await page.getByLabel("Fixed goal (cannot change after creation)").fill("Keep an exact sequence of public outputs.");await page.getByRole("button",{name:"Review creation",exact:true}).click();await expect(page.getByText("Gas only. Title and goal",{exact:false})).toBeVisible();await page.getByRole("button",{name:"Sign and create",exact:true}).dblclick();await page.getByRole("link",{name:"Open project",exact:true}).click();await expect(page.getByRole("heading",{name:"Workshop test project"})).toBeVisible();await expect(page.getByRole("heading",{name:"The first output starts here"})).toBeVisible();await expect(page.getByRole("heading",{name:"Funding and build status"})).toBeVisible();
});
test("sequence selection is read-only and exact verified downloads preserve extension",async({page},info)=>{
  await workspace(page);await shot(page,info,"workspace");await page.getByRole("button",{name:/Select Round 1/}).click();await expect(page.getByRole("heading",{name:"Round 1 output"})).toBeVisible();await expect(page.getByRole("button",{name:/Select Round 3/})).toContainText("Latest");await expect(page.getByRole("button",{name:/Select Round 1/})).toContainText("Selected");
  const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("link",{name:"Download verified file"}).click()]);expect(download.suggestedFilename()).toBe("notes.md");const bytes=await readFile((await download.path())!);const expected=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem("platform.fixture.v1")!);return data.checkpoints.find((c:any)=>c.id==="fx-branch-1:1").assets.find((a:any)=>a.assetKey==="notes").descriptor.sha256;});expect(`0x${createHash("sha256").update(bytes).digest("hex")}`).toBe(expected);
  await page.getByRole("button",{name:"Continue",exact:true}).click();const sheet=page.getByRole("dialog",{name:"Prepare a contribution"});await expect(sheet).toContainText("fx-branch-1:3");await expect(sheet.getByRole("button",{name:"Sign and submit proposal"})).toHaveCount(0);await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Continue",exact:true})).toBeFocused();
});
test("continue prepares a proposal without approval or purchase",async({page})=>{
  await workspace(page);await page.getByRole("button",{name:"Continue",exact:true}).click();const form=page.getByRole("dialog");await form.getByLabel("New asset name",{exact:true}).fill("guide");await form.getByLabel("Requirement",{exact:true}).fill("Document the handoff in plain English.");await form.getByRole("button",{name:"Review proposal",exact:true}).click();await expect(form).toContainText("Gas only. Execution requires separate funding");await form.getByRole("button",{name:"Sign and submit proposal"}).click();await expect(form).toHaveCount(0);await expect(page.getByRole("heading",{name:/Create Markdown.*guide/})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("platform.fixture.v1")!).sponsorships.length)).toBe(0);expect(await page.getByRole("button",{name:"Review funding",exact:true}).count()).toBe(3);
});
test("contribution sheets restore the actual clicked opener instead of stale focus",async({page})=>{
  await workspace(page);
  const triggers = [
    page.getByRole("button", {name:"Continue",exact:true}),
    page.getByRole("button", {name:"Review funding",exact:true}).first(),
    page.getByRole("button", {name:"Historical Fork",exact:true}),
    page.getByRole("button", {name:"Prepare at current checkpoint",exact:true}).first(),
  ];
  for (const trigger of triggers) {
    // A mouse/touch activation need not focus its button on WebKit. Retain unrelated
    // prior focus to prove dismissal uses the actual initiating control.
    await page.getByRole("button", {name:"Connect wallet",exact:true}).focus();
    await trigger.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(page.locator("#root")).toHaveAttribute("inert", "");
    await sheet.getByRole("button", {name:"Close preparation",exact:true}).click();
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  }
});
test("approval confirms before a separate purchase; exact allowance; completed attempt",async({page},info)=>{
  const sheet=await openFunding(page);await shot(page,info,"funding");await expect(sheet.getByRole("button",{name:"2. Purchase execution"})).toBeDisabled();await sheet.getByLabel(/Maximum fee/).fill("100");await sheet.getByRole("button",{name:"1. Approve exact amount"}).dblclick();await expect(sheet.getByRole("button",{name:"2. Purchase execution"})).toBeEnabled();expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem("platform.fixture.v1")!).allowances))).toEqual(["25000000000000000000"]);await sheet.getByRole("button",{name:"2. Purchase execution"}).dblclick();await expect(sheet).toHaveCount(0);await expect(page.locator(".attempt")).toHaveCount(1);await expect(page.locator(".attempt .stage").filter({hasText:"Binding"})).toContainText("Confirmed");await page.getByRole("button",{name:/Select Round 4/}).click();await expect(page.getByRole("heading",{name:"Round 4 output"})).toBeVisible();await expect(page.getByRole("button",{name:/Select Round 3/})).not.toContainText("Latest");
});
test("historical fork copies selected output and retains original provenance",async({page})=>{
  await workspace(page);await page.getByRole("button",{name:/Select Round 1/}).click();await page.getByRole("button",{name:"Historical Fork",exact:true}).click();const sheet=page.getByRole("dialog",{name:"Historical Fork"});await expect(sheet).toContainText("fx-branch-1:1");await sheet.getByLabel("Fork direction (fixed after creation)").fill("Develop an accessible English introduction");await sheet.getByRole("button",{name:"Review fork"}).click();await sheet.getByRole("button",{name:"Sign and fork"}).click();await sheet.getByRole("link",{name:"Open fork",exact:true}).click();await expect(page.getByRole("heading",{name:"Inherited snapshot"})).toBeVisible();await expect(page.getByRole("button",{name:"Historical Fork",exact:true})).toHaveCount(0);await expect(page.getByRole("link",{name:"Download verified file"})).toBeVisible();await page.getByText(/Complete asset table/).click();await expect(page.getByRole("table")).toContainText("fx-branch-1:1");await expect(page.getByRole("table")).toContainText("fx-job-1");expect(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem("platform.fixture.v1")!);return s.branches.find((b:any)=>b.id===location.hash.split("/").at(-1)).imdProjectId;})).toBeNull();
});
test("PNG uses its natural aspect ratio and all original file origins remain reachable",async({page})=>{
  await workspace(page);await page.getByRole("button",{name:/Select Round 2/}).click();const image=page.locator(".img-box img");await expect(image).toBeVisible();const size=await image.evaluate((i:HTMLImageElement)=>({w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height,nw:i.naturalWidth,nh:i.naturalHeight}));expect(size.w/size.h).toBeCloseTo(size.nw/size.nh,4);await page.getByText(/Complete asset table/).click();await expect(page.getByRole("table")).toContainText("fx-job-1");await expect(page.getByRole("table")).toContainText("fx-job-2");
});
test("isolated HTML and sanitized Markdown; bad and unavailable files never verified",async({page})=>{
  await page.goto("./#/demo/b/fx-branch-sec");await expect(page.locator("iframe")).toHaveAttribute("sandbox","");const frame=page.locator("iframe").contentFrame();await expect(frame.locator("script,form,iframe,[href],[action],img[src]")).toHaveCount(0);await page.getByRole("button",{name:/assets\/evil-notes.md/}).click();await expect(page.locator(".md")).toBeVisible();await expect(page.locator(".md script,.md iframe,.md img,[autofocus]")).toHaveCount(0);for(const name of ["tampered.png","missing.md","fake-png.png","broken-png.png","oversized-png.png"]){await page.getByRole("button",{name:new RegExp(`assets/${name.replace('.','\\.')}`)}).click();await expect(page.locator(".preview [role=alert]")).toBeVisible();await expect(page.locator(".preview .badge-ok")).toHaveCount(0);await expect(page.getByRole("link",{name:"Download verified file"})).toHaveCount(0);}
});
test("account changes cancel preparation; wrong network disables signing",async({page})=>{
  await openFunding(page);await page.keyboard.press("Escape");await page.getByText("Demo settings",{exact:true}).click();await page.getByLabel("Simulate wrong network").check();await expect(page.getByRole("button",{name:"Review funding",exact:true}).first()).toBeDisabled();await page.getByLabel("Simulate wrong network").uncheck();await page.getByText("Demo settings",{exact:true}).click();await page.getByRole("button",{name:"Review funding",exact:true}).first().click();await page.keyboard.press("Escape");await page.getByText("Demo settings",{exact:true}).click();await page.getByLabel("Demo signing account").selectOption("1");await expect(page.getByRole("status")).toContainText("Account or network changed");
});
test("production-component showcase and wallet sheet keyboard focus",async({page},info)=>{
  await page.goto("./#/showcase");await expect(page.getByRole("heading",{name:"Platform components",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Round 3 output"})).toBeVisible();await expect(page.getByRole("link",{name:"Download verified file"})).toBeVisible();await page.getByRole("button",{name:"Review demo funding"}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"Close preparation"})).toBeFocused();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Review demo funding"})).toBeFocused();await page.getByRole("button",{name:"Connect wallet",exact:true}).click();const wallet=page.getByRole("dialog",{name:"Connect wallet"});await expect(wallet).toBeVisible();await expect(wallet.getByText("Injected",{exact:true})).toHaveCount(0);await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Connect wallet",exact:true})).toBeFocused();await shot(page,info,"showcase");
});

test("reduced motion keeps keyboard preparation, focus return and historical selection usable",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await workspace(page);
  const action=page.getByRole("button",{name:"Continue",exact:true});
  expect(await action.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe("0s");
  await action.focus();await page.keyboard.press("Enter");const sheet=page.getByRole("dialog",{name:"Prepare a contribution"});
  await page.keyboard.press("Tab");await expect(sheet.getByRole("button",{name:"Close preparation"})).toBeFocused();
  await page.keyboard.press("Shift+Tab");await expect(sheet.getByRole("button",{name:"Review proposal",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await expect(action).toBeFocused();
  await page.getByRole("button",{name:/Select Round 1/}).click();await expect(page.getByRole("button",{name:/Select Round 3/})).toContainText("Latest");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});

test("actual handoff does not promote live profile readiness",async({page})=>{
 await page.goto('./#/configuration');
 await page.getByText('Deployment status and source',{exact:true}).click();
 await expect(page.getByText('HANDOFF_PRESENT_UNVERIFIED',{exact:true})).toBeVisible();
 await expect(page.getByText('productionReady: false',{exact:false})).toBeVisible();
 await expect(page.getByText('liveCompatibility: NOT_RUN',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:'Create project'})).toHaveCount(0);
});
