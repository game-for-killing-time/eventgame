import {story,twists} from './escape-story.js';
const fail=(ok,message)=>{if(!ok)throw Error(message);};
export const alive=s=>Object.keys(s.players||{}).filter(id=>s.players[id].alive);
export const scene=s=>story[Math.min(5,Math.max(0,s.round-1))];
const enter=(s,phase,now,seconds)=>{s.phase=phase;s.deadline=now+seconds*1000;s.revision++;};
export function createEscape(id,code,now){return {id,code,phase:'lobby',round:0,revision:0,players:{},first:{},final:{},votes:{},history:[],resources:{radio:false,battery:false,signal:false},lines:[],created:now,deadline:0,escapeDeadline:0,minutes:20,hasMurder:false,wolf:null,attack:null,runoff:false,candidates:[],outcome:null,pausedAt:null};}
export function normalize(s){for(const k of ['players','first','final','votes','resources'])s[k]??={};for(const k of ['history','lines','candidates'])s[k]??=[];s.pausedAt??=null;s.outcome??=null;s.wolf??=null;return s;}
function finish(s,outcome,now){s.outcome=outcome;enter(s,'ended',now,0);const name=s.players[s.wolf]?.name||'狼人';s.ending=outcome==='counter'?`${s.players[alive(s).find(id=>id!==s.wolf)]?.name}看穿了${name}的意圖，在最後一次襲擊前反過來制服了狼人。生還者反殺獲勝！`:outcome==='caught'?`${name}的狼人身份被揭穿。島上的威脅解除，生還者勝利！`:outcome==='escaped'?'救援船離開碼頭。生還者成功離島，狼人未能阻止撤離。生還者勝利！':outcome==='timeout'?'撤離時限已過，最後的救援機會消失。狼人成功阻止大家離島，狼人勝利。':outcome==='killed'?'島上已沒有普通生還者。狼人勝利。':'主持人結束了這場遊戲，沒有判定勝負。';}
function victory(s,now){const ids=alive(s);if(!ids.includes(s.wolf)){finish(s,'caught',now);return true;}if(!ids.some(id=>id!==s.wolf)){finish(s,'killed',now);return true;}if(ids.length===2){finish(s,'counter',now);return true;}return false;}
function beginRound(s,now){s.round++;s.first={};s.final={};s.attack=null;s.votes={};s.runoff=false;s.candidates=[];s.lines=[];s.twist=s.twistPlan[(s.round-1)%s.twistPlan.length];enter(s,'intro',now,10);}
function settledRoute(s,id){const allowed=twists[s.twist].allowed;const route=s.final[id]?.route??s.first[id]?.route;return allowed.includes(route)?route:allowed[0];}
function settle(s,now){
 const sc=scene(s),dead=[];const attack=s.attack;const wolfAction=s.final[s.wolf];
 if(attack&&s.players[attack]?.alive&&wolfAction&&attack!==s.wolf&&settledRoute(s,attack)===wolfAction.route){s.players[attack].alive=false;s.players[attack].deathRound=s.round;s.players[attack].cause='murder';s.hasMurder=true;dead.push(attack);}
 // A missing final answer is no action; a victim's entire round is invalid.
 const valid=alive(s).filter(id=>s.final[id]);s.lines=[];
 const earned=new Set();
 for(const id of valid){const a=s.final[id];if(s.round<=3){if(a.action===0&&!s.resources.radio){s.resources.radio=true;earned.add(sc.routes[a.route]+'隊找到通訊設備。');}if(a.action===1&&!s.resources.battery){s.resources.battery=true;earned.add(sc.routes[a.route]+'隊找到電池。');}}
  else if(a.action===1){if(!s.resources.radio){s.resources.radio=true;earned.add(sc.routes[a.route]+'隊找到通訊設備。');}else if(!s.resources.battery){s.resources.battery=true;earned.add(sc.routes[a.route]+'隊找到電池。');}}
 }
 if(s.resources.radio&&s.resources.battery&&valid.some(id=>s.final[id].action===(s.round>=6?1:0))&&s.round>=4){if(!s.resources.signal)earned.add('求救訊號已發出。救援船正趕往碼頭。');s.resources.signal=true;}
 s.lines.push(...earned);if(!earned.size)s.lines.push('這一輪沒有取得新的設備或求救進展。');
 for(const id of dead)s.lines.push(`${s.players[id].name}遭人殺害！`);
 const routes=[...alive(s),...dead].map(id=>({name:s.players[id].name,route:sc.routes[settledRoute(s,id)],action:dead.includes(id)?'本輪行動無效':s.final[id]?sc.actions[s.final[id].action]:'未提交最後行動'}));
 s.history.push({round:s.round,title:sc.title,lines:[...s.lines],routes,dead:dead.map(id=>s.players[id].name)});
 if(victory(s,now))return;
 if(s.round>=6&&s.resources.signal&&valid.some(id=>id!==s.wolf&&s.final[id].action===0)){finish(s,'escaped',now);return;}
 enter(s,'result',now,12);
}
function settleVote(s,now){
 const counts={};for(const id of alive(s)){const target=s.votes[id];if(target&&s.players[target]?.alive)counts[target]=(counts[target]||0)+1;}
 const max=Math.max(0,...Object.values(counts)),top=Object.keys(counts).filter(id=>counts[id]===max);s.voteCounts=counts;s.voteLines=Object.entries(counts).map(([id,n])=>`${s.players[id].name}：${n} 票`);
 if(top.length>1&&!s.runoff){s.runoff=true;s.candidates=top;s.votes={};s.voteLines.push('最高票同票，進行一次決選。');enter(s,'vote',now,30);return;}
 if(top.length===1){const id=top[0];s.players[id].alive=false;s.players[id].cause='vote';s.players[id].deathRound=s.round;s.voteLines.push(`${s.players[id].name}被逐出隊伍。${id===s.wolf?'他的身份是狼人。':'他不是狼人。'}`);}else s.voteLines.push('沒有唯一最高票，這輪無人出局。');
 s.history.push({round:s.round,title:'投票結果',lines:[...s.voteLines]});
 if(victory(s,now))return;enter(s,'voteResult',now,10);
}
export function tick(s,now){normalize(s);if(s.phase==='lobby'||s.phase==='ended'||s.pausedAt!==null)return false;if(now>=s.escapeDeadline){finish(s,'timeout',now);return true;}if(now<s.deadline)return false;
 if(s.phase==='intro')enter(s,'choose',now,40);
 else if(s.phase==='choose')enter(s,'twist',now,40);
 else if(s.phase==='twist')settle(s,now);
 else if(s.phase==='result'){if(s.hasMurder)enter(s,'discuss',now,60);else beginRound(s,now);}
 else if(s.phase==='discuss'){s.votes={};s.voteCounts={};s.voteLines=[];enter(s,'vote',now,30);}
 else if(s.phase==='vote')settleVote(s,now);
 else if(s.phase==='voteResult')beginRound(s,now);
 return true;
}
// rng is generated by the trusted server, never by a client or host.
export function command(s,{uid,host=false},data,now,rng){
 normalize(s);const action=data.action;
 if(action==='sync'){tick(s,now);return s;}
 const expired=tick(s,now);
 fail(data.game===s.id,'房間已更新，請重新加入。');
 if(action==='join'){fail(!host,'主持帳號不能同時參與秘密身份遊戲，請用另一部裝置加入。');if(s.players[uid])return s;fail(s.phase==='lobby','遊戲已開始，不能中途加入。');fail(data.code===s.code,'房間碼不正確。');fail(typeof data.name==='string'&&data.name.trim().length>0&&data.name.trim().length<=20,'暱稱需為 1–20 字。');fail(Object.keys(s.players).length<20,'房間已滿。');s.players[uid]={name:data.name.trim(),seat:Object.keys(s.players).length,alive:true};return s;}
 if(action==='start'){fail(host&&s.phase==='lobby','只有主持可以開始。');const ids=alive(s);fail(ids.length>=3,'至少需要 3 人；建議 5 人以上。');fail(Number.isInteger(data.minutes)&&data.minutes>=5&&data.minutes<=120,'撤離時限須為 5–120 分鐘。');s.minutes=data.minutes;s.escapeDeadline=now+data.minutes*60000;s.wolf=ids[rng.pick%ids.length];s.twistPlan=rng.twists;s.started=now;beginRound(s,now);return s;}
 if(action==='end'){fail(host,'只有主持可以結束。');if(s.phase!=='ended')finish(s,'aborted',now);return s;}
 if(action==='pause'){fail(host&&s.phase!=='lobby'&&s.phase!=='ended','目前不能暫停。');if(s.pausedAt===null)s.pausedAt=now;else{const delta=now-s.pausedAt;s.deadline+=delta;s.escapeDeadline+=delta;s.pausedAt=null;}return s;}
 fail(s.pausedAt===null,'遊戲暫停中。');
 // Deadlines win over late submissions. Keep any timer transition committed.
 if(expired)return s;
 fail(data.round===s.round&&data.revision===s.revision,'階段已更新，請依新畫面作答。');
 if(action==='advance'){fail(host,'只有主持可以推進。');fail(!['choose','twist','vote','ended','lobby'].includes(s.phase),'作答及投票期間不能提前揭曉。');s.deadline=now;tick(s,now);return s;}
 fail(!host&&s.players[uid]?.alive,'你目前不能作答或投票。');
 if(action==='answer'){
  fail(['choose','twist'].includes(s.phase),'現在不是作答階段。');fail(Number.isInteger(data.route)&&[0,1].includes(data.route)&&Number.isInteger(data.choice)&&data.choice>=0&&data.choice<3,'請選擇有效路線和行動。');
  if(s.phase==='twist')fail(twists[s.twist].allowed.includes(data.route),'該路線已封閉，請重新選路。');
  if(data.kill){fail(uid===s.wolf&&s.phase==='twist','不能提交秘密行動。');fail(data.kill!==uid&&s.players[data.kill]?.alive,'目標已不在場。');}
  const dest=s.phase==='choose'?s.first:s.final;dest[uid]={route:data.route,action:data.choice};if(s.phase==='twist'&&uid===s.wolf)s.attack=data.kill||null;
  // Fixed windows prevent submission timing from identifying the wolf.
 }else if(action==='vote'){
  fail(s.phase==='vote','現在不是投票階段。');fail(data.target===null||data.target!==uid&&s.players[data.target]?.alive,'請選其他生還者，或棄票。');fail(!s.runoff||data.target===null||s.candidates.includes(data.target),'決選只能投給同票候選人。');s.votes[uid]=data.target||'';
 }else throw Error('未知操作。');return s;
}
export function publicEscape(s){normalize(s);const sc=scene(s),during=['twist','result','discuss','vote','voteResult','ended'].includes(s.phase);return {id:s.id,code:s.code,phase:s.phase,revision:s.revision,round:s.round,title:s.phase==='lobby'?'墜機之後：誰能離島':sc.title,intro:sc.intro,routes:sc.routes,actions:sc.actions,players:s.players,deadline:s.deadline,escapeDeadline:s.escapeDeadline,pausedAt:s.pausedAt,resources:s.resources,twist:['twist','result','discuss','vote','voteResult'].includes(s.phase)?twists[s.twist]:null,firstRoutes:during?Object.entries(s.first).map(([id,a])=>({name:s.players[id].name,route:sc.routes[a.route]})):[],submitted:['choose','twist'].includes(s.phase)?Object.keys(s.phase==='choose'?s.first:s.final).length:s.phase==='vote'?Object.keys(s.votes).length:0,lines:s.lines,history:s.history,candidates:s.candidates,runoff:s.runoff,voteLines:s.voteLines||[],outcome:s.outcome,ending:s.ending||'',wolf:s.phase==='ended'?s.wolf:null};}
export function privateEscape(s,uid,host=false){if(host||!s.players[uid])return null;return {game:s.id,role:s.wolf?(s.wolf===uid?'wolf':'survivor'):null,first:s.first?.[uid]||null,final:s.final?.[uid]||null,vote:s.votes?.[uid]??null,kill:uid===s.wolf?s.attack:null};}
