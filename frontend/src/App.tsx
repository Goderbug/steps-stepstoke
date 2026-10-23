import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { WalletButton } from "./components/WalletButton";
import { EvidenceDisclosure, ProjectHeader } from "./components/platform";
import { PUBLIC_FACTS, UNDEPLOYED_BUILD, probePublicDeployment, type PublicProbe } from "./domain/publicMode";
import { DEMO_ACCOUNTS, FIXTURE_CHAIN_ID, FixtureAdapter } from "./domain/fixtureAdapter";
import type { Account } from "./domain/types";
import { CopyId } from "./ui/format";
import { ProjectList } from "./ui/ProjectList";
import { Workspace } from "./ui/Workspace";
import { clearVerifications } from "./ui/verification";
import { LocalApp } from "./ui/LocalApp";
import { Showcase } from "./ui/Showcase";

function useHash() {
  const [hash,setHash]=useState(()=>location.hash||"#/");
  useEffect(()=>{const on=()=>setHash(location.hash||"#/");addEventListener("hashchange",on);return()=>removeEventListener("hashchange",on);},[]);
  return hash;
}
export function App() {
  const hash=useHash(),demo=hash.startsWith("#/demo"),showcase=hash.startsWith("#/showcase");
  const branchId=/^#\/demo\/b\/([\w:-]+)/.exec(hash)?.[1]??null;
  const first=useRef(true);
  useEffect(()=>{if(first.current){first.current=false;return;}document.getElementById("main")?.focus({preventScroll:true});scrollTo(0,0);},[hash]);
  return <><a className="skip" href="#main" tabIndex={0} onClick={e=>{e.preventDefault();document.getElementById("main")?.focus();}}>Skip to main content</a><header className="top"><a className="brand" href="#/"><img src="./favicon.svg" width={28} height={28} alt=""/><span>STEPS</span></a><nav className="main-nav" aria-label="Platform"><a href="#/" aria-current={!demo&&!showcase&&!hash.startsWith("#/local")?"page":undefined}>Projects</a><a href="#/demo" aria-current={demo?"page":undefined}>Demo</a><a href="#/showcase" aria-current={showcase?"page":undefined}>Components</a></nav><div className="top-right"><WalletButton/></div></header>{demo?<DemoApp branchId={branchId}/>:showcase?<Showcase/>:hash.startsWith("#/local")?<LocalApp key="local"/>:hash.startsWith("#/configuration")?<LiveApp/>:<LocalApp key="ethereum" network="ethereum"/>}<footer className="site-footer"><span>STEPS · Open Workshop</span><a href="https://x.com/stepstoke" target="_blank" rel="noopener noreferrer">Stepstoke on X</a><span>Ethereum deployed · Payments disabled</span></footer></>;
}
function LiveApp() {
  const {address,chainId,isConnected}=useAccount();
  // An undeployed build makes no handoff request on load (it would only 404); a visitor can still
  // check explicitly. A deployed build reads and digest-checks its handoff automatically.
  const [probe,setProbe]=useState<PublicProbe>(()=>PUBLIC_FACTS.productionDeployment?{state:"checking"}:UNDEPLOYED_BUILD),[attempt,setAttempt]=useState(PUBLIC_FACTS.productionDeployment?1:0);
  useEffect(()=>{if(!attempt)return;let active=true;setProbe({state:"checking"});probePublicDeployment().then(p=>{if(active)setProbe(p);});return()=>{active=false;};},[attempt]);
  const wallet=!isConnected||!address?"Not connected. Browsing and verified public reads need no wallet.":chainId!==PUBLIC_FACTS.chainId?`Connected on chain ${chainId}. Signing is blocked until the wallet selects Ethereum (chain 1); reads are unaffected.`:"Connected on Ethereum. Signing still requires a verified deployment and cleared production gates.";
  const note=probe.state==="checking"?"Checking the Ethereum deployment handoff…":probe.state==="handoff"?"The deployment handoff and its asset hashes match. Open projects to verify the live chain, receipt, trace and runtime code.":probe.state==="rejected"?`The supplied Ethereum deployment failed verification and is disabled: ${probe.reason}`:"The verified launch is recorded, but its deployment handoff cannot be loaded here. Public reads stay unavailable until verification succeeds.";
  return <main id="main" tabIndex={-1} className="page"><ProjectHeader title="Deployment and readiness" goal="STEPS is connected to Ethereum. Live profile checks remain unperformed and payments stay disabled."/>
    <section className="work-section" aria-busy={probe.state==="checking"}><div className="panel-head"><h2>Public projects</h2><a className="btn btn-primary" href="#/ethereum">Verify and open projects</a></div><p id="deployment-note" className={probe.state==="rejected"?"alert alert-error":"hint"} role={probe.state==="rejected"?"alert":undefined}>{note}</p>{(probe.state==="rejected"||probe.state==="undeployed")&&<button className="btn btn-quiet" onClick={()=>setAttempt(n=>n+1)}>Check the handoff again</button>}<EvidenceDisclosure title="Deployment status and source"><p><code>{probe.state==="handoff"?"HANDOFF_PRESENT_UNVERIFIED":probe.state==="rejected"?"DEPLOYMENT_REJECTED":probe.state==="checking"?"CHECKING":"HANDOFF_UNAVAILABLE"}</code> · Deployment validity, live compatibility and signing authority are separate.</p><dl className="facts"><div><dt>Status</dt><dd>productionDeployment: {PUBLIC_FACTS.productionDeployment?"recorded":"unavailable"} · liveCompatibility: {PUBLIC_FACTS.liveCompatibility} · productionReady: {String(PUBLIC_FACTS.productionReady)}</dd></div><div><dt>Target network</dt><dd>{PUBLIC_FACTS.chainName} · chain {PUBLIC_FACTS.chainId}. No implicit network switch.</dd></div><div><dt>Payment token ({PUBLIC_FACTS.paymentToken})</dt><dd><CopyId value={PUBLIC_FACTS.imd} label="IMD token"/></dd></div><div><dt>Intake</dt><dd><CopyId value={PUBLIC_FACTS.intake} label="Intake"/> · {PUBLIC_FACTS.actions.join(", ")}</dd></div>{probe.state==="handoff"&&<div><dt>Handoff identity</dt><dd><CopyId value={probe.identity} label="deployment identity"/> · block {probe.deploymentBlock}</dd></div>}<div><dt>Account / network</dt><dd>{isConnected&&address?<CopyId value={address} label="account"/>:null} {wallet}</dd></div></dl><p className="hint">Create, propose, fund, fork and binding transactions stay disabled while production gates remain open. Disabled controls do not stop direct permissionless contract calls.</p></EvidenceDisclosure><div className="actions"><a className="btn btn-secondary" href="#/demo/b/fx-branch-1">Explore demo project</a><a className="btn btn-quiet" href="#/local">Open local contracts</a></div></section>
  </main>;
}
function DemoApp({branchId}:{branchId:string|null}) {
  const qc=useQueryClient();const [adapter,setAdapter]=useState<FixtureAdapter|null>(null),[error,setError]=useState<string|null>(null),[who,setWho]=useState(0),[wrongNet,setWrongNet]=useState(false),[generation,setGeneration]=useState(0),[resetting,setResetting]=useState(false);const lock=useRef(false);
  useEffect(()=>{let active=true;FixtureAdapter.create().then(a=>active&&setAdapter(a),(e:Error)=>active&&setError(e.message));return()=>{active=false;};},[]);
  const account:Account={...DEMO_ACCOUNTS[who],chainId:wrongNet?1:FIXTURE_CHAIN_ID};
  return <><div className="mode-bar"><span className="tag">Demo mode</span><span>Deterministic local fixtures. Simulated signatures only.</span><details className="demo-controls"><summary>Demo settings</summary><div><label className="field"><span>Demo signing account</span><select value={who} onChange={e=>setWho(Number(e.target.value))}>{DEMO_ACCOUNTS.map((a,i)=><option key={a.address} value={i}>{a.label}</option>)}</select></label><label className="check"><input type="checkbox" checked={wrongNet} onChange={e=>setWrongNet(e.target.checked)}/><span>Simulate wrong network</span></label><button className="btn btn-quiet" disabled={resetting} onClick={async()=>{if(lock.current)return;lock.current=true;setResetting(true);try{const next=await FixtureAdapter.create({reset:true});try{localStorage.removeItem("w1.recovery.v1");}catch{}clearVerifications();qc.removeQueries();setAdapter(next);setGeneration(n=>n+1);setWho(0);setWrongNet(false);location.hash="#/demo";}catch(e){setError((e as Error).message);}finally{lock.current=false;setResetting(false);}}}>{resetting?"Resetting…":"Reset demo data"}</button></div></details></div><main id="main" tabIndex={-1} className="page">{error&&<p className="alert alert-error" role="alert">Demo read failed: {error}</p>}{!adapter&&!error&&<p className="state-line">Loading demo…</p>}{adapter&&(branchId?<Workspace key={`${generation}:${branchId}`} adapter={adapter} branchId={branchId} account={account}/>:<ProjectList key={generation} adapter={adapter} account={account}/>)}</main></>;
}
