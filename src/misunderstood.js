import {SPOTLIGHT} from './spotlight.js';

// Published points contain only valid submissions: 0 means a wrong prediction
// when the target answered. Missing submissions and the target never count.
export function misunderstoodLeaderboard(results={},members={}){
 const scores={};
 for(const r of Object.values(results||{})){
  if(r?.kind!==SPOTLIGHT||r.targetAnswered!==true||!r.targetUid)continue;
  const wrong=Object.entries(r.points||{}).filter(([id,points])=>id!==r.targetUid&&points===0).length;
  scores[r.targetUid]=(scores[r.targetUid]||0)+wrong;
 }
 return Object.entries(members||{}).map(([id,m])=>({id,name:m.name,score:scores[id]||0}))
  .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'zh-Hant'));
}
