import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom} from '../src/game.js';
import {createVoyage,remoteCommand} from '../src/voyage-remote-model.js';
import {pauseMode,transitionSession,membersOf,mergeLegacyMembers} from '../src/session-model.js';
import {characterId} from '../src/characters.js';
import {initialEntryMode,playerInvitation} from '../src/player-routing.js';

const people=n=>Object.fromEntries(Array.from({length:n},(_,i)=>['p'+i,{name:'玩家'+i,seat:String(i),joined:100}]));
function seed(n=3){const room=newRoom('ABC234');room.public.members=Object.fromEntries(Object.entries(people(n)).map(([id,m])=>[id,{...m,code:'ABC234'}]));return {room,voyage:null};}
function switchTo(data,mode,now=1000){return transitionSession({room:pauseMode('classic',data.room,now),voyage:pauseMode('voyage',data.voyage,now)},mode,now);}

test('one room code, 20 stable identities and characters survive repeated mode switches',()=>{
 let data=switchTo(seed(20),'classic');
 const original=membersOf('classic',data.room);
 for(let n=0;n<8;n++){
  const mode=n%2?'classic':'voyage';data=switchTo(data,mode,2000+n*1000);
  assert.equal(data.room.public.state.code,'ABC234');assert.equal(data.voyage.public.code,'ABC234');
  assert.deepEqual(membersOf('classic',data.room),original);assert.deepEqual(membersOf('voyage',data.voyage),original);
  assert.equal(data.room.sessionActive,mode==='classic');assert.equal(data.voyage.sessionActive,mode==='voyage');
  for(const [id,p]of Object.entries(data.voyage.public.players))assert.equal(p.character,characterId(id,'ABC234'));
 }
});
test('switch pauses and resumes the exact round and remaining deadline; answers stay private',()=>{
 let data=switchTo(seed(),'classic');
 Object.assign(data.room.public.state,{status:'open',round:4,deadline:21000});data.room.answers={4:{p0:{choice:2,prediction:1,at:1000}}};
 data=switchTo(data,'voyage',6000);
 assert.equal(data.room.public.state.deadline,0);assert.equal(data.room.public.state.locked,true);
 assert.equal(data.room.sessionPause.remaining,15000);
 assert.ok(!JSON.stringify(data.voyage.public).includes('prediction'));
 data=switchTo(data,'classic',106000);
 assert.equal(data.room.public.state.status,'open');assert.equal(data.room.public.state.round,4);assert.equal(data.room.public.state.deadline,121000);
 assert.equal(data.room.answers[4].p0.choice,2);
});
test('players joining and leaving the active mode are reflected on return without resurrecting removed players',()=>{
 let data=switchTo(seed(),'voyage');
 delete data.voyage.roster.p1;delete data.voyage.hostOnly.players.p1;delete data.voyage.seats['1'];
 data.voyage.roster.new={name:'新朋友',seat:'1',game:data.voyage.hostOnly.id,at:2000};
 data=switchTo(data,'classic',3000);
 assert.deepEqual(Object.keys(data.room.public.members).sort(),['new','p0','p2']);
 data=switchTo(data,'voyage',4000);
 assert.equal(data.voyage.public.players.p1,undefined);assert.equal(data.voyage.public.players.new.name,'新朋友');
});
test('legacy migration keeps selected room code and merges both existing rosters without seat collisions',()=>{
 const data=seed(2);data.room.public.broadcast={mode:'voyage'};
 data.voyage=createVoyage('VOY234',1000);data.voyage.roster={v:{name:'冒險玩家',seat:'0',game:data.voyage.hostOnly.id,at:1000}};
 const merged=switchTo(data,'voyage',2000);
 assert.equal(merged.room.public.state.code,'VOY234');assert.equal(merged.voyage.public.code,'VOY234');
 assert.equal(Object.keys(merged.voyage.public.players).length,3);assert.equal(new Set(Object.values(merged.voyage.roster).map(x=>x.seat)).size,3);
 assert.throws(()=>mergeLegacyMembers(people(20),{extra:{name:'額外玩家',seat:'0'}}),/20/);
});
test('inactive adventure cannot advance, score or accept host commands',()=>{
 const data=switchTo(seed(),'classic');
 assert.equal(remoteCommand(data.voyage,'next',60),undefined);
 assert.equal(remoteCommand(data.voyage,'sync'),undefined);
});
test('shared session ignores stale invitation mode for players and display',async()=>{
 for(const role of ['player','display'])assert.equal(await initialEntryMode({role,search:'?mode=classic&room=ABC234',broadcast:{version:1,code:'ABC234',mode:'voyage'},get:()=>assert.fail('must follow the session')}),'voyage');
 assert.equal(playerInvitation('classic','ABC234'),playerInvitation('voyage','ABC234'));
});
test('empty room is created once for both modes and locking follows the room',()=>{
 let data=transitionSession({room:null,voyage:null},'voyage',1000,{createCode:'NEW234'});
 assert.equal(data.room.public.state.code,'NEW234');assert.equal(data.voyage.public.code,'NEW234');
 data.voyage.locked=true;data.voyage.chatOpen=false;data=switchTo(data,'classic',2000);
 assert.equal(data.room.public.state.locked,true);assert.equal(data.room.public.state.chatOpen,false);
});
test('removing a paused adventure target in classic mode safely updates the adventure before resume',()=>{
 let data=switchTo(seed(),'voyage',1000);
 data.voyage=remoteCommand(data.voyage,'next',60,null,2000);
 const target=data.voyage.hostOnly.target;
 data=switchTo(data,'classic',3000);delete data.room.public.members[target];
 data=switchTo(data,'voyage',4000);
 assert.equal(data.voyage.public.players[target],undefined);
 assert.notEqual(data.voyage.hostOnly.target,target);
 assert.doesNotThrow(()=>remoteCommand(data.voyage,'autoAdvance',null,null,5000));
});
test('a participant added after adventure starts remains a spectator, and room-wide moderation follows mode changes',()=>{
 let data=switchTo(seed(),'voyage',1000);data.voyage=remoteCommand(data.voyage,'next',60,null,2000);
 data=switchTo(data,'classic',3000);
 data.room.public.members.new={name:'新朋友',seat:'3',joined:3001,code:'ABC234'};
 data.room.moderation.p0={muted:true};data=switchTo(data,'voyage',4000);
 assert.equal(data.voyage.public.players.new.spectator,true);assert.equal(data.voyage.moderation.p0.muted,true);
});
