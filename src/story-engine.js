import {storyPack,traits} from './story-pack.js';
const scoring=new Set([1,4,7,10,13,16]);
const titles={ 'care+explore':'提著燈找人的探險家','care+careful':'替大家留一份的守望者','care+team':'把陌生人變成伙伴的人','care+self':'安靜伸出手的旅人','explore+careful':'帶著備案的冒險家','explore+team':'拉著朋友看世界的人','explore+self':'沿著好奇心走的旅人','careful+team':'讓大家安心出發的領航員','careful+self':'按自己步調前進的觀察者','team+self':'有主見的同行者'};
const traitOrder=Object.keys(traits);
function requireThat(ok,message){if(!ok)throw Error(message);}
export function validatePack(p){
 requireThat(p?.version===1&&p.id==='tide-island-v1','需要潮汐島 v1 故事包');
 const text=(v,max=3000)=>requireThat(typeof v==='string'&&v.trim().length>0&&v.length<=max,'故事文字不可空白或過長');
 text(p.title,100);text(p.opening);requireThat(p.chapters?.length===6&&p.rounds?.length===18&&p.endings?.length===4,'需要 6 章、18 輪與 4 個結局');
 for(const c of p.chapters){requireThat(Array.isArray(c)&&c.length===2,'章節格式不正確');c.forEach(v=>text(v));}
 const checkQ=(q,original)=>{requireThat(q?.id===original.id&&q.options?.length===4,'題目代號或四個選項不正確');text(q.text);q.options.forEach((o,i)=>{text(o.text,180);text(o.outcome);requireThat(traitOrder.includes(o.trait),'性格標記不正確');requireThat(o.flag===original.options[i].flag,'故事事件旗標不可更改；可以修改題文、標記與結果描述');});};
 p.rounds.forEach((r,i)=>{const source=storyPack.rounds[i];requireThat(r.n===i+1,'輪次必須連續');text(r.title,100);text(r.intro);text(r.reveal);if(source.routes){requireThat(r.routes?.length===2&&!r.question,'分流輪需要兩條路線');r.routes.forEach((t,j)=>{requireThat(t.id===source.routes[j].id,'路線代號不可更改');text(t.name,60);checkQ(t.question,source.routes[j].question);});}else{requireThat(!r.routes,'共同輪不可加入路線');checkQ(r.question,source.question);}});
 checkQ(p.trapped,storyPack.trapped);p.endings.forEach(e=>{text(e.title,100);text(e.text);});return p;
}
export function newStory(pack=storyPack,now=Date.now()) {validatePack(pack);return {id:`voyage-${now}`,pack:structuredClone(pack),phase:'lobby',round:0,deadline:0,players:{},routes:{},answers:{},results:{},history:[],runoffVotes:{},shared:{},chat:[],startedAt:now};}
export function joinStory(s,id,name){requireThat(s.phase!=='ended','冒險已結束，請等下一場');requireThat(typeof name==='string'&&name.trim()&&name.trim().length<=20,'暱稱需為 1–20 字');if(s.players[id])return;requireThat(Object.keys(s.players).length<20,'最多 20 位玩家');s.players[id]={name:name.trim(),seat:Object.keys(s.players).length,traits:Object.fromEntries(traitOrder.map(k=>[k,0])),flags:[],events:[],points:0};if(s.phase==='open'&&scene(s).routes)s.routes[id]=scene(s).routes[s.players[id].seat%2].id;}
export function scene(s){return s.pack.rounds[s.round-1];}
export function questionFor(s,id){const r=scene(s);if(!r)return null;if(s.round===9&&s.players[id]?.trappedRound===9)return s.pack.trapped;return r.question||r.routes.find(t=>t.id===s.routes[id])?.question||null;}
export function isScored(s){return scoring.has(s.round);}
export function nextRound(s,now=Date.now(),duration=60){requireThat(['lobby','revealed'].includes(s.phase),'請先揭曉本輪');requireThat(s.round<18,'故事已完成');s.round++;s.routes={};s.answers={};s.phase=scene(s).routes?'routing':'open';s.deadline=now+duration*1000;s.duration=duration;}
export function selectRoute(s,id,route,now=Date.now()){requireThat(s.players[id]&&s.phase==='routing'&&now<s.deadline,'選路已截止');requireThat(scene(s).routes.some(r=>r.id===route),'路線不存在');s.routes[id]=route;}
export function beginAnswers(s,now=Date.now()){requireThat(s.phase==='routing','目前不是選路階段');for(const [id,p]of Object.entries(s.players))s.routes[id]??=scene(s).routes[p.seat%2].id;s.phase='open';s.deadline=now+s.duration*1000;}
export function submit(s,id,round,qid,choice,prediction,now=Date.now()){
 requireThat(s.phase==='open'&&s.round===round&&now<s.deadline,'已截止或題目已更新，未接受這份答案');requireThat(s.players[id]&&questionFor(s,id)?.id===qid,'題目不屬於此玩家');requireThat(Number.isInteger(choice)&&choice>=0&&choice<4,'請選一個答案');requireThat(!isScored(s)||(Number.isInteger(prediction)&&prediction>=0&&prediction<4),'請猜多數答案');s.answers[id]={qid,choice,prediction:isScored(s)?prediction:null};
}
export function closeRound(s){requireThat(['open','runoff'].includes(s.phase),'目前沒有開放作答');s.phase=s.phase==='runoff'?'runoff-closed':'closed';}
export function extendRound(s,now=Date.now()){requireThat(['routing','open','runoff'].includes(s.phase)&&now<s.deadline,'本輪已截止，不能延長');s.deadline+=15000;}
function counts(answers){const c=[0,0,0,0];for(const a of answers)c[a.choice]++;const max=Math.max(...c);return {counts:c,winners:max?c.flatMap((n,i)=>n===max?[i]:[]):[],total:answers.length};}
export function settle(s,now=Date.now()){
 if(s.results[s.round])return;
 requireThat(s.phase==='closed','請先截止');const groups={};
 for(const [id,a]of Object.entries(s.answers)){const q=questionFor(s,id);requireThat(q&&q.id===a.qid,'答案與題目不符');(groups[q.id]??={title:q.text,options:q.options.map(o=>o.text),answers:[]}).answers.push({id,...a});}
 for(const group of Object.values(groups))Object.assign(group,counts(group.answers));
 for(const [id,p]of Object.entries(s.players)){
  const a=s.answers[id];if(a){const q=questionFor(s,id),o=q.options[a.choice];p.traits[o.trait]++;if(o.flag&&!p.flags.includes(o.flag))p.flags.push(o.flag);if(o.flag==='trapped')p.trappedRound=9;
   const companions=scene(s).routes?Object.keys(s.players).filter(other=>other!==id&&s.routes[other]===s.routes[id]).map(other=>s.players[other].name):[];
   p.events.push({round:s.round,qid:q.id,choice:a.choice,trait:o.trait,text:o.outcome,companions});if(isScored(s)&&groups[q.id].winners.includes(a.prediction))p.points++;
  }
  if(s.round===9)delete p.trappedRound;
 }
 // Only explicitly shared, scored questions contribute to affinity. Branches never compare A/B indices.
 s.affinity??={};if(isScored(s)){const ids=Object.keys(s.answers).sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=`${ids[i].length}:${ids[i]}${ids[j]}`,p=s.affinity[key]??={shared:0,same:0};p.shared++;if(s.answers[ids[i]].choice===s.answers[ids[j]].choice)p.same++;}}
 s.results[s.round]={groups,reveal:scene(s).reveal};s.history.push({round:s.round,title:scene(s).title,text:scene(s).reveal});
 if(s.round===16){const vote=counts(Object.values(s.answers));if(vote.winners.length>1){s.runoffOptions=vote.winners;s.runoffVotes={};s.phase='runoff';s.deadline=now+30000;return;}s.ending=vote.winners[0]??1;s.endingReason=vote.total?'最多票決定':'零票，採用預設篝火之夜';}
 s.phase=s.round===18?'ended':'revealed';
}
export function submitRunoff(s,id,choice,now=Date.now()){requireThat(s.players[id]&&s.phase==='runoff'&&now<s.deadline&&s.runoffOptions.includes(choice),'決選已截止或選項不正確');s.runoffVotes[id]=choice;}
export function settleRunoff(s){requireThat(s.phase==='runoff-closed','請先截止決選');const vote=counts(Object.values(s.runoffVotes).map(choice=>({choice})));s.ending=vote.winners[0]??s.runoffOptions[0];s.endingReason=vote.winners.length===1?'決選最多票':'決選同票或零票，依事先固定的選項順序';s.phase='revealed';}
export function echoFor(p){if(p.flags.includes('shared-cookie'))return '有人把最後一塊餅乾留給你：「你剛才也分給大家了。」';if(p.flags.includes('spare-cookie'))return '你留下的備用餅乾，正好讓忙碌的伙伴補充體力。';if(p.flags.includes('box-team'))return '一起開箱的伙伴走來：「還要不要一起做？」';if(p.flags.includes('trapped'))return '伙伴提起通話管裡的經歷，大家忍不住笑了。';return '禾婆婆喊出你的名字，邀請你一起完成最後的準備。';}
export function cardFor(s,id){
 const p=s.players[id];const order=[...traitOrder].sort((a,b)=>p.traits[b]-p.traits[a]||traitOrder.indexOf(a)-traitOrder.indexOf(b));const enough=p.events.length>=4;
 const top=order.filter(t=>p.traits[t]===p.traits[order[0]]);const chosen=order.slice(0,2).sort((a,b)=>traitOrder.indexOf(a)-traitOrder.indexOf(b));
 const repeated=order.filter(t=>p.traits[t]>=2);const title=enough&&repeated.length>=2&&top.length<=2?titles[chosen.join('+')]:'留下自己足跡的旅人';
 const descriptions={care:'你多次先留意別人的需要，讓照顧成為旅程的一部分。',explore:'面對未知時，你多次選擇靠近、觀察或親手嘗試。',careful:'你多次為下一步確認條件、保留資源，讓行動更有把握。',team:'你多次邀請別人一起完成，讓各自的發現連在一起。',self:'你多次保留自己的判斷與步調，也為個人的空間留了位置。'};
 const description=enough&&repeated.length?`在這次冒險裡，${order.filter(t=>p.traits[t]>=2).slice(0,2).map(t=>descriptions[t]).join('')}${top.length>1?`最高的 ${top.length} 種傾向並列，沒有單一主導方向。`:''}這些是故事中的選擇，可以隨情境改變。`:'目前有效選擇較少，先保留你的事件回顧，不推論主要性格。';
 const selected=chosen.map(t=>p.events.find(e=>e.trait===t)).filter(Boolean);
 const extra=p.events.find(e=>e.round===9&&e.qid==='r9-trapped'&&!selected.includes(e))||p.events.findLast(e=>!selected.includes(e));if(extra)selected.push(extra);
 return {name:p.name,title,description,events:selected,companions:[...new Set(p.events.flatMap(e=>e.companions))],keepsake:p.events.find(e=>e.round===18)?.text||'你帶走了這段屬於自己的旅程。',note:'這是本次故事選擇的回顧，不是心理測驗或診斷。'};
}
export function publicView(s){return {phase:s.phase,round:s.round,title:s.pack.title,scene:scene(s)?{title:scene(s).title,intro:scene(s).intro}:null,deadline:s.deadline,players:Object.values(s.players).map(p=>({name:p.name})),submitted:Object.keys(s.answers).length,routes:(scene(s)?.routes||[]).map(r=>({name:r.name,count:Object.values(s.routes).filter(id=>id===r.id).length})),history:s.history,ending:s.ending===undefined?null:s.pack.endings[s.ending],shared:s.phase==='ended'?Object.keys(s.shared).filter(id=>s.shared[id]).map(id=>cardFor(s,id)):[]};}
