import type { IntegrationStatus, RelayAdapter } from "./adapter";
import { IntegrationPendingError } from "./types";
import { A1_SOURCE } from "../config";

/**
 * A1 source/Node SDK is delivered, but its release has no product deployment and is not
 * production-ready. W1's browser bridge is unvalidated, so operations fail closed. No selector,
 * address or transaction is synthesized here (see docs/A1-HANDOFF.md).
 */
const pending = (what: string) => () => Promise.reject(new IntegrationPendingError(what));

export function createLiveAdapter(): RelayAdapter {
  const status: IntegrationStatus = {
    state: "A1_INTEGRATION_PENDING",
    summary: "A1 与浏览器 SDK 已接入本地合约模式；productionDeployment 为 null，公开项目与公开链操作保持关闭。",
    missing: [
      "已验证的链 ID、Factory 地址与公开 RPC",
      
      
    ],
    a1: { ...A1_SOURCE },
  };
  return {
    kind: "live",
    label: "A1 实时",
    capabilities: {
      read: false,
      createBranch: false,
      propose: false,
      sponsor: false,
      fork: false,
      bindingRetry: false,
      realWalletSigning: false,
    },
    status: () => status,
    getCapabilities: pending("能力配置"),
    listBranches: pending("公开项目列表"),
    getBranch: pending("分支读取"),
    getHistory: pending("历史读取"),
    getProposals: pending("提案读取"),
    getSponsorships: pending("资助状态读取"),
    quoteFee: pending("费用报价"),
    createBranch: pending("创建根分支"),
    propose: pending("提交提案"),
    approve: pending("授权额度"),
    sponsor: pending("资助"),
    retryRefused: pending("拒绝后重试"),
    resubmitBinding: pending("重新提交绑定"),
    fork: pending("分叉"),
    reconcile: pending("交易对账"),
    fetchFile: pending("文件下载"),
  };
}
