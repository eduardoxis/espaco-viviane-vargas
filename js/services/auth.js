// js/services/auth.js
import { auth, db } from "../../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { toast, podeExecutarPersistente } from "../utils/utils.js";
import { withLoading, beginListener } from "../utils/loadingManager.js";

import { garantirAceite } from "../privacy/terms.js";
let cadastroAceitou = false;
let authSequence = 0;

export let usuarioAtual = null;
export let perfilAtual = null;

const PERFIL_TTL_MS = 5 * 60 * 1000;

function chavePerfil(uid) { return `futura:perfil:${uid}`; }

function lerPerfilCache(uid) {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chavePerfil(uid)) || "null");
    return salvo && salvo.expiraEm > Date.now() ? salvo.perfil : null;
  } catch { return null; }
}

function salvarPerfilCache(uid, perfil) {
  try {
    sessionStorage.setItem(chavePerfil(uid), JSON.stringify({ perfil, expiraEm: Date.now() + PERFIL_TTL_MS }));
  } catch { /* sessionStorage indisponível: segue com leitura normal */ }
}

export function ouvirEstadoAuth(callback) {
  // O app espera esse primeiro retorno pra saber se tem usuário logado
  // ou não; por isso conta como loading até a primeira resposta.
  const finalizarPrimeiroEstado = beginListener("ouvirEstadoAuth");
  onAuthStateChanged(auth, async (user) => {
    const sequence = ++authSequence;
    usuarioAtual = null;
    try {
      if (user) {
        await garantirAceite(user, cadastroAceitou);
        if (sequence !== authSequence) return;
        usuarioAtual = user;
        // A permissão real continua nas regras do Firestore. Este cache só
        // evita reler o mesmo perfil para redesenhar a interface durante a
        // mesma sessão/navegação entre páginas.
        perfilAtual = lerPerfilCache(user.uid);
        if (!perfilAtual) {
          const ref = doc(db, "usuarios", user.uid);
          const snap = await getDoc(ref);
          perfilAtual = snap.exists() ? snap.data() : { cargos: ["cliente"] };
          if (!snap.exists() && !cadastroAceitou) {
            perfilAtual = { email: user.email || "", nome: user.displayName || "", cargos: ["cliente"], criadoEm: new Date().toISOString() };
            await setDoc(ref, perfilAtual);
          }
          salvarPerfilCache(user.uid, perfilAtual);
        }
        if (perfilAtual?.cargos?.includes("admin")) {
          // Mantém o comportamento administrativo sem uma segunda leitura.
          await setPersistence(auth, browserLocalPersistence);
        }
      } else {
        perfilAtual = null;
      }
      if (sequence === authSequence) callback(usuarioAtual, perfilAtual);
    } catch (erro) {
      if (sequence !== authSequence) return;
      usuarioAtual = null;
      perfilAtual = null;
      await signOut(auth).catch(() => {});
      callback(null, null);
      toast(erro.message || "Não foi possível liberar sua conta. Entre novamente para concluir o aceite.", "error");
    } finally {
      finalizarPrimeiroEstado();
    }
  });
}

export function ehAdmin() {
  return !!perfilAtual?.cargos?.includes("admin");
}

export function entrar(email, senha, manterLogin = true) {
  return withLoading("entrar", async () => {
    try {
      // Camada de proteção de interface: evita que um mesmo e-mail dispare
      // dezenas de requisições seguidas. O Firebase continua aplicando sua
      // própria proteção no servidor contra abuso de autenticação.
      const chaveLimite = `login:${String(email || "").trim().toLowerCase()}`;
      if (!podeExecutarPersistente(chaveLimite, 5, 15 * 60_000)) {
        const erro = new Error("Muitas tentativas de login. Aguarde 15 minutos e tente novamente.");
        toast(erro.message, "error");
        throw erro;
      }
      // "Manter conectado" marcado -> sessão sobrevive ao fechar o navegador
      // (browserLocalPersistence). Desmarcado -> some ao fechar a aba/janela
      // (browserSessionPersistence), útil em computador compartilhado.
      await setPersistence(auth, manterLogin ? browserLocalPersistence : browserSessionPersistence);
      const { user } = await signInWithEmailAndPassword(auth, email, senha);
      await garantirAceite(user);
      // Não consultamos o perfil aqui: o observador de autenticação já faz
      // essa única leitura (ou usa cache) ao concluir o login. Isso elimina
      // a leitura duplicada de usuarios/{uid} em todo acesso.
      // Login concluído: remove o histórico de tentativas daquele e-mail.
      localStorage.removeItem(`ratelimit_${chaveLimite}`);
      return user;
    } catch (err) {
      if (err?.message?.startsWith("Muitas tentativas de login")) throw err;
      toast(traduzErroAuth(err.code), "error");
      throw err;
    }
  });
}

export function cadastrar(dados) {
  return withLoading("cadastrar", async () => {
    try {
      if (dados.aceiteTermos !== true) throw new Error("Aceite os Termos de Uso para criar a conta.");
      const { email, senha, aceiteTermos, ...perfil } = dados;
      cadastroAceitou = true;
      const { user } = await createUserWithEmailAndPassword(auth, email, senha);
      await garantirAceite(user, true);
      const nomeExibicao = perfil.nome || perfil.responsavel || perfil.razaoSocial || "";
      if (nomeExibicao) await updateProfile(user, { displayName: nomeExibicao });
      const novoPerfil = {
        email, cargos: ["cliente"], criadoEm: new Date().toISOString(), ...perfil
      };
      await setDoc(doc(db, "usuarios", user.uid), novoPerfil);
      perfilAtual = novoPerfil;
      salvarPerfilCache(user.uid, novoPerfil);
      return user;
    } catch (err) {
      await signOut(auth).catch(() => {});
      toast(err.message || traduzErroAuth(err.code), "error");
      throw err;
    } finally { cadastroAceitou = false; }
  });
}

export function atualizarNomeAuth(nome) {
  return withLoading("atualizarNomeAuth", async () => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: nome });
  });
}

export function sair() {
  return withLoading("sair", async () => {
    await signOut(auth);
    window.location.href = "/index.html";
  });
}

export function redefinirSenha(email) {
  return withLoading("redefinirSenha", async () => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      toast(traduzErroAuth(err.code), "error");
      throw err;
    }
  });
}

function traduzErroAuth(code) {
  const mapa = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco antes de tentar de novo."
  };
  return mapa[code] || "Ocorreu um erro. Tente novamente.";
}
