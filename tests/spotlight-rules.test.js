import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,set,get,update,serverTimestamp,runTransaction,onValue,goOffline,goOnline} from 'firebase/database';
import {newRoom,startRound,settleRoom} from '../src/game.js';
import {questions} from '../src/questions.js';
import {activateGuesses,skipTarget} from '../src/spotlight.js';
import {endRoom} from '../src/end-room.js';
let env;
const db=(id,provider='anonymous')=>env.authenticatedContext(id,{firebase:{sign_in_provider:provider}}).database();
const host=()=>db('host','password');
const join=(d,id,seat)=>update(ref(d,'room/public'),{[`members/${id}`]:{name:id,code:'GUESS1',seat:String(seat),joined:serverTimestamp()},[`seats/${seat}`]:id});
const submit=(d,id,round,choice,prediction)=>set(ref(d,`room/answers/${round}/${id}`),{choice,prediction,at:serverTimestamp()});
const start=async(h,q=questions[0])=>runTransaction(ref(h,'room'),r=>{if(!r)return null;r.public.state=startRound(r,q,Date.now(),45);return r;},{applyLocally:false});
const reveal=async(h,round)=>{await update(ref(h,'room/public/state'),{status:'closed'});return runTransaction(ref(h,'room'),r=>r?settleRoom(r,round,'GUESS1',serverTimestamp()):null,{applyLocally:false});};
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-spotlight',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{config:{hostUid:'host'},room:(()=>{const r=newRoom('GUESS1');r.public.state.answerFlow='simultaneous-v1';return r;})()}));});

test('ending a room retries an empty host cache, preserves records and is idempotent',async()=>{
 const h=host();
 const cached=[];
 const result=await runTransaction(ref(h,'room'),r=>{cached.push(r);return endRoom(r,'GUESS1');},{applyLocally:false});
 assert.equal(cached[0],null);assert.ok(cached.length>=2);assert.equal(result.committed,true);
 const ended=result.snapshot.val();assert.equal(ended.public.state.status,'ended');assert.equal(ended.public.state.locked,true);assert.equal(ended.public.state.chatOpen,false);
 const repeated=await runTransaction(ref(h,'room'),r=>endRoom(r,'GUESS1'),{applyLocally:false});assert.deepEqual(repeated.snapshot.val(),ended);
 const stale=await runTransaction(ref(h,'room'),r=>endRoom(r,'OTHER1'),{applyLocally:false});assert.equal(stale.committed,false);assert.deepEqual((await get(ref(h,'room'))).val(),ended);
 await assertFails(runTransaction(ref(db('viewer'),'room'),r=>endRoom(r,'GUESS1'),{applyLocally:false}));
});
test('10 independent clients complete 30 rounds, identical broadcasts, no early disclosure or movement and idempotent awards',async()=>{
 const h=host(),clients=Array.from({length:10},(_,i)=>({id:`p${i}`,db:db(`p${i}`)}));
 // Sequential joins define the exact admission order; answers are concurrent.
 for(let i=0;i<10;i++)await join(clients[i].db,clients[i].id,i);
 const display=env.unauthenticatedContext().database();
 for(let round=1;round<=30;round++){
  await start(h,questions[round-1]);const state=(await get(ref(h,'room/public/state'))).val();assert.equal(state.targetUid,`p${(round-1)%10}`);
  const island=(await get(ref(display,'room/public/island'))).val();
  await Promise.all(clients.map((c,i)=>submit(c.db,c.id,round,i%4,c.id===state.targetUid?-1:((round-1)%10)%4)));
  // Overwrite rather than duplicate, with a target who cannot score a self-guess.
  await submit(clients[(round-1)%10].db,state.targetUid,round,((round-1)%10)%4,-1);
  assert.equal((await get(ref(display,`room/public/results/${round}`))).exists(),false);assert.deepEqual((await get(ref(display,'room/public/island'))).val(),island);
  await reveal(h,round);const expected=(await get(ref(h,'room'))).val();await Promise.all([reveal(h,round),reveal(h,round)]);assert.deepEqual((await get(ref(h,'room'))).val(),expected);
  for(const c of clients)assert.deepEqual((await get(ref(c.db,`room/public/results/${round}`))).val(),expected.public.results[round]);
 }
 const p=(await get(ref(display,'room/public'))).val();assert.equal(p.state.completed,true);assert.equal(p.awards.title,'心水清大師');assert.equal(p.awards.score,27);assert.equal(Object.keys(p.awards.winners).length,10);
 const hidden=(await get(ref(h,'room/hostOnly/spotlight'))).val();for(const score of Object.values(hidden.players)){assert.equal(score.turns,3);assert.equal(score.guessed,27);assert.equal(score.unguessed,0);}
 goOffline(clients[0].db);goOnline(clients[0].db);assert.deepEqual((await get(ref(clients[0].db,'room/public/awards'))).val(),p.awards);
});
test('own answers only before reveal; target answers omit self-guess, score/rotation/settings and hidden counters cannot be forged or read',async()=>{
 const h=host(),a=db('a'),b=db('b'),display=env.unauthenticatedContext().database();await join(a,'a',0);await join(b,'b',1);await start(h);
 await assertSucceeds(submit(a,'a',1,2,-1));await assertSucceeds(submit(b,'b',1,1,2));await assertFails(submit(a,'a',1,2,2));await assertFails(submit(b,'b',1,1,-1));
 await assertSucceeds(get(ref(a,'room/answers/1/a')));for(const client of [b,display])await assertFails(get(ref(client,'room/answers/1/a')));
 for(const c of [a,b,display]){
  for(const path of ['room/hostOnly','room/hostOnly/spotlight','room/hostOnly/spotlight/players/a','room/hostOnly/affinity'])await assertFails(get(ref(c,path)));
  for(const path of ['room/public/state/targetUid','room/public/state/questionsPerCycle','room/public/rotation','room/public/results/1','room/public/awards','room/public/island','room/hostOnly/spotlight'])await assertFails(set(ref(c,path),{forged:true}));
 }
 await reveal(h,1);assert.equal((await get(ref(display,'room/public/results/1/targetChoice'))).val(),2);await assertFails(get(ref(b,'room/answers/1/a/prediction')));assert.equal((await get(ref(h,'room/hostOnly/spotlight/players/a/guessed'))).val(),1);
});
test('deadline, queued offline writes, stale rounds and removed members are rejected; reconnect restores server-confirmed choice',async()=>{
 const h=host(),a=db('a'),b=db('b');await join(a,'a',0);await join(b,'b',1);await start(h);await submit(a,'a',1,1,-1);await submit(b,'b',1,2,1);
 goOffline(b);const queued=submit(b,'b',1,0,1);const denied=assertFails(queued);await update(ref(h,'room/public/state'),{deadline:Date.now()-1000});goOnline(b);await denied;assert.equal((await get(ref(b,'room/answers/1/b'))).val().choice,2);
 await assertFails(submit(a,'a',1,0,-1));await reveal(h,1);await start(h);await assertFails(submit(b,'b',1,2,1));
 await update(ref(h,'room'),{'moderation/b/removed':true,'public/members/b':null,'public/seats/1':null});await assertFails(submit(b,'b',2,2,-1));
});


test('target-first rules lock target, reject early guesses and stale skipped writes, then synchronize 10 clients',async()=>{
 const h=host();await set(ref(h,'room/public/state/answerFlow'),'target-first-v1');
 const clients=Array.from({length:10},(_,i)=>({id:`f${i}`,db:db(`f${i}`)}));for(let i=0;i<10;i++)await join(clients[i].db,clients[i].id,i);
 const display=env.unauthenticatedContext().database();
 await start(h);const first=(await get(ref(h,'room/public/state'))).val();assert.equal(first.status,'thinking');assert.equal(first.deadline,0);
 const answer=(c,s,choice,prediction)=>set(ref(c.db,`room/answers/${s.round}/${c.id}`),{choice,prediction,attempt:s.attempt,at:serverTimestamp()});
 await assertFails(answer(clients[1],first,1,1));await assertFails(update(ref(clients[1].db,'room/public/state'),{status:'open',deadline:Date.now()+45000}));
 const skipped=await runTransaction(ref(h,'room'),r=>skipTarget(r,first),{applyLocally:false});assert.equal(skipped.committed,true);const s=skipped.snapshot.val().public.state;assert.equal(s.round,1);assert.equal(s.targetUid,'f1');assert.equal(skipped.snapshot.val().public.results,undefined);
 await assertFails(answer(clients[0],first,1,-1));await assertFails(answer(clients[1],first,1,-1));
 await assertSucceeds(answer(clients[1],s,1,-1));await assertFails(answer(clients[1],s,2,-1));await assertFails(set(ref(clients[1].db,'room/answers/1/f1'),null));
 const skipAfterAnswer=await runTransaction(ref(h,'room'),r=>skipTarget(r,s),{applyLocally:false});assert.equal(skipAfterAnswer.committed,false);
 for(const c of [clients[0].db,display])await assertFails(get(ref(c,'room/answers/1/f1')));
 const opened=await runTransaction(ref(h,'room'),r=>activateGuesses(r,s,Date.now()),{applyLocally:false});assert.equal(opened.committed,true);const deadline=opened.snapshot.val().public.state.deadline;assert.ok(deadline>Date.now()+40000);
 const retry=await runTransaction(ref(h,'room'),r=>activateGuesses(r,s,Date.now()),{applyLocally:false});assert.equal(retry.committed,false);assert.equal((await get(ref(h,'room/public/state/deadline'))).val(),deadline);
 await assertFails(answer(clients[1],s,2,-1));await Promise.all(clients.filter(c=>c.id!=='f1').map(c=>answer(c,s,2,1)));
 await reveal(h,1);const result=(await get(ref(h,'room/public/results/1'))).val();assert.equal(result.targetChoice,1);assert.equal(result.points.f1,0);assert.equal(Object.values(result.points).reduce((a,b)=>a+b,0),9);
 for(const c of clients)assert.deepEqual((await get(ref(c.db,'room/public/results/1'))).val(),result);
 assert.equal(typeof result.revealedAt,'number');assert.ok(Math.abs(result.revealedAt-Date.now())<5000);
 assert.deepEqual((await get(ref(display,'room/public/results/1'))).val(),result);
 await Promise.all([reveal(h,1),reveal(h,1)]);assert.deepEqual((await get(ref(display,'room/public/results/1'))).val(),result);
 await assertFails(set(ref(clients[0].db,'room/public/results/1/revealedAt'),serverTimestamp()));
 await start(h);const next=(await get(ref(h,'room/public/state'))).val();assert.equal(next.round,2);assert.equal(next.targetUid,'f2');assert.equal(next.status,'thinking');
 await assertFails(answer(clients[1],s,1,-1));
});


test('target-first skip versus submission is atomic; stale offline target cannot answer after being skipped',async()=>{
 const h=host(),a=db('a'),b=db('b');await set(ref(h,'room/public/state/answerFlow'),'target-first-v1');await join(a,'a',0);await join(b,'b',1);await start(h);
 const s=(await get(ref(h,'room/public/state'))).val();
 // Cache the target's permitted own path before going offline, then queue a submission.
 await get(ref(a,'room/answers/1/a'));goOffline(a);
 const queued=set(ref(a,'room/answers/1/a'),{choice:0,prediction:-1,attempt:s.attempt,at:serverTimestamp()});const rejected=assertFails(queued);
 const skipped=await runTransaction(ref(h,'room'),r=>skipTarget(r,s),{applyLocally:false});assert.equal(skipped.committed,true);goOnline(a);await rejected;
 const next=(await get(ref(h,'room/public/state'))).val();assert.equal(next.targetUid,'b');assert.equal(next.round,1);
 const outcomes=await Promise.allSettled([
  set(ref(b,'room/answers/1/b'),{choice:2,prediction:-1,attempt:next.attempt,at:serverTimestamp()}),
  runTransaction(ref(h,'room'),r=>skipTarget(r,next),{applyLocally:false})
 ]);
 const room=(await get(ref(h,'room'))).val();
 if(room.answers?.[1]?.b){assert.equal(outcomes[0].status,'fulfilled');assert.equal(room.public.state.targetUid,'b');assert.equal(outcomes[1].value.committed,false);}
 else{assert.equal(outcomes[0].status,'rejected');assert.equal(outcomes[1].value.committed,true);assert.equal(room.public.state.targetUid,'a');}
 assert.equal(room.public.state.round,1);assert.equal(room.public.results,undefined);
});
