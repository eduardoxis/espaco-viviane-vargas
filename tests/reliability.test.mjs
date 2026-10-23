import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = process.env.PROJECT_ROOT || fileURLToPath(new URL('../', import.meta.url));
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
async function ambiente({ bloqueado = false, janela = {}, firestore = {}, sincronizacaoReal = false, cargos = ['admin'], tokenInvalido = false, usuario = null } = {}) {
  const local = storage(), session = storage(), eventos = [], avisos = [], writes = [], snapshots = [], apps = [], orders = [], leads = [];
  const document = {
    querySelector: () => null, querySelectorAll: () => [],
    body: { appendChild: element => avisos.push(element.textContent) },
    createElement: () => ({ classList: { add() {}, remove() {} }, remove() {} })
  };
  const window = { localStorage: local, sessionStorage: session, dispatchEvent: e => eventos.push(e.type), open: () => ({ opener: 'original' }), location: { origin: 'https://loja.test', assign() {} }, ...janela };
  if (bloqueado) for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, { get() { throw new Error('Storage bloqueado'); } });
  const context = vm.createContext({ window, document, console: { warn() {}, error() {} }, URLSearchParams, Intl, Event, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: fn => fn(), process: { env: { FIREBASE_PROJECT_ID: 'teste', FIREBASE_CLIENT_EMAIL: 'teste@example.test', FIREBASE_PRIVATE_KEY: 'chave-de-teste' } } });
  const config = { db: {}, STORE_CONFIG: { whatsapp: '556100000000', nome: 'Loja de teste' } };
  const mocks = new Map([
    [path.join(root, 'firebase/firebase-config.js'), config],
    [path.join(root, 'js/services/firestore.js'), { salvarLeadPerdido: async value => leads.push(value), criarPedido: async value => orders.push(value), incrementarCompartilhamento: async () => {} }],
    [path.join(root, 'js/services/auth.js'), { usuarioAtual: usuario, perfilAtual: null }],
    ['https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js', {
      doc: (_db, collection, uid) => ({ collection, uid }),
      onSnapshot: (ref, next, error) => { snapshots.push({ ref, next, error }); return () => {}; },
      setDoc: async (ref, data) => writes.push({ ref, data }), serverTimestamp: () => 123, ...firestore
    }],
    ['firebase-admin/app', { getApps: () => apps, cert: value => value, initializeApp: opts => { const app = { opts }; apps.push(app); return app; } }],
    ['firebase-admin/auth', { getAuth: app => { assert.ok(app, 'Firebase precisa ser inicializado antes de verificar o token'); return { verifyIdToken: async () => { if (tokenInvalido) throw new Error('Token inválido'); return { uid: 'admin-teste' }; } }; } }],
    ['firebase-admin/firestore', { getFirestore: app => { assert.ok(app); return { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ cargos }) }) }) }) }; } }]
  ]);
  if (!sincronizacaoReal) mocks.set(path.join(root, 'js/services/contaSync.js'), { salvarCarrinhoNuvem: async value => writes.push(value), salvarFavoritosNuvem: async () => {} });
  const cache = new Map();
  async function load(id) {
    if (cache.has(id)) return cache.get(id);
    if (mocks.has(id)) {
      const exports = mocks.get(id);
      const mod = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context, identifier: id });
      cache.set(id, mod); return mod;
    }
    const mod = new vm.SourceTextModule(readFileSync(id, 'utf8'), { context, identifier: id });
    cache.set(id, mod);

    return mod;
  }
  async function importar(relative) {
    const mod = await load(path.join(root, relative));
    if (mod.status === 'unlinked') await mod.link((specifier, parent) => load(specifier.startsWith('.') ? path.resolve(path.dirname(parent.identifier), specifier) : specifier));
    if (mod.status === 'linked') await mod.evaluate();
    return mod.namespace;
  }
  return { importar, local, session, window, eventos, avisos, writes, snapshots, apps, orders, leads };
}

test('carrinho antigo com números em texto continua válido, com totais numéricos', async () => {
  const a = await ambiente();
  a.local.setItem('papelaria_carrinho', JSON.stringify([{ id: 'a', nome: 'Produto', preco: '9.90', quantidade: '2' }]));
  const cart = await a.importar('js/modules/cart.js');
  cart.adicionarAoCarrinho({ id: 'a', nome: 'Produto', preco: 9.9 }, 1);
  assert.equal(cart.obterCarrinho()[0].quantidade, 3);
  assert.equal(cart.calcularTotais().total, 29.7);
});
test('JSON quebrado ou objeto no lugar de lista não derruba carrinho nem favoritos', async () => {
  const a = await ambiente();
  const cart = await a.importar('js/modules/cart.js');
  const products = await a.importar('js/modules/products.js');
  for (const value of ['{', '{}', 'null', '"texto"']) {
    a.local.setItem('papelaria_carrinho', value); a.local.setItem('futura_favoritos', value);
    assert.equal(cart.obterCarrinho().length, 0); assert.equal(products.obterFavoritos().length, 0);
    assert.equal(a.local.getItem('papelaria_carrinho'), value, 'Leitura não deve sobrescrever dados existentes');
  }
});
test('quantidades inválidas são recusadas sem remover um item válido', async () => {
  const a = await ambiente(), cart = await a.importar('js/modules/cart.js');
  cart.adicionarAoCarrinho({ id: 'a', preco: 10, nome: 'Produto' }, 2);
  for (const value of [NaN, Infinity, -1, 1.5]) { cart.atualizarQuantidade('a', value); cart.adicionarAoCarrinho({ id: 'a', preco: 10 }, value); }
  assert.equal(cart.obterCarrinho()[0].quantidade, 2);
  cart.atualizarQuantidade('a', 0); assert.equal(cart.obterCarrinho().length, 0);
});
test('cores diferentes continuam separadas e valores em centavos não acumulam erro', async () => {
  const a = await ambiente(), cart = await a.importar('js/modules/cart.js');
  cart.adicionarAoCarrinho({ id: 'a', preco: 0.1 }, 1, 'Azul');
  cart.adicionarAoCarrinho({ id: 'a', preco: 0.2 }, 1, 'Rosa');
  assert.equal(cart.obterCarrinho().length, 2); assert.equal(cart.calcularTotais().total, 0.3);
});
test('storage bloqueado permite usar carrinho e favoritos em memória', async () => {
  const a = await ambiente({ bloqueado: true }), cart = await a.importar('js/modules/cart.js'), products = await a.importar('js/modules/products.js');
  cart.adicionarAoCarrinho({ id: 'a', preco: 15, nome: 'Produto' });
  products.alternarFavorito('a');
  assert.equal(cart.obterCarrinho()[0].quantidade, 1); assert.equal(products.obterFavoritos()[0], 'a');
});
test('limitadores não quebram login quando há JSON inválido ou storage bloqueado', async () => {
  for (const bloqueado of [false, true]) {
    const a = await ambiente({ bloqueado }), utils = await a.importar('js/utils/utils.js');
    a.session.setItem('ratelimit_login', '{}'); a.local.setItem('ratelimit_senha', '{');
    assert.equal(utils.podeExecutar('login', 1), true); assert.equal(utils.podeExecutar('login', 1), false);
    assert.equal(utils.podeExecutarPersistente('senha', 1), true); assert.equal(utils.podeExecutarPersistente('senha', 1), false);
  }
});
test('abrir WhatsApp mantém o carrinho e corta acesso da nova aba à loja', async () => {
  const aba = { opener: 'original' }, a = await ambiente({ janela: { open: () => aba } }), cart = await a.importar('js/modules/cart.js');
  cart.adicionarAoCarrinho({ id: 'a', nome: 'Creme', preco: 20 });
  assert.equal(cart.finalizarPedidoWhatsApp('Maria'), true); assert.equal(aba.opener, null);
  assert.equal(cart.obterCarrinho().length, 1);
});
test('WhatsApp usa a mesma aba se pop-up bloqueado e conserva itens se tudo falhar', async () => {
  let destino;
  const a = await ambiente({ janela: { open: () => null, location: { assign: url => { destino = url; } } } }), cart = await a.importar('js/modules/cart.js');
  cart.adicionarAoCarrinho({ id: 'a', nome: 'Creme', preco: 20 });
  assert.equal(cart.finalizarPedidoWhatsApp(), true); assert.match(destino, /^https:\/\/wa.me\//);
  cart.atualizarQuantidade('a', 2);
  a.window.location.assign = () => { throw new Error('Navegação bloqueada'); };
  assert.equal(cart.finalizarPedidoWhatsApp(), false); assert.equal(cart.obterCarrinho().length, 1);
  assert.match(a.avisos.at(-1), /carrinho foi mantido/);
});
test('snapshot atrasado da conta anterior não altera nem escreve na nova conta', async () => {
  const a = await ambiente({ sincronizacaoReal: true }), sync = await a.importar('js/services/contaSync.js');
  const recebidos = [], opcoes = { carrinhoLocal: () => [{ id: 'local' }], favoritosLocais: () => [], aplicarCarrinho: itens => recebidos.push(itens), aplicarFavoritos() {} };
  sync.iniciarSincronizacaoConta('primeira', opcoes);
  const antigo = a.snapshots[0];
  sync.iniciarSincronizacaoConta('segunda', opcoes);
  antigo.next({ exists: () => false }); antigo.next({ exists: () => true, data: () => ({ itens: [{ id: 'antigo' }] }) });
  assert.equal(a.writes.length, 0); assert.equal(recebidos.length, 0);
  a.snapshots[2].next({ exists: () => true, data: () => ({ itens: [{ id: 'atual' }] }) });
  assert.equal(recebidos[0][0].id, 'atual');
  assert.doesNotThrow(() => a.snapshots[2].error(new Error('Sem conexão')));
});
test('Firebase Admin inicia antes da primeira verificação de token no servidor', async () => {
  const a = await ambiente(), auth = await a.importar('api/_auth.js');
  assert.equal(a.apps.length, 0);
  assert.equal(await auth.exigirAdmin({ headers: { authorization: 'Bearer valido' } }), 'admin-teste');
  assert.equal(a.apps.length, 1);
  await auth.exigirAdmin({ headers: { authorization: 'Bearer valido' } }); assert.equal(a.apps.length, 1);
});
test('servidor continua recusando acesso sem token, token inválido e perfil não admin', async () => {
  for (const cenario of [{ headers: {}, status: 401 }, { tokenInvalido: true, status: 401 }, { cargos: ['cliente'], status: 403 }]) {
    const a = await ambiente(cenario), auth = await a.importar('api/_auth.js');
    await assert.rejects(auth.exigirAdmin({ headers: cenario.headers || { authorization: 'Bearer token' } }), erro => erro.status === cenario.status);
  }
});

test('checkout autenticado registra histórico uma vez e não gera abandono', async () => {
  const a = await ambiente({ usuario: { uid: 'cliente-teste', displayName: 'Maria' } }), cart = await a.importar('js/modules/cart.js');
  cart.adicionarAoCarrinho({ id: 'a', nome: 'Creme', preco: 12.5 }, 2);
  assert.equal(cart.finalizarPedidoWhatsApp(), true);
  assert.equal(cart.finalizarPedidoWhatsApp(), false, 'Clique repetido não deve duplicar o pedido');
  await Promise.resolve();
  assert.equal(a.orders.length, 1); assert.equal(a.orders[0].total, 25);
  assert.equal(a.orders[0].usuarioId, 'cliente-teste'); assert.equal(a.orders[0].nomeCliente, 'Maria');
  await cart.registrarLeadPerdidoSeNecessario(); assert.equal(a.leads.length, 0);
  assert.equal(cart.obterCarrinho().length, 1);
});
test('aspas na URL de imagem não criam atributos extras no HTML do produto', async () => {
  const a = await ambiente(), products = await a.importar('js/modules/products.js');
  const html = products.cartaoProduto({ id: 'a', nome: 'Creme', preco: 10, quantidade: 1, imagem: 'foto.jpg" atributo="valor' });
  assert.ok(!html.includes('src="foto.jpg" atributo='));
  assert.ok(html.includes('foto.jpg&quot; atributo=&quot;valor'));
});