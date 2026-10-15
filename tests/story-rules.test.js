import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,update,runTransaction,onValue,serverTimestamp,goOffline,goOnline,query,orderByChild,limitToLast} from 'firebase/database';
import {createAdventure,remoteCommand,fingerprint} from '../src/story-remote-model.js';
let env;const client=(uid,provider='anonymous')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database();const host=()=>client('host','password');const seed=fn=>env.withSecurityRulesDisabled(c=>fn(c.database()));
const cmd=async(action,value)=>{const target=ref(host(),'adventure');return runTransaction(target,r=>r?remoteCommand(r,action,value):null,{applyLocally:false});};
const join=(db,id,seat)=>update(ref(db,'adventure'),{[`roster/${id}`]:{name:id,seat:String(seat),game:'test-game',at:serverTimestamp()},[`seats/${seat}`]:id});
const submit=(db,id,round=1,qid='r1',choice=0,prediction=0)=>set(ref(db,`adventure/inputs/answers/${round}/${id}`),{game:'test-game',qid,choice,prediction,at:serverTimestamp()});
const sync=()=>cmd('sync');
const observe=(db,path,check)=>new Promise((resolve,reject)=>{let stop=()=>{};const timer=setTimeout(()=>{stop();reject(Error(`sync timeout ${path}`));},7000);stop=onValue(ref(db,path),s=>{try{if(check(s.val())){clearTimeout(timer);queueMicrotask(stop);resolve(s.val());}}catch(e){clearTimeout(timer);stop();reject(e);}},reject);});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-hoho',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});});after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearDatabase();await seed(async db=>{const r=createAdventure('STORY1');r.hostOnly.id='test-game';r.public.id='test-game';await set(ref(db),{config:{hostUid:'host'},adventure:r});});});
test('10 distinct clients join, receive private questions, overwrite, settle once and resume',async()=>{
 const clients=Array.from({length:10},(_,i)=>({uid:`p${i}`,db:client(`p${i}`)}));await Promise.all(clients.map((c,i)=>join(c.db,c.uid,i)));await sync();await cmd('next',60);
 await Promise.all(clients.map(c=>observe(c.db,`adventure/inbox/${c.uid}`,q=>q?.question?.id==='r1')));
 await Promise.all(clients.map(c=>submit(c.db,c.uid)));await Promise.all(clients.map(c=>submit(c.db,c.uid,1,'r1',1,1)));await sync();
 assert.equal((await get(ref(host(),'adventure/public/submitted'))).val(),10);
 await cmd('close');await cmd('reveal');await cmd('sync');const engine=(await get(ref(host(),'adventure/hostOnly'))).val();assert.equal(engine.players.p0.points,1);assert.equal(engine.players.p0.traits.careful,1);
 await Promise.all(clients.map(c=>observe(c.db,`adventure/inbox/${c.uid}`,q=>q?.outcome==='你收好備用餅乾。')));
 const reload=client('p0');assert.equal((await get(ref(reload,'adventure/inputs/answers/1/p0'))).val().choice,1);
 await cmd('next',60);await Promise.all(clients.map((c,i)=>set(ref(c.db,`adventure/inputs/routes/2/${c.uid}`),{game:'test-game',route:i%2?'shop':'dock',at:serverTimestamp()})));await cmd('begin');
 await Promise.all(clients.map((c,i)=>observe(c.db,`adventure/inbox/${c.uid}`,q=>q?.question?.id===`r2-${i%2?'shop':'dock'}`)));
});
test('private root, host values, other questions and answers denied to viewer and unauthenticated OBS',async()=>{const a=client('a'),b=client('b');await join(a,'a',0);await join(b,'b',1);await sync();await cmd('next');await submit(a,'a');for(const db of [b,env.unauthenticatedContext().database()])for(const path of ['adventure','adventure/hostOnly','adventure/inbox','adventure/inbox/a','adventure/inputs/answers/1/a','adventure/sharedCards/a'])await assertFails(get(ref(db,path)));assert.ok((await get(ref(a,'adventure/inbox/a'))).exists());assert.ok((await get(ref(env.unauthenticatedContext().database(),'adventure/public'))).exists());});
test('viewer cannot change roles, scores, projection, arbitrary questions or forge timestamps',async()=>{const a=client('a');await join(a,'a',0);await sync();await cmd('next');for(const path of ['config/hostUid','adventure/public','adventure/hostOnly','adventure/inbox/a','adventure/sharedCards/a'])await assertFails(set(ref(a,path),{hacked:true}));await assertFails(submit(a,'a',1,'wrong'));await assertFails(submit(a,'a',1,'r1',4));await assertFails(submit(a,'a',0));await assertFails(set(ref(a,'adventure/inputs/answers/1/a'),{game:'test-game',qid:'r1',choice:0,prediction:0,at:1}));await assertFails(set(ref(client('host'),'adventure/public/phase'),'open'));});
test('deadline includes queued offline answers and duplicate close/reveal never doubles stats',async()=>{const a=client('a');await join(a,'a',0);await sync();await cmd('next');await get(ref(a,'adventure/public'));goOffline(a);const queued=submit(a,'a');const denied=assertFails(queued);await seed(db=>update(ref(db,'adventure'),{'public/deadline':1,'hostOnly/deadline':1}));goOnline(a);await denied;assert.equal((await get(ref(host(),'adventure/inputs/answers/1/a'))).exists(),false);await cmd('close');await cmd('reveal');const before=(await get(ref(host(),'adventure/hostOnly/players/a'))).val();const expected={id:'test-game',round:1,phase:'closed'};await runTransaction(ref(host(),'adventure'),r=>r?remoteCommand(r,'reveal',null,expected):undefined);assert.deepEqual((await get(ref(host(),'adventure/hostOnly/players/a'))).val(),before);});
test('late member gets assigned question; foreign game and seats over 20 rejected',async()=>{await cmd('next');const a=client('a');await join(a,'a',0);await sync();assert.equal((await get(ref(a,'adventure/inbox/a/question/id'))).val(),'r1');await assertFails(join(client('b'),'b',20));await assertFails(join(client('b'),'b',0));await assertFails(set(ref(a,'adventure/inputs/answers/1/a'),{game:'old-game',qid:'r1',choice:0,prediction:0,at:serverTimestamp()}));});
test('muting, removal, chat size/history, sharing ownership and withdrawal enforced',async()=>{
 const a=client('a'),b=client('b'),obs=env.unauthenticatedContext().database();await join(a,'a',0);await join(b,'b',1);await sync();
 const chat=(text='hello',seq=1)=>update(ref(a,'adventure/chat/a'),{seq,lastSent:serverTimestamp(),[`messages/${seq}`]:{game:'test-game',text,at:serverTimestamp()}});
 await assertFails(chat('x'.repeat(301)));await chat();await assertFails(chat('fast',2));await assertFails(get(ref(b,'adventure/chat/a/messages')));await get(query(ref(b,'adventure/chat/a/messages'),orderByChild('at'),limitToLast(3)));
 await seed(db=>set(ref(db,'adventure/chat/a/lastSent'),1));
 await assertFails(update(ref(a,'adventure/chat/a'),{seq:2,lastSent:serverTimestamp(),'messages/1':null,'messages/2':{game:'test-game',text:'delete old',at:serverTimestamp()}}));
 await assertFails(set(ref(a,'adventure/chat/a/messages/1/text'),'changed'));
 await cmd('mute','a');await assertFails(chat('muted',2));await cmd('end');await assertFails(get(ref(obs,'adventure/sharedCards/a')));
 await set(ref(a,'adventure/consent/a'),{game:'test-game',share:true});assert.equal((await get(ref(obs,'adventure/sharedCards/a'))).val().name,'a');await assertFails(set(ref(b,'adventure/consent/a'),{game:'test-game',share:true}));await set(ref(a,'adventure/consent/a'),{game:'test-game',share:false});await assertFails(get(ref(obs,'adventure/sharedCards/a')));
 await cmd('remove','a');await assertFails(get(ref(a,'adventure/inbox/a')));await assertFails(chat('removed',2));await assertFails(join(a,'a',0));
});
test('full 18-round Firebase transactions preserve trapped round, runoff, ending and projection stability',async()=>{const a=client('a'),b=client('b');await join(a,'a',0);await join(b,'b',1);await sync();
 for(let n=1;n<=18;n++){
  await cmd('next',60);let p=(await get(ref(host(),'adventure/public'))).val();
  if(p.phase==='routing'){for(const [db,id,index]of [[a,'a',0],[b,'b',1]])await set(ref(db,`adventure/inputs/routes/${n}/${id}`),{game:'test-game',route:p.routes[index].id,at:serverTimestamp()});await cmd('begin');}
  for(const [db,id,index]of [[a,'a',0],[b,'b',1]]){const q=(await get(ref(db,`adventure/inbox/${id}`))).val();if(n===9&&id==='a'){assert.equal(q.trapped,true);assert.equal(q.question.id,'r9-trapped');}await submit(db,id,n,q.question.id,n===16?index:0,p.scored?0:-1);}
  await cmd('close');await cmd('reveal');p=(await get(ref(host(),'adventure/public'))).val();if(p.phase==='runoff'){await set(ref(a,'adventure/inputs/runoff/a'),{game:'test-game',choice:1,at:serverTimestamp()});await cmd('close');await cmd('reveal');}
 }
 const before=(await get(ref(host(),'adventure'))).val();assert.equal(before.public.phase,'ended');assert.equal(before.hostOnly.players.a.events.length,18);assert.equal(before.hostOnly.ending,1);assert.equal(before.inbox.a.card.name,'a');assert.equal(fingerprint(remoteCommand(structuredClone(before),'sync')),fingerprint(before));
});
