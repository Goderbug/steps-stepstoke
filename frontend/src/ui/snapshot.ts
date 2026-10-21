import type { RelayAdapter } from "../domain/adapter";
/** Both reads are repeated together. Never combine a fresh branch with cached history. */
export async function readWorkspaceSnapshot(adapter: RelayAdapter, branchId: string) {
  const read = async () => {
    const [branch, checkpoints] = await Promise.all([adapter.getBranch(branchId), adapter.getHistory(branchId)]);
    const ordered = [...checkpoints].sort((a,b) => a.revision-b.revision);
    const consistent = ordered.length > 0 && ordered.at(-1)?.id === branch.latestCheckpoint && ordered.every(cp => cp.branchId.toLowerCase() === branch.id.toLowerCase());
    return { branch, checkpoints: ordered, consistent };
  };
  const first = await read();
  return first.consistent ? first : read();
}
