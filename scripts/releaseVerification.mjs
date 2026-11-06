// releaseVerification.mjs — what the release verifies, and when (rt192).
//
// Decision (Wagner, 06/11/2026): on a release every repo is treated as correct;
// a runtime error is the publisher's failure. The lib that changed is only
// emitted, never re-verified. Only the APP can be verified, and only how its
// declared policy says:
//   strict      → verified BEFORE activation (blocks, with cache).
//   permissive  → activation does not wait; the check runs afterwards and its
//                 report goes to the release record (late step `verificacao`).
// Everything else (libs) is skipped.

/**
 * @param {{ ids: string[], clientId: string, statusOf: (id: string) => 'strict' | 'permissive' }} input
 * @returns {{ now: string[], deferred: string[], skipped: string[] }}
 */
export function planVerification({ ids, clientId, statusOf }) {
  const now = [];
  const deferred = [];
  const skipped = [];
  for (const raw of ids) {
    const id = String(raw);
    if (id !== String(clientId)) {
      skipped.push(id);
    } else if (statusOf(id) === 'strict') {
      now.push(id);
    } else {
      deferred.push(id);
    }
  }
  return { now, deferred, skipped };
}
