export function pairStats(pairs,a,b){const [x,y]=[a,b].sort();return pairs?.[x]?.[y]||{shared:0,same:0};}
export function qualifies(p){return p.shared>=2&&p.same*10>=p.shared*7;}
export function addAffinityRound(affinity,round,answers={}){
 if(affinity.rounds?.[round])return affinity;
 affinity.rounds??={};affinity.pairs??={};
 const ids=Object.keys(answers).filter(id=>Number.isInteger(answers[id].choice)&&answers[id].choice>=0&&answers[id].choice<4).sort();
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const [a,b]=[ids[i],ids[j]];affinity.pairs[a]??={};const p=affinity.pairs[a][b]??={shared:0,same:0};
  p.shared++;if(answers[a].choice===answers[b].choice)p.same++;
 }
 affinity.rounds[round]=true;return affinity;
}
export function islandLayout(members={},pairs={},round=0){
 const order=Object.keys(members).sort((a,b)=>(Number(members[a].seat??999)-Number(members[b].seat??999))||a.localeCompare(b));
 let groups=order.map(id=>[id]);
 while(true){let best=null;
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
   const links=groups[i].flatMap(a=>groups[j].map(b=>pairStats(pairs,a,b)));
   if(!links.every(qualifies))continue;
   const score=Math.min(...links.map(p=>p.same/p.shared));
   if(!best||score>best.score)best={i,j,score};
  }
  if(!best)break;
  groups[best.i]=[...groups[best.i],...groups[best.j]].sort((a,b)=>order.indexOf(a)-order.indexOf(b));groups.splice(best.j,1);
 }
 const positions={};let x=40;
 for(const group of groups){for(const id of group){positions[id]={x,y:0};x+=96;}x+=100;}
 return {version:1,round,width:Math.max(600,x-60),positions};
}
export function migrateAffinity(room){
 if(!room?.public?.state)return room;
 if(room.hostOnly?.affinity?.version===1)return room;
 const affinity={version:1,rounds:{},pairs:{}};
 const rounds=Object.keys(room.public.results||{}).map(Number).filter(n=>n<room.public.state.round||(n===room.public.state.round&&['revealed','ended'].includes(room.public.state.status))).sort((a,b)=>a-b);
 for(const round of rounds)addAffinityRound(affinity,round,room.answers?.[round]||{});
 room.hostOnly??={};room.hostOnly.affinity=affinity;
 room.public.island=islandLayout(room.public.members,affinity.pairs,rounds.at(-1)||0);
 return room;
}
