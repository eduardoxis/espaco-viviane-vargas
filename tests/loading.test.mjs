import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

async function ambiente() {
  let now = 0, seq = 0;
  const timers = new Map(), elements = new Map();
  const appendChild = el => elements.set(el.id, el);
  const document = {
    head: { appendChild }, body: { appendChild },
    getElementById: id => elements.get(id),
    createElement: () => ({ attributes: {}, classes: new Set(),
      setAttribute(k, v) { this.attributes[k] = v; },
      get classList() { return { toggle: (k, v) => v ? this.classes.add(k) : this.classes.delete(k) }; }
    })
  };
  const context = vm.createContext({ document, URL, console, Date: { now: () => now },
    setTimeout: (fn, delay) => { timers.set(++seq, { fn, at: now + delay }); return seq; },
    clearTimeout: id => timers.delete(id) });
  const manager = new vm.SourceTextModule(readFileSync(new URL('../js/utils/loadingManager.js', import.meta.url), 'utf8'), { context });
  const ui = new vm.SourceTextModule(readFileSync(new URL('../js/utils/loadingUI.js', import.meta.url), 'utf8'), {
    context, initializeImportMeta(meta) { meta.url = new URL('../js/utils/loadingUI.js', import.meta.url).href; }
  });
  await manager.link(() => {}); await manager.evaluate();
  await ui.link(() => manager); await ui.evaluate();
  function tick(ms) {
    const target = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = target;
  }
  ui.namespace.iniciarLoadingGlobal();
  return { ui: ui.namespace, manager: manager.namespace, tick, elements,
    visible: () => elements.get('loading-global-overlay').classes.has('ativo') };
}

test('loading rápido não pisca; operações concorrentes e finalização duplicada', async () => {
  const a = await ambiente();
  const fimRapido = a.ui.mostrarBloqueio();
  a.tick(100); fimRapido(); a.tick(100); assert.equal(a.visible(), false);
  const fim1 = a.ui.mostrarBloqueio(), fim2 = a.ui.mostrarBloqueio();
  a.tick(150); assert.equal(a.visible(), true);
  fim1(); fim1(); a.tick(400); assert.equal(a.visible(), true);
  fim2(); a.tick(0); assert.equal(a.visible(), false);
  a.ui.iniciarLoadingGlobal(); assert.equal(a.elements.size, 2);
});

test('rejeição libera loading; operação travada expira com segurança', async () => {
  const a = await ambiente();
  await assert.rejects(a.manager.withLoading('falha', async () => { throw Error('teste'); }));
  assert.equal(a.manager.estaCarregando(), false);
  a.ui.mostrarBloqueio(); a.tick(150); assert.equal(a.visible(), true);
  a.tick(20000); assert.equal(a.visible(), false);
});
