// Deterministic public-story work. Assignments never depend on secret roles.
export const itemNames={radio:'通訊設備',battery:'電池',rope:'繩索',map:'碼頭地圖'};
const jobs={radio:['清開機艙入口，取出通訊設備','通訊設備'],battery:['搬開補給箱，取出電池','電池'],rope:['拉回卡在樹上的行李，取出繩索','繩索'],map:['翻查營地小屋，找出碼頭地圖','碼頭地圖'],signal:['轉動天線把手，發出求救訊號','求救訊號'],passage:['清開通往碼頭的障礙','碼頭通道'],board:['放下登船板，準備上船','登船準備']};
export function initInteractions(s){s.interactionVersion=1;s.work={};s.items={};}
export function prepareInteractions(s){
 if(!s.interactionVersion)return;
 s.work??={};s.items??={};
 const ids=Object.keys(s.players).filter(id=>s.players[id].alive).sort((a,b)=>s.players[a].seat-s.players[b].seat);
 const offset=(s.round-1)%ids.length,order=[...ids.slice(offset),...ids.slice(0,offset)];s.partners={};
 // Pairs, with one three-person circle for odd counts. Each person receives at most one request.
 for(let i=0;i<order.length;){const size=order.length-i===3?3:2,group=order.slice(i,i+size);group.forEach((id,j)=>s.partners[id]=group[(j+(size===3&&s.round%2===0?2:1))%group.length]);i+=size;}
 const missing=Object.keys(itemNames).filter(k=>!s.resources[k]);
 let tasks;
 const essential=['radio','battery'].filter(k=>!s.resources[k]);
 if(s.round<=3)tasks=missing.length?missing:['passage'];
 else if(essential.length)tasks=essential;
 else if(!s.resources.signal)tasks=['signal'];
 else if(!s.resources.passage)tasks=['passage'];
 else tasks=s.round>=6?['board']:missing.length?missing:['passage'];
 s.tasks=Object.fromEntries(ids.map((id,i)=>[id,tasks[(i+s.round-1)%tasks.length]]));
 s.carryLines=(s.lines||[]).filter(line=>/答應|交給|取得|拾回|接通|清開|部分準備/.test(line)).slice(0,2);
}
export function taskText(s,id){const key=s.tasks?.[id];return s.items?.[key]?.ground?`拾回留在${s.items[key].place}的${itemNames[key]}`:key==='radio'&&s.round>1?'搜尋沿路物資，取出通訊設備':key==='map'&&s.round<3?'翻查散落行李，找出碼頭地圖':jobs[key]?.[0]||'整理撤離路線';}
export function interactionActions(s,id){const partner=s.players[s.partners?.[id]]?.name||'伙伴';const held=Object.keys(itemNames).filter(k=>s.items?.[k]?.holder===id);return [`請${partner}協助：${taskText(s,id)}`,`自己處理：${taskText(s,id)}（通常需要累積兩次行動）`,held.length?`把${held.map(k=>itemNames[k]).join('、')}交給${partner}`:'留守接應，今輪不探索'];}
export function personalInteraction(s,id){
 if(!s.interactionVersion||!s.tasks?.[id]||!s.players[id]?.alive)return null;
 const sender=Object.keys(s.first||{}).find(other=>s.first[other].action===0&&s.partners?.[other]===id);
 const revealed=['twist','result','discuss','vote','voteResult','ended'].includes(s.phase);
 return {task:taskText(s,id),partner:s.players[s.partners[id]]?.name,actions:interactionActions(s,id),incoming:revealed&&sender?{name:s.players[sender].name,task:taskText(s,sender)}:null,inventory:Object.keys(itemNames).filter(k=>s.items?.[k]?.holder===id).map(k=>itemNames[k])};
}
export function dropItems(s,id,place){if(!s.interactionVersion)return;for(const [key,item]of Object.entries(s.items||{}))if(item.holder===id){item.holder=null;item.ground=true;item.dropRound=s.round;item.place=place;s.resources[key]=false;s.lines.push(`${s.players[id].name}攜帶的${itemNames[key]}留在${place}，之後可以拾回。`);}}
export function settleInteractions(s,sc,dead){
 s.lines=[];for(const id of dead)dropItems(s,id,sc.routes[s.final[id]?.route??s.final[s.wolf]?.route??0]);
 const valid=Object.keys(s.players).filter(id=>s.players[id].alive&&s.final[id]);
 const helpers=new Map();
 for(const id of valid){if(s.final[id].accept){const requester=Object.keys(s.first).find(other=>s.first[other].action===0&&s.partners[other]===id);if(requester)helpers.set(id,requester);}}
 const initialHolders=Object.fromEntries(Object.entries(s.items).map(([key,item])=>[key,item.holder]));
 const labels=Object.fromEntries(Object.keys(s.players).map(id=>[id,interactionActions(s,id)]));const boarded=[];
 for(const id of valid){
  const a=s.final[id],name=s.players[id].name,partner=s.partners[id];
  if(helpers.has(id))continue;
  if(a.action===2){const held=Object.keys(itemNames).filter(k=>initialHolders[k]===id);if(held.length&&s.players[partner]?.alive&&s.final[partner]&&s.final[partner].route===a.route){for(const k of held)s.items[k].holder=partner;s.lines.push(`${name}把${held.map(k=>itemNames[k]).join('、')}交給${s.players[partner].name}攜帶，自己留在原地接應，今輪沒有探索。`);}else s.lines.push(`${name}留守接應，今輪沒有探索${held.length?'；未能與伙伴會合，物資仍由自己保管':''}。`);continue;}
  const key=s.tasks[id],helper=[...helpers].find(([h,target])=>target===id&&s.final[h].route===a.route&&a.action===0)?.[0];
  const assisted=!!helper,nameHelper=s.players[helper]?.name;
  if(assisted)s.lines.push(`${nameHelper}答應${name}的求助，放下自己的工作，協助${name}${taskText(s,id)}。`);
  else if(a.action===0)s.lines.push(`${name}未能獲得伙伴協助，改為自己${taskText(s,id)}。`);
  else s.lines.push(`${name}決定自己${taskText(s,id)}。`);
  if(s.items[key]?.ground&&s.items[key].dropRound===s.round){s.lines.push(`${name}這輪未能取回${itemNames[key]}，留待下一輪返回現場拾回。`);continue;}
  // Supply recovery takes one action; rope and map make clearing the path easier.
  const required=s.items[key]?.ground?1:key==='passage'&&s.resources.rope&&s.resources.map?1:2;
  s.work[key]=(s.work[key]||0)+(assisted?2:1);
  if(key in itemNames&&s.resources[key]){s.lines.push(`${name}確認${itemNames[key]}已由${s.players[s.items[key]?.holder]?.name||'隊伍'}保管，沒有重複取得。`);continue;}
  if(s.work[key]<required){s.lines.push(`${name}完成了部分準備，${jobs[key][1]}仍需下一次行動；進度會保留。`);continue;}
  if(key in itemNames){const recovered=s.items[key]?.ground;s.items[key]={holder:id,ground:false,place:sc.routes[a.route]};s.resources[key]=true;s.lines.push(`${name}${recovered?'拾回':'取得'}${itemNames[key]}${assisted?`，${nameHelper}的協助令這次行動即時完成`:''}，暫時由${name}攜帶。`);}
  else if(key==='signal'){if(s.resources.radio&&s.resources.battery){s.resources.signal=true;s.lines.push(`${name}接通救援船${assisted?`；${nameHelper}固定天線，讓呼叫成功傳出`:''}。救援船正趕往碼頭。`);}else s.lines.push(`${name}已調好天線，但設備仍未齊備；拾回設備後可再嘗試求救。`);}
  else if(key==='passage'){s.resources.passage=true;s.lines.push(`${name}清開碼頭通道${s.resources.rope&&s.resources.map?'，繩索與地圖令工作更快完成':''}，全隊之後都可以使用。`);}
  else if(key==='board'&&s.resources.signal&&s.resources.passage){boarded.push(id);s.lines.push(`${name}踏上救援船${assisted?`，${nameHelper}替大家固定登船板`:''}。`);}
 }
 for(const [id,target]of helpers){const a=s.final[id],t=s.final[target];if(!s.players[target]?.alive||!t||t.action!==0||helpers.has(target)||t.route!==a.route)s.lines.push(`${s.players[id].name}答應協助${s.players[target].name}，但${!s.players[target]?.alive?'伙伴已出局':!t?'伙伴未提交最後決定':t.route!==a.route?'兩人最後走了不同路線':helpers.has(target)?'兩人都留下接應，無人執行原定工作':'伙伴改變了計劃'}；這輪未能完成合作。`);}
 for(const id of Object.keys(s.players).filter(id=>s.players[id].alive&&!s.final[id]))s.lines.push(`${s.players[id].name}未提交最後決定，今輪沒有執行行動。`);
 return {boarded,labels};
}
