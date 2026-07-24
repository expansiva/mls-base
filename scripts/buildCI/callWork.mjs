// callWork.mjs — notifies the backend (collab.codes) that the project updated.
//
// WARNING (decision #13 of taskNewBuildCI.md): during the testing phase, the
// call to this module stays COMMENTED OUT in buildCI.mjs — no
// onProjectUpdated should fire until Step 11 (production).
//
// Env expected in the workflow: COLLAB_TOKEN (secret), COLLAB_DRIVER (e.g. "GitHub").
// Without COLLAB_TOKEN, it skips with a warning (same behavior as mls-ci) —
// lets you run locally without notifying anything.

export async function runCallWork({ id, orgName, lastModify, log }) {
  const driver = process.env.COLLAB_DRIVER || 'GitHub';
  const collabToken = process.env.COLLAB_TOKEN; // secret configured in the gitHub or gitLab Actions secrets

  log('callWork', 'Secret:' + collabToken +' prj:'+id+' orgName:'+orgName +' lastModify:'+lastModify);

  if (!collabToken) {
    log('callWork', 'COLLAB_TOKEN missing — backend notification skipped');
    return false;
  }
  if (!id || !orgName || !lastModify) {
    log('callWork', `incomplete parameters (id=${id} orgName=${orgName} lastModify=${lastModify}) — skipped`);
    return false;
  }

  const response = await fetch('https://collab.codes/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'onProjectUpdated',
      project: +id,
      orgName,
      projectDriver: driver,
      lastModify,
      secret: collabToken,
    }),
  });
  if (!response.ok) {
    throw new Error(`callWork failed: HTTP ${response.status} — ${await response.text()}`);
  }
  log('callWork', `backend notified (project=${id} lastModify=${lastModify})`);
  return true;
}
