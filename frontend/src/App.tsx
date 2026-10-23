import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "./components/WalletButton";
import { EvidenceDisclosure, ProjectHeader } from "./components/platform";
import { PUBLIC_FACTS, UNDEPLOYED_BUILD, probePublicDeployment, type PublicProbe } from "./domain/publicMode";
import { CopyId } from "./ui/format";
import { LocalApp } from "./ui/LocalApp";
import { BRAND, BrandLockup, BrandSymbol } from "./brand/Logo";

function useHash() {
  const readHash = () => {
    const hash = location.hash || "#/";
    if (/^#\/(?:demo|showcase)(?:[/?]|$)/.test(hash)) {
      history.replaceState(history.state, "", `${location.pathname}${location.search}#/`);
      return "#/";
    }
    return hash;
  };
  const [hash,setHash]=useState(readHash);
  useEffect(()=>{const on=()=>setHash(readHash());addEventListener("hashchange",on);return()=>removeEventListener("hashchange",on);},[]);
  return hash;
}
export function App() {
  const hash=useHash();
  const first=useRef(true);
  useEffect(()=>{if(first.current){first.current=false;return;}document.getElementById("main")?.focus({preventScroll:true});scrollTo(0,0);},[hash]);
  const home = hash === "#/" || hash === "#";
  const projects = !home && !hash.startsWith("#/local") && !hash.startsWith("#/configuration");
  return <>
    <a className="skip" href="#main" tabIndex={0} onClick={e=>{e.preventDefault();document.getElementById("main")?.focus();}}>Skip to main content</a>
    <header className="top">
      <a className="brand" href="#/" aria-label="STEPS home"><BrandLockup/></a>
      <nav className="main-nav" aria-label="Platform">
        <a href="#/ethereum" aria-current={projects?"page":undefined}>Projects</a>
      </nav>
      <div className="top-right"><WalletButton/></div>
    </header>
    {home?<Home/>:hash.startsWith("#/local")?<LocalApp key="local"/>:hash.startsWith("#/configuration")?<LiveApp/>:<LocalApp key="ethereum" network="ethereum"/>}
    <footer className="site-footer">
      <span className="footer-brand"><BrandSymbol/><span>STEPS · Stepstoke</span></span>
      <a href={BRAND.x.url} target="_blank" rel="noopener noreferrer">Stepstoke on X</a>
      <span>Ethereum deployed · Payments disabled</span>
    </footer>
  </>;
}
function Home() {
  return <main id="main" tabIndex={-1} className="page">
    <ProjectHeader title={BRAND.slogan} goal="A shared workspace to propose work, fund execution and build on accepted outputs."/>
    <section className="entry-workspace" aria-labelledby="entry-title">
      <ol className="entry-sequence" aria-label="How a project moves forward">
        <li>01 Propose</li><li>02 Fund</li><li>03 Build</li><li>04 Continue</li>
      </ol>
      <div className="entry-content">
        <div className="entry-icon" aria-hidden="true"><BrandSymbol size={36}/></div>
        <h2 id="entry-title">Projects move forward, step by step</h2>
        <p>Browse public projects and inspect their outputs. Follow the sequence of contributions, continue from the latest step, or fork an earlier one.</p>
        <div className="actions">
          <a className="btn btn-primary" href="#/ethereum">Browse projects <span aria-hidden="true">→</span></a>
        </div>
        <p className="hint">Browse without a wallet. Live payments remain disabled.</p>
      </div>
    </section>
    <p className="entry-status"><a href="#/configuration">Deployment and readiness</a></p>
  </main>;
}
// The local route needs a loopback page (chainAdapter.ts); hosted visitors never see it.
const LOOPBACK=["localhost","127.0.0.1","[::1]"];
function LiveApp() {
  const {address,chainId,isConnected}=useAccount();
  // An undeployed build makes no handoff request on load (it would only 404); a visitor can still
  // check explicitly. A deployed build reads and digest-checks its handoff automatically.
  const [probe,setProbe]=useState<PublicProbe>(()=>PUBLIC_FACTS.productionDeployment?{state:"checking"}:UNDEPLOYED_BUILD),[attempt,setAttempt]=useState(PUBLIC_FACTS.productionDeployment?1:0);
  useEffect(()=>{if(!attempt)return;let active=true;setProbe({state:"checking"});probePublicDeployment().then(p=>{if(active)setProbe(p);});return()=>{active=false;};},[attempt]);
  const wallet=!isConnected||!address?"Not connected. Browsing and verified public reads need no wallet.":chainId!==PUBLIC_FACTS.chainId?`Connected on chain ${chainId}. Signing is blocked until the wallet selects Ethereum (chain 1); reads are unaffected.`:"Connected on Ethereum. Signing still requires a verified deployment and cleared production gates.";
  const note=probe.state==="checking"?"Checking the Ethereum deployment handoff…":probe.state==="handoff"?"The deployment handoff and its asset hashes match. Open projects to verify the live chain, receipt, trace and runtime code.":probe.state==="rejected"?`The supplied Ethereum deployment failed verification and is disabled: ${probe.reason}`:"The verified launch is recorded, but its deployment handoff cannot be loaded here. Public reads stay unavailable until verification succeeds.";
  return <main id="main" tabIndex={-1} className="page"><ProjectHeader title="Deployment and readiness" goal="STEPS is connected to Ethereum. Live profile checks remain unperformed and payments stay disabled."/>
    <section className="work-section" aria-busy={probe.state==="checking"}><div className="panel-head"><h2>Public projects</h2><a className="btn btn-primary" href="#/ethereum">Verify and open projects</a></div><p id="deployment-note" className={probe.state==="rejected"?"alert alert-error":"hint"} role={probe.state==="rejected"?"alert":undefined}>{note}</p>{(probe.state==="rejected"||probe.state==="undeployed")&&<button className="btn btn-quiet" onClick={()=>setAttempt(n=>n+1)}>Check the handoff again</button>}<EvidenceDisclosure title="Deployment status and source"><p><code>{probe.state==="handoff"?"HANDOFF_PRESENT_UNVERIFIED":probe.state==="rejected"?"DEPLOYMENT_REJECTED":probe.state==="checking"?"CHECKING":"HANDOFF_UNAVAILABLE"}</code> · Deployment validity, live compatibility and signing authority are separate.</p><dl className="facts"><div><dt>Status</dt><dd>productionDeployment: {PUBLIC_FACTS.productionDeployment?"recorded":"unavailable"} · liveCompatibility: {PUBLIC_FACTS.liveCompatibility} · productionReady: {String(PUBLIC_FACTS.productionReady)}</dd></div><div><dt>Target network</dt><dd>{PUBLIC_FACTS.chainName} · chain {PUBLIC_FACTS.chainId}. No implicit network switch.</dd></div><div><dt>Payment token ({PUBLIC_FACTS.paymentToken})</dt><dd><CopyId value={PUBLIC_FACTS.imd} label="IMD token"/></dd></div><div><dt>Intake</dt><dd><CopyId value={PUBLIC_FACTS.intake} label="Intake"/> · {PUBLIC_FACTS.actions.join(", ")}</dd></div>{probe.state==="handoff"&&<div><dt>Handoff identity</dt><dd><CopyId value={probe.identity} label="deployment identity"/> · block {probe.deploymentBlock}</dd></div>}<div><dt>Account / network</dt><dd>{isConnected&&address?<CopyId value={address} label="account"/>:null} {wallet}</dd></div></dl><p className="hint">Create, propose, fund, fork and binding transactions stay disabled while production gates remain open. Disabled controls do not stop direct permissionless contract calls.</p></EvidenceDisclosure><div className="actions">{LOOPBACK.includes(location.hostname)&&<a className="btn btn-quiet" href="#/local">Open local contracts</a>}</div></section>
  </main>;
}
