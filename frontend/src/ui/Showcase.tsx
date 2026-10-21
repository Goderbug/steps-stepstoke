import { useEffect, useState } from "react";
import { FixtureAdapter, DEMO_ACCOUNTS } from "../domain/fixtureAdapter";
import type { Branch, Checkpoint, Proposal, Sponsorship } from "../domain/types";
import { STAGES } from "../domain/types";
import { ProjectHeader, SequenceRail, ContributionCard, BuildStatus, EvidenceDisclosure } from "../components/platform";
import { ArtifactViewer } from "../components/ArtifactViewer";
import { FundingSheet } from "../components/FundingSheet";
import { FIXTURE_CAPABILITIES } from "../domain/fixtureAdapter";

export function Showcase() {
  const [data,setData]=useState<{adapter:FixtureAdapter;branch:Branch;cps:Checkpoint[];proposals:Proposal[]}|null>(null),[selected,setSelected]=useState<string|null>(null),[fund,setFund]=useState(false);
  useEffect(()=>{let active=true;(async()=>{const adapter=await FixtureAdapter.create();const [branch,cps,proposals]=await Promise.all([adapter.getBranch("fx-branch-1"),adapter.getHistory("fx-branch-1"),adapter.getProposals("fx-branch-1")]);if(active)setData({adapter,branch,cps:cps.sort((a,b)=>a.revision-b.revision),proposals});})();return()=>{active=false;};},[]);
  if(!data)return <main className="page" id="main" tabIndex={-1}><p>Loading production components…</p></main>;
  const {adapter,branch,cps,proposals}=data;const cp=cps.find(c=>c.id===selected)??cps.at(-1)!;const p=proposals.find(p=>p.status==="current")??proposals[0];
  const sample={id:"showcase-only",stages:Object.fromEntries(STAGES.map((s,i)=>[s,i<6?"confirmed":i===6?"pending":"not_applicable"]))} as Sponsorship;
  return <main className="page" id="main" tabIndex={-1}><ProjectHeader title="Platform components" goal="The same production components used by projects, workspace and funding. Demonstration data only."/><EvidenceDisclosure title="Tokens and local typography"><p>Canvas #F6F5F1 · Surface #FFFFFF · Text #22231F · Secondary #666961 · Border #DDDCD4 · Action #C1452A · Selected #FFF1E8.</p><p>Local system font fallback: Arial / Helvetica for interface text; Courier New / monospace for identifiers. No remote font requests.</p></EvidenceDisclosure><SequenceRail adapter={adapter} caps={FIXTURE_CAPABILITIES} checkpoints={cps} selectedId={cp.id} latestId={branch.latestCheckpoint} onSelect={setSelected}/><ArtifactViewer key={cp.id} checkpoint={cp} adapter={adapter} caps={FIXTURE_CAPABILITIES}/><section className="work-section"><h2>ContributionCard and FundingSheet</h2>{p&&<ContributionCard proposal={p}><button className="btn btn-secondary" onClick={()=>setFund(true)}>Review demo funding</button></ContributionCard>}</section><section className="work-section"><h2>BuildStatus</h2><p className="hint">Illustrative stage states, not a transaction receipt. File verification remains pending until exact bytes are checked.</p><BuildStatus sponsorship={sample}/></section><EvidenceDisclosure title="WalletButton and accessibility"><p>The header uses the production WalletButton. Its sheet supports named EIP-6963 browser wallets, mobile wallet links and Coinbase Smart Wallet. Tab stays in open sheets; Escape closes and returns focus.</p></EvidenceDisclosure>{fund&&p&&<FundingSheet account={DEMO_ACCOUNTS[0]} adapter={adapter} branch={branch} proposal={p} latest={cps.at(-1)!} onClose={()=>setFund(false)} onDone={()=>setFund(false)}/>}</main>;
}
