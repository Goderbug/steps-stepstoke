import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { WalletButton } from "./components/WalletButton";
import { EvidenceDisclosure, ProjectHeader } from "./components/platform";
import { createLiveAdapter } from "./domain/liveAdapter";
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
  return <><a className="skip" href="#main" onClick={e=>{e.preventDefault();document.getElementById("main")?.focus();}}>Skip to main content</a><header className="top"><a className="brand" href="#/"><img src="./favicon.svg" width={28} height={28} alt=""/><span>CTO Relay</span></a><nav className="main-nav" aria-label="Platform"><a href="#/" aria-current={!demo&&!showcase&&!hash.startsWith("#/local")?"page":undefined}>Projects</a><a href="#/demo" aria-current={demo?"page":undefined}>Demo</a><a href="#/showcase" aria-current={showcase?"page":undefined}>Components</a></nav><div className="top-right"><WalletButton/></div></header>{demo?<DemoApp branchId={branchId}/>:showcase?<Showcase/>:hash.startsWith("#/local")?<LocalApp/>:<LiveApp/>}<footer className="site-footer"><span>CTO Relay · Open Workshop</span><a href="#/showcase">Platform components</a><span>Local acceptance only · No public deployment</span></footer></>;
}
function LiveApp() {
  const adapter=useMemo(()=>createLiveAdapter(),[]),st=adapter.status();const {address,chainId,isConnected}=useAccount();
  return <main id="main" tabIndex={-1} className="page"><ProjectHeader title="Projects move forward" goal="A shared workspace to propose work, fund execution and build on accepted outputs."/>
    <section className="entry-workspace" aria-labelledby="entry-title"><div className="entry-sequence" aria-hidden="true"><span>01 Propose</span><span>02 Fund</span><span>03 Build</span><span>04 Continue</span></div><div className="entry-content"><div className="entry-icon" aria-hidden="true">↗</div><h2 id="entry-title">See a relay in progress</h2><p>Follow HTML → PNG → HTML through three accepted demo rounds. Explore files, contributions and historical forks.</p><div className="actions"><a className="btn btn-primary" href="#/demo/b/fx-branch-1">Explore demo project <span aria-hidden="true">→</span></a><a className="btn btn-secondary" href="#/local">Open local contracts</a></div><p className="hint">Demo data is labelled. Browse without a wallet.</p></div></section>
    <section className="work-section"><div className="panel-head"><h2>Public projects</h2><button className="btn btn-secondary" disabled aria-describedby="deployment-note">Create project</button></div><p id="deployment-note" className="hint">Public deployment is not configured. Local contract mode uses actual A1 contracts with MockToken and MockIntake.</p><EvidenceDisclosure title="Deployment status and source"><p><code>{st.state}</code> · {st.summary}</p><ul>{st.missing.map(m=><li key={m}>{m}</li>)}</ul><dl className="facts"><div><dt>Status</dt><dd>productionDeployment: null · liveCompatibility: NOT_RUN · productionReady: false</dd></div><div><dt>Account / network</dt><dd>{isConnected&&address?<CopyId value={address} label="account"/>:"Not connected; browsing is available"} · {chainId??"No network selected"}</dd></div><div><dt>A1 source job</dt><dd><CopyId value={st.a1.jobId} label="A1 source job"/>{st.a1.delivery&&<a href={st.a1.delivery} target="_blank" rel="noopener noreferrer">Pinned source delivery</a>}</dd></div></dl></EvidenceDisclosure></section>
  </main>;
}
function DemoApp({branchId}:{branchId:string|null}) {
  const qc=useQueryClient();const [adapter,setAdapter]=useState<FixtureAdapter|null>(null),[error,setError]=useState<string|null>(null),[who,setWho]=useState(0),[wrongNet,setWrongNet]=useState(false),[generation,setGeneration]=useState(0),[resetting,setResetting]=useState(false);const lock=useRef(false);
  useEffect(()=>{let active=true;FixtureAdapter.create().then(a=>active&&setAdapter(a),(e:Error)=>active&&setError(e.message));return()=>{active=false;};},[]);
  const account:Account={...DEMO_ACCOUNTS[who],chainId:wrongNet?1:FIXTURE_CHAIN_ID};
  return <><div className="mode-bar"><span className="tag">Demo mode</span><span>Deterministic local fixtures. Simulated signatures only.</span><details className="demo-controls"><summary>Demo settings</summary><div><label className="field"><span>Demo signing account</span><select value={who} onChange={e=>setWho(Number(e.target.value))}>{DEMO_ACCOUNTS.map((a,i)=><option key={a.address} value={i}>{a.label}</option>)}</select></label><label className="check"><input type="checkbox" checked={wrongNet} onChange={e=>setWrongNet(e.target.checked)}/><span>Simulate wrong network</span></label><button className="btn btn-quiet" disabled={resetting} onClick={async()=>{if(lock.current)return;lock.current=true;setResetting(true);try{const next=await FixtureAdapter.create({reset:true});try{localStorage.removeItem("w1.recovery.v1");}catch{}clearVerifications();qc.removeQueries();setAdapter(next);setGeneration(n=>n+1);setWho(0);setWrongNet(false);location.hash="#/demo";}catch(e){setError((e as Error).message);}finally{lock.current=false;setResetting(false);}}}>{resetting?"Resetting…":"Reset demo data"}</button></div></details></div><main id="main" tabIndex={-1} className="page">{error&&<p className="alert alert-error" role="alert">Demo read failed: {error}</p>}{!adapter&&!error&&<p className="state-line">Loading demo…</p>}{adapter&&(branchId?<Workspace key={`${generation}:${branchId}`} adapter={adapter} branchId={branchId} account={account}/>:<ProjectList key={generation} adapter={adapter} account={account}/>)}</main></>;
}
