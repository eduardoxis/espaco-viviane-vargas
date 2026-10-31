// Executado no head antes dos módulos que podem produzir métricas opcionais.
(() => {
  const KEY = 'ev:consentimento', VERSION = '2026-10-31', RETENTION = 180 * 86400000;
  let current = null;
  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v?.schema === 1 && v.policy === VERSION && v.necessary === true &&
          typeof v.statistics === 'boolean' && typeof v.marketing === 'boolean' &&
          Number.isFinite(Date.parse(v.at)) && Date.parse(v.at) <= Date.now() && Date.now() - Date.parse(v.at) < RETENTION) return v;
    } catch {}
    return null;
  }
  current = read();
  function clearOptional() {
    try {
      for (const key of Object.keys(localStorage)) {
        if ((!current?.statistics && key.startsWith('futura:view:')) ||
            (!current?.marketing && key === 'papelaria_ultimo_lead')) localStorage.removeItem(key);
      }
    } catch {}
  }
  window.EVConsent = {
    get: () => current && { ...current },
    allows: category => current?.[category] === true,
    save(choices) {
      const next = { schema: 1, policy: VERSION, necessary: true,
        statistics: choices.statistics === true, marketing: choices.marketing === true, at: new Date().toISOString() };
      // Só informa persistência quando a gravação realmente funcionou.
      localStorage.setItem(KEY, JSON.stringify(next));
      current = next;
      clearOptional();
      window.dispatchEvent(new CustomEvent('ev-consent-change', { detail: { ...next } }));
      return next;
    }
  };
  clearOptional();
  window.addEventListener('storage', e => {
    if (e.key === KEY) { current = read(); clearOptional(); window.dispatchEvent(new Event('ev-consent-change')); }
  });
})();
