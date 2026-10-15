import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,update,runTransaction,onValue,serverTimestamp,goOffline,goOnline,query,orderByChild,limitToLast} from 'firebase/database';
import {createVoyage,remoteCommand,fingerprint} from '../src/voyage-remote-model.js';
let env;const client=(uid,provider='anonymous')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database();const host=()=>client('host','password');const obs=()=>env.unauthenticatedContext().database();const seed=fn=>env.withSecurityRulesDisabled(c=>fn(c.database()));
const cmd=(action,value,expected)=>runTransaction(ref(host(),'voyage'),r=>r?remoteCommand(r,action,value,expected):null,{applyLocally:false});
const join=(db,id,seat)=>update(ref(db,'voyage'),{[`roster/${id}`]:{name:id,seat:String(seat),game:'test-game',at:serverTimestamp()},[`seats/${seat}`]:id});
const send=(db,id,kind,round,payload)=>set(ref(db,`voyage/inputs/${kind}/${round}/${id}`),{game:'test-game',at:serverTimestamp(),...payload});
const pub=async()=>(await get(ref(host(),'voyage/public'))).val();
const first=(db,id,p,choice=0,prediction=0)=>send(db,id,'first',p.round,{choice,prediction:p.target===id?-1:prediction});
const second=(db,id,p,a={})=>send(db,id,'second',p.round,{stance:'keep',choice:0,text:'',consent:false,...a});
const observe=(db,path,check)=>new Promise((resolve,reject)=>{let stop=()=>{};const timer=setTimeout(()=>{stop();reject(Error(`sync timeout ${path}`));},7000);stop=onValue(ref(db,path),s=>{if(check(s.val())){clearTimeout(timer);queueMicrotask(stop);resolve(s.val());}},reject);});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-hoho',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});});after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearDatabase();await seed(async db=>{const r=createVoyage('VOYAGE');r.hostOnly.id='test-game';r.public.id='test-game';await set(ref(db),{config:{hostUid:'host'},voyage:r});});});
test('10 independent clients: 12 scenes, target rotation, E choice, sync, overwrite, retries, reload, endings',async()=>{
 const clients=Array.from({length:10},(_,i)=>({id:`p${i}`,db:client(`p${i}`)}));await Promise.all(clients.map((c,i)=>join(c.db,c.id,i)));await cmd('sync');
 for(let n=1;n<=12;n++){
  await cmd('next',60);let p=await pub();assert.equal(p.target,`p${(n-1)%10}`);
  if(p.phase==='routing'){const c=clients.find(c=>c.id===p.target);await send(c.db,c.id,'routes',n,{route:p.routes[1].id});await cmd('begin');p=await pub();}
  await Promise.all(clients.map(c=>observe(c.db,'voyage/public',x=>x?.round===n&&x.phase==='first')));
  const choice=p.currentQuestion.options.length-1,before=JSON.stringify(p.island);
  await Promise.all(clients.map(c=>first(c.db,c.id,p,0,0)));await Promise.all(clients.map(c=>first(c.db,c.id,p,choice,choice)));await cmd('sync');
  assert.equal((await pub()).submitted,10);assert.equal(JSON.stringify((await pub()).island),before);assert.equal((await pub()).view.guessResult,undefined);
  await cmd('close');const expected={id:p.id,round:n,phase:'firstClosed'};await cmd('revealFirst',null,expected);const settled=fingerprint((await get(ref(host(),'voyage'))).val());await cmd('revealFirst',null,expected);assert.equal(fingerprint((await get(ref(host(),'voyage'))).val()),settled);
  await Promise.all(clients.map(c=>observe(c.db,'voyage/public',x=>x?.view?.guessResult?.correct===9&&x.round===n)));
  const reload=client('p0');assert.equal((await get(ref(reload,`voyage/inputs/first/${n}/p0`))).val().choice,choice);
  await cmd('twist');p=await pub();await Promise.all(clients.map(c=>second(c.db,c.id,p,{choice,text:`private-${c.id}`,consent:false})));await cmd('close');await cmd('revealSecond');
 }
 const r=(await get(ref(host(),'voyage'))).val();assert.equal(r.public.phase,'ended');assert.equal(r.hostOnly.players.p0.points,10);assert.equal(r.hostOnly.players.p0.events.length,12);assert.ok(!JSON.stringify(r.public).includes('private-'));assert.equal(fingerprint(remoteCommand(structuredClone(r),'sync')),fingerprint(r));
});
test('private answers, short responses and affinity unavailable to others/OBS; public writes denied',async()=>{
 const a=client('a'),b=client('b');await join(a,'a',0);await join(b,'b',1);await cmd('sync');await cmd('next',60);const p=await pub();await first(a,'a',p);await cmd('sync');
 for(const db of [b,obs()])for(const path of ['voyage','voyage/hostOnly','voyage/hostOnly/affinity','voyage/inbox/a','voyage/inputs/first/1/a','voyage/inputs/second/1/a'])await assertFails(get(ref(db,path)));
 for(const path of ['config/hostUid','voyage/public/island','voyage/public/players/a/points','voyage/hostOnly'])await assertFails(set(ref(b,path),1));await assertFails(set(ref(client('host'),'voyage/public/phase'),'ended'));await get(ref(obs(),'voyage/public'));
 await assertFails(first(b,'b',p,5,0));await assertFails(first(b,'b',p,0,-1));await assertFails(send(a,'a','first',1,{choice:0,prediction:1}));await assertFails(send(a,'a','first',0,{choice:0,prediction:-1}));
});
test('server deadline rejects offline queued submits and stale game timestamps',async()=>{
 const a=client('a');await join(a,'a',0);await cmd('sync');await cmd('next',60);const p=await pub();await get(ref(a,'voyage/public'));goOffline(a);const denied=assertFails(first(a,'a',p));await seed(db=>update(ref(db,'voyage'),{'public/deadline':1,'hostOnly/deadline':1}));goOnline(a);await denied;assert.equal((await get(ref(host(),'voyage/inputs/first/1/a'))).exists(),false);
 await assertFails(set(ref(a,'voyage/inputs/first/1/a'),{game:'test-game',at:1,choice:0,prediction:-1}));
});
test('short consent is opt-in, visible only after reveal, immediate withdrawal and host hiding; cards exclude private text',async()=>{
 const a=client('a');await join(a,'a',0);await cmd('sync');await cmd('next',60);let p=await pub();await first(a,'a',p);await cmd('close');await cmd('revealFirst');await cmd('twist');p=await pub();await second(a,'a',p,{text:'<img onerror=alert(1)>',consent:true});await assertFails(get(ref(obs(),'voyage/quotes/1/a')));await cmd('close');await cmd('revealSecond');
 assert.equal((await get(ref(obs(),'voyage/quotes/1/a'))).val().text,'<img onerror=alert(1)>');await set(ref(a,'voyage/quoteConsent/1/a'),{game:p.id,share:false});await assertFails(get(ref(obs(),'voyage/quotes/1/a')));await set(ref(a,'voyage/quoteConsent/1/a'),{game:p.id,share:true});await cmd('hide',{round:1,uid:'a'});await assertFails(get(ref(obs(),'voyage/quotes/1/a')));
 await cmd('end');await assertFails(get(ref(obs(),'voyage/sharedCards/a')));await set(ref(a,'voyage/consent/a'),{game:p.id,share:true});const c=(await get(ref(obs(),'voyage/sharedCards/a'))).val();assert.ok(!JSON.stringify(c).includes('onerror'));await set(ref(a,'voyage/consent/a'),{game:p.id,share:false});await assertFails(get(ref(obs(),'voyage/sharedCards/a')));
});
test('chat cooling, length, moderation, seat ownership and target removal',async()=>{
 const a=client('a'),b=client('b');await join(a,'a',0);await join(b,'b',1);await cmd('sync');
 const chat=(text,seq=1)=>update(ref(a,'voyage/chat/a'),{seq,lastSent:serverTimestamp(),[`messages/${seq}`]:{game:'test-game',text,at:serverTimestamp()}});
 await assertFails(chat('x'.repeat(301)));await chat('hello');await assertFails(chat('fast',2));await assertFails(get(ref(b,'voyage/chat/a/messages')));await get(query(ref(b,'voyage/chat/a/messages'),orderByChild('at'),limitToLast(3)));await assertFails(get(ref(obs(),'voyage/chat/a/messages')));
 await cmd('mute','a');await seed(db=>set(ref(db,'voyage/chat/a/lastSent'),1));await assertFails(chat('muted',2));await cmd('next',60);await cmd('remove','a');await assertFails(first(a,'a',await pub()));await assertFails(join(a,'a',0));assert.equal((await pub()).island.positions?.a,undefined);await cmd('twist');await cmd('close');await cmd('revealSecond');await cmd('next',60);assert.equal((await pub()).target,'b');
});

test('wrong guesses still gain affinity from own answers, late join, reconnect and identical public positions',async()=>{
 const a=client('a'),b=client('b');await join(a,'a',0);await join(b,'b',1);await cmd('sync');
 for(let n=1;n<=2;n++){await cmd('next',60);const p=await pub();await first(a,'a',p,0,1);await first(b,'b',p,0,1);const positions=p.island;await cmd('sync');assert.deepEqual((await pub()).island,positions);await cmd('close');await cmd('revealFirst');await cmd('twist');await cmd('close');await cmd('revealSecond');}
 const r=(await get(ref(host(),'voyage'))).val();assert.equal(r.hostOnly.players.a.points,0);assert.equal(r.hostOnly.players.b.points,0);assert.equal(r.hostOnly.affinity.pairs.a.b.same,2);assert.equal(r.public.island.positions.b.x-r.public.island.positions.a.x,96);
 goOffline(b);goOnline(b);const restored=await observe(b,'voyage/public',p=>p?.round===2);assert.deepEqual(restored.island,r.public.island);
 const c=client('c');await join(c,'c',2);await cmd('sync');await cmd('next',60);assert.equal((await pub()).target,'c');await cmd('begin');await first(a,'a',await pub());await cmd('close');await cmd('revealFirst');assert.equal((await pub()).view.guessResult.choice,undefined);assert.equal((await get(ref(host(),'voyage/hostOnly/affinity/pairs/a/b/same'))).val(),2);
});
