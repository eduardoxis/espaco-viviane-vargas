const pending = new Map();
async function request(user, body) {
  const token = await user.getIdToken();
  const response = await fetch('/api/terms', { method:body ? 'POST' : 'GET',
    headers:{ Authorization:`Bearer ${token}`, ...(body ? { 'Content-Type':'application/json' } : {}) },
    ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || 'Falha ao verificar os termos.');
  return data;
}
function ask() {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ev-cookie-dialog';
    dialog.setAttribute('aria-label', 'Aceitação dos Termos de Uso');
    dialog.innerHTML = `<h2>Termos de Uso da conta</h2><p>Para usar sua conta, confirme os <a href="/pages/termos-de-uso.html" target="_blank" rel="noopener">Termos de Uso</a> e a leitura da <a href="/pages/politica-de-privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>. Isso não aceita cookies opcionais.</p><form method="dialog"><p><label><input type="checkbox" required> Li e aceito os Termos de Uso e declaro ter lido a Política de Privacidade.</label></p><div class="ev-cookie-actions"><button value="accept">Confirmar aceite</button><button value="cancel" formnovalidate>Continuar sem conta</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { const accepted = dialog.returnValue === 'accept'; dialog.remove(); resolve(accepted); }, { once:true });
    dialog.showModal();
  });
}
export function garantirAceite(user, explicit = false) {
  if (pending.has(user.uid)) return pending.get(user.uid);
  const task = (async () => {
    const state = await request(user);
    if (state.accepted) return;
    if (!explicit && !await ask()) throw new Error('Conta não liberada: aceite os Termos de Uso para continuar.');
    await request(user, { action:'accept-terms', version:state.version, challenge:state.challenge });
  })().finally(() => pending.delete(user.uid));
  pending.set(user.uid, task);
  return task;
}
