import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,startRound,settleRoom} from '../src/game.js';
import {activateGuesses} from '../src/spotlight.js';
import {autoRevealReason,autoRevealRound} from '../src/auto-reveal.js';

const question={id:'auto-test',text:'測試題',options:['甲','乙','丙','丁']};
function fixture(){
 const r=newRoom('AUTO01');
 r.public.members={a:{name:'甲',joined:1,seat:'0'},b:{name:'乙',joined:2,seat:'1'}};
 r.public.state=startRound(r,question,1000);
 const expected={...r.public.state};
 r.answers[1]={a:{choice:1,prediction:-1,attempt:expected.attempt,at:1100}};
 activateGuesses(r,expected,1200);
 return r;
}
function complete(r){r.answers[1].b={choice:2,prediction:1,attempt:r.public.state.attempt,at:1500};}

test('wait for every active member, then reveal once with the shared timestamp',()=>{
 const r=fixture(),expected={...r.public.state};
 assert.equal(autoRevealRound(r,expected,1400),undefined);
 complete(r);assert.equal(autoRevealReason(r,1500),'all-answered');
 assert.equal(autoRevealRound(r,expected,1500,1700),r);
 assert.equal(r.public.state.status,'revealed');
 assert.equal(r.public.results[1].revealedAt,1700);
 assert.equal(r.public.results[1].points.b,1);
 const before=structuredClone(r);
 assert.equal(autoRevealRound(r,expected,1800),undefined);assert.deepEqual(r,before);
});
test('deadline reveals incomplete or empty answers, but not one millisecond early',()=>{
 for(const empty of [false,true]){
  const r=fixture(),expected={...r.public.state};if(empty)r.answers={};
  assert.equal(autoRevealReason(r,expected.deadline-1),null);
  assert.equal(autoRevealReason(r,expected.deadline),'timeout');
  autoRevealRound(r,expected,expected.deadline);
  assert.equal(r.public.results[1].total,empty?0:1);
 }
});
test('manual close always keeps results private until manual reveal, even after deadline',()=>{
 const r=fixture(),expected={...r.public.state};complete(r);r.public.state.status='closed';
 assert.equal(autoRevealRound(r,expected,expected.deadline+1000),undefined);
 assert.equal(r.public.results,undefined);
 settleRoom(r,1,'AUTO01',expected.deadline+2000);assert.equal(r.public.state.status,'revealed');
});
test('ignore stale room, round and attempt requests and never reveal during target thinking',()=>{
 const r=fixture(),expected={...r.public.state};complete(r);
 for(const changed of [{code:'OTHER1'},{round:0},{attempt:0}])assert.equal(autoRevealRound(r,{...expected,...changed},1500),undefined);
 r.public.state.status='thinking';assert.equal(autoRevealRound(r,expected,100000),undefined);
 r.public.state.status='ended';assert.equal(autoRevealRound(r,expected,100000),undefined);
 assert.equal(autoRevealRound(null,expected,1500),null);
});
test('late joiners must answer; removed members do not block; invalid or stale answers do not count',()=>{
 const r=fixture();complete(r);
 r.public.members.c={name:'丙',joined:3,seat:'2'};assert.equal(autoRevealReason(r,1600),null);
 r.moderation.c={removed:true};assert.equal(autoRevealReason(r,1600),'all-answered');
 for(const invalid of [{attempt:0},{choice:4},{prediction:-1}]){
  const next=structuredClone(r);Object.assign(next.answers[1].b,invalid);assert.equal(autoRevealReason(next,1600),null);
 }
 r.public.members={};assert.equal(autoRevealReason(r,1600),null);
});
test('classic rounds also reveal after all answers and reject stale next-round work',()=>{
 const r=newRoom('CLASS1','classic');r.public.members={a:{name:'甲'}};
 r.public.state=startRound(r,question,1000);const expected={...r.public.state};
 r.answers[1]={a:{choice:0,prediction:0}};
 autoRevealRound(r,expected,2000);assert.equal(r.public.results[1].points.a,1);
 r.public.state=startRound(r,question,3000);assert.equal(autoRevealRound(r,expected,100000),undefined);
 assert.equal(r.public.state.status,'open');
});
