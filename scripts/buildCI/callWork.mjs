// callWork.mjs — notifica o backend (collab.codes) que o projeto atualizou.
//
// ATENÇÃO (decisão #13 do taskNewBuildCI.md): durante a fase de testes a
// chamada deste módulo fica COMENTADA no buildCI.mjs — nenhum
// onProjectUpdated deve ser disparado até a Etapa 11 (produção).
//
// Env esperado no workflow: COLLAB_TOKEN (secret), COLLAB_DRIVER (ex.: "GitHub").
// Sem COLLAB_TOKEN, pula com aviso (comportamento do mls-ci) — permite rodar
// local sem notificar.

export async function runCallWork({ id, orgName, lastModify, log }) {
  const driver = process.env.COLLAB_DRIVER || 'GitHub';
  const collabToken = process.env.COLLAB_TOKEN; // secret configured in the gitHub or gitLab Actions secrets
  
  log('callWork', 'Secret:' + collabToken +' prj:'+id+' orgName:'+orgName +' lastModify:'+lastModify);

  if (!collabToken) {
    log('callWork', 'COLLAB_TOKEN ausente — notificação ao backend pulada');
    return false;
  }
  if (!id || !orgName || !lastModify) {
    log('callWork', `parâmetros incompletos (id=${id} orgName=${orgName} lastModify=${lastModify}) — pulado`);
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
    throw new Error(`callWork falhou: HTTP ${response.status} — ${await response.text()}`);
  }
  log('callWork', `backend notificado (project=${id} lastModify=${lastModify})`);
  return true;
}
