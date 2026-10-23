// Mantém a página utilizável quando o navegador bloqueia ou esgota o storage.
// A memória é usada apenas como alternativa; dados válidos já salvos são preservados.
const memoria = new Map();

export function lerJSON(chave, padrao = null, area = "local") {
  const id = `${area}:${chave}`;
  try {
    const bruto = memoria.has(id) ? memoria.get(id) : window[`${area}Storage`].getItem(chave);
    return bruto == null ? padrao : JSON.parse(bruto);
  } catch { return padrao; }
}

export function salvarJSON(chave, valor, area = "local") {
  const bruto = JSON.stringify(valor);
  const id = `${area}:${chave}`;
  try {
    window[`${area}Storage`].setItem(chave, bruto);
    memoria.delete(id);
    return true;
  } catch {
    memoria.set(id, bruto);
    return false;
  }
}

export function lerLista(chave, area = "local") {
  const lista = lerJSON(chave, [], area);
  return Array.isArray(lista) ? lista : [];
}
