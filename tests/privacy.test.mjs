import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as crypto from 'node:crypto';

const source = p => readFileSync(new URL(`../${p}`, import.meta.url),'utf8');
function consent(seed, blocked = false) {
  const values = new Map(seed ? [['ev:consentimento',seed]] : []), listeners = {};
  const storage = { getItem:k=>values.get(k)||null, setItem:(k,v)=>{ if (blocked) throw Error('bloqueado');values.set(k,v); }, removeItem:k=>values.delete(k) };
  const window = { addEventListener:(k,fn)=>listeners[k]=fn, dispatchEvent:()=>{} };
  const enumerableStorage = new Proxy(storage, { ownKeys:()=>[...values.keys()], getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true}) });
  vm.runInNewContext(source('js/privacy/consent.js'), { localStorage:enumerableStorage,window,CustomEvent:class {},Event:class {},Date });
  return { api:window.EVConsent, values };
}
test('consentimento nega por padrão e rejeição persiste entre páginas', () => {
  const a=consent();assert.equal(a.api.allows('statistics'),false);
  a.api.save({statistics:false,marketing:false});
  const b=consent(a.values.get('ev:consentimento'));
  assert.ok(b.api.get());assert.equal(b.api.allows('marketing'),false);
});
test('consentimento inválido/expirado e storage bloqueado não liberam opcionais', () => {
  for(const value of ['{','null',JSON.stringify({schema:1,policy:'old',necessary:true,statistics:true,marketing:true,at:new Date().toISOString()})]) assert.equal(consent(value).api.allows('statistics'),false);
  const a=consent(null,true);assert.throws(()=>a.api.save({statistics:true}));assert.equal(a.api.allows('statistics'),false);
});
test('preferências são independentes e revogação remove marcadores opcionais',()=>{
  const a=consent();a.api.save({statistics:true,marketing:false});assert.equal(a.api.allows('statistics'),true);assert.equal(a.api.allows('marketing'),false);
  a.values.set('futura:view:a','1');a.values.set('papelaria_ultimo_lead','1');a.api.save({statistics:false,marketing:false});
  assert.equal(a.values.has('futura:view:a'),false);assert.equal(a.values.has('papelaria_ultimo_lead'),false);
});

async function server() {
  const values=new Map();let fail=false;
  function ref(key) { return { key, collection:n=>({doc:id=>ref(`${key}/${n}/${id}`)}),
    get:async()=>({exists:values.has(key),data:()=>values.get(key)}),set:async v=>{if(fail)throw Error('offline');values.set(key,v);} }; }
  const db={collection:n=>({doc:id=>ref(`${n}/${id}`)}),runTransaction:async fn=>{
    if(fail)throw Error('offline');const writes=[];
    await fn({get:r=>r.get(),create:(r,v)=>{assert.ok(!values.has(r.key));writes.push(()=>values.set(r.key,v));},set:(r,v)=>writes.push(()=>values.set(r.key,v)),delete:r=>writes.push(()=>values.delete(r.key))});
    writes.forEach(fn=>fn());
  }};
  const context=vm.createContext({console,Buffer,Date});
  const mocks={ 'node:crypto':crypto,'firebase-admin/firestore':{
    FieldValue:{serverTimestamp:()=>({server:true})},Timestamp:{fromMillis:ms=>({toMillis:()=>ms})}},
    './_firebaseAdmin.js':{obterDbAdmin:()=>db,obterAuthAdmin:()=>({verifyIdToken:async token=>{if(token==='invalid')throw Error();return {uid:token};}})},
    './_rateLimit.js':{aplicarLimite:async()=>{}} };
  const mod=new vm.SourceTextModule(source('api/terms.js'),{context});
  await mod.link(id=>{const obj=mocks[id];return new vm.SyntheticModule(Object.keys(obj),function(){for(const k of Object.keys(obj))this.setExport(k,obj[k]);},{context});});
  await mod.evaluate();
  async function call(method='GET',token='u1',body={}) { const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
    await mod.namespace.default({method,headers:token?{authorization:`Bearer ${token}`}:{},body},res);return res; }
  return {call,values,offline:()=>{fail=true;}};
}
test('API recusa token ausente/inválido, versão errada e booleano livre',async()=>{
  const s=await server();assert.equal((await s.call('POST',null)).code,401);assert.equal((await s.call('GET','invalid')).code,401);
  assert.equal((await s.call('POST','u1',{termsAccepted:true})).code,400);
  assert.equal((await s.call('POST','u1',{action:'accept-terms',version:'antiga',challenge:'a'.repeat(64)})).code,400);
});
test('aceite usa desafio do UID, grava timestamp no servidor e histórico imutável/idempotente',async()=>{
  const s=await server(),c=(await s.call()).data;
  const body={action:'accept-terms',version:c.version,challenge:c.challenge};
  assert.equal((await s.call('POST','u2',body)).code,409);
  assert.equal((await s.call('POST','u1',body)).code,200);
  const record=s.values.get('aceitesTermos/u1');assert.equal(record.uid,'u1');assert.equal(record.aceitoEm.server,true);
  const event=record.eventoId;await s.call('POST','u1',body);assert.equal(s.values.get('aceitesTermos/u1').eventoId,event);
  assert.ok(s.values.has('aceitesTermos/u1/historico/2026-10-31'));
  assert.equal((await s.call()).data.accepted,true);
});
test('desafio expirado e falha parcial não liberam conta',async()=>{
  const s=await server(),c=(await s.call()).data;
  s.values.get('desafiosTermos/u1').expiraEm={toMillis:()=>0};
  const body={action:'accept-terms',version:c.version,challenge:c.challenge};
  assert.equal((await s.call('POST','u1',body)).code,409);assert.equal(s.values.has('aceitesTermos/u1'),false);
  s.offline();assert.equal((await s.call('POST','u1',body)).code,503);assert.equal(s.values.has('aceitesTermos/u1'),false);
});

async function account() {
  const s=await server(); let observer,created=0,writes=0,signedOut=0,fail=false;
  const user={uid:'u1',email:'test@example.com',getIdToken:async()=>'u1'};
  const auth={currentUser:null};
  const context=vm.createContext({console,Date,Map,AbortSignal,window:{location:{}},sessionStorage:{getItem:()=>null,setItem(){}},localStorage:{removeItem(){}},
    fetch:async(url,options)=>{if(fail)throw Error('offline');const r=await s.call(options.method, 'u1', options.body?JSON.parse(options.body):{});return {ok:r.code===200,json:async()=>r.data};} });
  const mocks={
    '../../firebase/firebase-config.js':{auth,db:{}},
    'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js':{
      createUserWithEmailAndPassword:async()=>{created++;auth.currentUser=user;return {user};},signInWithEmailAndPassword:async()=>({user}),
      signOut:async()=>{signedOut++;auth.currentUser=null;},onAuthStateChanged:(_auth,cb)=>observer=cb,sendPasswordResetEmail:async()=>{},updateProfile:async()=>{},
      setPersistence:async()=>{},browserLocalPersistence:{},browserSessionPersistence:{} },
    'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js':{doc:()=>({}),getDoc:async()=>({exists:()=>false}),setDoc:async()=>{writes++;}},
    '../utils/utils.js':{toast(){},podeExecutarPersistente:()=>true},
    '../utils/loadingManager.js':{withLoading:(_k,fn)=>fn(),beginListener:()=>()=>{}}
  };
  const cache=new Map();
  async function load(id) {
    if(cache.has(id))return cache.get(id);
    let m;
    if(id==='auth')m=new vm.SourceTextModule(source('js/services/auth.js'),{context,identifier:id});
    else if(id==='../privacy/terms.js')m=new vm.SourceTextModule(source('js/privacy/terms.js'),{context,identifier:id});
    else {const o=mocks[id];m=new vm.SyntheticModule(Object.keys(o),function(){for(const k of Object.keys(o))this.setExport(k,o[k]);},{context});}
    cache.set(id,m);return m;
  }
  const m=await load('auth');await m.link(load);await m.evaluate();
  return {api:m.namespace,s,user,fire:()=>observer(user),counts:()=>({created,writes,signedOut}),offline:()=>fail=true};
}
test('cadastro sem checkbox não cria identidade; com aceite registra no servidor antes do perfil',async()=>{
  const a=await account();
  await assert.rejects(a.api.cadastrar({email:'test@example.com',senha:'123456'}));
  assert.equal(a.counts().created,0);
  await a.api.cadastrar({email:'test@example.com',senha:'123456',aceiteTermos:true});
  assert.equal(a.counts().created,1);assert.equal(a.counts().writes,1);
  assert.equal(a.s.values.get('aceitesTermos/u1').versao,'2026-10-31');
});
test('falha do aceite não grava perfil e observador não libera usuário',async()=>{
  const a=await account();a.offline();
  await assert.rejects(a.api.cadastrar({email:'test@example.com',senha:'123456',aceiteTermos:true}));
  assert.equal(a.counts().writes,0);
  let released='unset';a.api.ouvirEstadoAuth(u=>released=u);await a.fire();
  assert.equal(released,null);assert.equal(a.api.usuarioAtual,null);
});

test('funções reais de métricas e recuperação não enviam requisições sem autorização',async()=>{
  let allowed=false,requests=0;
  const context=vm.createContext({console,Date,Map,Set,location:{hostname:"test.example"},window:{EVConsent:{allows:()=>allowed,get:()=>({policy:'2026-10-31',statistics:true,marketing:true})}},localStorage:{getItem:()=>null,setItem(){}},
    fetch:async()=>{requests++;return {ok:true,json:async()=>({ok:true})};}});
  const names=['collection','doc','getDoc','getDocs','addDoc','updateDoc','deleteDoc','setDoc','query','where','orderBy','limit','startAfter','serverTimestamp','increment','runTransaction','getCountFromServer','getAggregateFromServer','sum','writeBatch','documentId'];
  const mocks={ '../../firebase/firebase-config.js':{db:{}},'./public-sync.js':{sinalizarAtualizacaoPublica(){}},'../utils/loadingManager.js':{withLoading:(_k,fn)=>fn()},
    'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js':Object.fromEntries(names.map(n=>[n,()=>{}])) };
  const m=new vm.SourceTextModule(source('js/services/firestore.js'),{context});
  await m.link(id=>{const o=mocks[id];return new vm.SyntheticModule(Object.keys(o),function(){for(const k of Object.keys(o))this.setExport(k,o[k]);},{context});});await m.evaluate();
  for(const fn of ['incrementarVisualizacao','incrementarCompartilhamento','salvarLeadPerdido'])await m.namespace[fn]('abc');
  assert.equal(requests,0);allowed=true;
  for(const fn of ['incrementarVisualizacao','incrementarCompartilhamento','salvarLeadPerdido'])await m.namespace[fn]('abc');
  assert.equal(requests,3);
});

