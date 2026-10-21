import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { SITE_NAME, WALLET_CHAIN, LOCAL_CHAIN } from "../config";

// Wallets connect the network's one way: EIP-6963 browser wallets, phone "open in" links, and
// Coinbase Smart Wallet. No relay, no project ID. The wallet is used for account/network display
// and, once A1 ships, for signing A1-prepared unsigned transactions only.
export const wagmiConfig = createConfig({
  chains: [WALLET_CHAIN, LOCAL_CHAIN],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: SITE_NAME })],
  transports: { [WALLET_CHAIN.id]: http(), [LOCAL_CHAIN.id]: http("http://127.0.0.1:8545") },
});
