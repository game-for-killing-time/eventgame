import {islandLayout} from './affinity.js';
export const SPOTLIGHT='spotlight-v1';
export const isSpotlight=s=>s?.ruleset===SPOTLIGHT;
export const targetFirst=s=>isSpotlight(s)&&s.answerFlow==='target-first-v1';
export function configureSpotlight(room,{questionsPerCycle=10,cycles=3}={}){
 const s=room?.public?.state;
 if(!isSpotlight(s)||s.status!=='waiting'||s.round!==0)throw Error('場次設定只能在第一題開始前修改。');
 if(!Number.isInteger(questionsPerCycle)||questionsPerCycle<1||questionsPerCycle>30||!Number.isInteger(cycles)||cycles<1||cycles>3)throw Error('每回合可設 1–30 題，場次可設 1–3 回合。');
 s.questionsPerCycle=questionsPerCycle;s.cycles=cycles;return room;
}
export function orderedMembers(room){return Object.keys(room.public.members||{}).filter(id=>!room.moderation?.[id]?.removed).sort((a,b)=>(room.public.members[a].joined||0)-(room.public.members[b].joined||0)||Number(room.public.members[a].seat||0)-Number(room.public.members[b].seat||0)||a.localeCompare(b));}
export function nextSpotlight(room){
 const ids=orderedMembers(room),order=[...(room.public.rotation?.order||[])];
 for(const id of ids)if(!order.includes(id))order.push(id);
 const last=order.indexOf(room.public.state.targetUid);
 for(let step=1;step<=order.length;step++){const id=order[(last+step)%order.length];if(ids.includes(id))return {id,order};}
 return {id:null,order};
}
export function startSpotlight(room,question,now,duration){
 const s=room.public.state,total=s.questionsPerCycle*s.cycles;
 if(s.round>=total||s.completed)throw Error('本場題目已完成，請結束並清理後開新場。');
 if(orderedMembers(room).length<2)throw Error('至少兩位玩家入座後，才可輪流猜主角。');
 const {id,order}=nextSpotlight(room);room.public.rotation={order};
 const first=s.answerFlow!=='simultaneous-v1';
 return {...s,answerFlow:first?'target-first-v1':'simultaneous-v1',attempt:(s.attempt||0)+1,round:s.round+1,cycle:Math.floor(s.round/s.questionsPerCycle)+1,questionInCycle:s.round%s.questionsPerCycle+1,targetUid:id,targetName:room.public.members[id].name,status:first?'thinking':'open',question,deadline:first?0:now+duration*1000};
}
const sameTurn=(s,e)=>s&&e&&s.code===e.code&&s.round===e.round&&s.attempt===e.attempt&&s.targetUid===e.targetUid;
export function activateGuesses(room,expected,now){
 if(!room)return null;
 const s=room.public.state,a=room.answers?.[s.round]?.[s.targetUid];
 if(!sameTurn(s,expected)||!targetFirst(s)||s.status!=='thinking'||!a||a.attempt!==s.attempt)return undefined;
 s.status='open';s.deadline=now+45000;return room;
}
export function skipTarget(room,expected){
 if(!room)return null;
 const s=room.public.state;
 if(!sameTurn(s,expected)||!targetFirst(s)||s.status!=='thinking'||room.answers?.[s.round]?.[s.targetUid])return undefined;
 const {id,order}=nextSpotlight(room);
 if(!id||id===s.targetUid)throw Error('沒有其他玩家可接棒，請等待朋友加入或結束房間。');
 room.public.rotation={order};s.targetUid=id;s.targetName=room.public.members[id].name;s.attempt++;s.deadline=0;
 return room;
}
export function settleSpotlight(room){
 const s=room.public.state,round=s.round;
 room.public.results??={};
 if(room.public.results[round]){s.status='revealed';return room;}
 const members=room.public.members||{},answers=Object.fromEntries(Object.entries(room.answers?.[round]||{}).filter(([id,a])=>members[id]&&!room.moderation?.[id]?.removed&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<4));
 const target=answers[s.targetUid],counts=[0,0,0,0],points={},choices={};
 for(const [id,a]of Object.entries(answers)){counts[a.choice]++;choices[id]=a.choice;points[id]=id!==s.targetUid&&target&&a.prediction===target.choice?1:0;}
 room.hostOnly??={};
 const affinity=room.hostOnly.affinity??={version:1,rounds:{},pairs:{}};
 const stats=room.hostOnly.spotlight??={version:1,rounds:{},players:{}};
 if(!stats.rounds[round]){
  const p=stats.players[s.targetUid]??={turns:0,guessed:0,unguessed:0,missed:0};p.turns++;
  if(!target)p.missed++;
  else for(const [id,a]of Object.entries(answers))if(id!==s.targetUid){
   if(a.prediction===target.choice)p.guessed++;else p.unguessed++;
   const [x,y]=[id,s.targetUid].sort();affinity.pairs??={};affinity.pairs[x]??={};const pair=affinity.pairs[x][y]??={shared:0,same:0};pair.shared++;if(a.choice===target.choice)pair.same++;
  }
  stats.rounds[round]=true;affinity.rounds??={};affinity.rounds[round]=true;
 }
 room.public.results[round]={kind:SPOTLIGHT,questionId:s.question.id,targetUid:s.targetUid,targetName:s.targetName,targetAnswered:!!target,...(target?{targetChoice:target.choice}:{}),total:Object.keys(answers).length,counts,winners:[],points,choices};
 room.public.island=islandLayout(members,affinity.pairs,round);s.status='revealed';
 if(round>=s.questionsPerCycle*s.cycles){s.completed=true;s.locked=true;awardMasters(room);}
 return room;
}
export function awardMasters(room){
 if(!isSpotlight(room?.public?.state))return room;
 const scores={};for(const r of Object.values(room.public.results||{}))for(const [id,p]of Object.entries(r.points||{}))scores[id]=(scores[id]||0)+p;
 const active=Object.keys(room.public.members||{}),best=Math.max(0,...active.map(id=>scores[id]||0));
 room.public.awards={title:'心水清大師',score:best,winners:best?Object.fromEntries(active.filter(id=>scores[id]===best).map(id=>[id,true])):{}};return room;
}
