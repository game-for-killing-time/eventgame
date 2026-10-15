import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,startRound,settleRoom,leaderboard,publishRevealedChoices} from '../src/game.js';
import {configureSpotlight,nextSpotlight,awardMasters} from '../src/spotlight.js';
import {pairStats} from '../src/affinity.js';
import {questions} from '../src/questions.js';
function room(n=10){const r=newRoom('GUESS1');for(let i=0;i<n;i++)r.public.members[`p${i}`]={name:`玩家${i}`,seat:String(i),joined:i+1};return r;}
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
test('player markup has target-only choice form, guesser dual form and real revealed result without private counters',()=>{
 const r=room(2),s=open(r),props={s,pub:r.public,role:'viewer',uid:'p0',joined:true,canAnswer:true,choice:null,prediction:null};
 let html=spotlightQuestion(props);assert.ok(html.includes(questions[0].text.replaceAll('你','玩家0')));assert.ok(html.includes('name="choice"'));assert.ok(!html.includes('name="prediction"'));assert.ok(html.includes('提交我的答案'));
 html=spotlightQuestion({...props,uid:'p1'});assert.ok(html.includes('name="prediction"'));assert.ok(html.includes('你猜 玩家0，他會怎樣選？'));assert.ok(html.indexOf('name="prediction"')<html.indexOf('name="choice"'));
 reveal(r,{p0:{choice:1,prediction:-1},p1:{choice:1,prediction:1}});html=spotlightQuestion({...props,uid:'p1',result:r.public.results[1]});assert.ok(html.includes('你猜中了'));assert.ok(html.includes('再睡五分鐘'));assert.ok(!html.includes('name="prediction"'));assert.ok(!html.includes('未被猜中'));
});
