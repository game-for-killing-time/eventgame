import {isSpotlight} from './spotlight.js';
import {characterId,characterMarkup} from './characters.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const REVEAL_MS=6000;

export function countdown(s,now){
 const seconds=s.status==='open'?Math.max(0,Math.ceil((s.deadline-now)/1000)):0;
 const label=s.status==='thinking'?'等待主角':s.status==='revealed'?'已揭曉':s.status==='ended'?'已結束':'已截止';
 return {seconds,urgent:s.status==='open'&&seconds>0&&seconds<=10,
  markup:s.status==='open'?`<small>${seconds?'剩餘':'時間到'}</small><strong>${seconds}</strong><span>秒</span>`:`<span class="clock-state">${label}</span>`,
  text:s.status==='open'?`剩餘 ${seconds} 秒${seconds?'':'，作答已截止'}`:label};
}

// One server timestamp defines the same six-second window for every client.
// Historical results without this field remain readable without replaying a popup.
export function revealRemaining(pub,now){
 const s=pub?.state,r=pub?.results?.[s?.round];
 if(!isSpotlight(s)||s.status!=='revealed'||!Number.isFinite(r?.revealedAt))return 0;
 return Math.max(0,Math.min(REVEAL_MS,r.revealedAt+REVEAL_MS-now));
}

export function revealSummary(s,result,members={}){
 const targetId=result.targetUid||s.targetUid,name=result.targetName||s.targetName||'主角';
 const winners=result.targetAnswered?Object.keys(result.points||{}).filter(id=>id!==targetId&&result.points[id]===1).sort((a,b)=>Number(members[a]?.seat??99)-Number(members[b]?.seat??99)||a.localeCompare(b)):[];
 const prompt=String(s.question?.text||'主角選擇了').replaceAll('你',name).replace(/[⋯…?？:：]+$/u,'');
 return `<div class="reveal-hero">${characterMarkup(characterId(targetId,s.code),true)}<span>本題主角 <b>${esc(name)}</b></span></div><div class="reveal-answer">${result.targetAnswered?`<p class="reveal-sentence">${esc(prompt)}</p><strong class="reveal-choice">${esc(s.question?.options?.[result.targetChoice]??'')}</strong>`:'<p class="reveal-sentence">主角本題沒有有效作答，這題不計分。</p>'}</div><section class="reveal-winners" aria-label="猜中主角的玩家"><h3>共 ${winners.length} 人答對${winners.length?'！':' · 下題再猜猜'}</h3><div class="reveal-crew">${winners.map(id=>`<span class="reveal-player">${characterMarkup(characterId(id,s.code))}<b>${esc(members[id]?.name||'已離席玩家')}</b></span>`).join('')}</div></section>`;
}

export function createSpotlightReveal({root,now,onVisibility=()=>{}}){
 let pub=null,allowed=false,key='',dismissed='',timer,previousFocus;
 root.className='spotlight-popup';root.hidden=true;
 const hide=()=>{clearTimeout(timer);if(root.contains(document.activeElement)){const back=previousFocus?.isConnected?previousFocus:document.querySelector('#game');if(back){if(!back.hasAttribute('tabindex'))back.tabIndex=-1;back.focus({preventScroll:true});}}root.hidden=true;root.replaceChildren();onVisibility(false);};
 function sync(){
  const s=pub?.state,r=pub?.results?.[s?.round],remaining=revealRemaining(pub,now());
  const next=`${s?.code}/${s?.round}/${r?.revealedAt}`;
  if(!allowed||document.hidden||!remaining||next===dismissed){hide();return;}
  if(key!==next||root.hidden){
   previousFocus=document.activeElement;root.style.setProperty('--reveal-life',`${remaining}ms`);
   key=next;root.innerHTML=`<div class="reveal-popup-card"><button class="reveal-close" type="button" aria-label="關閉揭曉動畫">×</button><div role="status" aria-live="polite"><p class="reveal-announcement">答案揭曉！</p>${revealSummary(s,r,pub.members)}<p class="reveal-popup-hint">一起聽聽主角的理由</p></div></div>`;
   root.querySelector('.reveal-close').onclick=()=>{dismissed=next;hide();};
   root.hidden=false;onVisibility(true);
  }
  clearTimeout(timer);timer=setTimeout(sync,Math.max(20,remaining));
 }
 document.addEventListener('visibilitychange',sync);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden){dismissed=key;hide();}});
 return (next,visible)=>{pub=next;allowed=visible;sync();};
}
