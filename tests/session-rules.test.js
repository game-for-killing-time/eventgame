import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,update,serverTimestamp} from 'firebase/database';
import {sessionBackend} from '../src/session-backend.js';
import {broadcastPath} from '../src/broadcast-model.js';
let env;
const client=(uid,provider='anonymous')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).database();
const host=()=>client('host','password');
const read=async(db,path)=>(await get(ref(db,path))).val();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-hoho',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{config:{hostUid:'host'}}));});

test('real atomic switch preserves 20 player identities, owner-only inboxes and one room code under current deployed rules',async()=>{
 const db=host(),session=sessionBackend(db.app,undefined,db);await session.ensure('classic');await session.create('classic');
 const code=(await read(db,broadcastPath)).code;
 const players=Array.from({length:20},(_,i)=>({id:'p'+i,db:client('p'+i)}));
 for(const [i,p]of players.entries())await update(ref(p.db,'room/public'),{['members/'+p.id]:{name:'玩家'+i,seat:String(i),code,joined:serverTimestamp()},['seats/'+i]:p.id});
 await session.switch('voyage');
 const v=await read(db,'voyage/public');assert.equal(v.code,code);assert.equal(Object.keys(v.players).length,20);
 for(const p of players){assert.equal((await read(p.db,'voyage/roster/'+p.id)).game,v.id);assert.equal((await read(p.db,'voyage/inbox/'+p.id)).game,v.id);}
 await assertFails(get(ref(players[1].db,'voyage/inbox/p0')));
 await assertFails(set(ref(players[0].db,broadcastPath),{mode:'classic'}));
 await assertFails(set(ref(players[0].db,'room/answers/1/p0'),{choice:0,prediction:1,at:serverTimestamp()}));
 await session.switch('classic');assert.equal((await read(db,broadcastPath)).code,code);
 assert.equal(Object.keys(await read(db,'room/public/members')).length,20);
 await assertFails(update(ref(client('late'),'voyage'),{'roster/late':{name:'晚到',seat:'0',game:v.id,at:serverTimestamp()},'seats/0':'late'}));
});
test('simultaneous host switches are serialized and cannot leave mismatched codes or active modes',async()=>{
 const db=host(),a=sessionBackend(db.app,undefined,db),b=sessionBackend(db.app,undefined,db);await a.create('classic');
 const results=await Promise.allSettled([a.switch('voyage'),b.switch('classic')]);
 assert.ok(results.some(x=>x.status==='fulfilled'));
 const s=await read(db,broadcastPath),r=await read(db,'room'),v=await read(db,'voyage');
 assert.equal(r.public.state.code,v.code);assert.equal(s.lease,undefined);
 assert.equal(r.sessionActive,s.mode==='classic');assert.equal(v.sessionActive,s.mode==='voyage');
});
test('end and clean affect the whole session; a new game receives a fresh code and no old members',async()=>{
 const db=host(),s=sessionBackend(db.app,undefined,db);await s.create('voyage');const old=(await read(db,broadcastPath)).code;
 await assert.rejects(s.create('classic'),/已有房間/);await assert.rejects(s.clean('voyage'),/先結束/);
 await s.end('voyage');assert.equal((await read(db,'room/public/state')).status,'ended');assert.equal((await read(db,'voyage/public')).phase,'ended');
 await assert.rejects(s.switch('classic'),/清理/);await s.clean('voyage');assert.equal(await read(db,'voyage'),null);
 await s.create('classic');const next=await read(db,broadcastPath);assert.notEqual(next.code,old);assert.equal(next.mode,'classic');assert.equal(await read(db,'room/public/members'),null);
});
test('an interrupted switch is recoverable after its lease expires without losing the roster',async()=>{
 const db=host(),s=sessionBackend(db.app,undefined,db);await s.create('classic');const code=(await read(db,broadcastPath)).code;
 await update(ref(db,broadcastPath),{lease:{token:'lost-connection',until:1,target:'voyage'}});
 await s.ensure('classic');assert.equal((await read(db,broadcastPath)).mode,'voyage');assert.equal((await read(db,'voyage/public')).code,code);
});
