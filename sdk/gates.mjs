// Deployment validity, runtime compatibility and UI authority are separate decisions.
import { assertProductionGates, validateDeploymentRecord, REQUIRED_GATES } from './public.mjs';
export const PROFILE_IDS = Object.freeze([0,1,2,3,4]);
export function validateReleaseState(release, gate) {
  for (const v of [release,gate]) {
    if (v.productionReady !== true && v.productionReady !== false) throw new Error('productionReady must be explicit');
    if (!['NOT_RUN','FAIL','PASS'].includes(v.liveCompatibility)) throw new Error('Invalid live compatibility');
    if (v.productionDeployment) validateDeploymentRecord(v.productionDeployment);
    if (!v.productionDeployment && (v.productionReady || v.liveCompatibility !== 'NOT_RUN')) throw new Error('Undeployed release cannot claim live validation');
  }
  if (JSON.stringify(release.productionDeployment) !== JSON.stringify(gate.productionDeployment) || release.productionReady !== gate.productionReady || release.liveCompatibility !== gate.liveCompatibility) throw new Error('Release/gate state differs');
  for (const name of REQUIRED_GATES) if (!['NOT_RUN','OPEN','FAIL','PASS'].includes(gate.gates?.[name]?.status) || !Array.isArray(gate.gates[name].evidence)) throw new Error(`Invalid ${name} gate`);
  if (release.liveCompatibility === 'PASS') {
    for (const id of PROFILE_IDS) if (gate.profiles?.[id]?.status !== 'PASS' || !gate.profiles[id].evidence?.length) throw new Error(`Profile ${id} has no live evidence`);
  }
  if (release.productionReady) assertProductionGates(gate);
  return { deployment: release.productionDeployment ? 'EVIDENCE_REQUIRED' : 'UNDEPLOYED', liveCompatibility: release.liveCompatibility, productionReady: release.productionReady };
}
export function uiCapabilities({ verified = false, gate, config } = {}) {
  let transact = false;
  if (verified) { try { assertProductionGates(gate, config); transact = true; } catch {} }
  return { read: verified, createBranch: transact, propose: transact, sponsor: transact, fork: transact, bindingRetry: transact, realWalletSigning: transact };
}
