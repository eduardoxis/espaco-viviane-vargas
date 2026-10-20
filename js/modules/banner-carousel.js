import { observarBannersAtivos, observarConfiguracaoBanners } from "../services/banners.js";
import { escHtml } from "../utils/utils.js";

export function iniciarCarrosselBanners(elemento) {
  if (!elemento) return () => {};
  let banners = [], config = {}, atual = 0, temporizador, inicioToque = 0;
  const pausar = () => { clearInterval(temporizador); temporizador = null; };
  const renderizar = () => {
    pausar();
    if (!banners.length) { elemento.hidden = true; elemento.closest(".hero")?.classList.remove("hero--with-banner"); return; }
    elemento.hidden = false;
    elemento.closest(".hero")?.classList.add("hero--with-banner");
    atual = Math.min(atual, banners.length - 1);
    const banner = banners[atual];
    elemento.className = `hero-carousel hero-carousel--${config.efeito || "fade"}`;
    elemento.style.setProperty("--transicao-banner", `${config.transicaoMs || 500}ms`);
    elemento.innerHTML = `<div class="hero-carousel__viewport">
      <picture><source media="(max-width: 700px)" srcset="${escHtml(banner.imagemMobile || banner.imagemDesktop)}"><img src="${escHtml(banner.imagemDesktop)}" alt="${escHtml(banner.titulo || banner.nome)}" fetchpriority="high" decoding="async"></picture>
      ${(banner.titulo || banner.descricao) ? `<div class="hero-carousel__caption">${banner.titulo ? `<strong>${escHtml(banner.titulo)}</strong>` : ""}${banner.descricao ? `<span>${escHtml(banner.descricao)}</span>` : ""}</div>` : ""}
    </div>
    ${config.mostrarSetas && banners.length > 1 ? `<button type="button" class="hero-carousel__arrow hero-carousel__arrow--prev" aria-label="Banner anterior">‹</button><button type="button" class="hero-carousel__arrow hero-carousel__arrow--next" aria-label="Próximo banner">›</button>` : ""}
    ${config.mostrarIndicadores && banners.length > 1 ? `<div class="hero-carousel__dots" aria-label="Escolher banner">${banners.map((_, i) => `<button type="button" aria-label="Ir para banner ${i + 1}" class="${i === atual ? "is-active" : ""}" data-banner-slide="${i}"></button>`).join("")}</div>` : ""}`;
    elemento.querySelector(".hero-carousel__arrow--prev")?.addEventListener("click", () => mudar(atual - 1));
    elemento.querySelector(".hero-carousel__arrow--next")?.addEventListener("click", () => mudar(atual + 1));
    elemento.querySelectorAll("[data-banner-slide]").forEach(btn => btn.addEventListener("click", () => mudar(Number(btn.dataset.bannerSlide))));
    elemento.onpointerdown = e => { inicioToque = e.clientX; pausar(); };
    elemento.onpointerup = e => { if (config.permitirSwipe && Math.abs(e.clientX - inicioToque) > 35) mudar(atual + (e.clientX < inicioToque ? 1 : -1)); iniciarAuto(); };
    elemento.onmouseenter = pausar; elemento.onmouseleave = iniciarAuto;
    iniciarAuto();
  };
  const mudar = indice => { atual = (indice + banners.length) % banners.length; renderizar(); };
  const iniciarAuto = () => { if (config.reproducaoAutomatica && banners.length > 1 && !temporizador) temporizador = setInterval(() => mudar(atual + 1), Math.max(2000, config.intervaloMs || 5000)); };
  const cancelarBanners = observarBannersAtivos(lista => { banners = lista; renderizar(); });
  const cancelarConfig = observarConfiguracaoBanners(nova => { config = nova; renderizar(); });
  return () => { pausar(); cancelarBanners(); cancelarConfig(); };
}
