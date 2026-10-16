// Presentation only: animation never modifies game state or writes frame updates.
let section,track,scroller,find,visible=true,currentUid='';
const pause=()=>section?.classList.toggle('is-paused',document.hidden||!visible);
export function paintIsland(s,uid){
 if(!s){if(section)section.hidden=true;return;}
 if(!section){section=document.createElement('section');section.className='voyage-island';section.innerHTML='<div class="island-heading"><h2></h2><button type="button">找到我</button></div><p>相似的選擇讓伙伴慢慢靠近。位置是大致群聚，不是百分比。</p><div class="island-scroll" tabindex="0" aria-label="島民散步區，可左右捲動"><div class="island-track"></div></div>';document.body.append(section);track=section.querySelector('.island-track');scroller=section.querySelector('.island-scroll');find=section.querySelector('button');find.onclick=()=>{const node=[...track.children].find(n=>n.dataset.uid===currentUid);if(node)scroller.scrollTo({left:Math.max(0,Number(node.dataset.x)-scroller.clientWidth/2+48),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};document.addEventListener('visibilitychange',pause);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pause();}).observe(section);}
 section.hidden=false;currentUid=uid;section.querySelector('h2').textContent=`${Object.keys(s.players).length} 位島民散步中`;find.disabled=!s.players[uid];track.style.width=`${s.island.width}px`;
 for(const node of [...track.children])if(!s.players[node.dataset.uid])node.remove();
 for(const [id,p]of Object.entries(s.players)){let node=[...track.children].find(n=>n.dataset.uid===id);if(!node){node=document.createElement('div');node.className='island-walker';node.dataset.uid=id;node.innerHTML='<div class="walker-idle"><img alt="" draggable="false"></div><span></span>';node.querySelector('img').src=`./art/characters/${p.character??p.seat%10}.png`;node.querySelector('.walker-idle').style.animationDelay=`-${p.seat%7}s`;track.append(node);}
 const pos=s.island.positions[id];if(!pos)continue;node.dataset.x=pos.x;node.style.transform=`translateX(${pos.x}px)`;node.querySelector('span').textContent=`${id===uid?'你 · ':''}${p.name} · P${String(p.seat+1).padStart(2,'0')}`;node.title=`${p.name} · 座位 ${p.seat+1}`;node.classList.toggle('is-self',id===uid);}
 pause();
}
