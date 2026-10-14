import {characterId,characterMarkup} from './characters.js';
const phases={waiting:'準備開題！',open:'選好就交卷！',closed:'時間到！',revealed:'答案揭曉！',ended:'今晚謝謝大家！'};
export function createEffects(api,role,container,onError=()=>{}){
 container.innerHTML='<div class="party-title" role="status" hidden></div><div class="danmaku-lanes" aria-hidden="true"></div>';
 const title=container.querySelector('.party-title'),lanes=container.querySelector('.danmaku-lanes');
 const pref=`hoho-effects-${role}`,reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let enabled=role==='display'||localStorage.getItem(pref)!=='off';
 if(role==='viewer'){
  const label=document.createElement('label');label.className='effects-preference';label.innerHTML='<input type="checkbox"> 顯示聊天與交卷彈幕';
  document.querySelector('#social').append(label);const toggle=label.querySelector('input');toggle.checked=enabled;
  toggle.onchange=()=>{enabled=toggle.checked;localStorage.setItem(pref,enabled?'on':'off');sync();};
 }
 let pub,active=false,phase='',queue=[],lane=0,seen=new Set(),stops={},generation=0,bannerTimer,reported=new Set();
 const clear=()=>{queue=[];lanes.replaceChildren();};
 function unsubscribe(){Object.values(stops).forEach(f=>f());stops={};generation++;clear();}
 function remember(key){if(seen.has(key))return false;seen.add(key);if(seen.size>400)seen.delete(seen.values().next().value);return true;}
 function listen(kind){const gen=generation,started=api.now();let initial=true;
  stops[kind]=api.watch(`room/effects/${kind}`,data=>{
   if(gen!==generation)return;
   const items=kind==='chat'?Object.entries(data||{}).map(([uid,m])=>({uid,...m,key:`chat/${uid}/${m.seq}`,text:m.text})):data?.round===pub.state.round?Object.entries(data.items||{}).map(([uid,at])=>({uid,at,key:`submit/${data.round}/${uid}`,text:'已作答！'})):[];
   const valid=new Set(items.map(m=>`${pub.state.code}/${m.key}`));
   queue=queue.filter(m=>m.kind!==kind||valid.has(m.id));for(const el of lanes.children)if(el.dataset.kind===kind&&!valid.has(el.dataset.id))el.remove();
   for(const m of items.sort((a,b)=>a.at-b.at)){
    const id=`${pub.state.code}/${m.key}`,fresh=remember(id);
    // Ignore history, but retain events arriving while the initial subscription loads.
    if((initial&&m.at<started)||!fresh||document.hidden||!pub.members?.[m.uid]||api.now()-m.at>15000||m.at>api.now()+5000)continue;
    queue.push({...m,id,kind,queued:Date.now()});
   }
   queue=queue.slice(-12);initial=false;
  },()=>{if(gen!==generation)return;queue=queue.filter(m=>m.kind!==kind);for(const el of lanes.children)if(el.dataset.kind===kind)el.remove();if(!reported.has(kind)){reported.add(kind);onError('彈幕無法讀取，請主持人確認 Firebase 最新規則已發布，再重新整理頁面。');}});
 }
 function sync(){unsubscribe();if(!active||!enabled)return;if(pub.state.chatEffects===true&&pub.state.chatOpen)listen('chat');if(pub.state.submitEffects===true)listen('submissions');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();title.hidden=true;}});
 reduce.addEventListener('change',()=>{clear();container.classList.toggle('effects-reduced',reduce.matches);});container.classList.toggle('effects-reduced',reduce.matches);
 setInterval(()=>{
  if(document.hidden||!active||!enabled)return;
  queue=queue.filter(m=>Date.now()-m.queued<12000&&pub.members?.[m.uid]);
  if(!queue.length||lanes.children.length>=2)return;
  const m=queue.shift(),el=document.createElement('div');el.className='danmaku-bubble';el.dataset.id=m.id;el.dataset.kind=m.kind;el.dataset.uid=m.uid;el.style.setProperty('--lane',String(lane++%2));
  const avatar=document.createElement('span');avatar.innerHTML=characterMarkup(characterId(m.uid,pub.state.code));
  const text=document.createElement('span');text.textContent=`${pub.members[m.uid].name}：${[...m.text].slice(0,48).join('')}${[...m.text].length>48?'…':''}`;
  el.append(avatar,text);lanes.append(el);setTimeout(()=>el.remove(),reduce.matches?4500:8000);
 },1200);
 let subscriptionKey='';
 return (next,allowed)=>{
  pub=next;active=!!allowed&&!!pub?.state&&pub.state.status!=='ended';container.hidden=!allowed||!pub?.state;
  if(pub?.state){const s=pub.state,key=`${s.code}/${s.round}/${s.status}`;
   if(key!==phase){
    clearTimeout(bannerTimer);title.hidden=true;
    if(phase&&allowed&&!document.hidden){title.textContent=phases[s.status]||'';title.hidden=false;title.classList.remove('party-pop');void title.offsetWidth;title.classList.add('party-pop');bannerTimer=setTimeout(()=>{title.hidden=true;},2800);}
    phase=key;clear();
   }
   for(const el of lanes.children)if(!pub.members?.[el.dataset.uid])el.remove();
  }else{phase='';title.hidden=true;}
  const key=`${pub?.state?.code}/${pub?.state?.round}/${active}/${pub?.state?.chatEffects}/${pub?.state?.chatOpen}/${pub?.state?.submitEffects}`;
  if(key!==subscriptionKey){subscriptionKey=key;sync();}
 };
}
