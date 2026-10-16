import {validDuration} from './voyage-timing.js';
import {isSurvival,living,resolveSurvival,survivalSummary} from './voyage-survival.js';
import {voyage,legacyVoyage} from './voyage-pack.js';
import {islandLayout} from './affinity.js';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
export const reading=s=>isSurvival(s)&&['intro','revealed','twistIntro','discussion'].includes(s.phase);
const readFor=(s,phase,now,seconds)=>{s.phase=phase;s.deadline=now+seconds*1000;};
export const active=s=>['routing','first','twist'].includes(s.phase);
export const pack=s=>!s||isSurvival(s)?voyage:legacyVoyage;
export const scene=s=>pack(s).rounds[s.round-1];
export function create(now=Date.now(),packId=voyage.id){return {version:3,packId,casualties:{},id:crypto.randomUUID(),phase:'lobby',round:0,deadline:0,duration:60,players:{},routes:{},first:{},second:{},history:[],scored:{},shared:{},hidden:{},chat:[],cast:[],turns:{},target:null,currentQuestion:null,affinity:{rounds:{},pairs:{}},results:{},island:islandLayout(),started:now};}
export function join(s,id,name){check(s.phase!=='ended','本場已結束');check(typeof name==='string'&&name.trim()&&name.trim().length<=20,'暱稱需為 1–20 字');if(s.players[id])return;check(Object.keys(s.players).length<20,'最多 20 位玩家');const seat=Object.keys(s.players).length;s.players[id]={name:name.trim(),seat,alive:!(isSurvival(s)&&s.round>0),spectator:isSurvival(s)&&s.round>0,group:'red',points:0,traits:{},events:[]};const x=Math.max(-156,...Object.values(s.island.positions).map(p=>p.x))+196;s.island.positions[id]={x,y:0};s.island.width=Math.max(s.island.width,x+140);if(scene(s)?.routes&&s.phase!=='routing')s.routes[id]=scene(s).routes[seat%2].id;}
export function narrative(s,text){const names=s.cast.map(id=>s.players[id]?.name).filter(Boolean);return text.replaceAll('{lead}',names[0]||'同行伙伴').replaceAll('{partner}',names[1]||names[0]||'另一位伙伴');}
export function question(s,id){return s.currentQuestion||null;}
export function next(s,now=Date.now(),duration=60){check(['lobby','discussion'].includes(s.phase),'請先完成小變化揭曉與討論');check(s.round<12,'故事已完成');check(living(s).length,'沒有可繼續冒險的玩家');check(validDuration(duration,true),'作答秒數不正確');const ids=living(s).sort((a,b)=>(s.turns[a]||0)-(s.turns[b]||0)||s.players[a].seat-s.players[b].seat);s.target=ids[0];s.turns[s.target]=(s.turns[s.target]||0)+1;s.round++;s.routes={};s.first={};s.second={};s.duration=duration;s.phase=scene(s).routes?'routing':'first';s.deadline=duration?now+duration*1000:Number.MAX_SAFE_INTEGER;s.cast=[s.target,...ids.filter(id=>id!==s.target)].slice(0,2);s.currentQuestion=s.round===6&&s.players[s.target].trapped===6?scene(s).trapped:scene(s).question||null;if(isSurvival(s))readFor(s,'intro',now,12);}
function open(s,id,phase,now){check(!!s.players[id],'請先加入');check(s.players[id].alive!==false,'角色已淘汰，現在可以觀戰及聊天');check(s.phase===phase&&now<s.deadline,'作答已截止或階段已更新');}
export function route(s,id,value,now=Date.now()){open(s,id,'routing',now);check(id===s.target,'本輪由主角選路');check(scene(s).routes.some(r=>r.id===value),'路線不存在');s.routes[id]=value;}
export function begin(s,now=Date.now()){check(s.phase==='routing','目前不是選路階段');const route=s.routes[s.target]||scene(s).routes[s.players[s.target].seat%2].id;s.routes[s.target]=route;s.currentQuestion=scene(s).routes.find(r=>r.id===route).question;s.phase='first';s.deadline=s.duration?now+s.duration*1000:Number.MAX_SAFE_INTEGER;}
const validChoice=(q,v)=>Number.isInteger(v)&&v>=0&&v<q.options.length;
export function submitFirst(s,id,round,choice,prediction,now=Date.now()){open(s,id,'first',now);check(s.round===round,'幕次已改變');const q=question(s,id);check(q&&validChoice(q,choice),'請選一個有效選項');check(id===s.target||validChoice(q,prediction),'請猜主角會選哪個答案');s.first[id]={choice,prediction:id===s.target?null:prediction};}
export function submitSecond(s,id,round,{stance,choice,text='',consent=false},now=Date.now()){open(s,id,'twist',now);check(s.round===round,'幕次已改變');check(['keep','change','depends'].includes(stance),'請選擇小變化後的想法');check(typeof text==='string'&&text.length<=100,'短答最多 100 字');check(typeof consent==='boolean','公開設定不正確');const q=question(s,id);check(q,'題目尚未準備');if(stance==='keep')check(!!s.first[id],'這幕尚未初選，請選「重新選擇」');if(stance==='change'){check(validChoice(q,choice),'請選小變化後的選項');check(choice!==s.first[id]?.choice,'與初選相同，請選「維持」');}s.second[id]={stance,choice:stance==='keep'?s.first[id].choice:stance==='change'?choice:null,text:text.trim(),consent};}
export function close(s){check(['first','twist'].includes(s.phase),'目前沒有開放作答');s.phase+='Closed';}
export function extend(s,now=Date.now()){check(active(s)&&now<s.deadline,'已截止，不能延長');s.deadline+=15000;}
export function revealFirst(s,now=Date.now()){if(s.phase==='revealed')return;check(s.phase==='firstClosed','請先截止初選');if(!s.results[s.round]){const target=s.first[s.target],q=question(s),guesses=Object.entries(s.first).filter(([id])=>id!==s.target);const rows=guesses.map(([id,a])=>({id,name:s.players[id].name,prediction:a.prediction,choice:a.choice,correct:target?a.prediction===target.choice:null,same:target?a.choice===target.choice:null}));const correct=rows.filter(r=>r.correct).length;s.results[s.round]={target:s.target,targetName:s.players[s.target].name,choice:target?.choice??null,options:q.options.map(o=>o.text),total:rows.length,correct,wrong:target?rows.length-correct:null,rows};if(target){for(const row of rows){if(row.correct)s.players[row.id].points++;const [a,b]=[s.target,row.id].sort();s.affinity.pairs[a]??={};const p=s.affinity.pairs[a][b]??={shared:0,same:0};p.shared++;if(row.same)p.same++;}}s.affinity.rounds[s.round]=true;s.island=islandLayout(s.players,s.affinity.pairs,s.round);}s.phase='revealed';if(isSurvival(s))readFor(s,'revealed',now,12);}
export function twist(s,now=Date.now()){check(s.phase==='revealed','請先揭曉初選');s.phase='twist';s.deadline=s.duration?now+s.duration*1000:Number.MAX_SAFE_INTEGER;}
function firstLine(s,id,a){return `${s.players[id].name}${question(s,id).options[a.choice].action}。`;}
function secondLine(s,id,a){const name=s.players[id].name,q=question(s,id);if(a.stance==='depends')return `${name}想再確認一個條件，尚未決定是否改選。`;if(a.stance==='keep')return `${name}仍然${q.options[a.choice].action}。`;return `${name}在小變化後，改為「${q.options[a.choice].text}」。`;}
export function revealSecond(s,now=Date.now()){if(['discussion','ended'].includes(s.phase))return;check(s.phase==='twistClosed','請先截止小變化');if(s.history.some(h=>h.round===s.round))return;
 const entries=[];for(const [id,p]of Object.entries(s.players)){if(p.alive===false)continue;const a=s.first[id],b=s.second[id],q=question(s,id);if(s.round===6)delete p.trapped;if(!a&&!b)continue;const effective=b?(b.stance==='depends'?null:b.choice):a.choice;const event={round:s.round,title:scene(s).title,first:a?firstLine(s,id,a):'',second:b?secondLine(s,id,b):'',text:b?.text||'',consent:b?.consent===true,stance:b?.stance||'unanswered',choice:effective,choiceText:effective===null?'尚未決定':q.options[effective].text};p.events.push(event);entries.push({id,...event});if(effective!==null){const tag=q.options[effective].trait;if(tag)p.traits[tag]=(p.traits[tag]||0)+1;}if(s.round===5&&effective===3)p.trapped=6;if(s.round===6)delete p.trapped;}
 s.history.push({round:s.round,title:scene(s).title,entries,reveal:scene(s).reveal});
 if(s.round===11){const counts=[0,0,0,0];for(const e of entries)if(e.choice!==null)counts[e.choice]++;s.ending=counts.some(Boolean)?counts.indexOf(Math.max(...counts)):1;}
 s.phase=s.round===12?'ended':'discussion';resolveSurvival(s,scene(s));if(isSurvival(s)&&s.phase==='discussion')readFor(s,'discussion',now,15);
}
export function consent(s,id,round,value){const e=s.players[id]?.events.find(e=>e.round===round);check(e,'找不到這段回顧');check(typeof value==='boolean','公開設定不正確');e.consent=value;const entry=s.history.find(h=>h.round===round)?.entries.find(e=>e.id===id);if(entry)entry.consent=value;if(s.round===round&&s.second[id])s.second[id].consent=value;}
export function card(s,id){const p=s.players[id];check(p,'找不到玩家');return {name:p.name,survival:isSurvival(s)?(p.spectator?'本場觀戰，未參與逃生':p.alive===false?`第 ${p.deathRound} 幕淘汰：${p.deathReason}`:s.outcome==='good'||s.outcome==='partial'?'生還通關':'尚未完成逃生'):null,events:p.events.map(e=>({round:e.round,title:e.title,first:e.first,second:e.second,text:e.text,consent:e.consent})),keepsake:p.events.find(e=>e.round===12)?.choiceText||'這段一起走過的旅程',note:'這是本場選擇的回顧，不是人格判定或心理測驗。'};}
export function publicView(s){const visibleFirst=['revealed','twistIntro','twist','twistClosed','discussion','ended'].includes(s.phase);const visibleSecond=['discussion','ended'].includes(s.phase);const lines=visibleFirst?Object.entries(s.first).map(([id,a])=>firstLine(s,id,a)):[];const follow=visibleSecond?Object.entries(s.second).map(([id,a])=>secondLine(s,id,a)):[];const quotes=visibleSecond?Object.entries(s.second).filter(([id,a])=>a.consent&&a.text&&!s.hidden[`${s.round}/${id}`]).map(([id,a])=>({id,name:s.players[id].name,text:a.text})):[];
 return {title:pack(s).title,survival:survivalSummary(s),round:s.round,phase:s.phase,target:s.target,targetName:s.players[s.target]?.name||null,guessResult:visibleFirst?s.results[s.round]||null:null,island:s.island,intro:narrative(s,scene(s)?.intro||pack(s).opening),scene:scene(s)?.title||'準備登島',twist:['twistIntro','twist','twistClosed','discussion','ended'].includes(s.phase)?scene(s)?.twist:'',lines,follow,quotes,reveal:visibleSecond?scene(s)?.reveal:'',discuss:visibleSecond?scene(s)?.discuss:'',ending:s.phase==='ended'?(survivalSummary(s)?.text||pack(s).endings[s.ending??1]):null,cards:s.phase==='ended'?Object.keys(s.shared).filter(id=>s.shared[id]).map(id=>{const c=card(s,id);c.events=c.events.map(e=>({...e,text:e.consent&&!s.hidden[`${e.round}/${id}`]?e.text:''}));return c;}):[]};}

// Each transaction advances one stage, giving returning viewers a full reading window.
export function autoAdvance(s,now=Date.now()){
 if(reading(s)){
  if(now<s.deadline)return false;
  if(s.phase==='intro'){s.phase=scene(s).routes?'routing':'first';s.deadline=s.duration?now+s.duration*1000:Number.MAX_SAFE_INTEGER;}
  else if(s.phase==='revealed')readFor(s,'twistIntro',now,10);
  else if(s.phase==='twistIntro'){s.phase='revealed';twist(s,now);}
  else next(s,now,s.duration);
  return true;
 }
 if(!active(s))return false;
 const ids=living(s),expired=s.duration!==0&&now>=s.deadline;
 if(isSurvival(s)&&!expired)return false;
 if(s.phase==='routing'){if(!expired&&!s.routes[s.target])return false;begin(s,now);return true;}
 const answers=s.phase==='first'?s.first:s.second;
 if(!expired&&(!ids.length||!ids.every(id=>answers[id])))return false;
 const first=s.phase==='first';close(s);if(first)revealFirst(s,now);else revealSecond(s,now);return true;
}
// Firebase may return numeric round keys as an array with null slots.
export function misunderstoodScore(s,id){return Object.values(s.results||{}).reduce((total,r)=>total+(r&&r.target===id&&r.choice!==null?(r.wrong||0):0),0);}
