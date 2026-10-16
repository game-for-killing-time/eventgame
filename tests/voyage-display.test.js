import test from 'node:test';
import assert from 'node:assert/strict';
import {voyageDisplayView} from '../src/voyage-display-view.js';
import * as E from '../src/voyage-engine.js';
import {createVoyage,project} from '../src/voyage-remote-model.js';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const firstChoice='初選公開記錄：阿晴把繩索交給伙伴。';
const secondChoice='再選公開記錄：阿晴改為留下訊號。';
const storyTexts={intro:'主線開場：渡船抵達北岸。',twist:'主線變化：回程渡船突然失聯。',reveal:'主線結果：眾人找到了燈塔鑰匙。',ending:'主線結局：救援船帶著伙伴回航。'};

function fixture(phase='intro'){
 return {
  id:'display-test',packId:'last-light-survival-v1',phase,round:5,deadline:60000,duration:60,submitted:1,
  players:{
   highScore:{name:'最後入座者',seat:8,points:999,alive:true},
   dead:{name:'已淘汰者',seat:1,points:1000,alive:false},
   spectator:{name:'中途觀戰者',seat:2,points:1001,alive:true,spectator:true},
   firstSeat:{name:'最先入座者',seat:0,points:0,alive:true},
   legacy:{name:'沒有生存欄位者',seat:3,points:1}
  },
  currentQuestion:{text:'大家下一步如何行動？',options:[{text:'留下標記'},{text:'觀察燈光'}]},
  view:{
   title:'潮汐島測試',scene:'第五幕的燈塔',...storyTexts,
   lines:[firstChoice],follow:[secondChoice],
   expedition:{teams:[],resources:[],consequence:null,ending:null},
   survival:{title:'島上生存狀態',text:'危險結束後確認生還人數。',alive:[],dead:[]},
   guessResult:{targetName:'私密猜測主角',choice:0,options:['私密猜測答案'],correct:1,wrong:0,total:1,rows:[{name:'私密猜測玩家',prediction:0}]},
   quotes:[{name:'私密短答玩家',text:'私密短答內容'}],
   cards:[{name:'私人回顧名字',keepsake:'私人回顧內容',events:[]}]
  }
 };
}

test('display presents living participants in seat order without scores or old panels',()=>{
 const html=voyageDisplayView(fixture('discussion'));
 for(const label of ['仍在生存的玩家','故事主要路向','玩家選擇'])assert.ok(html.includes(label),label);
 const names=['最先入座者','沒有生存欄位者','最後入座者'];
 names.forEach(name=>assert.ok(html.includes(name),name));
 assert.ok(html.indexOf(names[0])<html.indexOf(names[1]));
 assert.ok(html.indexOf(names[1])<html.indexOf(names[2]));
 for(const hidden of ['已淘汰者','中途觀戰者','原來你是這樣想的','島上的共同紀錄','排行榜','data-voyage-rank','私密猜測主角','私密猜測答案','私密猜測玩家','私密短答內容','私人回顧內容'])assert.ok(!html.includes(hidden),hidden);
 assert.match(html,/data-voyage-countdown/);
 assert.match(html,/data-choice-feed/);
 assert.match(html,/data-choice-toggle/);
});

const firstVisible=new Set(['revealed','twistIntro','twist','twistClosed','discussion','ended']);
const secondVisible=new Set(['discussion','ended']);
for(const phase of ['lobby','intro','routing','first','firstClosed','revealed','twistIntro','twist','twistClosed','discussion','ended']){
 test(`display only reveals the permitted player choices during ${phase}`,()=>{
  const html=voyageDisplayView(fixture(phase));
  assert.equal(html.includes(firstChoice),firstVisible.has(phase),'first choice visibility');
  assert.equal(html.includes(secondChoice),secondVisible.has(phase),'second choice visibility');
 });
}

for(const [phase,field]of [['intro','intro'],['first','intro'],['firstClosed','intro'],['revealed','intro'],['twistIntro','twist'],['twist','twist'],['twistClosed','twist'],['discussion','reveal'],['ended','ending']]){
 test(`display keeps the ${field} story prominent during ${phase}`,()=>{
  const html=voyageDisplayView(fixture(phase));
  assert.ok(html.includes(storyTexts[field]),`${field} story must be visible`);
  assert.match(html,/第\s*5\s*幕\s*\/\s*12/);
  if(['intro','first','firstClosed','revealed'].includes(phase)){
   assert.ok(!html.includes(storyTexts.twist),'unopened twist must stay hidden');
   assert.ok(!html.includes(storyTexts.reveal),'unsettled outcome must stay hidden');
   assert.ok(!html.includes(storyTexts.ending),'future ending must stay hidden');
  }
 });
}

test('display handles no room and an empty lobby without inventing participants',()=>{
 assert.match(voyageDisplayView(null),/等待|還沒開場/);
 const s=fixture('lobby');s.round=0;s.players={};s.view.lines=[];s.view.follow=[];
 const html=voyageDisplayView(s);
 assert.ok(html.includes('仍在生存的玩家'));
 assert.ok(!html.includes('最先入座者'));
 assert.doesNotMatch(html,/undefined|NaN/);
});

for(const [outcome,title,round]of [['bad','Bad Ending · 全滅',4],['aborted','主持人提前結束 · 未完成逃生',7]]){
 test(`display preserves the actual scene and outcome when the adventure is ${outcome}`,()=>{
  const s=fixture('ended');s.round=round;s.outcome=outcome;
  s.players={dead:{name:'全滅測試玩家',seat:0,alive:false}};
  s.view.survival={title,text:storyTexts.ending,outcome,alive:[],dead:[]};
  const html=voyageDisplayView(s);
  assert.ok(html.includes(title));
  assert.ok(html.includes(storyTexts.ending));
  assert.match(html,new RegExp(`第\\s*${round}\\s*幕\\s*\\/\\s*12`));
  assert.ok(!html.includes('全滅測試玩家'));
  assert.doesNotMatch(html,/undefined|NaN/);
 });
}

test('display escapes participant names, narrative and choice feed text',()=>{
 const s=fixture('discussion');
 const payload=kind=>`${kind}<img src=x onerror="alert(1)"> & 'quoted'`;
 s.players={one:{name:payload('名字'),seat:0,alive:true}};
 s.view.scene=payload('幕名');s.view.reveal=payload('主線');s.view.lines=[payload('選擇')];s.view.follow=[];
 const html=voyageDisplayView(s);
 for(const kind of ['名字','幕名','主線','選擇']){
  assert.ok(html.includes(escapeHtml(payload(kind))),kind);
  assert.ok(!html.includes(payload(kind)),kind);
 }
 assert.ok(!html.includes('<img src=x'));
 assert.doesNotMatch(html,/<script\b|onerror="alert/);
});

test('real public projections keep initial decisions visible through the twist and reveal final decisions afterwards',()=>{
 const room=createVoyage('DISPLAY',0);const s=room.hostOnly;
 E.join(s,'a','真實玩家甲');E.join(s,'b','真實玩家乙');
 const draw=()=>voyageDisplayView(project(room).public);
 const advance=()=>assert.equal(E.autoAdvance(s,s.deadline),true);
 E.next(s,100,60);advance();
 E.submitFirst(s,'a',s.round,0,0,s.deadline-1);
 E.submitFirst(s,'b',s.round,1,0,s.deadline-1);
 assert.equal(s.phase,'first');
 const pendingFirst=E.publicView({...s,phase:'revealed'}).lines[0];
 assert.ok(!draw().includes(escapeHtml(pendingFirst)));
 advance();assert.equal(s.phase,'revealed');
 const publicFirst=E.publicView(s).lines[0];
 assert.ok(draw().includes(escapeHtml(publicFirst)));
 advance();assert.equal(s.phase,'twistIntro');
 assert.ok(draw().includes(escapeHtml(publicFirst)));
 advance();assert.equal(s.phase,'twist');
 E.submitSecond(s,'a',s.round,{stance:'change',choice:1,text:'不應進入展示的短答',consent:false},s.deadline-1);
 const before=draw();assert.ok(before.includes(escapeHtml(publicFirst)));
 assert.ok(!before.includes('不應進入展示的短答'));
 advance();assert.equal(s.phase,'discussion');
 const publicSecond=E.publicView(s).follow[0];
 const after=draw();assert.ok(after.includes(escapeHtml(publicFirst)));
 assert.ok(after.includes(escapeHtml(publicSecond)));
 assert.ok(!after.includes('不應進入展示的短答'));
});
