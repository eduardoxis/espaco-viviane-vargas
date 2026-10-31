// Indicador compartilhado, ligado ao estado real das operações.
import { onLoadingChange, begin, end } from "./loadingManager.js";
const OVERLAY_ID = "loading-global-overlay";
const LOGO_URL = new URL("../../assets/images/logo.webp", import.meta.url).href;

function garantirElementos() {
  if (!document.getElementById("loading-global-style")) {
    const style = document.createElement("style");
    style.id = "loading-global-style";
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 99999;
        display: grid; place-items: center;
        background: transparent; pointer-events: none;
        visibility: hidden; opacity: 0;
        transition: opacity 300ms ease, visibility 0s linear 300ms;
      }
      #${OVERLAY_ID}.ativo { visibility: visible; opacity: 1; transition-delay: 0s; }
      #${OVERLAY_ID} .loading-global-unit {
        position: relative; display: grid; place-items: center;
        width: 116px; height: 116px;
      }
      #${OVERLAY_ID} .loading-global-ring {
        position: absolute; inset: 0; box-sizing: border-box;
        border: 2px solid; border-color: #a97160 #c99483 #ebd5cb #dec0b4;
        border-radius: 50%; animation: vv-loading-spin 1.8s linear infinite;
      }
      #${OVERLAY_ID} .loading-global-mark {
        display: block; width: 60%; height: 60%; object-fit: contain;
        animation: vv-loading-breathe 2s ease-in-out infinite;
      }
      #${OVERLAY_ID}:not(.ativo) .loading-global-ring,
      #${OVERLAY_ID}:not(.ativo) .loading-global-mark { animation-play-state: paused; }
      @keyframes vv-loading-spin { to { transform: rotate(360deg); } }
      @keyframes vv-loading-breathe { 50% { opacity: .78; transform: scale(.97); } }
      @media (max-width: 650px) {
        #${OVERLAY_ID} .loading-global-unit { width: 90px; height: 90px; }
      }
      @media (prefers-reduced-motion: reduce) {
        #${OVERLAY_ID} { transition: none; }
        #${OVERLAY_ID} .loading-global-ring,
        #${OVERLAY_ID} .loading-global-mark { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<div class="loading-global-unit" role="status" aria-label="Carregando"><span class="loading-global-ring" aria-hidden="true"></span><img class="loading-global-mark" src="${LOGO_URL}" width="70" height="70" alt="" aria-hidden="true"></div>`;
    document.body.appendChild(overlay);
  }
  return overlay;
}
let iniciado = false;
export function iniciarLoadingGlobal() {
  if (iniciado) return;
  iniciado = true;
  const start = () => {
    const overlay = garantirElementos();
    onLoadingChange(({ visivel }) => {
      overlay.classList.toggle("ativo", visivel);
      overlay.setAttribute("aria-hidden", String(!visivel));
    });
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
/** Finalizar em finally. Cada chamada participa do contador compartilhado. */
export function mostrarBloqueio() {
  iniciarLoadingGlobal();
  const id = begin("bloqueio-explicito");
  return () => end(id);
}
