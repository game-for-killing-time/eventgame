import './style.css';
import './spotlight.css';
import './voyage-display.css';
import {voyageDisplayView} from './voyage-display-view.js';
import {startChoiceScroll} from './voyage-choice-scroll.js';
const root=document.getElementById('app'),local=new URLSearchParams(location.search).get('demo')==='1';
document.body.classList.add('display','display-in-room','voyage-display');
document.querySelector('.display-background-video')?.remove();
root.innerHTML='<header><img class="brand-logo" src="./art/party-logo.png" width="1816" height="866" alt="來吧！我們互相傷害！"><span class="voyage-display-title">12 幕海島冒險</span><span id="voyageConnection" role="status"></span></header><main id="voyageDisplayStage" class="voyage-display-stage"></main>';
const stage=document.getElementById('voyageDisplayStage');
let current,remote,feed,stopScroll,mainMarkup='',choicesPaused=false,now=()=>Date.now();
function tick(){const el=document.querySelector('[data-voyage-countdown]');if(el&&current)el.textContent=['lobby','ended','firstClosed','twistClosed'].includes(current.phase)?'':current.duration===0&&['first','twist'].includes(current.phase)?'不限時':current.deadline>now()?Math.max(0,Math.ceil((current.deadline-now())/1000))+' 秒':'';}
function render(s){
 const sameScene=current?.id===s?.id&&current?.round===s?.round&&current?.phase===s?.phase;
 const storyScroll=sameScene?stage.querySelector('.voyage-story-panel')?.scrollTop||0:0;
 current=s;
 const next=document.createElement('template');next.innerHTML=voyageDisplayView(s);
 const nextMain=next.content.querySelector('.voyage-display-main'),main=stage.querySelector('.voyage-display-main');
 if(!main)stage.append(nextMain);
 else if(mainMarkup!==nextMain.innerHTML){main.replaceWith(nextMain);nextMain.querySelector('.voyage-story-panel').scrollTop=storyScroll;}
 mainMarkup=nextMain.innerHTML;
 const nextFeed=next.content.querySelector('[data-choice-feed]');
 // Public subscriptions also update submission counts and presence. Preserve the
 // connected feed, including keyboard focus, while its choices remain unchanged.
 if(!feed||nextFeed.dataset.feedKey!==feed.dataset.feedKey){
  stopScroll?.();
  if(feed)feed.replaceWith(nextFeed);else stage.append(nextFeed);
  feed=nextFeed;stopScroll=startChoiceScroll(feed,{paused:choicesPaused,onPause:value=>{choicesPaused=value;}});
 }
 tick();
}
function connection(online){const el=document.getElementById('voyageConnection');el.textContent=online?'●':'○';el.setAttribute('aria-label',online?'已連線':'重新連線中');el.dataset.online=String(online);}
render(null);setInterval(tick,250);
if(local){const {publicView,question}=await import('./voyage-engine.js');const refresh=()=>{const s=JSON.parse(localStorage.getItem('hoho-voyage-local-v3')||'null');render(s?{...s,currentQuestion:question(s),view:publicView(s),submitted:Object.keys(s.phase==='twist'||s.phase==='twistClosed'?s.second:s.first).length}:null);};refresh();connection(true);addEventListener('storage',e=>{if(e.key==='hoho-voyage-local-v3')refresh();});}
else{const {startVoyageOnline}=await import('./voyage-online-runtime.js');remote=await startVoyageOnline('display',()=>{if(remote){connection(remote.online);render(remote.state);}},()=>{connection(false);});now=remote.now;connection(remote.online);render(remote.state);}
