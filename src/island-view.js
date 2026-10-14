import {characterId,characterMarkup} from './characters.js';
import {islandLayout} from './affinity.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createIsland(container){
 container.innerHTML='<div class="island-heading"><h2>島民散步中</h2></div><div class="island-scroll" tabindex="0" role="region" aria-label="島民散步區，可左右滑動"><div class="island-world"></div></div>';
 const world=container.querySelector('.island-world'),scroll=container.querySelector('.island-scroll');let self=null,visible=false,code=null,centerPending=true;
 const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
 const updateMotion=()=>container.classList.toggle('reduced-motion',motionQuery.matches);
 motionQuery.addEventListener('change',updateMotion);updateMotion();
 const pause=()=>container.classList.toggle('motion-paused',!visible||document.hidden);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pause();centerSelf();},{threshold:0.05}).observe(container);
 document.addEventListener('visibilitychange',pause);
 function centerSelf(){if(!visible||!centerPending)return;const node=[...world.children].find(n=>n.dataset.uid===self);if(!node)return;scroll.scrollTo({left:Math.max(0,Number(node.dataset.x)-scroll.clientWidth/2+41),behavior:'instant'});centerPending=false;}
 return (pub,uid)=>{
  self=uid;if(code!==pub.state.code){world.replaceChildren();code=pub.state.code;centerPending=true;}
  const members=pub.members||{},published=pub.island?.positions||{},fallback=islandLayout(members),positions={...fallback.positions,...published};
  const activeIds=Object.keys(members).sort((a,b)=>Number(members[a].seat??999)-Number(members[b].seat??999)||a.localeCompare(b));let edge=600;
  for(const node of [...world.children])if(!members[node.dataset.uid])node.remove();
  const used=Object.entries(published).filter(([id])=>members[id]).map(([,p])=>p.x);
  let next=Math.max(0,...used)+196;
  for(const id of activeIds){const m=members[id];let node=[...world.children].find(n=>n.dataset.uid===id);
   let x=positions[id]?.x||40;if(!published[id]&&used.length){x=next;next+=196;}
   if(!node){node=document.createElement('div');node.className='islander';node.dataset.uid=id;node.innerHTML=`<div class="islander-walk" style="--duration:${5+(Number(m.seat)||0)%5}s;--delay:-${Number(m.seat)||0}s">${characterMarkup(characterId(id,code),true)}</div><div class="islander-name">${id===uid?'<span class="you-tag">你</span>':''}<b>${escape(m.name)}</b></div>`;world.append(node);}
   node.dataset.x=x;node.style.transform=`translateX(${x}px)`;node.classList.toggle('is-you',id===uid);edge=Math.max(edge,x+136);
  }
  world.style.width=`${edge}px`;container.querySelector('h2').textContent=`${activeIds.length} 位島民散步中`;centerSelf();
 };
}
