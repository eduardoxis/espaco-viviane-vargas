// Sincroniza dados pessoais da conta entre dispositivos em tempo real.
import { db } from "../../firebase/firebase-config.js";
import { doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let usuarioId = null;
let versaoSessao = 0;
let pararCarrinho = null;
let pararFavoritos = null;

function encerrarListeners() {
  pararCarrinho?.();
  pararFavoritos?.();
  pararCarrinho = null;
  pararFavoritos = null;
}

export function iniciarSincronizacaoConta(uid, { carrinhoLocal, favoritosLocais, aplicarCarrinho, aplicarFavoritos }) {
  encerrarListeners();
  const versaoAtual = ++versaoSessao;
  usuarioId = uid || null;
  if (!usuarioId) return;

  const carrinhoRef = doc(db, "carrinhos", usuarioId);
  const favoritosRef = doc(db, "favoritos", usuarioId);

  const falhaSincronizacao = erro => console.warn("Sincronização indisponível; os dados locais foram mantidos.", erro);
  pararCarrinho = onSnapshot(carrinhoRef, (snap) => {
    if (versaoAtual !== versaoSessao) return;
    if (snap.exists()) aplicarCarrinho(Array.isArray(snap.data().itens) ? snap.data().itens : []);
    else salvarCarrinhoNuvem(carrinhoLocal()).catch(falhaSincronizacao);
  }, falhaSincronizacao);
  pararFavoritos = onSnapshot(favoritosRef, (snap) => {
    if (versaoAtual !== versaoSessao) return;
    if (snap.exists()) aplicarFavoritos(Array.isArray(snap.data().itens) ? snap.data().itens : []);
    else salvarFavoritosNuvem(favoritosLocais()).catch(falhaSincronizacao);
  }, falhaSincronizacao);
}

export function salvarCarrinhoNuvem(itens) {
  if (!usuarioId) return Promise.resolve();
  return setDoc(doc(db, "carrinhos", usuarioId), { itens, atualizadoEm: serverTimestamp() });
}

export function salvarFavoritosNuvem(itens) {
  if (!usuarioId) return Promise.resolve();
  return setDoc(doc(db, "favoritos", usuarioId), { itens, atualizadoEm: serverTimestamp() });
}
