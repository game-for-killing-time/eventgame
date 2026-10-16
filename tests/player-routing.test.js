import test from 'node:test';
import assert from 'node:assert/strict';
import {roomCodePath,resolvePlayerMode,initialEntryMode,playerInvitation} from '../src/player-routing.js';

function publicCodes(classic='CLASS1',voyage='VOYAG1'){
 const reads=[];
 const get=async path=>{
  reads.push(path);
  assert.ok(['room/public/state/code','voyage/public/code'].includes(path),'routing reads only public room codes');
  return path==='voyage/public/code'?voyage:classic;
 };
 return {get,reads};
}

test('room code lookup uses each game public code path',()=>{
 assert.equal(roomCodePath('classic'),'room/public/state/code');
 assert.equal(roomCodePath('voyage'),'voyage/public/code');
});

test('a voyage code routes to voyage despite classic broadcast',async()=>{
 const {get,reads}=publicCodes();
 assert.equal(await initialEntryMode({role:'player',search:'?room=VOYAG1',broadcast:{mode:'classic'},get}),'voyage');
 assert.deepEqual(reads,['room/public/state/code','voyage/public/code']);
});

test('a classic code routes to classic despite voyage broadcast',async()=>{
 const {get,reads}=publicCodes();
 assert.equal(await initialEntryMode({role:'player',search:'?room=CLASS1',broadcast:{mode:'voyage'},get}),'classic');
 assert.deepEqual(reads,['voyage/public/code','room/public/state/code']);
});

test('typed codes ignore surrounding whitespace and letter case',async()=>{
 const {get,reads}=publicCodes();
 assert.equal(await resolvePlayerMode('  voyag1  ','voyage',get),'voyage');
 assert.deepEqual(reads,['voyage/public/code']);
});

test('a preferred code match avoids alternate reads and wins a code collision',async()=>{
 const {get,reads}=publicCodes('SHARED','SHARED');
 assert.equal(await resolvePlayerMode('SHARED','voyage',get),'voyage');
 assert.deepEqual(reads,['voyage/public/code']);
});

test('unknown codes stay with the preferred mode for normal backend rejection',async()=>{
 const query=new URLSearchParams('room=WRONG1&mode=voyage');
 const {get}=publicCodes();
 assert.equal(await resolvePlayerMode(query.get('room'),'voyage',get),null);
 assert.equal(await initialEntryMode({role:'player',search:query,broadcast:{mode:'classic'},get}),'voyage');
 assert.equal(query.get('room'),'WRONG1');
});

test('missing rooms and broadcast-only classic state allow the other room to match',async()=>{
 const {get}=publicCodes(null,'VOYAG1');
 assert.equal(await resolvePlayerMode('VOYAG1','classic',get),'voyage');
 assert.equal(await resolvePlayerMode('WRONG1','classic',publicCodes(null,null).get),null);
});

test('display always follows broadcast and never reads invitation room codes',async()=>{
 const get=()=>assert.fail('display must not inspect room codes');
 assert.equal(await initialEntryMode({role:'display',search:'mode=voyage&room=VOYAG1',broadcast:{mode:'classic'},get}),'classic');
 assert.equal(await initialEntryMode({role:'display',search:'mode=classic&room=CLASS1',broadcast:{mode:'voyage'},get}),'voyage');
});

test('explicit player mode takes precedence without a room and serves as lookup preference',async()=>{
 const noReads=()=>assert.fail('no room code means no lookup');
 assert.equal(await initialEntryMode({role:'player',search:'mode=voyage',broadcast:{mode:'classic'},get:noReads}),'voyage');
 const {get,reads}=publicCodes();
 assert.equal(await initialEntryMode({role:'player',search:'mode=voyage&room=VOYAG1',broadcast:{mode:'classic'},get}),'voyage');
 assert.deepEqual(reads,['voyage/public/code']);
 assert.equal(await initialEntryMode({role:'player',search:'mode=classic&room=VOYAG1',broadcast:{mode:'voyage'},get}),'voyage');
});

test('invalid modes fall back safely and blank codes do not match absent rooms',async()=>{
 const noReads=()=>assert.fail('no usable room code means no lookup');
 assert.equal(await initialEntryMode({role:'player',search:'mode=https://bad',broadcast:{mode:'voyage'},get:noReads}),'voyage');
 assert.equal(await initialEntryMode({role:'player',search:'mode=bad',broadcast:null,get:noReads}),'classic');
 assert.equal(await resolvePlayerMode('  ','voyage',noReads),null);
 const {get,reads}=publicCodes();
 assert.equal(await resolvePlayerMode('CLASS1','invalid',get),'classic');
 assert.deepEqual(reads,['room/public/state/code']);
});

test('read failures propagate instead of being reported as an unknown room code',async()=>{
 const denied=Object.assign(new Error('Permission denied'),{code:'PERMISSION_DENIED'});
 let calls=0;
 await assert.rejects(resolvePlayerMode('VOYAG1','classic',async()=>{calls++;throw denied;}),error=>error===denied);
 assert.equal(calls,1);
 await assert.rejects(initialEntryMode({role:'player',search:'room=VOYAG1',broadcast:{mode:'classic'},get:async path=>{
  if(path==='room/public/state/code')return 'CLASS1';
  throw denied;
 }}),error=>error===denied);
});

test('invitations stay identical across modes and safely encode the exact room code',()=>{
 assert.equal(playerInvitation('voyage','VOYAG1'),'./index.html?room=VOYAG1');
 assert.equal(playerInvitation('classic'),'./index.html');
 assert.equal(playerInvitation('invalid'),'./index.html');
 const url=new URL(playerInvitation('voyage','A&B =?'),'https://example.test/game/');
 assert.equal(url.pathname,'/game/index.html');
 assert.equal(url.searchParams.get('mode'),null);
 assert.equal(playerInvitation('classic','ABC234'),playerInvitation('voyage','ABC234'));
 assert.equal(url.searchParams.get('room'),'A&B =?');
});
