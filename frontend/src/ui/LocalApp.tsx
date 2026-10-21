import { EvidenceDisclosure } from "../components/platform";
import { CopyId } from "./format";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { ChainAdapter, loadJournal, type LocalConfig, type Provider } from "../domain/chainAdapter";
import type { DisplayAccount as Account } from "../domain/types";
import { ProjectList } from "./ProjectList";
import { Workspace } from "./Workspace";

export function LocalApp() {
  const connected = useAccount();
  const current = useRef(connected); current.current = connected;
  const [adapter, setAdapter] = useState<ChainAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const qc = useQueryClient();
  const id = /^#\/local\/b\/(0x[0-9a-fA-F]{40})/.exec(location.hash)?.[1] ?? null;
  useEffect(() => {
    let active = true;
    setAdapter(null); setError(null);
    qc.removeQueries();
    (async () => {
      const res = await fetch("./local-config.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Local configuration is missing. Run the local setup command in README.");
      const config = await res.json() as LocalConfig;
      const a = new ChainAdapter(config, async () => {
        const connector = current.current.connector;
        if (!connector) return null;
        return await connector.getProvider() as Provider;
      });
      await a.verify();
      if (active) setAdapter(a);
    })().catch(e => active && setError((e as Error).message));
    return () => { active = false; };
  }, [generation, qc]);
  const account: Account = { address: connected.address ?? "", chainId: connected.chainId ?? 0, label: connected.address ? "Selected wallet" : "Disconnected; public reads available" };
  return <>
    <div className="demo-bar" role="status"><p><strong>Local contract mode</strong>: Actual A1 contracts with MockToken, MockIntake and deterministic files. No live IMD or public deployment.</p><div className="actions"><a href="#/">Public configuration</a><a href="#/demo">Fixture demo</a></div></div>
    <main id="main" tabIndex={-1} className="page">
      {!adapter && !error && <p className="state-line">Verifying chain, Factory, Branch, policy and runtime code…</p>}
      {error && <section className="panel"><h1>Local contracts unavailable</h1><p className="alert alert-error" role="alert">{error}</p><p>Run local setup from README to start Anvil and generate deployment configuration. Fixture data is never substituted.</p><button className="btn btn-primary" onClick={() => setGeneration(n => n + 1)}>Verify local configuration again</button></section>}
      {adapter && <>
        {id ? <Workspace key={id} adapter={adapter} branchId={id} account={account} /> : <ProjectList adapter={adapter} account={account} />}
        <EvidenceDisclosure title="Local deployment identity, transaction records and limitations"><dl className="facts"><div><dt>Chain</dt><dd>{adapter.config.chainId}</dd></div><div><dt>Factory</dt><dd><CopyId value={adapter.config.contracts.factory} label="Factory address" /></dd></div></dl><p>Wallets sign SDK-prepared transactions. Receipts, admission, execution, callback, binding, files, Git and publication are separate. Unknown transactions never trigger a repurchase. Refresh reads chain state; local records only help reconciliation.</p><p>productionDeployment:null; liveCompatibility:NOT_RUN; productionReady:false. Browsers cannot inspect DNS/IP. The loopback artifact policy is local testing only.</p><pre className="req">{JSON.stringify(loadJournal(), null, 2)}</pre></EvidenceDisclosure>
      </>}
    </main>
  </>;
}
