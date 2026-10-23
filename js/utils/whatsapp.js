// js/utils/whatsapp.js
// Helpers genéricos e reutilizáveis para montar links e abrir o WhatsApp.
import { toast } from "./utils.js";
import { STORE_CONFIG } from "../../firebase/firebase-config.js";

/** Saudação automática conforme o horário local do visitante. */
export function saudacao() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Monta a URL do wa.me já com a mensagem codificada. */
export function linkWhatsApp(mensagem, numero = STORE_CONFIG.whatsapp) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** Abre o WhatsApp (nova aba) com a mensagem informada. */
export function abrirWhatsApp(mensagem, numero = STORE_CONFIG.whatsapp) {
  const url = linkWhatsApp(mensagem, numero);
  try {
    const aba = window.open(url, "_blank");
    if (aba) { aba.opener = null; return true; }
  } catch { /* Navegadores podem bloquear a nova janela. */ }
  try {
    window.location.assign(url);
    return true;
  } catch {
    toast("Não foi possível abrir o WhatsApp. Seu carrinho foi mantido. Tente novamente.", "error");
    return false;
  }
}
