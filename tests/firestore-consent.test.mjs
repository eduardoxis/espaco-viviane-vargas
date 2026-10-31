// Exclusivo do emulador. Nunca aponta para o projeto real.
import test from 'node:test';
import assert from 'node:assert/strict';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host && !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('Use somente o emulador local.');
const project = 'demo-ev-privacy';
const endpoint = `http://${host}/v1/projects/${project}/databases/(default)/documents/`;
function token(uid) {
  const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:uid,user_id:uid,aud:project,iss:`https://securetoken.google.com/${project}`,iat:now,exp:now+3600,firebase:{sign_in_provider:'password'}})}.`;
}
function fields(o) {
  return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v === 'string' ? {stringValue:v} : Array.isArray(v) ? {arrayValue:{values:v.map(x=>({stringValue:x}))}} : {integerValue:String(v)}]));
}
test('regras reais: bloqueio sem aceite, imutabilidade do histórico e isolamento por UID', { skip:!host }, async()=>{
  const uid=`privacy-${Date.now()}`,jwt=token(uid);
  async function put(p,data,auth=jwt) { return fetch(endpoint+p,{method:'PATCH',headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)})}); }
  let r=await put(`carrinhos/${uid}`,{});assert.equal(r.status,403);
  r=await put(`aceitesTermos/${uid}`,{versao:'2026-10-31'});assert.equal(r.status,403);
  r=await put(`aceitesTermos/${uid}/historico/falso`,{versao:'2026-10-31'});assert.equal(r.status,403);
  r=await put(`aceitesTermos/${uid}`,{versao:'2026-10-31',uid},'owner');assert.ok(r.ok,await r.text());
  r=await put(`usuarios/${uid}`,{email:'test@example.invalid',cargos:['admin']});assert.equal(r.status,403);
  r=await put(`usuarios/${uid}`,{email:'test@example.invalid',cargos:['cliente']});assert.ok(r.ok,await r.text());
  r=await fetch(endpoint+`usuarios/${uid}`,{headers:{Authorization:`Bearer ${token('outra-conta')}`}});assert.equal(r.status,403);
});
