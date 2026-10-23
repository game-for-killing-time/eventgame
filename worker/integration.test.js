import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {generateKeyPair,SignJWT,exportJWK,createLocalJWKSet} from 'jose';
import {verifyIdentity} from './auth.js';

test('Firebase token signatures, audience and expiry are verified',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';const keys=createLocalJWKSet({keys:[jwk]});
 const token=await new SignJWT({auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'anonymous'}}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('player').setIssuedAt().setExpirationTime('1h').setIssuer('https://securetoken.google.com/demo').setAudience('demo').sign(privateKey);
 assert.deepEqual(await verifyIdentity(token,'demo',Date.now(),keys),{uid:'player',provider:'anonymous'});
 await assert.rejects(verifyIdentity(token,'wrong',Date.now(),keys));await assert.rejects(verifyIdentity(token,'demo',Date.now()+7200000,keys));await assert.rejects(verifyIdentity(token+'x','demo',Date.now(),keys));
});
test('SQLite Durable Object: concurrent joins, role privacy, kill/vote/counterkill/timeout and alarms',async()=>{
 const bundled=await build({entryPoints:['worker/test-room.js'],bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers']});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-23',durableObjects:{GAME:{className:'TestRoom',useSQLite:true}}}));
 let state;
 async function call(uid,action,props={}){const response=await mf.dispatchFetch('http://local',{method:'POST',body:JSON.stringify({actor:{uid,host:uid==='host',hostAccount:uid==='host'},data:{game:state?.public?.id,round:state?.public?.round,revision:state?.public?.revision,action,...props}})});const result=await response.json();assert.equal(result.error,undefined);state=result;return result;}
 try{
  await call('host','create');let code=state.public.code;
  await Promise.all(Array.from({length:5},(_,i)=>call('p'+i,'join',{code,name:'玩家'+i})));
  await call('host','start',{minutes:20});assert.equal(state.private,null);assert.equal(state.public.wolf,null);
  const roles=await Promise.all(Array.from({length:5},(_,i)=>call('p'+i,'sync')));const wolf='p'+roles.findIndex(r=>r.private.role==='wolf');assert.equal(roles.filter(r=>r.private.role==='wolf').length,1);
  const humans=Array.from({length:5},(_,i)=>'p'+i).filter(id=>id!==wolf);const victim=humans[0];
  await call('host','test-advance');await call('host','test-advance');const route=state.public.twist.allowed[0];
  await call(victim,'answer',{route,choice:1});await call(wolf,'answer',{route,choice:2,kill:victim});
  await call('host','sync');assert.equal(state.private,null);assert.equal(state.public.wolf,null);assert.equal('attack' in state.public,false);
  await call('host','test-advance');assert.equal(state.public.players[victim].alive,false);assert.equal(state.public.resources.battery,false);
  await call('host','test-advance');await call('host','test-advance');assert.equal(state.public.phase,'vote');
  for(const id of humans.slice(1))await call(id,'vote',{target:wolf});
  await call('host','test-advance');assert.equal(state.public.outcome,'caught');
  // A new three-player game ends in counterkill immediately after its first kill.
  await call('host','create');code=state.public.code;
  for(let i=0;i<3;i++)await call('q'+i,'join',{code,name:'測試'+i});await call('host','start',{minutes:20});
  const three=await Promise.all([0,1,2].map(i=>call('q'+i,'sync')));const w='q'+three.findIndex(r=>r.private.role==='wolf');const v=['q0','q1','q2'].find(id=>id!==w);
  await call('host','test-advance');await call('host','test-advance');await call(w,'answer',{route:state.public.twist.allowed[0],choice:2,kill:v});await call('host','test-advance');assert.equal(state.public.outcome,'counter');
  await call('host','create');code=state.public.code;for(let i=0;i<3;i++)await call('r'+i,'join',{code,name:'限時'+i});await call('host','start',{minutes:5});await call('host','test-expire');assert.equal(state.public.outcome,'timeout');
 }finally{await mf.dispose();}
});
