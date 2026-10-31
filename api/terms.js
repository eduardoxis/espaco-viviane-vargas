import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { obterAuthAdmin, obterDbAdmin } from './_firebaseAdmin.js';
import { aplicarLimite } from './_rateLimit.js';

export const TERMS_VERSION = '2026-10-31';
const DOCUMENT = '/pages/legal/termos-2026-10-31.html';
const DOCUMENT_SHA256 = '624a88c05c7447167eac07b6858825caadd2548b4a2353a1f80744c9d13c280c';
const hash = value => createHash('sha256').update(value).digest();
// Firebase Auth pode criar a identidade antes do aceite. As regras bloqueiam
// os dados da conta até que esta função grave o comprovante no servidor.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ erro:'Método não permitido.' });
  try {
    const bearer = req.headers.authorization || '';
    if (!bearer.startsWith('Bearer ')) return res.status(401).json({ erro:'Entre na sua conta.' });
    let user;
    try { user = await obterAuthAdmin().verifyIdToken(bearer.slice(7), true); }
    catch { return res.status(401).json({ erro:'Sessão inválida. Entre novamente.' }); }
    const db = obterDbAdmin(), uid = user.uid;
    await aplicarLimite(`terms:${uid}`, { maximo:30, janelaMs:60000 });
    const receipt = db.collection('aceitesTermos').doc(uid);
    const challenge = db.collection('desafiosTermos').doc(uid);
    if (req.method === 'GET') {
      const saved = await receipt.get();
      if (saved.exists && saved.data().versao === TERMS_VERSION) return res.status(200).json({ accepted:true, version:TERMS_VERSION });
      const nonce = randomBytes(32).toString('hex');
      await challenge.set({ digest:hash(nonce).toString('hex'), versao:TERMS_VERSION, expiraEm:Timestamp.fromMillis(Date.now() + 15 * 60000) });
      return res.status(200).json({ accepted:false, version:TERMS_VERSION, document:DOCUMENT, challenge:nonce });
    }
    const { version, challenge: nonce, action } = req.body || {};
    if (version !== TERMS_VERSION || action !== 'accept-terms' || typeof nonce !== 'string' || nonce.length !== 64) return res.status(400).json({ erro:'Reabra os termos vigentes para confirmar.' });
    await db.runTransaction(async tx => {
      const [saved, pending] = await Promise.all([tx.get(receipt), tx.get(challenge)]);
      if (saved.exists && saved.data().versao === TERMS_VERSION) return;
      const value = pending.exists ? pending.data() : null;
      if (!value || value.versao !== TERMS_VERSION || value.expiraEm.toMillis() < Date.now() || !timingSafeEqual(Buffer.from(value.digest,'hex'), hash(nonce))) {
        const error = new Error('Confirmação expirada. Reabra os termos.'); error.status = 409; throw error;
      }
      const evidence = { uid, versao:TERMS_VERSION, documento:DOCUMENT, documentoSha256:DOCUMENT_SHA256, eventoId:randomUUID(), aceitoEm:FieldValue.serverTimestamp() };
      tx.create(receipt.collection('historico').doc(TERMS_VERSION), evidence);
      tx.set(receipt, evidence);
      tx.delete(challenge);
    });
    return res.status(200).json({ accepted:true, version:TERMS_VERSION });
  } catch (error) {
    // Não expõe credenciais, tokens ou detalhes do banco ao visitante.
    return res.status(error.status || 503).json({ erro:error.status ? error.message : 'Não foi possível registrar o aceite. Tente novamente.' });
  }
}
