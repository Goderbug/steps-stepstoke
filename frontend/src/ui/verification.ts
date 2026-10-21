import { useSyncExternalStore } from "react";
import type { AssetVersion } from "../domain/types";

// Local observations of actual-byte verification in this page session. They never change chain
// binding truth and are not persisted: after a reload the file stage waits for a new check.
// The key covers checkpoint, producer job and the full descriptor, so other bytes never match.
export type VerificationResult = "verified" | "failed";

const results = new Map<string, VerificationResult>();
const listeners = new Set<() => void>();
let version = 0;

export const verificationKey = (a: AssetVersion, identity = "") =>
  JSON.stringify([identity, a.originBranchId, a.originCheckpoint, a.assetKey, a.revision, a.producerJobId, a.kind, a.descriptor.name, a.descriptor.path, a.descriptor.mediaType, a.descriptor.bytes, a.descriptor.sha256]);

export function recordVerification(a: AssetVersion, result: VerificationResult, identity = "") {
  const key = verificationKey(a, identity);
  if (results.get(key) === result) return;
  results.set(key, result);
  version += 1;
  for (const l of listeners) l();
}

export const verificationOf = (a: AssetVersion, identity = "") => results.get(verificationKey(a, identity)) ?? null;

export function clearVerifications() {
  results.clear();
  version += 1;
  for (const l of listeners) l();
}

/** Re-renders when any observation changes; read individual results with verificationOf. */
export function useVerificationVersion() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => version,
  );
}
