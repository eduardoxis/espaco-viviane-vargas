// Independente dos módulos de Firebase: uma falha de rede não bloqueia a abertura.
(() => {
  const root = document.documentElement;
  const intro = document.getElementById('intro');
  if (!intro || !root.classList.contains('ev-intro-pending')) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.classList.add('site-in');
    return;
  }
  const body = document.body;
  const skip = document.getElementById('intro-skip');
  const stage = intro.querySelector('.ev-stage');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer, cleanupTimer, finished = false;
  function showSite() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    clearTimeout(window.evIntroSafety);
    intro.classList.add('out');
    intro.setAttribute('aria-hidden', 'true');
    body.classList.add('site-in');
    if (document.activeElement === skip) {
      const logo = document.querySelector('.site-header .logo');
      if (logo) logo.focus({ preventScroll:true });
    }
    skip.disabled = true;
    try { sessionStorage.setItem('evIntro', '1'); } catch { /* armazenamento opcional */ }
    cleanupTimer = setTimeout(() => {
      root.classList.remove('ev-intro-pending');
      intro.hidden = true;
    }, 1500);
  }
  function alignHeader() {
    const target = document.querySelector('.site-header .logo');
    if (!target) return;
    const from = stage.getBoundingClientRect(), to = target.getBoundingClientRect();
    stage.style.setProperty('--ev-intro-x', `${to.x + to.width/2 - (from.x + from.width/2)}px`);
    stage.style.setProperty('--ev-intro-y', `${to.y + to.height/2 - (from.y + from.height/2)}px`);
    stage.style.setProperty('--ev-intro-scale', Math.min(to.width/from.width, to.height/from.height, .65));
  }
  function play() {
    clearTimeout(timer); clearTimeout(cleanupTimer);
    if (reduce.matches) { showSite(); return; }
    body.classList.remove('site-in');
    intro.classList.remove('out','go');
    void intro.offsetWidth;
    alignHeader();
    intro.classList.add('go');
    timer = setTimeout(showSite, 3700);
  }
  skip.addEventListener('click', showSite);
  reduce.addEventListener('change', () => { if (reduce.matches) showSite(); });
  window.addEventListener('resize', () => { if (!finished) alignHeader(); });
  window.addEventListener('pagehide', showSite, { once:true });
  // O watchdog do head também funciona quando este arquivo não chega a carregar.
  window.addEventListener('ev-intro-fallback', showSite, { once:true });
  try { play(); } catch { showSite(); }
})();
