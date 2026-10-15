import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,startRound,settleRoom,leaderboard} from '../src/game.js';
import {misunderstoodLeaderboard} from '../src/misunderstood.js';
import {SPOTLIGHT} from '../src/spotlight.js';
const members={a:{name:'甲',joined:1,seat:'0'},b:{name:'乙',joined:2,seat:'1'},c:{name:'丙',joined:3,seat:'2'},d:{name:'丁',joined:4,seat:'3'}};
const scores=board=>Object.fromEntries(board.map(p=>[p.id,p.score]));
const question={id:'q',text:'選哪項？',options:['A','B','C','D']};
test('wrong guesses score for the target, correct guesses score for the guesser; missing submissions never count',()=>{
 const r=newRoom('SCORE1');r.public.members=structuredClone(members);
 r.public.state=startRound(r,question,1000);
 r.answers[1]={a:{choice:0,prediction:-1},b:{choice:0,prediction:1},c:{choice:2,prediction:0}};
 r.public.state.status='closed';settleRoom(r,1);
 assert.deepEqual(scores(misunderstoodLeaderboard(r.public.results,members)),{a:1,b:0,c:0,d:0});
 assert.equal(scores(leaderboard(r.public.results,members)).c,1);
 assert.equal(scores(leaderboard(r.public.results,members)).b,0);
 assert.equal(r.hostOnly.spotlight.players.a.unguessed,1);
 const before=JSON.stringify(r.public.results);settleRoom(r,1);assert.equal(JSON.stringify(r.public.results),before);
 assert.equal(scores(misunderstoodLeaderboard(r.public.results,members)).a,1);
});
test('derive both new and existing room totals solely from published results; exclude target self score, missing targets and classic rounds',()=>{
 const results={
  1:{kind:SPOTLIGHT,targetUid:'a',targetAnswered:true,points:{a:0,b:0,c:1}},
  2:{kind:SPOTLIGHT,targetUid:'b',targetAnswered:true,points:{a:0,b:0,c:0}},
  3:{kind:SPOTLIGHT,targetUid:'a',targetAnswered:false,points:{b:0,c:0}},
  4:{points:{a:0,b:0}},
  5:{kind:SPOTLIGHT,targetUid:'a',targetAnswered:true,points:{a:0,b:0,c:1}},
 };
 const board=misunderstoodLeaderboard(results,members);
 assert.equal(scores(board).a,2);assert.equal(scores(board).b,2);
 assert.deepEqual(board.slice(0,2).map(p=>p.score),[2,2]);
 const snapshot=structuredClone(results);misunderstoodLeaderboard(results,members);assert.deepEqual(results,snapshot);
 const active={...members};delete active.b;assert.ok(!misunderstoodLeaderboard(results,active).some(p=>p.id==='b'));
 assert.equal(scores(misunderstoodLeaderboard(results,active)).a,2);
});
test('empty and incomplete stored snapshots stay safe; all seated players start at zero',()=>{
 assert.deepEqual(misunderstoodLeaderboard(),[]);
 assert.deepEqual(scores(misunderstoodLeaderboard(null,members)),{a:0,b:0,c:0,d:0});
 assert.deepEqual(scores(misunderstoodLeaderboard({1:null,2:{kind:SPOTLIGHT,targetAnswered:true,targetUid:'a'}},members)),{a:0,b:0,c:0,d:0});
});
test('published leaderboard matches private unguessed totals through full rotation',()=>{
 const r=newRoom('SCORE1');r.public.members=structuredClone(members);
 for(let n=1;n<=8;n++){
  r.public.state=startRound(r,{...question,id:`q${n}`},n*1000);
  const target=r.public.state.targetUid;r.answers[n]={};
  for(const id of Object.keys(members))if(id===target||id!=='d')r.answers[n][id]={choice:n%4,prediction:id===target?-1:id==='b'?n%4:(n+1)%4};
  r.public.state.status='closed';settleRoom(r,n);
  const totals=scores(misunderstoodLeaderboard(r.public.results,members));
  for(const id of Object.keys(members))assert.equal(totals[id],r.hostOnly.spotlight.players[id]?.unguessed||0);
 }
});
