import { db } from "../../firebase/firebase-config.js";
import { collection, doc, addDoc, deleteDoc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, where, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { comprimirParaBase64 } from "./imagem-base64.js";

const COLECAO = "banners";
const CONFIG_REF = doc(db, "configuracoes", "banners");
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

export const CONFIG_PADRAO_CARROSSEL = Object.freeze({
  reproducaoAutomatica: true, intervaloMs: 5000, transicaoMs: 500,
  efeito: "fade", mostrarSetas: true, mostrarIndicadores: true, permitirSwipe: true
});

export function validarArquivoBanner(file) {
  if (!file) return "Selecione uma imagem.";
  if (!TIPOS.has(file.type)) return "Use uma imagem JPG, PNG ou WebP.";
  if (file.size > TAMANHO_MAXIMO) return "Cada imagem pode ter no máximo 8 MB.";
  return "";
}

export async function enviarImagemBanner(file, _variante, aoProgresso = () => {}) {
  const erro = validarArquivoBanner(file);
  if (erro) throw new Error(erro);
  aoProgresso(15);
  const imagem = await comprimirParaBase64(file, { maxLargura: 1280, maxBytes: 280 * 1024, qualidade: 0.82 });
  aoProgresso(100);
  return imagem;
}

export async function listarBannersAdmin() {
  const resultado = await getDocs(query(collection(db, COLECAO), orderBy("ordem", "asc")));
  return resultado.docs.map(item => ({ id: item.id, ...item.data() }));
}

export function observarBannersAtivos(aoAtualizar, aoErro = console.error) {
  return onSnapshot(query(collection(db, COLECAO), where("ativo", "==", true), orderBy("ordem", "asc")),
    snap => aoAtualizar(snap.docs.map(item => ({ id: item.id, ...item.data() }))), aoErro);
}

export function observarConfiguracaoBanners(aoAtualizar, aoErro = console.error) {
  return onSnapshot(CONFIG_REF, snap => aoAtualizar({ ...CONFIG_PADRAO_CARROSSEL, ...(snap.exists() ? snap.data() : {}) }), aoErro);
}

export async function salvarBanner(dados) {
  const registro = {
    nome: String(dados.nome || "").trim(), titulo: String(dados.titulo || "").trim(), descricao: String(dados.descricao || "").trim(),
    ordem: Math.max(0, Number(dados.ordem) || 0), ativo: dados.ativo !== false,
    imagemDesktop: dados.imagemDesktop || "", imagemMobile: dados.imagemMobile || "", atualizadoEm: serverTimestamp()
  };
  if (!registro.nome || !registro.imagemDesktop) throw new Error("Informe o nome e envie a imagem para desktop.");
  if (dados.id) { await updateDoc(doc(db, COLECAO, dados.id), registro); return dados.id; }
  const criado = await addDoc(collection(db, COLECAO), { ...registro, criadoEm: serverTimestamp() });
  return criado.id;
}

export async function excluirBanner(banner) {
  await deleteDoc(doc(db, COLECAO, banner.id));
}

export async function salvarOrdemBanners(bannersOrdenados) {
  const lote = writeBatch(db);
  bannersOrdenados.forEach((banner, indice) => lote.update(doc(db, COLECAO, banner.id), { ordem: indice + 1, atualizadoEm: serverTimestamp() }));
  await lote.commit();
}

export async function salvarConfiguracaoBanners(configuracao) {
  const dados = {
    reproducaoAutomatica: !!configuracao.reproducaoAutomatica,
    intervaloMs: Math.max(2000, Math.min(30000, Number(configuracao.intervaloMs) || 5000)),
    transicaoMs: Math.max(150, Math.min(2000, Number(configuracao.transicaoMs) || 500)),
    efeito: configuracao.efeito === "slide" ? "slide" : "fade",
    mostrarSetas: !!configuracao.mostrarSetas, mostrarIndicadores: !!configuracao.mostrarIndicadores,
    permitirSwipe: !!configuracao.permitirSwipe, atualizadoEm: serverTimestamp()
  };
  await setDoc(CONFIG_REF, dados, { merge: true });
}
