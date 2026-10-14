import test from 'node:test';
import assert from 'node:assert/strict';
import {tally,leaderboard,newRoom,startRound,settleRoom} from '../src/game.js';
import {questions} from '../src/questions.js';
test('12 valid four-choice questions',()=>{assert.equal(questions.length,12);for(const q of questions)assert.equal(q.options.length,4);});
test('ties award any winning prediction; zero votes award nothing',()=>{assert.deepEqual(tally({a:{choice:0,prediction:1},b:{choice:1,prediction:0},c:{choice:2,prediction:3}}),{counts:[1,1,1,0],total:3,winners:[0,1,2],points:{a:1,b:1,c:0}});assert.deepEqual(tally(),{counts:[0,0,0,0],total:0,winners:[],points:{}});});
test('full round and idempotent settlement, stale retry cannot affect next round',()=>{const r=newRoom('PARTY1');r.public.members={a:{name:'甲'},b:{name:'乙'}};r.public.state=startRound(r,questions[0],1000);r.answers[1]={a:{choice:0,prediction:0},b:{choice:1,prediction:0}};r.public.state.status='closed';settleRoom(r,1);settleRoom(r,1);assert.deepEqual(leaderboard(r.public.results,r.public.members).map(x=>x.score),[1,1]);r.public.state=startRound(r,questions[1],10000);assert.equal(settleRoom(r,1),undefined);assert.equal(r.public.state.round,2);assert.throws(()=>startRound(r,questions[2],12000));});

import {characterId,characters} from '../src/characters.js';
test('room avatars stay stable across clients and allow repeated characters',()=>{
 const assignments=Array.from({length:100},(_,i)=>characterId(`viewer-${i}`,'PARTY1'));
 assert.ok(assignments.every(n=>Number.isInteger(n)&&n>=0&&n<characters.length));
 assert.equal(new Set(assignments).size,10);
 assert.ok(new Set(assignments).size<assignments.length);
 assert.deepEqual(assignments,Array.from({length:100},(_,i)=>characterId(`viewer-${i}`,'PARTY1')));
 assert.notDeepEqual(assignments,Array.from({length:100},(_,i)=>characterId(`viewer-${i}`,'PARTY2')));
});

import {pairStats,qualifies,addAffinityRound,islandLayout,migrateAffinity} from '../src/affinity.js';
test('affinity uses shared revealed answers only, exact 70% threshold, and idempotent rounds',()=>{
 const a={version:1,rounds:{},pairs:{}};
 addAffinityRound(a,1,{x:{choice:0,prediction:1},y:{choice:0,prediction:2},late:{choice:1}});
 assert.equal(qualifies(pairStats(a.pairs,'y','x')),false);
 addAffinityRound(a,2,{x:{choice:1},y:{choice:1}});assert.deepEqual(pairStats(a.pairs,'x','y'),{shared:2,same:2});assert.equal(qualifies(pairStats(a.pairs,'x','y')),true);
 addAffinityRound(a,2,{x:{choice:0},y:{choice:2}});assert.deepEqual(pairStats(a.pairs,'x','y'),{shared:2,same:2});
 assert.deepEqual(pairStats(a.pairs,'x','late'),{shared:1,same:0});
 assert.equal(qualifies({shared:2,same:1}),false);assert.equal(qualifies({shared:10,same:7}),true);assert.equal(qualifies({shared:10,same:6}),false);
 addAffinityRound(a,3,{});assert.deepEqual(pairStats(a.pairs,'x','y'),{shared:2,same:2});
});
test('complete-link groups do not chain unlike players, ties and layout are stable',()=>{
 const members={a:{seat:'0'},b:{seat:'1'},c:{seat:'2'}};
 const pairs={a:{b:{shared:10,same:9},c:{shared:10,same:4}},b:{c:{shared:10,same:9}}};
 const layout=islandLayout(members,pairs,2);
 assert.equal(layout.positions.b.x-layout.positions.a.x,96);assert.equal(layout.positions.c.x-layout.positions.b.x,196);
 assert.deepEqual(layout,islandLayout({c:members.c,b:members.b,a:members.a},pairs,2));
 assert.deepEqual(Object.keys(layout).sort(),['positions','round','version','width']);
 assert.ok(Object.values(layout.positions).every(p=>Object.keys(p).sort().join(',')==='x,y'));
});
test('migration excludes open/closed current answers and can resume without double scores',()=>{
 const r=newRoom('OLD123');r.public.members={a:{name:'a',seat:'0'},b:{name:'b',seat:'1'}};
 r.public.state={...r.public.state,round:3,status:'closed'};r.public.results={1:tally({a:{choice:0,prediction:0},b:{choice:0,prediction:0}}),2:tally({a:{choice:1,prediction:1},b:{choice:1,prediction:1}})};
 r.answers={1:{a:{choice:0},b:{choice:0}},2:{a:{choice:1},b:{choice:1}},3:{a:{choice:2},b:{choice:0}}};
 migrateAffinity(r);assert.deepEqual(pairStats(r.hostOnly.affinity.pairs,'a','b'),{shared:2,same:2});assert.equal(r.public.island.round,2);
 const before=structuredClone(r);migrateAffinity(r);assert.deepEqual(r,before);assert.equal(settleRoom(r,3,'WRONG1'),undefined);
 settleRoom(r,3,'OLD123');assert.deepEqual(pairStats(r.hostOnly.affinity.pairs,'a','b'),{shared:3,same:2});const once=structuredClone(r);settleRoom(r,3,'OLD123');assert.deepEqual(r,once);
 const replaced={a:r.public.members.a,newcomer:{name:'new',seat:'1'}};const next=islandLayout(replaced,r.hostOnly.affinity.pairs,3);assert.equal(next.positions.newcomer.x-next.positions.a.x,196);
});
