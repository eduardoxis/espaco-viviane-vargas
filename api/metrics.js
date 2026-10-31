import { obterDbAdmin } from './_firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { aplicarLimite } from './_rateLimit.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro:'Método não permitido.' });
  const { id, type, consent } = req.body || {};
  if (consent?.statistics !== true || consent?.policy !== '2026-10-31') return res.status(403).json({ erro:'Estatísticas não autorizadas.' });
  if (typeof id !== 'string' || !/^[\w-]{1,150}$/.test(id) || !['view','share'].includes(type)) return res.status(400).json({ erro:'Métrica inválida.' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0];
    await aplicarLimite(`metrics:${ip}`, { maximo:30, janelaMs:60000 });
    const ref = obterDbAdmin().collection('produtos').doc(id);
    await obterDbAdmin().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists && ['disponivel','sem_estoque','esgotado'].includes(snap.data().status)) tx.update(ref, { [type === 'view' ? 'visualizacoes' : 'compartilhamentos']:FieldValue.increment(1) });
    });
    return res.status(200).json({ ok:true });
  } catch { return res.status(503).json({ erro:'Métrica indisponível.' }); }
}
