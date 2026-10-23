// js/modules/cart.js
import { formatBRL, escHtml, podeExecutar, toast, pareceEmail, registrarErroCliente } from "../utils/utils.js";
import { salvarLeadPerdido, criarPedido } from "../services/firestore.js";
import { salvarCarrinhoNuvem } from "../services/contaSync.js";

import { lerLista, salvarJSON } from "../utils/storage.js";
import { abrirWhatsApp } from "../utils/whatsapp.js";

import { usuarioAtual, perfilAtual } from "../services/auth.js";

const CART_KEY = "papelaria_carrinho";
const LEAD_KEY = "papelaria_ultimo_lead";
let leadSalvo = false;
let ultimoEnvio = { assinatura: "", quando: 0 };

function linkProdutoComPreview(produto) {
  if (!produto?.id) return "";
  const imagemDaCor = Array.isArray(produto.cores)
    ? produto.cores.flatMap(cor => Array.isArray(cor?.imagens) ? cor.imagens : [cor?.imagem]).find(Boolean)
    : "";
  const imagem = [produto.imagem, ...(Array.isArray(produto.imagens) ? produto.imagens : []), imagemDaCor]
    .find(valor => typeof valor === "string" && valor.trim() && !valor.startsWith("data:")) || "";
  const dados = new URLSearchParams({
    n: String(produto.nome || "Produto").slice(0, 160),
    d: String(produto.descricaoCurta || produto.descricao || "Confira este produto no Espaço Viviane Vargas.").slice(0, 180)
  });
  if (imagem) dados.set("i", imagem);
  return `${window.location.origin}/p/${encodeURIComponent(produto.id)}?${dados}`;
}

function normalizarCarrinho(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter(item => item && typeof item.id === "string" && item.id.trim() && item.preco != null && item.preco !== "" && item.quantidade != null)
    .map(item => ({ ...item, preco: Number(item.preco), quantidade: Number(item.quantidade) }))
    .filter(item => Number.isFinite(item.preco) && item.preco >= 0 &&
      Number.isSafeInteger(item.quantidade) && item.quantidade > 0 &&
      Number.isFinite(item.preco * item.quantidade));
}

export function obterCarrinho() {
  return normalizarCarrinho(lerLista(CART_KEY));
}

function salvarCarrinho(carrinho) {
  salvarJSON(CART_KEY, carrinho);
  atualizarBadgeCarrinho();
  salvarCarrinhoNuvem(carrinho).catch(() => {});
  leadSalvo = false; // qualquer mudança reabre a possibilidade de novo lead
}

export function aplicarCarrinhoSincronizado(carrinho) {
  salvarJSON(CART_KEY, normalizarCarrinho(carrinho));
  atualizarBadgeCarrinho();
  window.dispatchEvent(new Event("carrinho-atualizado"));
}

/**
 * Gera a chave única do item no carrinho. Produtos com cor selecionada
 * geram uma chave diferente por cor (ex.: "abc123|Azul"); produtos sem
 * cor mantêm a chave igual ao próprio id, preservando compatibilidade
 * com carrinhos já salvos antes da funcionalidade de cores.
 */
export function chaveItemCarrinho(id, cor = "") {
  return cor ? `${id}|${cor}` : id;
}

export function adicionarAoCarrinho(produto, quantidade = 1, cor = "") {
  quantidade = Number(quantidade);
  if (!normalizarCarrinho([{ ...produto, quantidade }]).length) return false;
  const carrinho = obterCarrinho();
  const chave = chaveItemCarrinho(produto.id, cor);
  const existente = carrinho.find(i => (i.chave || i.id) === chave);
  if (existente) {
    if (!Number.isSafeInteger(existente.quantidade + quantidade)) return false;
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      chave,
      id: produto.id,
      nome: produto.nome,
      marca: produto.marca || "",
      preco: Number(produto.preco),
      imagem: produto.imagem || "",
      cor: cor || "",
      quantidade
    });
  }
  salvarCarrinho(carrinho);
}

export function atualizarQuantidade(chave, quantidade) {
  quantidade = Number(quantidade);
  if (!Number.isSafeInteger(quantidade) || quantidade < 0) return false;
  let carrinho = obterCarrinho();
  if (quantidade <= 0) {
    carrinho = carrinho.filter(i => (i.chave || i.id) !== chave);
  } else {
    const item = carrinho.find(i => (i.chave || i.id) === chave);
    if (item) item.quantidade = quantidade;
  }
  salvarCarrinho(carrinho);
}

export function removerDoCarrinho(chave) {
  const carrinho = obterCarrinho().filter(i => (i.chave || i.id) !== chave);
  salvarCarrinho(carrinho);
}

export function limparCarrinho() {
  salvarCarrinho([]);
}

export function calcularTotais(carrinho = obterCarrinho()) {
  carrinho = normalizarCarrinho(carrinho);
  const quantidadeItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
  const subtotal = carrinho.reduce((acc, i) => acc + i.quantidade * Math.round(i.preco * 100), 0) / 100;
  return { quantidadeItens, subtotal, total: subtotal };
}

export function atualizarBadgeCarrinho() {
  const badge = document.querySelector("[data-cart-badge]");
  if (!badge) return;
  const { quantidadeItens } = calcularTotais();
  badge.textContent = quantidadeItens;
  badge.style.display = quantidadeItens > 0 ? "flex" : "none";
}

export function montarMensagemWhatsApp(nomeCliente = "") {
  const carrinho = obterCarrinho();
  const { total } = calcularTotais(carrinho);
  let msg = "Olá!\nTenho interesse nestes produtos:\n\n";
  carrinho.forEach(item => {
    const corStr = item.cor ? ` (Cor: ${item.cor})` : "";
    msg += `${item.nome}${corStr}\nQuantidade: ${item.quantidade}\nValor: ${formatBRL(item.preco * item.quantidade)}\n\n`;
  });
  msg += `------------------\nTotal: ${formatBRL(total)}\n\n`;
  if (nomeCliente) msg += `Meu nome é: ${nomeCliente}\n\n`;
  msg += "Gostaria de mais informações.";
  return msg;
}

export function finalizarPedidoWhatsApp(nomeCliente = "") {
  const carrinho = obterCarrinho();
  if (!carrinho.length) { toast("Seu carrinho está vazio.", "error"); return false; }
  const nome = [nomeCliente, usuarioAtual?.displayName, perfilAtual?.nome, perfilAtual?.responsavel, perfilAtual?.razaoSocial]
    .find(valor => typeof valor === "string" && valor.trim() && !pareceEmail(valor))?.trim() || "";
  const assinatura = `${usuarioAtual?.uid || "visitante"}:${carrinho.map(i => `${i.chave || i.id}:${i.quantidade}:${i.preco}`).sort().join("|")}`;
  if (ultimoEnvio.assinatura === assinatura && Date.now() - ultimoEnvio.quando < 5000) {
    toast("O WhatsApp já foi aberto. Confira a conversa antes de enviar novamente.");
    return false;
  }
  // Abrir uma conversa não comprova envio nem confirmação do pedido.
  // Conserva os itens mesmo se o navegador bloquear a nova aba.
  if (!abrirWhatsApp(montarMensagemWhatsApp(nome))) return false;
  ultimoEnvio = { assinatura, quando: Date.now() };
  leadSalvo = true;
  salvarJSON(LEAD_KEY, { assinatura: carrinho.map(i => `${i.chave || i.id}:${i.quantidade}`).sort().join("|"), expiraEm: Date.now() + 30 * 60_000 });
  if (usuarioAtual) {
    const usuarioId = usuarioAtual.uid;
    const { total } = calcularTotais(carrinho);
    criarPedido({ usuarioId, nomeCliente: nome, total, itens: carrinho.map(i => ({ id: i.id, nome: i.nome || "Produto", quantidade: i.quantidade, preco: i.preco, cor: i.cor || "" })) })
      .catch(erro => {
        toast("O WhatsApp foi aberto, mas não foi possível salvar o histórico. Seus itens foram mantidos.", "error");
        registrarErroCliente("checkout-criarPedido", erro, { usuarioId });
      });
  }
  return true;
}

/**
 * Contato rápido sobre UM único produto, sem passar pelo carrinho —
 * útil no card do catálogo ou na página do produto quando o cliente
 * quer perguntar sobre um item específico na hora, sem montar um pedido.
 * @param {{nome:string, marca?:string, id:string}} produto
 */
export function falarSobreProduto(produto) {
  const marcaStr = produto.marca ? ` [${produto.marca}]` : "";
  const endereco = linkProdutoComPreview(produto);
  const link = endereco ? `\n🔗 Link do produto: ${endereco}` : "";
  const mensagem = `Olá!\nTenho interesse neste produto:\n*${produto.nome}*${marcaStr}${link}\n\nPoderia me passar mais informações?`;
  return abrirWhatsApp(mensagem);
}

/**
 * Chame isto quando o usuário sair da página com itens no carrinho e
 * sem finalizar (ex.: evento beforeunload/visibilitychange), passando
 * opcionalmente nome/telefone se o usuário os informou em algum campo.
 */
export async function registrarLeadPerdidoSeNecessario({ nome = "", telefone = "" } = {}) {
  const carrinho = obterCarrinho();
  if (leadSalvo || carrinho.length === 0) return;
  const assinatura = carrinho.map(i => `${i.chave || i.id}:${i.quantidade}`).sort().join("|");
  try {
    const ultimo = JSON.parse(localStorage.getItem(LEAD_KEY) || "null");
    if (ultimo?.assinatura === assinatura && Date.now() < ultimo.expiraEm) return;
  } catch { /* storage indisponível/corrompido: segue normalmente */ }
  if (!podeExecutar("lead-perdido", 3, 5 * 60_000)) return;
  const { total } = calcularTotais(carrinho);
  leadSalvo = true;
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify({ assinatura, expiraEm: Date.now() + 30 * 60_000 }));
  } catch { /* segue sem deduplicação persistente */ }
  try {
    await salvarLeadPerdido({
      nome,
      telefone,
      produtos: carrinho.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
      valor: total
    });
  } catch (erro) {
    leadSalvo = false;
    try { localStorage.removeItem(LEAD_KEY); } catch { /* ignora */ }
    throw erro;
  }
}
