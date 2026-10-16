export const isSurvival=s=>s?.packId==='last-light-survival-v1';
export const living=s=>Object.keys(s.players||{}).filter(id=>s.players[id].alive!==false);
export function resolveSurvival(s,scene){
 if(!isSurvival(s))return;
 for(const [id,p]of Object.entries(s.players)){
  if(p.alive===false)continue;
  const event=p.events.find(e=>e.round===s.round),choice=event?.choice??null;
  if(scene.split){p.group=choice===null?(p.group||'red'):choice%2?'blue':'red';continue;}
  if(!scene.hazard)continue;
  const fatal=choice===null||scene.hazard[p.group||'red'].includes(choice);
  if(fatal){p.alive=false;p.deathRound=s.round;p.deathReason=choice===null?'沒有在期限內作出明確的安全選擇，未能離開危險區。':scene.death;s.casualties??={};s.casualties[id]={name:p.name,round:s.round,reason:p.deathReason};}
 }
 if(!living(s).length){s.phase='ended';s.outcome='bad';}
 else if(s.round===12){s.outcome=Object.keys(s.casualties||{}).length?'partial':'good';}
}
export function survivalSummary(s){
 if(!isSurvival(s))return null;
 const alive=living(s).map(id=>({id,name:s.players[id].name,group:s.players[id].group||'red'}));
 const dead=Object.entries(s.casualties||{}).map(([id,p])=>({id,...p}));
 const titles={good:'Good Ending · 全員生還',partial:'Survivor Ending · 部分生還',bad:'Bad Ending · 全滅',aborted:'主持人提前結束 · 未完成逃生'};
 const texts={good:'全員登上救援船。你們成立退費群組，旅行社第一次希望自己的客服永遠忙線。',partial:'救援船帶走了幸存者，空下的座位記錄着沒能回來的伙伴。勝利屬於生還者，回顧屬於每一個人。',bad:'最後一位玩家也未能生還，逃生失敗。無人接聽的電話裡，客服仍在說：「您的意見對我們很重要。」',aborted:'故事尚未完成，這場不判定成功逃生。'};
 const outcome=s.outcome||(s.phase==='ended'?'aborted':null);
 return {alive,dead,outcome,title:outcome?titles[outcome]:'島上生存狀態',text:outcome?texts[outcome]:'危險幕會在小變化揭曉後結算生死。淘汰後可觀看及聊天，不能繼續作答。'};
}
