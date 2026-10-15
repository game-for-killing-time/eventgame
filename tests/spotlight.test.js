import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,startRound,settleRoom,leaderboard,publishRevealedChoices} from '../src/game.js';
import {configureSpotlight,nextSpotlight,awardMasters,activateGuesses,skipTarget} from '../src/spotlight.js';
import {pairStats} from '../src/affinity.js';
import {questions} from '../src/questions.js';
function room(n=10){const r=newRoom('GUESS1');r.public.state.answerFlow='simultaneous-v1';for(let i=0;i<n;i++)r.public.members[`p${i}`]={name:`玩家${i}`,seat:String(i),joined:i+1};return r;}
function open(r){r.public.state=startRound(r,questions[(r.public.state.round)%questions.length],1000);return r.public.state;}
function reveal(r,answers={}){r.answers[r.public.state.round]=answers;r.public.state.status='closed';return settleRoom(r,r.public.state.round);}
test('10 players rotate in seat order for configurable 10 questions x 3 cycles, restore and finish',()=>{
 let r=room();assert.equal(r.public.state.questionsPerCycle,10);assert.equal(r.public.state.cycles,3);
 for(let i=0;i<30;i++){
  const s=open(r);assert.equal(s.targetUid,`p${i%10}`);assert.equal(s.cycle,Math.floor(i/10)+1);assert.equal(s.questionInCycle,i%10+1);
  reveal(r,{[s.targetUid]:{choice:0,prediction:-1},[`p${(i+1)%10}`]:{choice:1,prediction:0}});r=JSON.parse(JSON.stringify(r));
 }
 assert.equal(r.public.state.completed,true);assert.equal(r.public.state.locked,true);assert.throws(()=>open(r));
 assert.equal(Object.keys(r.public.awards.winners).length,10);assert.equal(r.public.awards.score,3);assert.equal(r.public.awards.title,'心水清大師');
 for(const p of Object.values(r.hostOnly.spotlight.players)){assert.equal(p.turns,3);assert.equal(p.guessed,3);assert.equal(p.unguessed,0);}
});
test('settings accept 1–30 questions and 1–3 cycles only before start; fewer players keep rotating across cycles',()=>{
 const r=room(3);configureSpotlight(r,{questionsPerCycle:2,cycles:2});assert.throws(()=>configureSpotlight(r,{questionsPerCycle:0,cycles:1}));assert.throws(()=>configureSpotlight(r,{questionsPerCycle:2,cycles:4}));
 const targets=[];for(let i=0;i<4;i++){targets.push(open(r).targetUid);reveal(r);}
 assert.deepEqual(targets,['p0','p1','p2','p0']);assert.throws(()=>configureSpotlight(r,{questionsPerCycle:3,cycles:1}));assert.deepEqual(r.public.awards.winners,{});assert.throws(()=>open(room(1)));
});
test('guess points and target-only affinity are independent; hidden target scores idempotent and never public',()=>{
 const r=room(4),s=open(r);reveal(r,{p0:{choice:2,prediction:-1},p1:{choice:0,prediction:2},p2:{choice:2,prediction:1},p3:{choice:2,prediction:2}});
 const out=r.public.results[1];assert.deepEqual(out.points,{p0:0,p1:1,p2:0,p3:1});assert.equal(out.targetChoice,2);assert.deepEqual(out.choices,{p0:2,p1:0,p2:2,p3:2});
 assert.deepEqual(pairStats(r.hostOnly.affinity.pairs,'p0','p1'),{shared:1,same:0});assert.deepEqual(pairStats(r.hostOnly.affinity.pairs,'p0','p2'),{shared:1,same:1});assert.deepEqual(pairStats(r.hostOnly.affinity.pairs,'p2','p3'),{shared:0,same:0});
 assert.deepEqual(r.hostOnly.spotlight.players.p0,{turns:1,guessed:2,unguessed:1,missed:0});const before=structuredClone(r);settleRoom(r,1);publishRevealedChoices(r);assert.deepEqual(r,before);
 assert.ok(!JSON.stringify(r.public).includes('unguessed'));open(r);assert.equal(settleRoom(r,1),undefined);assert.equal(settleRoom(r,2,'OTHER1'),undefined);assert.equal(s.targetUid,'p0');
});
test('missing or removed target causes no points or affinity; missing guesser not counted as wrong',()=>{
 for(const removed of [false,true]){const r=room(3);open(r);if(removed){delete r.public.members.p0;r.moderation.p0={removed:true};}
 reveal(r,{...(removed?{p0:{choice:1,prediction:-1}}:{}),p1:{choice:1,prediction:1}});assert.equal(r.public.results[1].targetAnswered,false);assert.equal(r.public.results[1].points.p1,0);assert.deepEqual(r.hostOnly.affinity.pairs,{});assert.equal(r.hostOnly.spotlight.players.p0.unguessed,0);}
 const r=room(3);open(r);reveal(r,{p0:{choice:0,prediction:-1}});assert.equal(r.hostOnly.spotlight.players.p0.guessed,0);assert.equal(r.hostOnly.spotlight.players.p0.unguessed,0);
});
test('late members append, removed identities skipped and reused seat never inherits target counters',()=>{
 const r=room(3);open(r);reveal(r);delete r.public.members.p1;r.public.members.late={name:'新朋友',seat:'1',joined:999};assert.equal(nextSpotlight(r).id,'p2');open(r);reveal(r);assert.equal(open(r).targetUid,'late');reveal(r);assert.equal(r.hostOnly.spotlight.players.late.turns,1);assert.equal(r.hostOnly.spotlight.players.p1,undefined);assert.equal(nextSpotlight(r).id,'p0');
});
test('early ending crowns positive top scores and ties only, never arbitrary zero-point winner',()=>{
 const r=room(3);open(r);reveal(r,{p0:{choice:1,prediction:-1},p1:{choice:2,prediction:1},p2:{choice:0,prediction:1}});awardMasters(r);assert.deepEqual(r.public.awards.winners,{p1:true,p2:true});assert.equal(leaderboard(r.public.results,r.public.members)[0].score,1);
 const empty=room();awardMasters(empty);assert.deepEqual(empty.public.awards.winners,{});
});

import {voteStack} from '../src/voter-view.js';
test('Firebase omits empty winners array; revealed voter list still renders',()=>{const markup=voteStack(1,{counts:[0,1,0,0],choices:{a:1}},{a:{name:'甲',seat:'0'}},'a','GUESS1');assert.match(markup,/查看/);assert.ok(!markup.includes('最多人選'));});

import {spotlightQuestion} from '../src/spotlight-view.js';
import {countdown,revealSummary,revealRemaining,REVEAL_MS} from '../src/spotlight-presentation.js';
test('player markup has target-only choice form, guesser dual form and real revealed result without private counters',()=>{
 const r=room(2),s=open(r),props={s,pub:r.public,role:'viewer',uid:'p0',joined:true,canAnswer:true,choice:null,prediction:null};
 let html=spotlightQuestion(props);assert.ok(html.includes(questions[0].text.replaceAll('你','玩家0')));assert.ok(html.includes('name="choice"'));assert.ok(!html.includes('name="prediction"'));assert.ok(html.includes('提交我的答案'));
 html=spotlightQuestion({...props,uid:'p1'});assert.ok(html.includes('name="prediction"'));assert.ok(html.includes('你猜 玩家0，他會怎樣選？'));assert.ok(html.indexOf('name="prediction"')<html.indexOf('name="choice"'));
 reveal(r,{p0:{choice:1,prediction:-1},p1:{choice:1,prediction:1}});html=spotlightQuestion({...props,uid:'p1',result:r.public.results[1]});assert.ok(html.includes('你猜中了'));assert.ok(html.includes('再睡五分鐘'));assert.ok(!html.includes('name="prediction"'));assert.ok(!html.includes('未被猜中'));
});


test('target-first thinking has no deadline; skip changes target without consuming question, score or affinity',()=>{
 const r=room(3);delete r.public.state.answerFlow;r.public.state=startRound(r,questions[0],1000);
 const expected={...r.public.state};assert.equal(expected.status,'thinking');assert.equal(expected.deadline,0);assert.equal(expected.round,1);
 assert.equal(activateGuesses(r,expected,2000),undefined);assert.equal(settleRoom(r,1),undefined);
 skipTarget(r,expected);assert.equal(r.public.state.targetUid,'p1');assert.equal(r.public.state.round,1);assert.equal(r.public.state.questionInCycle,1);assert.equal(r.public.results,undefined);assert.equal(r.hostOnly,undefined);
 assert.equal(skipTarget(r,expected),undefined);assert.equal(activateGuesses(r,expected,3000),undefined);
 const e={...r.public.state};r.answers[1]={[e.targetUid]:{choice:2,prediction:-1,attempt:e.attempt,at:3000}};
 assert.equal(skipTarget(r,e),undefined);activateGuesses(r,e,5000);assert.equal(r.public.state.deadline,50000);assert.equal(r.public.state.status,'open');
 assert.equal(activateGuesses(r,e,8000),undefined);assert.equal(r.public.state.deadline,50000);
});

test('thinking screens hide choices from guessers and display; target sees a single immutable submission',()=>{
 const r=room(2);delete r.public.state.answerFlow;r.public.state=startRound(r,{...questions[1],options:['直接淋上去','擠旁邊慢慢蘸','我吃原味','我想要其他醬']},1000);const s=r.public.state;
 const props={s,pub:r.public,role:'viewer',uid:'p1',joined:true,canAnswer:false,choice:null,prediction:null};
 for(const role of ['viewer','display']){const h=spotlightQuestion({...props,role});assert.ok(h.includes('玩家0正在思考'));assert.ok(!h.includes('name="choice"'));assert.ok(!h.includes('name="prediction"'));}
 const h=spotlightQuestion({...props,uid:'p0',canAnswer:true});assert.ok(h.includes('name="choice"'));assert.ok(!h.includes('name="prediction"'));assert.ok(h.includes('答案會鎖定'));
 s.status='open';const locked=spotlightQuestion({...props,uid:'p0',ownSubmitted:true});assert.ok(locked.includes('答案已鎖定'));assert.ok(!locked.includes('更新我的答案'));
 const guessing=spotlightQuestion({...props,canAnswer:true});assert.ok(guessing.includes('他會吃原味'));assert.ok(!guessing.includes('<span>我吃原味</span></label></div></fieldset><fieldset'));
});


test('local demo follows target-first submission and skip without filling real player answers',async()=>{
 const old={localStorage:globalThis.localStorage,window:globalThis.window,location:globalThis.location};const store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};globalThis.window={addEventListener(){}};globalThis.location={search:'?demo=1'};
 try{
  const {connect}=await import('../src/backend.js');const api=await connect('host',()=>{});await api.create();await api.join('PARTY1','真人');await api.command('demoParticipants');await api.command('start',questions[0]);
  let s=await api.get('room/public/state');assert.equal(s.status,'thinking');assert.equal(s.targetUid,api.uid());
  await api.command('demoAnswers');assert.equal(await api.get(`room/answers/${s.round}/${api.uid()}`),null);
  await api.answer(s.round,1,-1,s.attempt);assert.equal((await api.get('room/public/state')).status,'open');await assert.rejects(api.answer(s.round,2,-1,s.attempt));
  await api.command('demoAnswers');await api.command('close');await api.command('reveal');await api.command('start',questions[1]);s=await api.get('room/public/state');
  await api.command('skipTarget',{...s});const next=await api.get('room/public/state');assert.equal(next.round,s.round);assert.notEqual(next.targetUid,s.targetUid);await api.command('demoAnswers');assert.equal((await api.get('room/public/state')).status,'open');
 }finally{for(const [k,v]of Object.entries(old)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});

test('target submission has no update button, including restored answers; guessers remain editable before deadline',()=>{
 const r=room(2),s=open(r),props={s,pub:r.public,role:'viewer',uid:'p0',joined:true,canAnswer:true,choice:1,prediction:-1,ownSubmitted:true,ack:'已提交'};
 for(const ack of ['已提交','已恢復儲存的答案']){const h=spotlightQuestion({...props,ack});assert.ok(!h.includes('id="submit"'));assert.ok(!h.includes('更新我的答案'));assert.match(h,/<fieldset disabled>/);assert.ok(h.includes('答案已鎖定'));}
 const h=spotlightQuestion({...props,uid:'p1',prediction:1});assert.match(h,/<button id="submit" class="primary" >提交答案/);assert.ok(!h.includes('先猜玩家0的選擇，再留下自己的答案。'));
});

test('numeric countdown uses shared clock, handles extension and never goes negative; positions differ by page',()=>{
 const s={...open(room(2)),deadline:46000};
 assert.equal(countdown(s,1000).seconds,45);assert.equal(countdown(s,36001).seconds,10);assert.equal(countdown(s,36001).urgent,true);
 assert.equal(countdown(s,50000).seconds,0);assert.ok(countdown(s,50000).text.includes('截止'));assert.equal(countdown({...s,deadline:61000},40000).seconds,21);
 assert.equal(countdown({...s,status:'thinking',deadline:0},1000).text,'等待主角');assert.equal(countdown({...s,status:'closed'},1000).seconds,0);
 const props={s,pub:{members:{}},role:'viewer',uid:'p1',joined:true,now:1000};const player=spotlightQuestion(props),display=spotlightQuestion({...props,role:'display'});
 assert.ok(player.indexOf('target-banner')<player.indexOf('id="timer"'));assert.ok(display.indexOf('id="timer"')<display.indexOf('target-banner'));assert.ok(player.includes('<strong>45</strong>'));
});

test('reveal clock is idempotent, expires across clients and reloads, never exposes a pending result',()=>{
 const r=room(2);open(r);r.answers[1]={p0:{choice:0,prediction:-1},p1:{choice:1,prediction:0}};r.public.state.status='closed';
 settleRoom(r,1,'GUESS1',1000);assert.equal(r.public.results[1].revealedAt,1000);settleRoom(r,1,'GUESS1',8000);assert.equal(r.public.results[1].revealedAt,1000);
 assert.equal(revealRemaining(r.public,1000),REVEAL_MS);assert.equal(revealRemaining(JSON.parse(JSON.stringify(r.public)),6000),1000);assert.equal(revealRemaining(r.public,7000),0);
 for(const status of ['open','thinking','closed','ended'])assert.equal(revealRemaining({...r.public,state:{...r.public.state,status}},2000),0);
 delete r.public.results[1].revealedAt;assert.equal(revealRemaining(r.public,2000),0);
});

test('reveal summary shows actual target choice and correct guessers, not everyone choosing same answer; names are escaped',()=>{
 const r=room(4),s=open(r);s.targetName='<img onerror=x>';r.public.members.p1.name='<script>bad</script>';
 reveal(r,{p0:{choice:2,prediction:-1},p1:{choice:0,prediction:2},p2:{choice:2,prediction:0},p3:{choice:3,prediction:2}});
 const result=r.public.results[1],h=revealSummary(s,result,r.public.members);assert.ok(h.includes('共 2 人答對'));assert.ok(h.includes('設了十個鬧鐘'));assert.ok(h.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(!h.includes('<script>'));assert.ok(!h.includes('玩家2'));assert.ok(h.includes('玩家3'));
 const player=spotlightQuestion({s,result,pub:r.public,role:'viewer',uid:'p1',joined:true});assert.ok(player.includes('等待主持人開始下一題'));assert.ok(!player.includes('class="options'));assert.ok(player.includes('你猜中了'));
 const missing=revealSummary(s,{...result,targetAnswered:false},r.public.members);assert.ok(missing.includes('共 0 人答對'));assert.ok(missing.includes('沒有有效作答'));
 s.completed=true;const last=spotlightQuestion({s,result,pub:r.public,role:'display'});assert.ok(last.includes('本場完成'));assert.ok(!last.includes('等待主持人開始下一題'));
});
