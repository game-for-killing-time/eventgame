// Keep a fractional position so slow movement is smooth on high-refresh displays.
export function startChoiceScroll(feed,{paused:initialPaused=false,onPause=()=>{}}={}){
 const viewport=feed?.querySelector('[data-choice-viewport]'),group=feed?.querySelector('[data-choice-group]'),button=feed?.querySelector('[data-choice-toggle]');
 if(!viewport||!group||!button)return ()=>{};
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();
 let clone=null,width=0,overflow=false,paused=initialPaused,hovered=false,frame=0,last=0,position=0,restUntil=performance.now()+1800;
 function controls(){
  const stopped=paused||motion.matches;
  button.disabled=motion.matches||!overflow;
  button.textContent=motion.matches?'手動':stopped?'播放':'暫停';
  button.setAttribute('aria-pressed',String(stopped));
  button.setAttribute('aria-label',motion.matches?'已減少動畫，可手動捲動':stopped?'播放自動捲動':'暫停自動捲動');
 }
 function measure(){
  clone?.remove();clone=null;
  width=group.getBoundingClientRect().width;overflow=width>viewport.clientWidth;
  if(overflow&&!motion.matches){clone=group.cloneNode(true);clone.removeAttribute('data-choice-group');clone.setAttribute('aria-hidden','true');group.after(clone);}
  position=viewport.scrollLeft;controls();
 }
 function rest(){restUntil=performance.now()+10000;position=viewport.scrollLeft;}
 button.addEventListener('click',()=>{paused=!paused;onPause(paused);controls();},{signal:events.signal});
 viewport.addEventListener('pointerenter',()=>{hovered=true;},{signal:events.signal});
 viewport.addEventListener('pointerleave',()=>{hovered=false;},{signal:events.signal});
 for(const name of ['pointerdown','wheel','keydown','touchstart'])viewport.addEventListener(name,rest,{passive:true,signal:events.signal});
 motion.addEventListener('change',measure);
 const resize=new ResizeObserver(measure);resize.observe(viewport);resize.observe(group);
 function tick(now){
  const elapsed=last?Math.min(now-last,50):0;last=now;
  if(overflow&&!paused&&!hovered&&!motion.matches&&!document.hidden&&document.activeElement!==viewport&&now>restUntil){
   position=(position+elapsed*.045)%width;viewport.scrollLeft=position;
  }else position=viewport.scrollLeft;
  frame=requestAnimationFrame(tick);
 }
 measure();frame=requestAnimationFrame(tick);
 return ()=>{cancelAnimationFrame(frame);resize.disconnect();events.abort();motion.removeEventListener('change',measure);clone?.remove();};
}
