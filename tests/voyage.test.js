import test from 'node:test';
import assert from 'node:assert/strict';
import {voyage} from '../src/voyage-pack.js';
import * as E from '../src/voyage-engine.js';
import {pairStats} from '../src/affinity.js';
import {createVoyage,remoteCommand} from '../src/voyage-remote-model.js';
import {durationOptions} from '../src/voyage-timing.js';
const setup=(n=4)=>{const s=E.create(0);for(let i=0;i<n;i++)E.join(s,`p${i}`,['小美','阿樂','琪琪','主持人'][i]||`玩家${i}`);return s;};
test('target rotates, guesses score separately from own-choice affinity, E option works, movement only after reveal',()=>{const s=setup(3);start(s);assert.equal(s.target,'p0');E.submitFirst(s,'p0',1,0,null,110);E.submitFirst(s,'p1',1,0,1,110);E.submitFirst(s,'p2',1,1,0,110);const before=JSON.stringify(s.island);assert.equal(E.publicView(s).guessResult,null);E.close(s);assert.equal(JSON.stringify(s.island),before);E.revealFirst(s);assert.equal(s.players.p0.points,0);assert.equal(s.players.p1.points,0);assert.equal(s.players.p2.points,1);assert.deepEqual(pairStats(s.affinity.pairs,'p0','p1'),{shared:1,same:1});assert.deepEqual(pairStats(s.affinity.pairs,'p1','p2'),{shared:0,same:0});E.twist(s,120);E.close(s);E.revealSecond(s);start(s);assert.equal(s.target,'p1');const old=JSON.stringify(s.island);E.submitFirst(s,'p0',2,4,0,110);E.submitFirst(s,'p1',2,4,null,110);E.submitFirst(s,'p2',2,4,4,110);assert.equal(JSON.stringify(s.island),old);E.close(s);E.revealFirst(s);assert.deepEqual(pairStats(s.affinity.pairs,'p0','p1'),{shared:2,same:2});assert.equal(s.island.positions.p1.x-s.island.positions.p0.x,96);assert.equal(s.players.p0.points,0);assert.equal(s.players.p2.points,2);assert.equal(s.results[2].correct,1);assert.equal(s.results[2].wrong,1);const settled=JSON.stringify(s);E.revealFirst(s);assert.equal(JSON.stringify(s),settled);assert.equal('affinity' in E.publicView(s),false);});
test('non-target must submit guess plus own answer; unanswered target never produces false wrong guesses or affinity',()=>{const s=setup(3);start(s);assert.throws(()=>E.submitFirst(s,'p1',1,0,null,110));assert.throws(()=>E.submitFirst(s,'p1',1,null,0,110));E.submitFirst(s,'p1',1,0,0,110);E.close(s);E.revealFirst(s);assert.equal(s.results[1].choice,null);assert.equal(s.results[1].rows[0].correct,null);assert.equal(s.players.p1.points,0);assert.deepEqual(s.affinity.pairs,{});});
test('fair target allocation includes late joiners and remains fixed through refresh and answer edits',()=>{const s=setup(2);play(s);E.join(s,'late','遲來玩家');start(s);assert.equal(s.target,'p1');E.submitFirst(s,'p0',2,0,0,110);E.submitFirst(s,'p0',2,1,1,111);assert.equal(JSON.parse(JSON.stringify(s)).target,'p1');E.close(s);E.revealFirst(s);E.twist(s,120);E.close(s);E.revealSecond(s);E.next(s,100);assert.equal(s.target,'late');assert.equal(s.turns.p0,1);assert.equal(s.turns.p1,1);assert.equal(s.turns.late,1);});
test('untimed local preview remains usable through both choices without early disclosure',()=>{const s=setup(1);E.next(s,0,0);E.submitFirst(s,'p0',1,0,0,100000000);assert.equal(E.publicView(s).lines.length,0);E.close(s);E.revealFirst(s);E.twist(s,100000001);E.submitSecond(s,'p0',1,{stance:'keep'},200000000);assert.equal(s.deadline,Number.MAX_SAFE_INTEGER);});
function start(s){E.next(s,100,60);if(s.phase==='routing'){E.route(s,s.target,E.scene(s).routes[s.players[s.target].seat%2].id,101);E.begin(s,102);}}
function play(s,choice=0){start(s);for(const id of Object.keys(s.players))E.submitFirst(s,id,s.round,choice,choice,110);E.close(s);E.revealFirst(s);E.twist(s,120);for(const id of Object.keys(s.players))E.submitSecond(s,id,s.round,{stance:'keep',text:'一起走',consent:false},125);E.close(s);E.revealSecond(s);}
test('12 complete adventure scenes, two routes, three five-choice text questions and real name casting',()=>{assert.equal(voyage.rounds.length,12);assert.equal(voyage.rounds.filter(r=>r.routes).length,2);assert.equal(voyage.rounds.filter(r=>r.question?.visual).length,3);for(const r of voyage.rounds){assert.ok(r.twist&&r.prompt&&r.discuss&&r.reveal);for(const q of r.routes?.map(x=>x.question)||[r.question])assert.equal(q.options.length,q.visual?5:4);}const s=setup();start(s);const text=E.publicView(s).intro;assert.ok(text.includes('小美')&&text.includes('阿樂'));assert.ok(!text.includes('{lead}'));});
test('full 12 scenes, idempotent reveals, separate second choices and no visual personality labels',()=>{const s=setup(10);for(let i=1;i<=12;i++){play(s);const before=JSON.stringify(s);E.revealSecond(s);assert.equal(JSON.stringify(s),before);}assert.equal(s.phase,'ended');assert.equal(s.history.length,12);assert.equal(s.players.p0.events.length,12);assert.equal(s.players.p0.points,10);assert.equal(Object.values(s.players.p0.traits).reduce((a,b)=>a+b,0),9);assert.equal(E.publicView(s).cards.length,0);s.shared.p0=true;assert.equal(E.publicView(s).cards.length,1);assert.ok(E.publicView(s).cards[0].events.every(e=>!e.text));});
test('five options accepts E, rejects F; visual reveal is named text and never predicts temperament',()=>{const s=setup();play(s);start(s);E.submitFirst(s,'p0',2,0,0,110);E.submitFirst(s,'p1',2,4,null,110);assert.throws(()=>E.submitFirst(s,'p2',2,5,null,110));assert.equal(E.publicView(s).lines.length,0);E.close(s);assert.equal(E.publicView(s).lines.length,0);E.revealFirst(s);assert.ok(E.publicView(s).lines.includes('小美選了一把珊瑚紅的工具。'));assert.ok(E.publicView(s).lines.includes('阿樂選了一把霧黑的工具。'));});
test('short answers stay private until opt-in and second reveal; withdrawal and host hiding work',()=>{const s=setup();start(s);E.submitFirst(s,'p0',1,0,0,110);E.close(s);E.revealFirst(s);E.twist(s,120);E.submitSecond(s,'p0',1,{stance:'change',choice:1,text:'<img onerror=alert(1)>',consent:true},125);E.submitSecond(s,'p1',1,{stance:'depends',text:'私人原因',consent:false},125);assert.equal(E.publicView(s).quotes.length,0);E.close(s);assert.equal(E.publicView(s).quotes.length,0);E.revealSecond(s);assert.equal(E.publicView(s).quotes.length,1);E.consent(s,'p0',1,false);assert.equal(E.publicView(s).quotes.length,0);E.consent(s,'p0',1,true);s.hidden['1/p0']=true;assert.equal(E.publicView(s).quotes.length,0);assert.equal(s.players.p1.events[0].choice,null);});
test('trapped one round only from actual final choice; no fabricated choices for missing answers',()=>{const s=setup(2);for(let n=1;n<5;n++)play(s);start(s);E.submitFirst(s,'p0',5,3,0,110);E.submitFirst(s,'p1',5,3,0,110);E.close(s);E.revealFirst(s);E.twist(s,120);E.submitSecond(s,'p0',5,{stance:'keep'},125);E.submitSecond(s,'p1',5,{stance:'change',choice:0},125);E.close(s);E.revealSecond(s);assert.equal(s.players.p0.trapped,6);assert.equal(s.players.p1.trapped,undefined);start(s);assert.equal(E.question(s,'p0'),E.question(s,s.target));assert.equal(E.question(s,'p1'),E.question(s,'p0'));E.close(s);E.revealFirst(s);E.twist(s,120);E.close(s);E.revealSecond(s);assert.equal(s.players.p0.trapped,undefined);assert.equal(s.players.p0.events.length,5);assert.equal(E.publicView(s).lines.length,0);});
test('deadline, stale round, overwrite, draft validation, late join and neutral zero-vote ending',()=>{const s=setup(1);start(s);E.submitFirst(s,'p0',1,0,0,110);E.submitFirst(s,'p0',1,1,1,111);assert.equal(Object.keys(s.first).length,1);assert.throws(()=>E.submitFirst(s,'p0',1,0,0,60100));assert.throws(()=>E.submitFirst(s,'p0',2,0,0,111));E.close(s);E.revealFirst(s);E.twist(s,120);E.join(s,'late','遲來');assert.throws(()=>E.submitSecond(s,'late',1,{stance:'keep'},125));E.submitSecond(s,'late',1,{stance:'change',choice:2},125);assert.throws(()=>E.submitSecond(s,'p0',1,{stance:'keep',text:'x'.repeat(101)},125));assert.throws(()=>E.submitSecond(s,'p0',1,{stance:'keep'},60120));E.close(s);E.revealSecond(s);for(let i=2;i<=12;i++){start(s);E.close(s);E.revealFirst(s);E.twist(s,120);E.close(s);E.revealSecond(s);}assert.equal(s.ending,1);assert.equal(s.phase,'ended');});
test('target selects common branch question, saved state recovery, 20-player capacity and no early next',()=>{const s=setup(20);play(s);play(s);E.next(s,100);assert.throws(()=>E.route(s,'p0','dock',110));E.route(s,s.target,'shop',110);E.begin(s,120);assert.equal(E.question(s,'p0').text,E.question(s,'p1').text);assert.deepEqual(E.question(JSON.parse(JSON.stringify(s)),'p0'),E.question(s,'p0'));assert.throws(()=>E.join(s,'overflow','滿了'));assert.throws(()=>E.next(s));});

const timedRoom=()=>{const r=createVoyage('ABCDEF',0);r.roster={a:{name:'A',seat:'0'}};r.seats={0:'a'};return r;};
test('online hosts can start with every supported answer duration and restore the selected option',()=>{
 for(const duration of [15,45,60,90,120,180,300,600]){
  const r=remoteCommand(timedRoom(),'next',duration,undefined,1000);
  assert.equal(r.hostOnly.duration,duration);
  assert.equal(r.public.duration,duration);
  assert.equal(r.public.phase,'first');
  assert.equal(r.public.deadline,1000+duration*1000);
  assert.match(durationOptions(r.public.duration),new RegExp(`<option value="${duration}" selected>`));
  assert.equal((durationOptions(duration).match(/ selected/g)||[]).length,1);
 }
 assert.match(durationOptions(),/<option value="60" selected>/);
 assert.doesNotMatch(durationOptions(),/<option value="0"/);
 assert.match(durationOptions(0,true),/<option value="0" selected>/);
});

for(const duration of [120,180,300,600])test(`${duration}-second answers persist through reload, extension, two scenes and route selection`,()=>{
 let r=timedRoom();
 const command=(action,now,value=null)=>{r=remoteCommand(r,action,value,undefined,now);};
 const reload=now=>{
  const deadline=r.public.deadline;
  r=remoteCommand(JSON.parse(JSON.stringify(r)),'sync',null,undefined,now);
  assert.equal(r.hostOnly.duration,duration);
  assert.equal(r.public.duration,duration);
  assert.equal(r.hostOnly.deadline,deadline);
  assert.equal(r.public.deadline,deadline);
 };
 let now=1000;
 for(let round=1;round<=2;round++){
  command('next',now,duration);
  assert.equal(r.public.round,round);
  assert.equal(r.public.phase,'first');
  const firstDeadline=now+duration*1000;
  assert.equal(r.public.deadline,firstDeadline);
  r.inputs.first??={};
  r.inputs.first[round]={a:{game:r.public.id,choice:0,prediction:-1,at:firstDeadline-1}};
  command('sync',firstDeadline-1);
  assert.equal(r.public.submitted,1);
  assert.deepEqual(r.public.view.lines,[]);
  command('extend',firstDeadline-1);
  assert.equal(r.public.deadline,firstDeadline+15000);
  reload(firstDeadline);
  E.submitFirst(structuredClone(r.hostOnly),'a',round,0,-1,firstDeadline);
  assert.throws(()=>E.submitFirst(structuredClone(r.hostOnly),'a',round,0,-1,r.public.deadline),/截止/);
  command('close',r.public.deadline);
  command('revealFirst',r.public.deadline);
  assert.equal(r.public.view.lines.length,1);
  now=r.public.deadline+100;
  command('twist',now);
  assert.equal(r.public.phase,'twist');
  assert.equal(r.public.deadline,now+duration*1000,'the 15-second extension applies only to the first choice');
  const twistDeadline=r.public.deadline;
  r.inputs.second??={};
  r.inputs.second[round]={a:{game:r.public.id,stance:'keep',choice:0,text:'',consent:false,at:twistDeadline-1}};
  reload(twistDeadline-1);
  assert.equal(r.public.submitted,1);
  assert.deepEqual(r.public.view.follow,[]);
  assert.throws(()=>E.submitSecond(structuredClone(r.hostOnly),'a',round,{stance:'keep'},twistDeadline),/截止/);
  command('close',twistDeadline);
  command('revealSecond',twistDeadline);
  assert.equal(r.public.phase,'discussion');
  assert.equal(r.hostOnly.history.length,round);
  now=twistDeadline+100;
 }
 command('next',now,duration);
 assert.equal(r.public.round,3);
 assert.equal(r.public.phase,'routing');
 assert.equal(r.public.deadline,now+duration*1000);
 r.inputs.routes={3:{a:{game:r.public.id,route:'shop',at:now+1}}};
 reload(now+1);
 command('begin',now+2);
 assert.equal(r.public.phase,'first');
 assert.equal(r.public.deadline,now+2+duration*1000);
 assert.equal(r.hostOnly.routes.a,'shop');
 assert.equal(E.question(r.hostOnly).text,E.scene(r.hostOnly).routes.find(route=>route.id==='shop').question.text);
});

test('invalid answer durations are rejected and unlimited time remains local only',()=>{
 for(const duration of [-1,1,61,601,120.5,'120',NaN,Infinity,null]){
  assert.throws(()=>remoteCommand(timedRoom(),'next',duration,undefined,0),/作答時間/);
  assert.throws(()=>E.next(setup(1),0,duration),/作答秒數/);
 }
 assert.throws(()=>remoteCommand(timedRoom(),'next',0,undefined,0),/作答時間/);
 const s=setup(1);E.next(s,0,0);
 assert.equal(s.duration,0);
 assert.equal(s.deadline,Number.MAX_SAFE_INTEGER);
});
