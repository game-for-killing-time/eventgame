import {migrateAffinity,addAffinityRound,islandLayout} from './affinity.js';
export function tally(answers={}) {
 const counts=[0,0,0,0];
 for(const a of Object.values(answers)) if(Number.isInteger(a.choice)&&a.choice>=0&&a.choice<4) counts[a.choice]++;
 const total=counts.reduce((a,b)=>a+b,0), max=Math.max(...counts);
 const winners=total ? counts.flatMap((n,i)=>n===max?[i]:[]) : [];
 const points=Object.fromEntries(Object.entries(answers).map(([id,a])=>[id,winners.includes(a.prediction)?1:0]));
 return {counts,total,winners,points};
}
export function leaderboard(results={},members={}) {
 const scores={};
 for(const result of Object.values(results)) for(const [id,score] of Object.entries(result.points||{})) scores[id]=(scores[id]||0)+score;
 return Object.entries(members).map(([id,m])=>({id,name:m.name,score:scores[id]||0})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'zh-Hant'));
}
export function newRoom(code) {return {public:{state:{code,status:'waiting',round:0,locked:false,chatOpen:true,chatEffects:true,submitEffects:true,deadline:0},members:{}},answers:{},stories:{},moderation:{},chat:{}};}
export function startRound(room,question,now,duration=45) {
 if(!room||!['waiting','revealed'].includes(room.public.state.status)) throw Error('請先揭曉目前題目。');
 const s=room.public.state; return {...s,round:s.round+1,status:'open',question,deadline:now+duration*1000};
}
export function settleRoom(room,expectedRound,expectedCode=room?.public?.state?.code) {
 if(!room?.public?.state || room.public.state.round!==expectedRound || room.public.state.code!==expectedCode) return;
 const s=room.public.state;
 if(s.status==='revealed') return publishRevealedChoices(migrateAffinity(room));
 if(s.status!=='closed') return;
 migrateAffinity(room);
 room.public.results??={};
 room.public.results[expectedRound]??=tally(room.answers?.[expectedRound]||{});
 addAffinityRound(room.hostOnly.affinity,expectedRound,room.answers?.[expectedRound]||{});
 room.public.island=islandLayout(room.public.members,room.hostOnly.affinity.pairs,expectedRound);
 s.status='revealed'; return publishRevealedChoices(room);
}
// Publish only personal choices from completed rounds, never predictions or open answers.
export function publishRevealedChoices(room){
 const s=room?.public?.state;if(!s)return room;
 for(const [round,result] of Object.entries(room.public.results||{})){
  if(Number(round)>s.round||(Number(round)===s.round&&!['revealed','ended'].includes(s.status)))continue;
  result.choices??=Object.fromEntries(Object.entries(room.answers?.[round]||{}).filter(([,a])=>Number.isInteger(a.choice)&&a.choice>=0&&a.choice<4).map(([id,a])=>[id,a.choice]));
 }
 return room;
}
