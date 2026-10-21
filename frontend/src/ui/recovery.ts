import type { RecoveryRecord } from "../domain/adapter";
import type { Sponsorship } from "../domain/types";

/** A local journal row whose purchase finally failed (reverted or replaced) never became an
 *  on-chain attempt, so it cannot supersede the authenticated attempt that permits a retry. */
export function isLatestAttempt(all: Sponsorship[] | undefined, sp: Sponsorship) {
  return !all?.some((other) => other.proposalId === sp.proposalId && other.attempt > sp.attempt && other.stages.purchase !== "failed");
}

// Local storage only helps recovery after a reload: the chain state the adapter reports is the truth.
const KEY = "w1.recovery.v1";

export function loadRecovery(): RecoveryRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter(isRecord).slice(-100) : [];
  } catch {
    return [];
  }
}

export function saveRecovery(r: RecoveryRecord) {
  const all = loadRecovery().filter((x) => x.sponsorshipId !== r.sponsorshipId);
  try { localStorage.setItem(KEY, JSON.stringify([...all, r].slice(-100))); return true; }
  catch { return false; } // Storage failure cannot turn a submitted purchase into a retry.
}

export function removeRecovery(sponsorshipId: string) {
  try { localStorage.setItem(KEY, JSON.stringify(loadRecovery().filter((x) => x.sponsorshipId !== sponsorshipId))); } catch { /* chain remains authoritative */ }
}

function isRecord(r: unknown): r is RecoveryRecord {
  if (!r || typeof r !== "object") return false;
  const v = r as Partial<RecoveryRecord>;
  return typeof v.sponsorshipId === "string" && typeof v.branchId === "string" && typeof v.proposalId === "string"
    && typeof v.account === "string" && /^0x[\da-f]{40}$/i.test(v.account)
    && typeof v.txHash === "string" && /^0x[\da-f]{64}$/i.test(v.txHash)
    && Number.isSafeInteger(v.nonce) && (v.nonce ?? -1) >= 0
    && Number.isSafeInteger(v.chainId) && (v.chainId ?? 0) > 0
    && (v.adapterKind === "fixture" || v.adapterKind === "live") && typeof v.savedAt === "string";
}
