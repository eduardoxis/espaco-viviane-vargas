import { ICONS } from "./icons.js";
import { lerLista } from "./storage.js";

const cabecalho = document.querySelector(".site-header");
if (cabecalho) {
  const mobile = window.matchMedia("(max-width: 760px)");
  const linha = cabecalho.querySelector(".header-top");
  if (!cabecalho.querySelector(".search-bar")) {
    const busca = document.createElement("form");
    busca.className = "search-bar";
    busca.dataset.headerMobileOnly = "true"; busca.hidden = !mobile.matches;
    busca.setAttribute("role", "search");
    busca.action = "/pages/catalogo.html";
    busca.method = "get";
    busca.innerHTML = `<label class="sr-only" for="busca-header">Pesquisar produtos</label><input id="busca-header" name="q" type="search" placeholder="Buscar por nome, marca ou código..." autocomplete="off"><button class="search-bar__btn" type="submit" aria-label="Pesquisar"><span class="icon">${ICONS.search}</span></button>`;
    linha.appendChild(busca);
  }
  if (!cabecalho.querySelector("#abrir-carrinho")) {
    let acoes = cabecalho.querySelector(".header-actions");
    if (!acoes) { acoes = document.createElement("div"); acoes.className = "header-actions"; acoes.dataset.headerMobileOnly = "true"; acoes.hidden = !mobile.matches; linha.appendChild(acoes); }
    const link = document.createElement("a");
    link.id = "abrir-carrinho";
    link.dataset.headerMobileOnly = "true"; link.hidden = !mobile.matches;
    link.className = "icon-btn";
    link.href = "/pages/catalogo.html?carrinho=1";
    link.setAttribute("aria-label", "Abrir carrinho");
    link.innerHTML = `<span class="icon">${ICONS.cart}</span><span class="cart-badge" data-cart-badge>0</span>`;
    acoes.appendChild(link);
  }
  const campoBusca = cabecalho.querySelector("input[type=search]");
  const placeholderOriginal = campoBusca?.placeholder || "";
  const atualizarPlaceholder = () => {
    cabecalho.querySelectorAll("[data-header-mobile-only]").forEach(elemento => { elemento.hidden = !mobile.matches; });
    if (campoBusca) campoBusca.placeholder = mobile.matches ? "Buscar por nome, marca ou código..." : placeholderOriginal; };
  atualizarPlaceholder();
  mobile.addEventListener("change", atualizarPlaceholder);
  const atualizar = () => {
    const quantidade = lerLista("papelaria_carrinho").reduce((total, item) => {
      const n = Number(item?.quantidade);
      return total + (Number.isSafeInteger(n) && n > 0 ? n : 0);
    }, 0);
    const badge = cabecalho.querySelector("[data-cart-badge]");
    if (badge) { badge.textContent = quantidade; badge.style.display = quantidade ? "flex" : "none"; }
  };
  atualizar();
  window.addEventListener("storage", atualizar);
  window.addEventListener("carrinho-atualizado", atualizar);
}
