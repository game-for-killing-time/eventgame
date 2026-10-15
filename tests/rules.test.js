import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,set,get,update,query,orderByChild,limitToLast,onValue,goOffline,goOnline,serverTimestamp,runTransaction} from 'firebase/database';
import {newRoom,startRound,settleRoom} from '../src/game.js';
import {relayEffects} from '../src/effects.js';
import {questions} from '../src/questions.js';
let env;
const db=(uid,provider='anonymous')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database();
const host=()=>db('host','password');
const seed=async fn=>env.withSecurityRulesDisabled(async c=>fn(c.database()));
const member=async(uid)=>seed(async d=>{const seats=(await get(ref(d,'room/public/seats'))).val()||{};const seat=String(Array.from({length:20},(_,i)=>i).find(i=>!seats[i]));await update(ref(d,'room/public'),{[`members/${uid}`]:{name:uid,joined:1,code:'PARTY1',seat},[`seats/${seat}`]:uid});});
const join=(d,uid,seat='0',code='PARTY1')=>update(ref(d,'room/public'),{[`members/${uid}`]:{name:uid,code,seat,joined:serverTimestamp()},[`seats/${seat}`]:uid});
const submit=(d,uid,choice=0,prediction=0,round=1)=>set(ref(d,`room/answers/${round}/${uid}`),{choice,prediction,at:serverTimestamp()});
const chat=(d,uid,text='hello',seq=1)=>update(ref(d,`room/chat/${uid}`),{seq,lastSent:serverTimestamp(),[`messages/${seq}`]:{text,at:serverTimestamp()}});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-hoho',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearDatabase();await seed(async d=>{const r=newRoom('PARTY1','legacy');r.public.state=startRound(r,questions[0],Date.now(),120);await set(ref(d),{config:{hostUid:'host'},room:r});});});
test('10 independent clients join, synchronize, submit, overwrite and score once',async()=>{
 const clients=Array.from({length:10},(_,i)=>({id:`p${i}`,db:db(`p${i}`)}));
 await Promise.all(clients.map((c,i)=>assertSucceeds(join(c.db,c.id,String(i)))));
 assert.equal((await get(ref(host(),'room/public/members'))).size,10);
 await Promise.all(clients.map((c,i)=>submit(c.db,c.id,i%4,0)));
 await Promise.all(clients.map(c=>submit(c.db,c.id,0,0)));
 const h=host();await update(ref(h,'room/public/state'),{status:'closed'});
 const answers=(await get(ref(h,'room/answers/1'))).val();assert.equal(Object.keys(answers).length,10);
 const settle=()=>runTransaction(ref(h,'room/public'),p=>p?settleRoom({public:p,answers:{1:answers}},1)?.public:null,{applyLocally:false});
 await settle();await settle();
 await Promise.all(clients.map(c=>new Promise((resolve,reject)=>{let stop=()=>{};const timer=setTimeout(()=>{stop();reject(Error('sync timeout'));},5000);stop=onValue(ref(c.db,'room/public/results/1'),s=>{if(s.val()){assert.equal(s.val().total,10);assert.equal(s.val().points[c.id],1);clearTimeout(timer);queueMicrotask(stop);resolve();}},reject);})));
});
test('private answers, stories and control data denied to other viewer and unauthenticated display',async()=>{
 await member('a');await member('b');await submit(db('a'),'a');const b=db('b'),display=env.unauthenticatedContext().database();
 for(const client of [b,display])for(const path of ['room','room/answers','room/answers/1/a','room/stories','room/moderation'])await assertFails(get(ref(client,path)));
 await assertSucceeds(get(ref(db('a'),'room/answers/1/a')));await assertSucceeds(get(ref(display,'room/public')));
});
test('viewer cannot change state, points, roles, other answers or publish a story',async()=>{
 await member('a');const d=db('a');for(const path of ['config/hostUid','room/public/state','room/public/results/1','room/public/story','room/moderation/a','room/answers/1/b'])await assertFails(set(ref(d,path),'hacked'));
 await assertFails(set(ref(db('host'),'room/public/state/status'),'ended'));
});
test('deadline, wrong round, invalid values, removed identity and post-reveal writes rejected',async()=>{
 await member('a');const a=db('a');await assertFails(submit(a,'a',4));await assertFails(submit(a,'a',0,0,0));
 await seed(d=>set(ref(d,'room/public/state/deadline'),Date.now()-1));await assertFails(submit(a,'a'));
 await seed(d=>update(ref(d,'room/public/state'),{deadline:Date.now()+60000,status:'revealed'}));await assertFails(submit(a,'a'));
 await seed(d=>{return update(ref(d,'room'),{'public/state/status':'open','moderation/a/removed':true});});await assertFails(submit(a,'a'));
});
test('offline queued write arriving after deadline is rejected and no answer survives',async()=>{
 await member('a');const a=db('a');await get(ref(a,'room/public/state'));goOffline(a);const queued=submit(a,'a');const rejection=assertFails(queued);
 await seed(d=>set(ref(d,'room/public/state/deadline'),Date.now()-100));goOnline(a);await rejection;assert.equal((await get(ref(host(),'room/answers/1/a'))).exists(),false);
});
test('chat cooldown, length, append integrity, history limits, mute and remove',async()=>{
 await member('a');const a=db('a');await assertSucceeds(chat(a,'a'));await assertFails(chat(a,'a','fast',2));
 await assertFails(get(ref(a,'room/chat/a/messages')));await assertSucceeds(get(query(ref(a,'room/chat/a/messages'),orderByChild('at'),limitToLast(3))));
 await seed(d=>set(ref(d,'room/chat/a/lastSent'),1));await assertFails(chat(a,'a','x'.repeat(241),2));
 await assertFails(set(ref(a,'room/chat/a/messages/2'),{text:'bypass',at:serverTimestamp()}));
 await seed(d=>set(ref(d,'room/moderation/a/muted'),true));await assertFails(chat(a,'a','muted',2));
 await assertSucceeds(set(ref(host(),'room/chat/a/messages/1'),null));
 await seed(d=>update(ref(d,'room'),{'moderation/a/removed':true,'public/members/a':null}));
 await assertFails(set(ref(a,'room/public/members/a'),{name:'again',code:'PARTY1',joined:serverTimestamp()}));
});
test('stories remain private until host selects; muted identity cannot post',async()=>{
 await member('a');await member('b');await seed(d=>set(ref(d,'room/public/state/status'),'revealed'));
 const a=db('a');await assertSucceeds(set(ref(a,'room/stories/1/a'),{text:'private story',at:serverTimestamp()}));
 await assertFails(get(ref(db('b'),'room/stories/1/a')));await assertFails(set(ref(a,'room/stories/1/a'),{text:'x'.repeat(501),at:serverTimestamp()}));
 const display=env.unauthenticatedContext().database();assert.equal((await get(ref(display,'room/public/story'))).exists(),false);
 await set(ref(host(),'room/public/story'),{name:'a',text:'private story',round:1});assert.equal((await get(ref(display,'room/public/story/text'))).val(),'private story');
 await seed(d=>set(ref(d,'room/moderation/a/muted'),true));await assertFails(set(ref(a,'room/stories/1/a'),{text:'muted',at:serverTimestamp()}));
});
test('20-seat capacity, room code, lock and late join; ended room rejects chats',async()=>{
 const a=db('a');await assertFails(join(a,'a','0','WRONG1'));
 await set(ref(host(),'room/public/state/locked'),true);await assertFails(join(a,'a'));
 await set(ref(host(),'room/public/state/locked'),false);await assertSucceeds(join(a,'a'));await assertSucceeds(submit(a,'a'));
 for(let i=0;i<19;i++)await member(`seat${i}`);await assertFails(join(db('overflow'),'overflow','20'));await assertFails(join(db('overflow'),'overflow','0'));
 await set(ref(host(),'room/public/state/status'),'ended');await assertFails(chat(a,'a'));
});
test('seat and membership must be created atomically and cannot be hijacked',async()=>{
 const a=db('a'),b=db('b');await assertFails(set(ref(a,'room/public/seats/0'),'a'));await assertSucceeds(join(a,'a'));
 await assertFails(join(b,'b','0'));await assertFails(join(a,'a','1'));
 await assertFails(update(ref(b,'room/public'),{'members/b':{name:'b',code:'PARTY1',seat:'1',joined:serverTimestamp()},'seats/2':'b'}));
});
test('reconnected identity restores submitted answer; late member cannot answer closed round',async()=>{
 await member('a');const a=db('a');await submit(a,'a',2,1);goOffline(a);await set(ref(host(),'room/public/state/status'),'closed');goOnline(a);
 assert.equal((await get(ref(a,'room/answers/1/a'))).val().choice,2);
 const late=db('late');await assertSucceeds(join(late,'late','1'));await assertFails(submit(late,'late'));
});
test('closed chat, old-message edits, unbounded query and batch cooldown bypass denied',async()=>{
 await member('a');const a=db('a');await chat(a,'a');await assertFails(set(ref(a,'room/chat/a/messages/1'),{text:'edit',at:serverTimestamp()}));
 await assertFails(get(query(ref(a,'room/chat/a/messages'),orderByChild('at'))));
 await seed(d=>set(ref(d,'room/chat/a/lastSent'),1));await assertFails(update(ref(a,'room/chat/a'),{seq:2,lastSent:serverTimestamp(),'messages/2':{text:'one',at:serverTimestamp()},'messages/3':{text:'two',at:serverTimestamp()}}));
 await set(ref(host(),'room/public/state/chatOpen'),false);await assertFails(chat(a,'a','closed',2));
});
test('zero-answer round can be published repeatedly without awarding points',async()=>{
 const h=host();await set(ref(h,'room/public/state/status'),'closed');const publish=()=>runTransaction(ref(h,'room/public'),p=>p?settleRoom({public:p,answers:{}},1)?.public:null,{applyLocally:false});await publish();await publish();
 const r=(await get(ref(h,'room/public/results/1'))).val();assert.equal(r.total,0);assert.equal(r.points??null,null);
});

test('10 clients see only revealed island positions; private affinity denied, reconnect and root settlement retries safe',async()=>{
 const clients=Array.from({length:10},(_,i)=>({id:`islander${i}`,db:db(`islander${i}`)}));const h=host();
 await Promise.all(clients.map((c,i)=>join(c.db,c.id,String(i))));
 const reveal=async round=>{await update(ref(h,'room/public/state'),{status:'closed'});await runTransaction(ref(h,'room'),r=>r?settleRoom(r,round,'PARTY1'):null,{applyLocally:false});};
 for(let round=1;round<=2;round++){
  if(round===2)await update(ref(h,'room/public/state'),{round,status:'open',deadline:Date.now()+60000});
  const old=(await get(ref(h,'room/public/island'))).val();
  await Promise.all(clients.map((c,i)=>submit(c.db,c.id,i<5?0:1,0,round)));
  for(const c of clients)assert.deepEqual((await get(ref(c.db,'room/public/island'))).val(),old);
  await reveal(round);
 }
 const expected=(await get(ref(h,'room/public/island'))).val();
 const privateBefore=(await get(ref(h,'room/hostOnly/affinity'))).val();
 assert.deepEqual(privateBefore.pairs.islander0.islander1,{shared:2,same:2});
 await Promise.all([reveal(2),reveal(2)]);assert.deepEqual((await get(ref(h,'room/hostOnly/affinity'))).val(),privateBefore);
 await Promise.all(clients.map(c=>new Promise((resolve,reject)=>{let stop=()=>{};const timeout=setTimeout(()=>{stop();reject(Error('island sync timeout'));},5000);stop=onValue(ref(c.db,'room/public/island'),s=>{if(s.val()?.round===2){try{assert.deepEqual(s.val(),expected);clearTimeout(timeout);queueMicrotask(stop);resolve();}catch(e){reject(e);}}},reject);})));
 for(const client of [clients[0].db,clients[1].db,env.unauthenticatedContext().database()]){
  for(const path of ['room/hostOnly','room/hostOnly/affinity','room/hostOnly/affinity/pairs/islander0/islander1'])await assertFails(get(ref(client,path)));
  for(const path of ['room/hostOnly/affinity','room/public/island','room/public/results/2'])await assertFails(set(ref(client,path),{hacked:true}));
 }
 assert.deepEqual(Object.keys(expected).sort(),['positions','round','version','width']);
 goOffline(clients[0].db);goOnline(clients[0].db);assert.deepEqual((await get(ref(clients[0].db,'room/public/island'))).val(),expected);
 await update(ref(h,'room'),{'public/members/islander0':null,'public/seats/0':null,'public/island/positions/islander0':null,'moderation/islander0/removed':true});
 assert.equal((await get(ref(clients[1].db,'room/public/island/positions/islander0'))).exists(),false);
});

test('public effects are host-only writes, switch-gated reads, no private answer access',async()=>{
 await member('a');const h=host(),a=db('a'),display=env.unauthenticatedContext().database();
 await submit(a,'a',2,3);await chat(a,'a','hello');
 await assertFails(set(ref(a,'room/effects/chat/a'),{seq:1,text:'fake',at:Date.now()}));
 await assertFails(set(ref(a,'room/public/state/chatEffects'),false));
 await assertSucceeds(set(ref(h,'room/effects'),{chat:{a:{seq:1,text:'hello',at:Date.now()}},submissions:{round:1,items:{a:Date.now()}}}));
 for(const client of [a,display]){assert.equal((await assertSucceeds(get(ref(client,'room/effects/chat/a/text')))).val(),'hello');await assertSucceeds(get(ref(client,'room/effects/submissions')));await assertFails(get(ref(client,'room/answers/1')));await assertFails(get(ref(client,'room/hostOnly')));await assertFails(get(ref(client,'room/effects')));}
 await set(ref(h,'room/public/state/chatEffects'),false);await assertFails(get(ref(display,'room/effects/chat')));await assertSucceeds(get(ref(display,'room/effects/submissions')));
 await set(ref(h,'room/public/state/submitEffects'),false);await assertFails(get(ref(display,'room/effects/submissions')));
 await update(ref(h,'room/public/state'),{chatEffects:true,submitEffects:true,status:'ended'});await assertFails(get(ref(display,'room/effects/chat')));await assertFails(get(ref(display,'room/effects/submissions')));
});

test('only revealed personal choices become public, predictions stay private',async()=>{
 await member('a');await member('b');const a=db('a'),b=db('b'),h=host(),display=env.unauthenticatedContext().database();
 await submit(a,'a',2,1);await submit(b,'b',0,3);
 for(const c of [b,display]){assert.equal((await get(ref(c,'room/public/results/1/choices'))).exists(),false);await assertFails(get(ref(c,'room/answers/1/a')));}
 await update(ref(h,'room/public/state'),{status:'closed'});await runTransaction(ref(h,'room'),r=>r?settleRoom(r,1,'PARTY1'):null,{applyLocally:false});
 for(const c of [b,display]){assert.deepEqual((await get(ref(c,'room/public/results/1/choices'))).val(),{a:2,b:0});await assertFails(get(ref(c,'room/answers/1/a/prediction')));await assertFails(set(ref(c,'room/public/results/1/choices/a'),1));}
});


test('host relay transactions deliver chat and first submission to independent clients',async()=>{
 await member('a');const a=db('a'),h=host(),display=env.unauthenticatedContext().database();
 await submit(a,'a',2,1);await chat(a,'a','new message');
 const relay=kind=>runTransaction(ref(h,'room'),r=>r?relayEffects(r,{code:'PARTY1',kind,round:1,uid:'a',seq:1},Date.now()):null,{applyLocally:false});
 await relay('submissions');await relay('chat');
 const expected=(await get(ref(display,'room/effects/submissions'))).val();
 assert.deepEqual(Object.keys(expected.items),['a']);
 for(const c of [a,display])assert.equal((await get(ref(c,'room/effects/chat/a/text'))).val(),'new message');
 await submit(a,'a',0,3);await relay('submissions');assert.deepEqual((await get(ref(display,'room/effects/submissions'))).val(),expected);
 await assertFails(set(ref(a,'room/effects/submissions/items/a'),0));
});
