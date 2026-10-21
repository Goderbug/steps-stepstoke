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
      if (!res.ok) throw new Error("缺少本地配置，请运行 README 的本地设置命令。");
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
  const account: Account = { address: connected.address ?? "", chainId: connected.chainId ?? 0, label: connected.address ? "所选钱包" : "未连接（可公开读取）" };
  return <>
    <div className="demo-bar" role="status"><p><strong>本地合约模式</strong>：实际 A1 交易，MockToken / MockIntake 与确定性文件。非真实 IMD，无公开部署。</p><div className="actions"><a href="#/">公开配置</a><a href="#/demo">样例演示</a></div></div>
    <main id="main" tabIndex={-1} className="page">
      {!adapter && !error && <p className="state-line">正在核验链、Factory、Branch、policy 与运行时代码…</p>}
      {error && <section className="panel"><h1>本地合约未连接</h1><p className="alert alert-error" role="alert">{error}</p><p>按照 README 启动本地 Anvil、部署实际 A1 并生成配置；不会回退为样例。</p><button className="btn btn-primary" onClick={() => setGeneration(n => n + 1)}>重新核验本地配置</button></section>}
      {adapter && <>
        {id ? <Workspace key={id} adapter={adapter} branchId={id} account={account} /> : <ProjectList adapter={adapter} account={account} />}
        <details className="panel"><summary>本地交易记录与限制</summary><p>钱包只签 SDK 未签名交易。回执、接收、执行、回调、绑定、文件、Git、发布各自独立。未知交易不会自动重购；刷新会从链恢复状态，本机记录只协助对账。</p><p>公开 productionDeployment:null；liveCompatibility:NOT_RUN；productionReady:false。浏览器无法观察 DNS/IP；此模式的回环文件策略仅用于测试。</p><pre className="req">{JSON.stringify(loadJournal(), null, 2)}</pre></details>
      </>}
    </main>
  </>;
}
