(() => {
  const consent = window.EVConsent;
  if (!consent) return;
  const container = document.createElement('div');
  container.className = 'ev-privacy';
  container.innerHTML = `<section class="ev-cookie-banner" aria-label="Preferências de cookies" hidden>
    <div><h2>Sua privacidade é importante para nós</h2><p>Usamos armazenamento necessário para sua sessão e carrinho. Você decide sobre métricas de uso e recuperação de carrinho. <a href="/pages/politica-de-privacidade.html#cookies">Saiba mais</a>.</p><p class="ev-cookie-error" role="status"></p></div>
    <div class="ev-cookie-actions"><button data-choice="all">Aceitar todos</button><button data-choice="none">Rejeitar opcionais</button><button data-cookie-settings>Personalizar</button></div>
  </section>
  <dialog class="ev-cookie-dialog" aria-labelledby="ev-cookie-title"><h2 id="ev-cookie-title">Configurações de Cookies</h2>
    <p>As preferências abaixo não alteram a aceitação dos Termos de Uso.</p>
    <p><label><input type="checkbox" checked disabled> Necessários — sempre ativos</label><small>Sessão, segurança, carrinho, favoritos e cache do catálogo.</small></p>
    <p><label><input name="statistics" type="checkbox"> Estatísticas</label><small>Contagem interna de visualizações e compartilhamentos de produtos.</small></p>
    <p><label><input name="marketing" type="checkbox"> Recuperação de carrinho</label><small>Registro dos itens não finalizados e dos dados de contato informados para atendimento posterior.</small></p>
    <p>Não usamos Google Analytics nem pixel de publicidade. Preferências válidas por 180 dias; uma atualização relevante da política pode solicitar nova decisão.</p>
    <p class="ev-cookie-error" role="status"></p><div class="ev-cookie-actions"><button data-cookie-save>Salvar preferências</button><button data-choice="none">Rejeitar opcionais</button><button data-cookie-close>Fechar</button></div>
  </dialog>`;
  document.body.append(container);
  const banner = container.querySelector('.ev-cookie-banner'), dialog = container.querySelector('dialog');
  let previousFocus;
  function showBanner() { banner.hidden = !!consent.get(); }
  function open() {
    previousFocus = document.activeElement;
    const saved = consent.get();
    for (const key of ['statistics', 'marketing']) dialog.querySelector(`[name="${key}"]`).checked = saved?.[key] === true;
    if (!dialog.open) dialog.showModal();
  }
  function close() { dialog.close(); previousFocus?.focus(); }
  function save(choices) {
    try {
      consent.save(choices);
      container.querySelectorAll('.ev-cookie-error').forEach(e => e.textContent = '');
      banner.hidden = true;
      if (dialog.open) close();
    } catch {
      container.querySelectorAll('.ev-cookie-error').forEach(e => e.textContent = 'O navegador não permitiu salvar. As preferências anteriores continuam valendo; sem decisão anterior, os opcionais ficam desativados. Habilite o armazenamento e tente novamente.');
    }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-cookie-settings]')) open();
  });
  container.addEventListener('click', e => {
    const choice = e.target.closest('[data-choice]')?.dataset.choice;
    if (choice) save({ statistics: choice === 'all', marketing: choice === 'all' });
    if (e.target.closest('[data-cookie-close]')) close();
    if (e.target.closest('[data-cookie-save]')) save(Object.fromEntries(['statistics','marketing'].map(k => [k, dialog.querySelector(`[name="${k}"]`).checked])));
  });
  window.addEventListener('ev-consent-change', showBanner);
  showBanner();
})();
