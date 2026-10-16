import test from 'node:test';import assert from 'node:assert/strict';
import * as E from '../src/voyage-engine.js';
import {living,survivalSummary} from '../src/voyage-survival.js';
import {createVoyage,remoteCommand} from '../src/voyage-remote-model.js';
const setup=()=>{const s=E.create(0);for(let n=0;n<4;n++)E.join(s,'p'+n,'玩家'+n);return s;};
function advance(s){assert.equal(E.autoAdvance(s,s.deadline),true);}
function start(s){if(s.phase==='lobby')E.next(s,100,15);else advance(s);assert.equal(s.phase,'intro');assert.deepEqual(E.publicView(s).lines,[]);advance(s);if(s.phase==='routing'){E.route(s,s.target,E.scene(s).routes[0].id,s.deadline-1);advance(s);}}
function play(s,choices={}){start(s);for(const id of living(s))E.submitFirst(s,id,s.round,choices[id]??0,0,s.deadline-1);assert.equal(E.autoAdvance(s,s.deadline-1),false);advance(s);assert.equal(s.phase,'revealed');advance(s);assert.equal(s.phase,'twistIntro');advance(s);for(const id of living(s))E.submitSecond(s,id,s.round,{stance:'keep'},s.deadline-1);assert.equal(E.autoAdvance(s,s.deadline-1),false);advance(s);}
test('new survival adventure reaches full-party Good Ending through all 12 scenes',()=>{const s=setup();for(let n=1;n<=12;n++)play(s,n===3||n===7?{p1:1,p3:1}:{});assert.equal(s.outcome,'good');assert.equal(s.history.length,12);assert.equal(living(s).length,4);assert.match(E.card(s,'p0').survival,/生還/);assert.equal(survivalSummary(s).dead.length,0);});
test('successive deaths produce partial survival; dead players never answer or become targets',()=>{const s=setup();for(let n=1;n<=12;n++){play(s,n===4?{p0:1}:n===6?{p1:3}:n===9?{p2:1}:{});if(n===4){assert.equal(s.players.p0.alive,false);assert.throws(()=>E.submitFirst(s,'p0',4,0,0,130),/淘汰/);}if(n>4)assert.notEqual(s.target,'p0');}assert.equal(s.outcome,'partial');assert.deepEqual(living(s),['p3']);assert.deepEqual(Object.values(s.casualties).map(x=>x.round),[4,6,9]);assert.equal(s.players.p0.events.length,4);});
test('all-party death ends the game immediately and cannot advance or double-count',()=>{const s=setup();for(let n=1;n<=3;n++)play(s);play(s,{p0:1,p1:1,p2:1,p3:1});assert.equal(s.phase,'ended');assert.equal(s.outcome,'bad');assert.equal(s.round,4);const snapshot=JSON.stringify(s);assert.equal(E.autoAdvance(s,99999),false);E.revealSecond(s);assert.equal(JSON.stringify(s),snapshot);assert.throws(()=>E.next(s));});
test('group-specific light hazard kills only the affected group; final changed choice controls fate',()=>{const s=setup();for(let n=1;n<=7;n++)play(s,n===3||n===7?{p1:1,p3:1}:{});play(s,{p0:1,p1:1,p2:2,p3:2});assert.equal(s.players.p0.alive,false);assert.equal(s.players.p3.alive,false);assert.equal(s.players.p1.alive,true);assert.equal(s.players.p2.alive,true);});
test('manual early close never auto-reveals; deadline handles missing answers and first choice fallback',()=>{const s=setup();start(s);E.close(s);assert.equal(E.autoAdvance(s,999999),false);assert.equal(s.phase,'firstClosed');E.revealFirst(s);E.twist(s,200);assert.equal(E.autoAdvance(s,15200),true);assert.equal(s.phase,'discussion');});
test('hazard deadline without a safe decision is fatal; late joining cannot revive a failed run',()=>{const s=setup();for(let n=1;n<=3;n++)play(s);start(s);advance(s);advance(s);advance(s);advance(s);assert.equal(s.outcome,'bad');assert.throws(()=>E.join(s,'late','遲到'));});
test('mid-game new identities are spectators; old room content remains compatible',()=>{const s=setup();play(s);E.join(s,'late','遲到');assert.equal(s.players.late.spectator,true);assert.ok(!living(s).includes('late'));const old=E.create(0,'last-light-v2');E.join(old,'a','A');E.next(old,0);E.join(old,'b','B');assert.equal(old.players.b.alive,true);assert.equal(E.pack(old).id,'last-light-v2');});
test('host removal and rejoin preserves life, scores and legacy-ban migration',()=>{let r=createVoyage('ABCDEF');r.roster={a:{name:'A',seat:'0'},b:{name:'B',seat:'1'}};r.seats={0:'a',1:'b'};r=remoteCommand(r,'sync');r.hostOnly.players.a.points=3;r.hostOnly.players.a.alive=false;r.hostOnly.players.a.deathRound=4;r.hostOnly.players.a.deathReason='測試';r=remoteCommand(r,'remove','a');assert.equal(r.seats[0],undefined);assert.notEqual(r.moderation.a?.removed,true);r.roster.a={name:'A',seat:'0'};r.seats[0]='a';r=remoteCommand(r,'sync');assert.equal(r.public.players.a.alive,false);assert.equal(r.public.players.a.points,3);assert.equal(r.public.players.a.deathRound,4);});

test('reading windows cannot be skipped by duplicate commands; resumed host grants fresh reading time',()=>{const s=setup();E.next(s,0,15);assert.equal(s.phase,'intro');assert.throws(()=>E.submitFirst(s,'p0',1,0,0,1));assert.equal(E.autoAdvance(s,11999),false);E.autoAdvance(s,12000);assert.equal(s.phase,'first');E.autoAdvance(s,999999);assert.equal(s.phase,'revealed');assert.equal(s.deadline,1011999);assert.equal(E.autoAdvance(s,999999),false);assert.equal(E.publicView(s).twist,'');});
test('ending an empty lobby and removing the only player never crashes autoplay',()=>{let r=createVoyage('ABCDEF');assert.equal(remoteCommand(r,'end').public.phase,'ended');r=createVoyage('ABCDEF');r.roster={a:{name:'A',seat:'0'}};r.seats={0:'a'};r=remoteCommand(r,'next',15,undefined,0);r=remoteCommand(r,'remove','a',undefined,1);assert.equal(r.public.phase,'ended');assert.equal(remoteCommand(r,'autoAdvance',null,undefined,999999).public.phase,'ended');});


const timedRoom=()=>{const r=createVoyage('ABCDEF',0);r.roster={a:{name:'A',seat:'0'}};r.seats={0:'a'};return r;};
test('online hosts can start with every supported answer duration',()=>{
 for(const duration of [15,45,60,90,120,180,300,600]){
  const r=remoteCommand(timedRoom(),'next',duration,undefined,1000);
  assert.equal(r.hostOnly.duration,duration);
  assert.equal(r.public.duration,duration);
  assert.equal(r.public.phase,'intro');
  assert.equal(r.public.deadline,13000,'story reading time is independent of answer time');
 }
});

for(const duration of [120,180,300,600])test(`${duration}-second answers survive reload, extension, both choices and automatic next scene`,()=>{
 let r=remoteCommand(timedRoom(),'next',duration,undefined,1000);
 const command=(action,now)=>{r=remoteCommand(r,action,null,undefined,now);};
 const reload=()=>{
  const deadline=r.public.deadline;
  r=remoteCommand(JSON.parse(JSON.stringify(r)),'sync',null,undefined,deadline-1);
  assert.equal(r.hostOnly.duration,duration);
  assert.equal(r.public.duration,duration);
  assert.equal(r.hostOnly.deadline,deadline);
  assert.equal(r.public.deadline,deadline);
 };

 const introDeadline=r.public.deadline;
 command('autoAdvance',introDeadline-1);
 assert.equal(r.public.phase,'intro');
 command('autoAdvance',introDeadline);
 assert.equal(r.public.phase,'first');
 const firstDeadline=introDeadline+duration*1000;
 assert.equal(r.public.deadline,firstDeadline);
 r.inputs.first={1:{a:{game:r.public.id,choice:0,prediction:-1,at:firstDeadline-1}}};
 command('autoAdvance',firstDeadline-1);
 assert.equal(r.public.submitted,1);
 assert.equal(r.public.phase,'first','all submitted answers remain editable until the deadline');
 assert.deepEqual(r.public.view.lines,[]);

 command('extend',firstDeadline-1);
 assert.equal(r.public.deadline,firstDeadline+15000);
 reload();
 command('autoAdvance',firstDeadline);
 assert.equal(r.public.phase,'first','the original deadline must no longer close the extended choice');
 const extendedDeadline=r.public.deadline;
 command('autoAdvance',extendedDeadline-1);
 assert.equal(r.public.phase,'first');
 command('autoAdvance',extendedDeadline);
 assert.equal(r.public.phase,'revealed');
 assert.equal(r.public.deadline,extendedDeadline+12000);
 command('autoAdvance',r.public.deadline);
 assert.equal(r.public.phase,'twistIntro');
 assert.equal(r.public.deadline,extendedDeadline+22000);
 const twistStart=r.public.deadline;
 command('autoAdvance',twistStart);
 assert.equal(r.public.phase,'twist');
 assert.equal(r.public.deadline,twistStart+duration*1000,'extension applies only to its current choice');

 const twistDeadline=r.public.deadline;
 r.inputs.second={1:{a:{game:r.public.id,stance:'keep',choice:0,text:'',consent:false,at:twistDeadline-1}}};
 command('autoAdvance',twistDeadline-1);
 assert.equal(r.public.phase,'twist');
 assert.equal(r.public.submitted,1);
 reload();
 command('autoAdvance',twistDeadline);
 assert.equal(r.public.phase,'discussion');
 assert.equal(r.public.deadline,twistDeadline+15000);
 assert.equal(r.hostOnly.history.length,1);
 command('autoAdvance',r.public.deadline);
 assert.equal(r.public.phase,'intro');
 assert.equal(r.public.round,2);
 assert.equal(r.public.duration,duration);
 reload();
 const secondIntroDeadline=r.public.deadline;
 command('autoAdvance',secondIntroDeadline);
 assert.equal(r.public.phase,'first');
 assert.equal(r.public.deadline,secondIntroDeadline+duration*1000);
});

test('invalid answer durations are rejected and unlimited time remains local only',()=>{
 for(const duration of [-1,1,61,601,120.5,'120',NaN,Infinity,null]){
  assert.throws(()=>remoteCommand(timedRoom(),'next',duration,undefined,0),/作答時間/);
  assert.throws(()=>E.next(setup(),0,duration),/作答秒數/);
 }
 assert.throws(()=>remoteCommand(timedRoom(),'next',0,undefined,0),/作答時間/);

 const s=setup();E.next(s,0,0);advance(s);
 assert.equal(s.phase,'first');
 assert.equal(s.duration,0);
 assert.equal(s.deadline,Number.MAX_SAFE_INTEGER);
 E.submitFirst(s,'p0',1,0,-1,100000000);
 assert.equal(E.autoAdvance(s,100000000),false);
 E.close(s);E.revealFirst(s,100000000);advance(s);advance(s);
 assert.equal(s.phase,'twist');
 assert.equal(s.deadline,Number.MAX_SAFE_INTEGER);
 E.submitSecond(s,'p0',1,{stance:'keep'},200000000);
 assert.equal(E.autoAdvance(s,200000000),false);
});
