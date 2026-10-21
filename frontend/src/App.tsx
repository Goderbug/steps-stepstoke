import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectSheet } from "./wallet/ConnectSheet";
import { createLiveAdapter } from "./domain/liveAdapter";
import { DEMO_ACCOUNTS, FIXTURE_CHAIN_ID, FixtureAdapter } from "./domain/fixtureAdapter";
import type { Account } from "./domain/types";
import { CopyId, short } from "./ui/format";
import { ProjectList } from "./ui/ProjectList";
import { Workspace } from "./ui/Workspace";
import { clearVerifications } from "./ui/verification";
import { LocalApp } from "./ui/LocalApp";
import { WALLET_CHAIN, LOCAL_CHAIN } from "./config";

function useHash() {
  const [hash, setHash] = useState(() => location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const demo = hash.startsWith("#/demo");
  const branchId = /^#\/(?:demo\/)?b\/([\w:-]+)/.exec(hash)?.[1] ?? null;

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // Move focus to the main region on route change so keyboard and screen-reader users land on the new view.
    document.getElementById("main")?.focus({ preventScroll: true });
    scrollTo(0, 0);
  }, [hash]);

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>跳到主要内容</a>
      <header className={demo ? "top top-demo" : "top"}>
        <a className="brand" href={demo ? "#/demo" : "#/"}>
          <img src="./favicon.svg" width={24} height={24} alt="" />
          <span>CTO 中继站</span>
        </a>
        <div className="top-right">
          <NetworkBadge demo={demo} />
          <ConnectSheet />
        </div>
      </header>
      {demo ? <DemoApp branchId={branchId} /> : hash.startsWith("#/local") ? <LocalApp /> : <LiveApp />}
    </>
  );
}

function NetworkBadge({ demo }: { demo: boolean }) {
  const { isConnected, chainId } = useAccount();
  const target = location.hash.startsWith("#/local") ? LOCAL_CHAIN : WALLET_CHAIN;
  if (demo) return <span className="pill pill-demo">演示模式</span>;
  if (!isConnected) return null;
  return <span className={chainId === target.id ? "pill" : "pill pill-warn"}>{chainId === target.id ? target.name : `网络 ${chainId}`}</span>;
}

/** Live mode: public reads need no wallet, but A1 is not delivered, so everything is explicitly unavailable. */
function LiveApp() {
  const adapter = useMemo(() => createLiveAdapter(), []);
  const st = adapter.status();
  const { address, chainId, isConnected } = useAccount();
  return (
    <main id="main" tabIndex={-1} className="page">
      <section className="intro" aria-labelledby="live-title">
        <h1 id="live-title">公开项目</h1>
        <p className="lede">浏览任何人创建的项目，提出工作，明确资助，查看真实文件与历史。</p>
        <div className="actions">
          <button className="btn btn-primary" disabled aria-describedby="live-why">创建项目</button>
          <a className="btn btn-secondary" href="#/local">打开本地合约</a>
          <a className="btn btn-quiet" href="#/demo">打开演示模式</a>
        </div>
        <p id="live-why" className="hint">公开部署尚未配置。本地合约模式连接实际 A1 与 MockToken / MockIntake；演示模式只用样例。</p>
        <div className="alert alert-pending" role="status">
          <p><strong>公开配置未启用</strong>，状态码 <code>A1_INTEGRATION_PENDING</code></p>
          <p>{st.summary}</p>
          <ul>{st.missing.map((m) => <li key={m}>缺少：{m}</li>)}</ul>
          <p>这里不会用样例数据冒充公开项目。</p>
        </div>
      </section>
      <section className="panel" aria-labelledby="acct-title">
        <h2 id="acct-title">当前账户与网络</h2>
        <dl className="facts">
          <div><dt>账户</dt><dd>{isConnected && address ? <CopyId value={address} label="账户地址" /> : "未连接（浏览公开内容不需要连接）"}</dd></div>
          <div><dt>网络</dt><dd>{isConnected ? (chainId === WALLET_CHAIN.id ? WALLET_CHAIN.name : `链 ${chainId}，需要 ${WALLET_CHAIN.name}`) : "未连接"}</dd></div>
          <div><dt>A1 来源</dt><dd>作业 <CopyId value={st.a1.jobId} label="A1 作业" />，{st.a1.checkedAt} 查看时状态为 {st.a1.observedState}，{st.a1.delivery ? <a href={st.a1.delivery} target="_blank" rel="noopener noreferrer">查看已固定提交的源码交付</a> : "尚无公开交付"}</dd></div>
          <div><dt>A1 提交体 SHA-256</dt><dd><CopyId value={st.a1.submittedBodySha256} label="A1 提交体哈希" /></dd></div>
        </dl>
      </section>
    </main>
  );
}

/** Demo mode: the fixture adapter with two temporary demo accounts. The real wallet is never asked to sign. */
function DemoApp({ branchId }: { branchId: string | null }) {
  const qc = useQueryClient();
  const [adapter, setAdapter] = useState<FixtureAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState(0);
  const [wrongNet, setWrongNet] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [resetting, setResetting] = useState(false);
  const resetLock = useRef(false);
  useEffect(() => {
    FixtureAdapter.create().then(setAdapter, (e: Error) => setError(e.message));
  }, []);
  const account: Account = { ...DEMO_ACCOUNTS[who], chainId: wrongNet ? 1 : FIXTURE_CHAIN_ID };

  return (
    <>
      <div className="demo-bar" role="region" aria-label="演示模式">
        <p><strong>演示模式</strong>：本地固定样例，操作只使用模拟账户，不会请求真实钱包签名或发送真实交易。</p>
        <div className="demo-ctl">
          <label>
            <span>演示签名账户</span>
            <select value={who} onChange={(e) => setWho(Number(e.target.value))}>
              {DEMO_ACCOUNTS.map((a, i) => <option key={a.address} value={i}>{a.label} {short(a.address)}</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={wrongNet} onChange={(e) => setWrongNet(e.target.checked)} />
            <span>模拟钱包在错误网络</span>
          </label>
          <button
            className="btn btn-quiet"
            disabled={resetting}
            onClick={async () => {
              if (resetLock.current) return;
              resetLock.current = true;
              setResetting(true);
              try {
                const next = await FixtureAdapter.create({ reset: true });
                try { localStorage.removeItem("w1.recovery.v1"); } catch { /* local hints are optional */ }
                clearVerifications();
                qc.removeQueries({ predicate: (q) => ["branches", "branch", "history", "proposals", "sponsorships", "caps"].includes(String(q.queryKey[0])) });
                setAdapter(next);
                setGeneration((n) => n + 1);
                setWho(0);
                setWrongNet(false);
                setError(null);
                location.hash = "#/demo";
              } catch (e) { setError((e as Error).message); }
              finally { resetLock.current = false; setResetting(false); }
            }}
          >
            {resetting ? "重置中…" : "重置演示数据"}
          </button>
        </div>
      </div>
      <main id="main" tabIndex={-1} className="page">
        {error && <p className="alert alert-error" role="alert">演示数据加载失败：{error}</p>}
        {!adapter && !error && <p className="state-line">正在加载演示数据…</p>}
        {adapter && (branchId ? <Workspace key={`${generation}:${branchId}`} adapter={adapter} branchId={branchId} account={account} /> : <ProjectList key={generation} adapter={adapter} account={account} />)}
      </main>
    </>
  );
}
