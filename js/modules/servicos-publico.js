// js/modules/servicos-publico.js
// Equivalente ao products.js, para serviços: cartão, grade, favoritos,
// compartilhar, filtros e ordenação. Diferença para produtos: serviço não é
// vendido pelo site, então não existe "Adicionar ao carrinho" — a ação é
// agendar/tirar dúvida pelo WhatsApp.
import { escHtml, formatBRL, imgPos } from "../utils/utils.js";
import { icon } from "../utils/icons.js";
import { linkWhatsApp } from "../utils/whatsapp.js";
import { servicoTemImagem, ordenarServicos, normalizarTexto } from "../services/servicos.js";

const NOME_SALAO = "Espaço Viviane Vargas";
const CHAVE_FAVORITOS = "evv_favoritos_servicos";

// ---------- FAVORITOS (localStorage) ----------
export function obterIdsFavoritosServicos() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_FAVORITOS));
    return Array.isArray(lista) ? lista.filter(Boolean) : [];
  } catch { return []; }
}

export function alternarFavoritoServico(id) {
  const lista = obterIdsFavoritosServicos();
  const idx = lista.indexOf(id);
  if (idx >= 0) lista.splice(idx, 1); else lista.push(id);
  try { localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista)); } catch { /* storage indisponível */ }
  return lista.includes(id);
}

// ---------- WHATSAPP / COMPARTILHAR ----------
export function linkAgendarServico(servico) {
  const link = servico.id ? `\nLink do serviço: ${window.location.origin}/pages/servico.html?id=${servico.id}` : "";
  return linkWhatsApp(`Olá! Vim do site do ${NOME_SALAO} e gostaria de agendar o serviço:\n*${servico.nome}*${link}\n\nPoderia me passar mais informações?`);
}

export function falarSobreServico(servico) {
  window.open(linkAgendarServico(servico), "_blank", "noopener");
}

export async function compartilharServico(servico) {
  const url = `${window.location.origin}/pages/servico.html?id=${servico.id}`;
  const dados = { title: servico.nome, text: `Confira: ${servico.nome}`, url };
  try {
    if (navigator.share) {
      await navigator.share(dados);
      return "compartilhado";
    }
    await navigator.clipboard.writeText(url);
    return "copiado";
  } catch {
    return "cancelado";
  }
}

// ---------- CARTÃO / GRADE ----------
export function textoPrecoServico(servico) {
  return Number(servico.preco) > 0 ? `A partir de ${formatBRL(servico.preco)}` : "Sob consulta";
}

export function cartaoServico(servico, favoritos = null) {
  const favoritado = favoritos instanceof Set ? favoritos.has(servico.id) : obterIdsFavoritosServicos().includes(servico.id);
  const primeira = servico.imagem || (Array.isArray(servico.imagens) ? servico.imagens.find(Boolean) : "") || "";
  const imagem = imgPos(primeira, 480).src || "/assets/images/placeholder.svg";
  const rotulo = [servico.categoriaNome, servico.subcategoriaNome].filter(Boolean).join(" · ");

  return `
    <div class="product-card" data-id="${servico.id}">
      <button class="product-card__fav ${favoritado ? "is-active" : ""}" data-fav-id="${servico.id}" aria-label="Favoritar serviço" aria-pressed="${favoritado}">${icon("heart")}</button>
      <a class="product-card__link" href="/pages/servico.html?id=${servico.id}">
        <div class="product-card__image">
          <img src="${imagem}" style="object-position:center center" alt="${escHtml(servico.nome)}" loading="lazy" decoding="async" width="411" height="732">
          ${servico.duracao ? `<div class="product-card__tags"><span class="tag-badge">${escHtml(servico.duracao)}</span></div>` : ""}
        </div>
        <div class="product-card__body">
          ${rotulo ? `<span class="product-card__brand">${escHtml(rotulo)}</span>` : ""}
          <h3 class="product-card__name">${escHtml(servico.nome)}</h3>
          <span class="product-card__price">${textoPrecoServico(servico)}</span>
        </div>
      </a>
      <div class="product-card__actions">
        <button class="btn-whatsapp product-card__ask" data-ask-id="${servico.id}" aria-label="Agendar este serviço pelo WhatsApp">${icon("whatsapp")}<span>Agendar</span></button>
      </div>
    </div>`;
}

export function renderizarGradeServicos(container, servicos) {
  const comFoto = (Array.isArray(servicos) ? servicos : []).filter(servicoTemImagem);
  if (!comFoto.length) {
    container.innerHTML = `<div class="empty-state">Nenhum serviço encontrado. Tente ajustar sua busca ou filtros.</div>`;
    return;
  }
  const favoritos = new Set(obterIdsFavoritosServicos());
  container.__servicosPorId = new Map(comFoto.map(s => [s.id, s]));
  container.innerHTML = comFoto.map(s => cartaoServico(s, favoritos)).join("");

  if (!container.dataset.acoesLigadas) {
    container.dataset.acoesLigadas = "1";
    container.addEventListener("click", (e) => {
      const btnFav = e.target.closest("[data-fav-id]");
      if (btnFav) {
        e.preventDefault();
        const ativo = alternarFavoritoServico(btnFav.dataset.favId);
        btnFav.classList.toggle("is-active", ativo);
        btnFav.setAttribute("aria-pressed", String(ativo));
        return;
      }
      const btnAsk = e.target.closest("[data-ask-id]");
      if (!btnAsk) return;
      e.preventDefault();
      const servico = container.__servicosPorId?.get(btnAsk.dataset.askId);
      if (servico) falarSobreServico(servico);
    });
  }
}

// ---------- FILTROS / ORDENAÇÃO (client-side) ----------
function dentroDaFaixa(preco, faixa) {
  const [min, max] = String(faixa).split("-");
  const valor = Number(preco) || 0;
  if (valor <= 0) return false; // "Sob consulta" não entra em faixa de preço
  if (min !== "" && valor <= Number(min) && Number(min) > 0) return false;
  if (max !== "" && valor > Number(max)) return false;
  return true;
}

export function aplicarFiltrosServicos(servicos, { termo = "", catId = "", subId = "", faixasPreco = [] } = {}) {
  const busca = normalizarTexto(termo);
  return servicos.filter(s => {
    if (catId && s.categoriaId !== catId) return false;
    if (subId && s.subcategoriaId !== subId) return false;
    if (faixasPreco.length && !faixasPreco.some(f => dentroDaFaixa(s.preco, f))) return false;
    if (!busca) return true;
    return normalizarTexto([s.nome, s.categoriaNome, s.subcategoriaNome, s.descricaoCurta, s.descricao].join(" ")).includes(busca);
  });
}

export function ordenarListaServicos(servicos, criterio, categorias = []) {
  const lista = [...servicos];
  const preco = (s) => (Number(s.preco) > 0 ? Number(s.preco) : null);
  switch (criterio) {
    case "preco_asc": return lista.sort((a, b) => (preco(a) ?? Infinity) - (preco(b) ?? Infinity));
    case "preco_desc": return lista.sort((a, b) => (preco(b) ?? -Infinity) - (preco(a) ?? -Infinity));
    case "recentes": return lista.sort((a, b) => (Number(b.criadoEm) || 0) - (Number(a.criadoEm) || 0));
    case "nome": return lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    default: return ordenarServicos(lista, categorias);
  }
}
