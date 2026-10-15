import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {ref,set,get,update,runTransaction,serverTimestamp,goOffline,goOnline} from 'firebase/database';
import {newRoom,startRound,settleRoom} from '../src/game.js';
import {activateGuesses} from '../src/spotlight.js';
import {autoRevealRound} from '../src/auto-reveal.js';
let env,expected;
const host=()=>env.authenticatedContext('host',{firebase:{sign_in_provider:'password'}}).database();
const options={applyLocally:false};
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-auto-reveal',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{
 await env.clearDatabase();
 const r=newRoom('AUTO01');r.public.members={a:{name:'甲',seat:'0',joined:1},b:{name:'乙',seat:'1',joined:2}};
 r.public.state=startRound(r,{id:'q1',text:'測試題',options:['甲','乙','丙','丁']},Date.now());
 r.answers[1]={a:{choice:1,prediction:-1,attempt:r.public.state.attempt,at:Date.now()}};
 activateGuesses(r,{...r.public.state},Date.now());expected={...r.public.state};
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{config:{hostUid:'host'},room:r}));
});
test('last player submission reveals atomically for all clients, with no duplicate scoring',async()=>{
 const h=host(),b=env.authenticatedContext('b',{firebase:{sign_in_provider:'anonymous'}}).database();
 const display=env.unauthenticatedContext().database();
 const auto=db=>runTransaction(ref(db,'room'),r=>autoRevealRound(r,expected,Date.now(),serverTimestamp()),options);
 assert.equal((await auto(h)).committed,false);
 await assertFails(get(ref(display,'room/answers/1/a')));
 await assertFails(auto(b));
 await set(ref(b,'room/answers/1/b'),{choice:2,prediction:1,attempt:expected.attempt,at:serverTimestamp()});
 await auto(h);assert.equal((await get(ref(h,'room/public/state/status'))).val(),'open');
 for(const id of ['a','b']){const client=env.authenticatedContext(id,{firebase:{sign_in_provider:'anonymous'}}).database();await set(ref(client,'room/public/earlyClose/votes/'+id),{code:expected.code,round:expected.round,attempt:expected.attempt,at:serverTimestamp()});}
 const results=await Promise.all([auto(h),auto(host())]);assert.equal(results.filter(r=>r.committed).length,1);
 const result=(await get(ref(display,'room/public/results/1'))).val();
 assert.equal(result.total,2);assert.equal(result.points.b,1);assert.equal(typeof result.revealedAt,'number');
 assert.deepEqual((await get(ref(b,'room/public/results/1'))).val(),result);
 assert.equal((await auto(h)).committed,false);
 assert.equal((await get(ref(h,'room/hostOnly/spotlight/players/a/turns'))).val(),1);
});
test('manual close wins over a pending automatic reveal and retains manual settlement',async()=>{
 const h=host();await update(ref(h,'room/public/state'),{status:'closed'});
 assert.equal((await runTransaction(ref(h,'room'),r=>autoRevealRound(r,expected,expected.deadline+1,serverTimestamp()),options)).committed,false);
 assert.equal((await get(ref(h,'room/public/results'))).exists(),false);
 await runTransaction(ref(h,'room'),r=>r?settleRoom(r,1,'AUTO01',serverTimestamp()):null,options);
 assert.equal((await get(ref(h,'room/public/state/status'))).val(),'revealed');
});
test('expired rounds recover on a fresh host connection without waiting for missing answers',async()=>{
 await env.withSecurityRulesDisabled(c=>update(ref(c.database(),'room/public/state'),{deadline:Date.now()-1000}));
 const h=host();const seen=[];
 const result=await runTransaction(ref(h,'room'),r=>{seen.push(r);return autoRevealRound(r,expected,Date.now(),serverTimestamp());},options);
 assert.equal(seen[0],null);assert.equal(result.committed,true);
 assert.equal(result.snapshot.val().public.results[1].total,1);
});

test('one edit only: duplicates, reset counters, deletion, consent and target edits are rejected',async()=>{
 const b=env.authenticatedContext('b').database(),a=env.authenticatedContext('a').database(),h=host();
 const path=ref(b,'room/answers/1/b'),payload={choice:2,prediction:1,attempt:expected.attempt,revision:0,at:serverTimestamp()};
 await set(path,payload);
 await assertFails(set(path,payload));
 await assertFails(set(path,{...payload,revision:1})); // no-op must not spend a revision
 await set(path,{...payload,choice:3,revision:1});
 await assertFails(set(path,{...payload,choice:0,revision:2}));
 await assertFails(set(path,{...payload,choice:0,revision:0}));
 await assertFails(set(path,null));
 await assertFails(set(ref(a,'room/answers/1/a'),{...payload,prediction:-1,revision:1}));
 await runTransaction(ref(h,'room'),r=>autoRevealRound(r,expected,Date.now()),options);
 const vote={code:expected.code,round:1,attempt:expected.attempt,at:serverTimestamp()};
 await assertFails(set(ref(b,'room/public/earlyClose/votes/a'),vote));
 await assertFails(set(ref(b,'room/public/earlyClose/ready'),false));
 await set(ref(b,'room/public/earlyClose/votes/b'),vote);
 await assertFails(set(ref(b,'room/public/earlyClose/votes/b'),vote));
 await assertFails(set(ref(b,'room/public/earlyClose/votes/b'),null));
});

test('ten independent clients: every consent required, edits lock on consent, retries score once',async()=>{
 const ids=['a','b',...Array.from({length:8},(_,i)=>'p'+i)],h=host();
 await env.withSecurityRulesDisabled(async c=>{
  const members=Object.fromEntries(ids.map((id,i)=>[id,{name:id,seat:String(i),joined:i+1}]));
  await set(ref(c.database(),'room/public/members'),members);
 });
 const clients=ids.map(id=>({id,db:env.authenticatedContext(id).database()}));
 const auto=async()=>{await get(ref(h,'room'));return runTransaction(ref(h,'room'),r=>autoRevealRound(r,expected,Date.now(),serverTimestamp()),options);};
 await assertFails(set(ref(clients[1].db,'room/public/earlyClose/votes/b'),{code:expected.code,round:1,attempt:expected.attempt,at:serverTimestamp()}));
 await Promise.all(clients.slice(1).map(c=>set(ref(c.db,'room/answers/1/'+c.id),{choice:2,prediction:1,attempt:expected.attempt,revision:0,at:serverTimestamp()})));
 await auto();assert.equal((await get(ref(h,'room/public/state/status'))).val(),'open');
 const consent=c=>set(ref(c.db,'room/public/earlyClose/votes/'+c.id),{code:expected.code,round:1,attempt:expected.attempt,at:serverTimestamp()});
 await Promise.all(clients.slice(0,9).map(consent));
 await assertFails(set(ref(clients[1].db,'room/answers/1/b'),{choice:3,prediction:1,attempt:expected.attempt,revision:1,at:serverTimestamp()}));
 assert.equal((await auto()).committed,false);
 await consent(clients[9]);await auto();await auto();
 const publicResults=await Promise.all(clients.map(c=>get(ref(c.db,'room/public/results/1'))));
 for(const result of publicResults){assert.equal(result.val().total,10);assert.equal(result.val().points.b,1);}
 assert.equal((await get(ref(h,'room/hostOnly/spotlight/players/a/turns'))).val(),1);
 for(const c of [clients[1].db,env.unauthenticatedContext().database()])await assertFails(get(ref(c,'room/answers/1/a')));
});

test('offline edit and consent cannot arrive after the deadline; stale round vote denied',async()=>{
 const b=env.authenticatedContext('b').database(),h=host(),path=ref(b,'room/answers/1/b');
 const answer={choice:2,prediction:1,attempt:expected.attempt,revision:0,at:serverTimestamp()};
 await set(path,answer);await runTransaction(ref(h,'room'),r=>autoRevealRound(r,expected,Date.now()),options);
 await assertFails(set(ref(b,'room/public/earlyClose/votes/b'),{code:'OTHER1',round:1,attempt:expected.attempt,at:serverTimestamp()}));
 goOffline(b);
 const edit=assertFails(set(path,{...answer,choice:3,revision:1}));
 const vote=assertFails(set(ref(b,'room/public/earlyClose/votes/b'),{code:expected.code,round:1,attempt:expected.attempt,at:serverTimestamp()}));
 await update(ref(h,'room/public/state'),{deadline:Date.now()-1000});goOnline(b);await Promise.all([edit,vote]);
 assert.equal((await get(ref(h,'room/answers/1/b/revision'))).val(),0);
});
