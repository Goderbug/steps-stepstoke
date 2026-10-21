import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { WALLET_ICONS } from "./icons";
import { OPEN_IN, isMobileBrowser } from "./open-in";
import { WALLET_CHAIN, LOCAL_CHAIN } from "../config";
import { short } from "../ui/format";

const svgSrc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** The one connect control and its sheet. In demo mode it is still the real wallet, but demo actions never ask it to sign. */
export function ConnectSheet() {
  const mobile = isMobileBrowser();
  const target = location.hash.startsWith("#/local") ? LOCAL_CHAIN : WALLET_CHAIN;
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, variables, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const app = document.getElementById("root");
    if (app) app.inert = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && sheet.current) {
        const items = [...sheet.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    addEventListener("keydown", onKey);
    sheet.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    return () => {
      if (app) app.inert = false;
      removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open]);
  useEffect(() => { if (isConnected) setOpen(false); }, [isConnected]);

  const named = connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const listed = [...connectors.filter((c) => c.type === "injected"), ...connectors.filter((c) => c.type !== "injected")]
    .filter((c) => !(c.id === "injected" && named));
  const label = (c: Connector) => (c.id === "injected" ? "浏览器钱包" : c.id === "coinbaseWalletSDK" && mobile ? "Coinbase Smart Wallet" : c.name);
  const icon = (c: Connector) => c.icon ?? (WALLET_ICONS[c.id] ? svgSrc(WALLET_ICONS[c.id]) : undefined);

  if (isConnected && address) {
    if (chainId !== target.id)
      return (
        <div className="wallet-row">
          <button ref={opener} className="btn btn-primary" disabled={switching} onClick={() => switchChain({ chainId: target.id })}>
            {switching ? "正在切换…" : `切换到 ${target.name}`}
          </button>
          <button className="btn btn-quiet" onClick={() => disconnect()}>断开</button>
        </div>
      );
    return (
      <div className="wallet-row">
        <span className="wallet-addr mono" title={address}>{short(address)}</span>
        <button ref={opener} className="btn btn-quiet" onClick={() => disconnect()}>断开</button>
      </div>
    );
  }
  return (
    <>
      <button ref={opener} className="btn btn-primary" onClick={() => { reset(); setOpen(true); }}>连接钱包</button>
      {open && createPortal(
        <div className="sheet-bg" onClick={() => setOpen(false)}>
          <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby="connect-title" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2 id="connect-title">连接钱包</h2>
              <button className="x" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
            </div>
            {mobile && OPEN_IN.map((w) => (
              <a key={w.id} className="sheet-row" href={w.href(location.href)} rel="noopener noreferrer">
                <span className="ic">{WALLET_ICONS[w.id] ? <img width={28} height={28} src={svgSrc(WALLET_ICONS[w.id])} alt="" /> : null}</span>
                <span>在 {w.name} 中打开</span>
              </a>
            ))}
            {listed.map((c) => (
              <button key={c.uid} className="sheet-row" onClick={() => connect({ connector: c })} disabled={isPending}>
                <span className="ic">{icon(c) ? <img width={28} height={28} src={icon(c)} alt="" /> : null}</span>
                <span>{label(c)}{isPending && variables?.connector === c ? " · 正在打开…" : ""}</span>
              </button>
            ))}
            {error && <p className="note" role="status">{/rejected|denied/i.test(error.message) ? "你在钱包中取消了连接。" : "钱包没有完成连接，请重试。"}</p>}
          </div>
        </div>, document.body
      )}
    </>
  );
}
