import './story-style.css';
import './voyage-style.css';
import './host-modes.css';
import './party-theme.css';
import './voyage-theme.css';
import './player-entry.css';
import './voyage-display.css';
import './escape-style.css';
import {playerEntry} from './player-entry.js';
import {setEntryVideo} from './player-entry-video.js';
import {paintIsland} from './voyage-island.js';
import {escapeDisplay} from './escape-display-view.js';
import {startChoiceScroll} from './voyage-choice-scroll.js';
import {connectEscape} from './escape-backend.js';
import {esc,phases,publicPanel,historyPanel} from './escape-view.js';
import {escapeRole} from './story-routing.js';
const params=new URLSearchParams(location.search),role=escapeRole(location.search,document.body.dataset.role);
const root=document.getElementById('story-app')||document.getElementById('app');
document.body.classList.add(role==='display'?'voyage-display':'voyage-page','escape-page');
if(role==='host')document.body.classList.add('voyage-host');
if(role==='display')root.id='app';
let stopFeed;
let rt={public:null,private:null,uid:null,host:false,now:()=>Date.now()},api,error='',signature='',draftKey='',draft={},sending=false;
const link=r=>`story.html?role=${r}${r==='player'&&rt.public?'&code='+rt.public.code:''}`;
const button=(action,text)=>`<button type="button" data-command="${action}" ${sending?'disabled':''}>${text}</button>`;
function choices(name,options,selected){return options.map(([value,text],i)=>`<label class="option color-${i%5} ${String(selected)===String(value)?'selected':''}"><input type="radio" name="${name}" value="${esc(value)}" ${String(selected)===String(value)?'checked':''} required><b>${'ABCDE'[i%5]}</b><span>${esc(text)}</span><i aria-hidden="true">${String(selected)===String(value)?'✓':''}</i></label>`).join('');}
function playerPanel(s){
 if(!s)return entrance(s);
 const p=s.players?.[rt.uid],mine=rt.private;
 if(!p)return s.phase==='lobby'?entrance(s):'<p class="notice">遊戲已開始，你可以觀看公開進度。</p>';
 const wolf=mine?.role==='wolf';
 let html=`<section class="personal"><div class="identity"><div class="portrait">${wolf?'<span class="private-star" aria-label="只有你可見的狼人記號">★</span>':''}<img src="./art/characters/${p.seat%10}.png" alt=""></div><div><h2>${esc(p.name)}</h2><p>${p.alive?'你的行動':'你已出局，只能觀戰'}${wolf?' · 狼人（僅自己可見）':''}</p></div></div>`;
 if(!p.alive||s.phase==='ended'||s.phase==='lobby'||s.pausedAt!==null)return html+'</section>';
 if(['choose','twist'].includes(s.phase)){
  const final=s.phase==='twist',saved=final?mine?.final:mine?.first;
  const allowed=final?s.twist.allowed:[0,1];
  html+=`<p class="eyebrow">第 ${s.round} 輪 · ${final?'事情有了小變化':'作出你的決定'}</p><h1>${esc(s.title)}</h1><p class="narrative">${esc(final?s.twist.text:s.intro)}</p>`;
  html+=`<form id="answer"><fieldset><legend>你要走哪一條路？</legend>${choices('route',s.routes.map((name,i)=>[i,name]).filter(([i])=>allowed.includes(i)),draft.route??saved?.route)}</fieldset><fieldset><legend>抵達後，你要做甚麼？</legend>${choices('choice',s.actions.map((text,i)=>[i,text]),draft.choice??saved?.action)}</fieldset>`;
  if(final&&wolf){html+=`<fieldset class="secret"><legend>狼人秘密行動 · 只有你可見</legend><p>每輪最多殺一人。只能襲擊最後與你走同一路線的人；若對方改道，襲擊落空。死者本輪行動無效。</p><label>下手目標<select name="kill"><option value="">暫不下手</option>${Object.entries(s.players).filter(([id,p])=>id!==rt.uid&&p.alive).map(([id,p])=>`<option value="${esc(id)}" ${(draft.kill??mine?.kill)===id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></fieldset>`;}
  html+=`<button ${sending?'disabled':''}>${saved?'更新我的決定':'確認我的決定'}</button><p class="hint">${final?'必須提交最後決定；未提交便不執行探索，也不發動襲擊。未改道時沿用仍開放的初選路線，否則走第一條可通行路線；未提交仍可能遇襲。':'小變化公布後，你還要確認一次最終行動。'}截止前可以修改。</p></form>`;
 }else if(s.phase==='vote'){
  const options=Object.entries(s.players).filter(([id,p])=>id!==rt.uid&&p.alive&&(!s.runoff||s.candidates.includes(id))).map(([id,p])=>[id,p.name]);options.push(['','棄票']);
  html+=`<form id="vote"><fieldset><legend>${s.runoff?'同票決選：誰是狼人？':'你認為誰是狼人？'}</legend>${choices('target',options,draft.target??mine?.vote)}</fieldset><button ${sending?'disabled':''}>確認秘密投票</button><p class="hint">截止後一起公布票數。唯一最高票者出局；再同票則無人出局。</p></form>`;
 }else html+=`<p>${s.phase==='discuss'?'先看公開紀錄，再與其他生還者討論；討論結束後秘密投票。':'請閱讀公共故事，等待下一階段。'}</p>`;
 return html+'</section>';
}
function entrance(s){return '<section id="entry" class="entry">'+playerEntry({room:params.get('code')||params.get('room')||s?.code||'',name:localStorage.getItem('hoho-live-name')||'',busy:sending||!s,hint:!s?'主持人開好房間後，就可以一起入座。':''}).replace('name="room"','name="code"').replace('name="nickname"','name="name"')+'</section>';}
function hostPanel(s){
 if(!rt.host)return '<section class="scene host-login"><div><p class="eyebrow">主持人登入</p><h1>歡迎回到小桌。</h1><p>使用原有主持帳號登入，房間進度會保留。</p></div><form id="login"><label>電子郵件<input type="email" name="email" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label><button class="primary">登入主持</button></form></section>';
 let controls='';
 if(s?.phase==='lobby')controls='<form id="start"><label>撤離總時限（分鐘）<input name="minutes" type="number" min="5" max="120" value="20" required></label><p class="hint">至少 3 人；3 人局首次命案可能直接反殺，建議 5 人以上。</p><button class="primary">抽選身份並開始</button></form>';
 if(s&&!['ended','lobby'].includes(s.phase))controls='<div class="toolbar">'+button('pause',s.pausedAt!==null?'繼續遊戲':'暫停遊戲')+(!['choose','twist','vote'].includes(s.phase)&&s.pausedAt===null?button('advance','繼續下一階段'):'')+'</div>';
 return `<section class="scene host-desk"><div class="host-welcome"><div><p>今晚的小島，由你開場。</p><h1>主持小桌</h1><p>墜機逃生 · 秘密狼人</p></div><div class="host-mascots" aria-hidden="true"><img src="./art/characters/0.png" alt=""><img src="./art/characters/1.png" alt=""></div></div><div class="host-room"><p>邀請朋友入座${s?' · 已加入 '+Object.keys(s.players).length+' / 20 位':''}</p><h2>${s?esc(s.code):'尚未開場'}</h2>${s?`<div class="toolbar"><a href="${link('player')}" target="_blank" rel="noopener">我要一起玩 ↗</a><a href="${link('display')}" target="_blank" rel="noopener">開啟 OBS 展示 ↗</a></div><button type="button" id="copy-invite">複製邀請連結</button>`:''}${!s||s.phase==='ended'?button('create',s?'再開一場':'建立故事房間'):''}</div><div class="question-picker"><h2>本輪控制</h2><p>${s?`第 ${s.round} 輪 · ${phases[s.phase]}`:'先建立故事房間，再邀請朋友加入。'}</p>${controls}<p class="hint">故事、選擇、小變化及投票會按倒數推進。你只能查看公開故事，身份與秘密行動只會顯示給玩家本人。</p></div>${s&&s.phase!=='ended'?'<details class="room-management"><summary>結束本場</summary><p>提前結束不判勝負，並會揭曉狼人。</p>'+button('end','結束遊戲並揭曉身份')+'</details>':''}</section>`;
}
function showRole(){
 const mine=rt.private,s=rt.public;const existing=document.querySelector('#identity-dialog');if(existing&&(existing.dataset.game!==s?.id||s?.phase==='ended'))existing.remove();if(role!=='player'||!mine?.role||s?.phase==='ended')return;
 const key='escape-role-'+s.id+'-'+rt.uid;if(sessionStorage.getItem(key)||document.querySelector('#identity-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='identity-dialog';dialog.dataset.game=s.id;const wolf=mine.role==='wolf';
 dialog.innerHTML=`<h2>${wolf?'你是狼人':'你是生還者'}</h2><p>${wolf?'你要阻止其他玩家在限時內離島。每輪可秘密襲擊一名同行者，也可不下手。你照常選路和探索。':'找出狼人，或完成求救並離島。第一次命案後，每輪都會投票。'}</p><p>${wolf?'你的星號只有自己看得到。只剩你與一名普通玩家時，對方會反殺，你會落敗。':'只剩你與狼人時，你會反殺獲勝。'}</p><button autofocus>我知道了</button>`;
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{sessionStorage.setItem(key,'1');dialog.remove();});document.body.append(dialog);dialog.showModal();
}
function render(force=false){
 const s=rt.public,key=`${s?.id}/${s?.round}/${s?.revision}/${rt.uid}`;if(key!==draftKey){draftKey=key;draft={};}
 const next=JSON.stringify([s,rt.private,rt.host,error,sending]);if(!force&&signature===next){showRole();return;}signature=next;
 // Preserve typed lobby/login forms across incoming public roster changes.
 const form=root.querySelector('#joinForm,#login,#start');const fields=form?Object.fromEntries(new FormData(form)):null;const oldForm=form?.id;
 const entering=role==='player'&&!s?.players?.[rt.uid]&&(!s||s.phase==='lobby');
 document.body.classList.toggle('player-entry',entering);setEntryVideo(entering);
 root.className='escape-app';
 const logo='<img class="brand-logo" src="./art/party-logo.png" width="1816" height="866" alt="來吧！我們互相傷害！">';
 const clock=`<div class="clock"><span>${s?.phase==='lobby'?'房間碼':'撤離倒數'}</span><strong id="escape-clock">${s?.phase==='lobby'?esc(s.code):'—'}</strong><small id="phase-clock"></small></div>`;
 const notice=error?`<p role="alert" class="notice error">${esc(error)}</p>`:'';
 stopFeed?.();
 if(role==='display'){
  root.innerHTML=`<header>${logo}<span class="voyage-display-title">墜機逃生 · 秘密狼人</span>${clock}</header><main class="voyage-display-stage">${escapeDisplay(s,notice)}</main>`;
  stopFeed=startChoiceScroll(root.querySelector('[data-choice-feed]'));
 }else{
  root.innerHTML=`<header>${logo}<nav><a href="${link('player')}" target="_blank" rel="noopener">觀眾席</a><a href="story.html?role=host">主持小桌</a><a href="${link('display')}" target="_blank" rel="noopener">直播展示 ↗</a></nav>${entering?'':clock}</header>${role==='host'&&rt.host?'<nav class="host-mode-switch" aria-label="主持模式"><span>主持模式</span><a href="host.html">選邊站</a><a href="host.html?mode=voyage" aria-current="page">墜機逃生・狼人</a></nav>':''}<main class="voyage">${notice}${role==='host'?hostPanel(s):playerPanel(s)}${!entering&&(role!=='host'||rt.host)?publicPanel(s)+historyPanel(s):''}</main>`;
 }
 const copy=root.querySelector('#copy-invite');if(copy)copy.onclick=()=>navigator.clipboard.writeText(new URL(link('player'),location.href).href).then(()=>{copy.textContent='已複製邀請連結';}).catch(()=>{copy.textContent='請複製「我要一起玩」連結';});
 if(s&&!entering&&role!=='display'&&(role!=='host'||rt.host)){
  const players=Object.fromEntries(Object.entries(s.players).filter(([,p])=>p.alive));
  const positions=Object.fromEntries(Object.keys(players).map((id,i)=>[id,{x:35+i*110}]));
  paintIsland({...s,players,island:{width:Math.max(800,Object.keys(players).length*110+80),positions}},rt.uid);
  const island=document.querySelector('.voyage-island');if(island){island.querySelector('h2').textContent=Object.keys(players).length+' 位生還者在島上';island.querySelector(':scope > p').textContent='找到你的角色，一起走向下一幕。';island.querySelectorAll('.private-star').forEach(n=>n.remove());if(rt.private?.role==='wolf'&&role==='player'){const walker=[...island.querySelectorAll('.island-walker')].find(n=>n.dataset.uid===rt.uid);if(walker){const star=document.createElement('b');star.className='private-star';star.textContent='★';star.setAttribute('aria-label','只有你可見的狼人記號');walker.prepend(star);}}}
 }else paintIsland(null,rt.uid);
 if(fields&&oldForm)for(const [name,value]of Object.entries(fields)){const input=root.querySelector(`#${oldForm} [name="${name}"]`);if(input)input.value=value;}
 root.querySelectorAll('#answer input,#answer select,#vote input').forEach(el=>el.addEventListener('change',()=>{draft[el.name]=el.value;if(el.type==='radio')root.querySelectorAll(`input[name="${el.name}"]`).forEach(i=>{i.closest('label').classList.toggle('selected',i.checked);const mark=i.closest('label').querySelector('i');if(mark)mark.textContent=i.checked?'✓':'';});}));
 root.querySelectorAll('[data-command]').forEach(el=>el.onclick=()=>perform(()=>api.call(el.dataset.command)));
 for(const id of ['joinForm','login','start','answer','vote']){const f=root.querySelector('#'+id);if(f)f.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));if(id==='joinForm'){d.code=d.code.trim().toUpperCase();d.name=d.name.trim();localStorage.setItem('hoho-live-name',d.name);}perform(()=>id==='login'?api.login(d.email,d.password):api.call(id==='joinForm'?'join':id,id==='start'?{minutes:Number(d.minutes)}:id==='answer'?{route:Number(d.route),choice:Number(d.choice),kill:d.kill||null}:id==='vote'?{target:d.target||null}:d));};}
 updateClocks();showRole();
}
function updateClocks(){const s=rt.public;if(!s||s.phase==='lobby')return;const now=s.pausedAt??rt.now();const fmt=end=>{const n=Math.max(0,Math.ceil((end-now)/1000));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};const a=root.querySelector('#escape-clock'),b=root.querySelector('#phase-clock');if(a)a.textContent=s.phase==='ended'?'已結束':fmt(s.escapeDeadline);if(b)b.textContent=s.phase==='ended'?'':`${phases[s.phase]} ${fmt(s.deadline)}`;}
async function perform(fn){if(sending)return;sending=true;error='';render();try{await fn();}catch(e){error=e.message;}finally{sending=false;render();}}
render();
try{api=await connectEscape(role,state=>{rt=state;render();},e=>{error=e.code==='functions/not-found'?'多人逃生服務尚未部署。請完成伺服器部署後再建立房間。':e.message;render();});}catch(e){error=e.message;render();}
setInterval(updateClocks,1000);
