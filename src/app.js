import './spotlight.css';
import {isSpotlight,nextSpotlight,targetFirst} from './spotlight.js';
import {spotlightQuestion,masterCard} from './spotlight-view.js';
import {hostModes} from './host-modes.js';
import {voteStack,createVoterDialog} from './voter-view.js';
import {createEffects} from './effects-view.js';
import {createInvite} from './invite.js';
import {renderDisplayWelcome} from './display-welcome.js';
import {createIsland} from './island-view.js';
import {pairStats,qualifies} from './affinity.js';
import {connect} from './backend.js';
import {questions} from './questions.js';
import {leaderboard} from './game.js';
import {config} from '../config.js';
import {pageLink} from './navigation.js';
import {characterId,characterMarkup} from './characters.js';

const role=document.body.dataset.role||'viewer', $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={waiting:'等大家入座',thinking:'主角正在思考',open:'開放作答',closed:'已截止，等待揭曉',revealed:'答案揭曉・聊聊吧',ended:'今晚先到這裡'};
let api,pub=null,privateRoom={},hostReady=false,choice=null,prediction=null,answerRound=null,ack='',sending=false,lastAutoClose=0;
let ownAnswer=null,advancing=false,advanceRetryAt=0;
let privateUnsub=()=>{},ownUnsub=()=>{},modUnsub=()=>{},moderation={},chatUnsubs=new Map(),chatData={},privateRound=null;
const explicitDemo=new URLSearchParams(location.search).get('demo')==='1';
const link=(page,room='')=>pageLink(page,{demo:explicitDemo,room});
const storagePrefix=explicitDemo||!config.firebase?'hoho-demo':'hoho-live';
let savedCode=new URLSearchParams(location.search).get('room')||localStorage.getItem(`${storagePrefix}-room`)||'';
let pane='answer',unread=0,chatInitialized=false,seenMessages=new Set(),migrationCode=null,migrating=false;
const button=(id,text,cls='')=>`<button id="${id}" class="${cls}">${text}</button>`;
document.body.classList.add(role);
$('app').innerHTML=`<header><div class="brand"><img class="brand-logo" src="./art/party-logo.png" alt="來吧！我們互相傷害！" width="1816" height="866"></div><nav>${role==='host'?`<a href="${link('index')}" target="_blank" rel="noopener">觀眾席</a><a href="${link('host')}" target="_blank" rel="noopener">主持小桌</a><a href="${link('display')}" target="_blank" rel="noopener">直播展示 ↗</a>`:''}</nav><span id="connection" role="status" data-state="connecting" title="連線中…"><span class="connection-label">連線中…</span></span></header>
<div class="mode" id="mode">正在準備今晚的同樂會…</div>${role==='host'?hostModes('classic'):''}<main><div id="notice" role="status" aria-live="polite"></div>
<section id="entry" class="entry" hidden></section>
${role==='host'?`<section id="controls" class="panel" hidden><div class="host-welcome"><div><p>今晚的小島，由你開場。</p><h1>主持小桌</h1></div><div class="host-mascots" aria-hidden="true">${characterMarkup(0,true)}${characterMarkup(1,true)}</div></div><div class="host-room"><div id="roomLinks"><b>還沒有房間</b><span>建立房間後，邀請朋友入座。</span></div><div id="inviteTools" hidden></div><div class="toolbar room-actions">${button('create','建立房間','primary')}${button('lock','鎖定加入')}${button('toggleChat','關閉聊天')}</div></div><div class="question-picker"><div class="section-title"><h2>本輪控制</h2><span id="submitted">等待開場</span></div><p id="hostGuide" class="hint">先建立房間，再選一道暖場題。</p><label for="questionPick">下一道題目</label><select id="questionPick">${questions.map((q,i)=>`<option value="${i}">${i+1}. ${esc(q.text)}</option>`).join('')}</select><div class="toolbar round-actions">${button('start','開始這題 · 45 秒','primary')}<button id="skipTarget" hidden>跳過未作答主角</button>${button('extend','延長 15 秒')}${button('close','提前截止')}${button('reveal','揭曉答案','accent')}</div></div><details class="room-management"><summary>房間管理與登出</summary><p class="hint">結束後才能清理。本場答案、故事與聊天會一併移除。</p><div class="toolbar">${button('end','結束房間')}${button('clean','清理資料','danger')}${button('logout','登出')}</div></details></section>`:''}
${role==='viewer'?'<div id="viewerStatus" hidden></div><nav id="playerTabs" class="player-tabs" aria-label="玩家功能" hidden><button data-pane="answer" aria-pressed="true">作答</button><button data-pane="chat" aria-pressed="false">聊天 <span id="chatBadge"></span></button><button data-pane="board" aria-pressed="false">排行榜</button></nav>':''}<div class="layout"><section id="game" aria-label="題目與結果"></section>${role!=='display'?`<aside id="social" hidden><details class="panel" open><summary>同桌聊天 <span>可以只玩，不用發言</span></summary><p class="hint" id="chatHint">作答時先別暴雷，讓大家自己選！</p><div id="messages" class="messages" aria-live="polite"></div><form id="chatForm"><label for="chatText">說點甚麼</label><div class="input-row"><input id="chatText" maxlength="240" placeholder="最多 240 字，間隔 3 秒" autocomplete="off"><button class="primary">送出</button></div></form></details><section id="storyBox" class="panel" hidden><h2>這個答案背後有故事？</h2><p>投稿先給主持人看，選中才會出現在直播。</p><form id="storyForm"><label for="storyText">你的故事（最多 500 字）</label><textarea id="storyText" maxlength="500" rows="4"></textarea><button class="accent">交給主持人</button></form></section></aside>`:''}</div>
${role==='viewer'?'<button id="chatEntry" class="chat-entry" hidden>同桌聊天 <span id="chatEntryCount">打開聊天室</span></button><section id="islandArea" hidden></section>':''}
${role==='host'?'<section id="affinityPanel" class="panel" hidden><h2>島民默契 · 僅主持人可見</h2><label for="affinityPlayer">選擇玩家</label><select id="affinityPlayer"></select><div id="affinityRows"></div></section><div class="host-bottom"><section class="panel"><h2>在座朋友</h2><div id="members"></div></section><section class="panel"><h2>故事收件匣</h2><p>只有你能看到未選中的投稿。</p><div id="stories"></div></section></div>':''}
</main>${role==='viewer'?'':'<footer><span>選擇沒有標準答案，也不是人格測驗。</span><a id="twitch" target="_blank" rel="noopener">回到 Twitch ↗</a></footer>'}`;
const updateVoterDialog=['viewer','display'].includes(role)?createVoterDialog($('game'),()=>pub?.state?({...pub.state,result:pub.results?.[pub.state.round],members:pub.members||{},uid:api?.uid(),options:pub.state.question?.options||[]}):null):()=>{};
if(role==='viewer')document.querySelector('main').after($('islandArea'));
if(role==='display'){const area=document.createElement('section');area.id='islandArea';area.hidden=true;document.querySelector('main').after(area);}
const updateIsland=role==='viewer'||role==='display'?createIsland($('islandArea'),{spectator:role==='display'}):()=>{};
const updateInvite=role==='host'?createInvite($('inviteTools')):()=>{};
let updateEffects=()=>{}; const relayed=new Set();let relayWarningAt=0;
function relayOnce(key,value){if(relayed.has(key))return;relayed.add(key);if(relayed.size>500)relayed.delete(relayed.values().next().value);api.command('relayEffects',value).catch(e=>{relayed.delete(key);if(Date.now()-relayWarningAt>30000){relayWarningAt=Date.now();notice('彈幕轉送失敗，請確認連線與主持人權限。'+friendly(e),true);}});}
if(role==='host'){const panel=document.createElement('div');panel.className='effect-controls';panel.innerHTML='<h2>直播氣氛</h2><p class=hint>聊天會自動出現在玩家頁與直播。保留此主持頁開著，即可自動轉送。</p><div class=toolbar>'+button('toggleChatEffects','聊天彈幕')+button('toggleSubmitEffects','交卷彈幕')+'</div>';$('controls').insertBefore(panel,document.querySelector('.room-management'));}
function setPane(value){pane=value;document.body.dataset.pane=value;if(value==='chat')unread=0;updateBadges();document.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===value)));}
function updateBadges(){if($('chatBadge'))$('chatBadge').textContent=unread?`(${unread})`:'';if($('chatEntryCount'))$('chatEntryCount').textContent=unread?`${unread} 則新訊息`:'打開聊天室';}
document.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>setPane(b.dataset.pane));if($('chatEntry'))$('chatEntry').onclick=()=>setPane('chat');setPane('answer');
async function ensureMigration(){if(!hostReady||!pub?.state||migrating||migrationCode===pub.state.code)return;migrating=true;const code=pub.state.code;try{await api.command('migrate');migrationCode=code;}catch(e){notice(friendly(e),true);}finally{migrating=false;}}
if($('twitch')){
try{const u=new URL(config.twitchUrl);$('twitch').href=u.protocol==='https:'?u.href:'https://www.twitch.tv/';}catch{$('twitch').href='https://www.twitch.tv/';}
$('twitch').textContent=new URL($('twitch').href).pathname==='/'?'前往 Twitch ↗':'回到直播頻道 ↗';
}
function notice(msg,error=false){
 const box=$('notice');box.replaceChildren();box.className=error?'error':'success';
 if(!msg)return;
 const text=document.createElement('span');text.textContent=msg;
 const close=document.createElement('button');close.type='button';close.className='notice-close';close.textContent='×';close.setAttribute('aria-label','關閉提示');
 close.onclick=()=>{box.replaceChildren();box.className='';};
 box.append(text,close);
}
function friendly(e){return e.code?.includes('permission')?'操作未獲伺服器接受。可能已截止、被禁言／移除，或房間已鎖定。':e.code?.includes('auth/')?'登入失敗，請檢查帳號、密碼和登入設定。':e.message||'操作失敗，請重試。';}
async function act(fn){try{await fn();}catch(e){notice(friendly(e),true);}}
function on(id,fn){const el=$(id);if(el)el.onclick=()=>act(fn);}
function replace(id,html){const active=document.activeElement,focusId=active?.id,start=active?.selectionStart;$(id).innerHTML=html;if(focusId&&$(focusId)){ $(focusId).focus({preventScroll:true});if(typeof start==='number'&&$(focusId).setSelectionRange)$(focusId).setSelectionRange(start,start);}}
function entry(){
 if(role==='display')return;
 if(role==='host'){
 $('entry').hidden=hostReady;$('controls').hidden=!hostReady;
 if(!hostReady)$('entry').innerHTML='<div><p class="eyebrow">主持人專用</p><h1>歡迎回到小桌。</h1><p>使用指定的正式帳號登入，房間進度會保留。</p></div><form id="loginForm"><label for="email">電子郵件</label><input id="email" type="email" autocomplete="username" required><label for="password">密碼</label><input id="password" type="password" autocomplete="current-password" required><button class="primary">登入主持</button></form>';
 if($('loginForm'))$('loginForm').onsubmit=e=>{e.preventDefault();act(async()=>{await api.login($('email').value,$('password').value);hostReady=true;watchPrivate();entry();render();});};
 }else{
 const joined=pub?.members?.[api.uid()]&&savedCode===pub?.state?.code;
 $('entry').hidden=!!joined;
 if(!joined&&!$('joinForm'))$('entry').innerHTML=`<form id="joinForm" aria-labelledby="joinTitle"><h1 id="joinTitle" class="join-title">一起上島。</h1><p class="join-intro">輸入房間碼和暱稱，就能加入派對。</p><label for="roomCode">房間碼</label><input id="roomCode" maxlength="6" pattern="[A-Za-z0-9]{6}" value="${esc(savedCode)}" placeholder="輸入 6 位房間碼" autocomplete="off" autocapitalize="characters" spellcheck="false" required><label for="nickname">暱稱</label><input id="nickname" maxlength="20" value="${esc(localStorage.getItem(`${storagePrefix}-name`)||'')}" placeholder="大家怎樣稱呼你？" autocomplete="nickname" required><button class="primary">加入派對</button><p class="hint">毋須註冊，入座後會獲派一位島民。</p></form>`;
 if($('joinForm'))$('joinForm').onsubmit=e=>{e.preventDefault();act(async()=>{const code=$('roomCode').value.trim().toUpperCase(),name=$('nickname').value.trim();if(!name)throw Error('請輸入暱稱。');await api.join(code,name);savedCode=code;localStorage.setItem(`${storagePrefix}-room`,code);localStorage.setItem(`${storagePrefix}-name`,name);entry();render();watchOwn();syncChats();});};
 }
}
function eligible(){return role==='viewer'&&pub?.members?.[api.uid()]&&savedCode===pub?.state?.code&&!moderation.removed;}
function render(){
 const s=pub?.state,joined=eligible();entry();updateVoterDialog();
 if(role==='display'){
  $('islandArea').hidden=!s;document.body.classList.toggle('display-in-room',!!s);if(s)updateIsland(pub,null);
  const backgroundVideo=document.querySelector('.display-background-video');
  if(backgroundVideo){
   backgroundVideo.hidden=!!s;
   if(s)backgroundVideo.pause();
   else if(backgroundVideo.paused){backgroundVideo.muted=true;backgroundVideo.play().catch(()=>{});}
  }
 }
 updateEffects(pub,role==='display'||joined);
 if(role==='host')updateInvite({url:s?new URL(link('index',s.code),location.href).href:'',available:hostReady&&!!s&&s.status!=='ended',demo:explicitDemo||!config.firebase,local:['localhost','127.0.0.1'].includes(location.hostname),locked:s?.locked});
 if(role==='host'&&!s){const m=document.querySelector('.room-management');m.open=false;m.dataset.roomState='';m.querySelector('summary').textContent='房間管理與登出';}
 if(role==='viewer'){for(const id of ['viewerStatus','playerTabs','chatEntry','islandArea'])$(id).hidden=!joined;document.body.classList.toggle('in-room',!!joined);if(joined){$('viewerStatus').innerHTML=`<span class="viewer-identity"><span class="player-avatar">${characterMarkup(characterId(api.uid(),s.code))}</span><b>${esc(pub.members[api.uid()].name)}</b></span>`;updateIsland(pub,api.uid());}}
 if(!s){if($('hiddenScores')){$('hiddenScores').hidden=true;$('hiddenScores').replaceChildren();$('spotlightSettings').hidden=true;}if($('affinityPanel')){$('affinityPanel').hidden=true;$('affinityRows').textContent='';}if(role==='display')renderDisplayWelcome($('game'),new URL(link('index'),location.href).href);else replace('game','<div class="empty"><span class="big-mark">◒</span><h1>小桌還沒開場</h1><p>主持人開好房間後，就可以一起入座。</p></div>');if($('social'))$('social').hidden=true;if(hostReady){for(const id of ['lock','toggleChat','toggleChatEffects','toggleSubmitEffects','end','clean','start','skipTarget','extend','close','reveal'])$(id).disabled=true;$('submitted').textContent='等待開場';$('roomLinks').innerHTML='<b>還沒有房間</b><span>建立房間後，邀請朋友入座。</span>';$('hostGuide').textContent='先建立房間，再選一道暖場題。';$('members').textContent='';$('stories').textContent='';}return;}
 const spotlight=isSpotlight(s),result=pub.results?.[s.round], isOpen=s.status==='open'&&api.now()<s.deadline, count=Object.keys(pub.members||{}).length;
 const ownSubmitted=!!ownAnswer&&(!targetFirst(s)||ownAnswer.attempt===s.attempt);
 const canAnswer=joined&&!sending&&(targetFirst(s)?(api.uid()===s.targetUid?s.status==='thinking'&&!ownSubmitted:isOpen):isOpen);
 const board=leaderboard(pub.results,pub.members);
 const avatar=uid=>characterMarkup(characterId(uid,s.code));

 let html=`<div class="room-line"><span class="room-code">房間 <b>${esc(s.code)}</b></span><span>${count} / 20 人入座</span><span class="pill">${labels[s.status==='open'&&!isOpen?'closed':s.status]||'等待中'}</span></div>`;

 if(s.question&&spotlight)html+=spotlightQuestion({s,result,pub,role,uid:api.uid(),joined,canAnswer,choice,prediction,sending,ack,ownSubmitted});
 else if(s.question){html+=`<article class="question"><div class="section-title"><span>第 ${s.round} 題</span><span id="timer" class="timer"></span></div><h1>${esc(s.question.text)}</h1>`;
 if(role==='viewer'&&joined&&s.status!=='revealed'&&s.status!=='ended')html+=`<fieldset ${canAnswer?'':'disabled'}><legend>我的答案</legend><div class="options">${s.question.options.map((o,i)=>`<label class="option option-${i} ${choice===i?'selected':''}"><input id="choice-${i}" name="choice" type="radio" value="${i}" ${choice===i?'checked':''}><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}</span></label>`).join('')}</div></fieldset><fieldset ${canAnswer?'':'disabled'}><legend>猜誰是多數？ <small>猜中 +1 分</small></legend><div class="predictions">${s.question.options.map((o,i)=>`<label class="prediction prediction-${i} ${prediction===i?'selected':''}"><input id="prediction-${i}" name="prediction" type="radio" value="${i}" aria-label="${'ABCD'[i]}：${esc(o)}" ${prediction===i?'checked':''}><b>${'ABCD'[i]}</b><span>${esc(o)}</span></label>`).join('')}</div></fieldset><div class="submit-row"><button id="submit" class="primary" ${!canAnswer||sending||choice===null||prediction===null?'disabled':''}>${sending?'等伺服器確認…':ack==='已提交'?'更新我的答案':'一起提交'}</button><span id="ack" role="status">${esc(ack||'選答案，再猜多數。')}</span></div>`;
 else html+=`<div class="options ${result?'revealed':''}">${s.question.options.map((o,i)=>`<div class="option option-${i} ${result?.winners?.includes(i)?'most-votes':''}" style="--vote-share:${result?.total?Math.round(result.counts[i]/result.total*100):0}%"><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}</span>${result?(role==='viewer'?voteStack(i,result,pub.members||{},api.uid(),s.code):`<strong>${result.counts[i]} 票 ${result.winners?.includes(i)?'★':''}</strong><span class="vote-track" aria-hidden="true"><i></i></span>${role==='display'?voteStack(i,result,pub.members||{},null,s.code):''}`):''}</div>`).join('')}</div>`;
 if(result&&role!=='viewer')html+=`<p class="result-note">${result.total===0?'這題零票，不計分。下題再來！':`${result.total} 人作答 · ${result.winners.length>1?'最高票並列，猜中任一項都得分。':'★ 是最多人選的答案。'}`}${joined?`<br>你本輪得 ${result.points?.[api.uid()]||0} 分${result.points?.[api.uid()]===1?'，默契到位！':'，來聽聽大家的理由。'}`:''}</p>`;
 html+='</article>';
 }else html+=`<article class="question waiting"><div class="waiting-crew">${[0,1,2,3,4].map(i=>characterMarkup(i,true)).join('')}</div><h1>先坐好，題目快來了。</h1><p>${spotlight?`${count<2?`目前 ${count} 位入座，至少 2 位才能開始。請邀請另一位朋友加入。`:'人數已足夠，等待主持人請主角先作答。'}玩家不需要按開始；題目會自動出現。主角先提交並鎖定答案，才開始大家的 45 秒作答時間。`:'選自己的答案，再猜最多人選哪個。不比手速，放心慢慢想。'}</p></article>`;
 if(pub.story&&pub.story.round===s.round)html+=`<section class="spotlight ${pub.story.text.length<=140?'short-story':''}"><p>主持人選中的故事</p><blockquote>「${esc(pub.story.text)}」</blockquote><b>— ${esc(pub.story.name)}</b></section>`;
 if(result||s.status==='ended'||role==='viewer')html+=`<section class="panel leaderboard"><h2>${spotlight?'心水清排行榜':'猜大家排行榜'}</h2>${spotlight?masterCard(pub.awards,pub.members||{}):''}${board.length?board.map((p,i)=>`<div class="rank"><span>${i&&p.score===board[i-1].score?'＝':board.findIndex(x=>x.score===p.score)+1}</span>${avatar(p.id)}<b>${esc(p.name)}${pub.awards?.winners?.[p.id]?'<span class="master-badge">心水清大師</span>':''}</b><strong>${p.score} <small>分</small></strong></div>`).join(''):'<p>還沒有人入座。</p>'}</section>`;
 replace('game',html);
 document.querySelectorAll('input[name="choice"]').forEach(el=>el.onchange=()=>{choice=+el.value;ack='選擇已修改，請提交。';render();});
 document.querySelectorAll('input[name="prediction"]').forEach(el=>el.onchange=()=>{prediction=+el.value;ack='選擇已修改，請提交。';render();});
 on('submit',async()=>{if(sending)return;sending=true;ack='';render();const stillCurrent=()=>pub?.state?.code===s.code&&pub?.state?.round===s.round&&pub?.state?.attempt===s.attempt;try{await api.answer(s.round,choice,spotlight&&s.targetUid===api.uid()?-1:prediction,targetFirst(s)?s.attempt:undefined);if(stillCurrent()){ownAnswer={choice,prediction,attempt:s.attempt};ack='已提交';}}catch(e){if(stillCurrent())ack='提交未成功，請檢查連線或截止時間。';throw e;}finally{sending=false;render();}});
 if($('social')){$('social').hidden=!(joined||hostReady);$('storyBox').hidden=!(joined&&s.status==='revealed');$('chatHint').textContent=s.chatOpen?'聊天會自動出現在玩家頁與直播彈幕；請勿填個人資料，作答時先別暴雷。每人隔 3 秒可發言一次。':'主持人暫時關閉了聊天。';$('chatText').disabled=!joined||!s.chatOpen||moderation.muted||s.status==='ended';$('chatForm').hidden=role==='host';}
 if(role==='host'&&hostReady){renderHost();ensureMigration();}
 tick();
}
const lockedAnswerLabel='<span class="submit-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="12" rx="3"/><path d="M12 14v4"/></svg></span><span>本題已截止，等待主持人揭曉</span>';
function tick(){
 const s=pub?.state;if(!s)return;
 if(hostReady&&targetFirst(s)&&s.status==='thinking'&&privateRoom.answers?.[s.round]?.[s.targetUid]&&!advancing&&Date.now()>advanceRetryAt){advancing=true;api.command('openGuesses',{...s}).catch(e=>{advanceRetryAt=Date.now()+5000;notice(friendly(e),true);}).finally(()=>advancing=false);}
 if(!$('timer'))return;
 const seconds=Math.max(0,Math.ceil((s.deadline-api.now())/1000));
 $('timer').textContent=s.status==='open'?(seconds?`${seconds} 秒`:'時間到，已鎖定作答'):s.status==='thinking'?`${s.targetName}正在思考`:labels[s.status];
 if(hostReady&&s.status==='open')$('hostGuide').textContent=seconds?`剩餘 ${seconds} 秒，到時自動截止。需要更多時間，請現在按「延長 15 秒」；「鎖定加入」只影響新玩家入座。`:'倒數已結束，正在同步截止狀態；接著按「揭曉答案」，再開始下一題。';
 const locked=s.status==='closed'||(s.status==='open'&&!seconds);
 if(locked){
  document.querySelectorAll('fieldset').forEach(e=>e.disabled=true);
  const submit=$('submit');if(submit){submit.disabled=true;if(!submit.classList.contains('answer-locked')){submit.classList.add('answer-locked');submit.innerHTML=lockedAnswerLabel;}$('ack').hidden=false;$('ack').textContent='等待主持人揭曉並開始下一題後，即可繼續作答。';}
 }
 if(s.status==='open'&&!seconds&&hostReady&&Date.now()-lastAutoClose>5000){lastAutoClose=Date.now();api.command('close',{round:s.round,code:s.code}).catch(()=>{});}
}

function watchPrivate(){privateUnsub();if(!hostReady||!pub?.state)return;const round=pub.state.round;privateRound=round;privateRoom={answers:{},stories:{},moderation:{}};const stops=[];for(const [path,key] of [[`answers/${round}`,'answers'],[`stories/${round}`,'stories'],['moderation','moderation'],['hostOnly/affinity','affinity'],['hostOnly/spotlight','spotlight']])stops.push(api.watch(`room/${path}`,r=>{privateRoom[key]=['moderation','affinity','spotlight'].includes(key)?(r||{}):{[round]:r||{}};renderHost();},e=>notice(friendly(e),true)));privateUnsub=()=>stops.forEach(f=>f());}
function watchOwn(){ownUnsub();modUnsub();if(role!=='viewer'||!api.uid())return;modUnsub=api.watch(`room/moderation/${api.uid()}`,m=>{moderation=m||{};if(m?.removed)notice('你已被主持人移出房間。',true);render();},()=>{});if(eligible()&&pub?.state?.round)ownUnsub=api.watch(`room/answers/${pub.state.round}/${api.uid()}`,a=>{if(!sending){ownAnswer=a;if(a&&(!targetFirst(pub?.state)||a.attempt===pub.state.attempt)){choice=a.choice;prediction=a.prediction;ack='已恢復儲存的答案';}render();}},()=>{});}
if(role==='host'){
 const settings=document.createElement('section');settings.id='spotlightSettings';settings.className='spotlight-settings';settings.hidden=true;settings.innerHTML='<h2>輪流猜主角</h2><div class="toolbar"><label>每回合題數<input id="cycleQuestions" type="number" min="1" max="30" value="10"></label><label>場次回合數<input id="cycleCount" type="number" min="1" max="3" value="3"></label><button id="saveSpotlight">套用場次設定</button></div><p id="rotationHint" class="hint"></p>';document.querySelector('.host-room').before(settings);
 const scores=document.createElement('section');scores.id='hiddenScores';scores.className='panel';scores.hidden=true;document.querySelector('.host-bottom').before(scores);
 on('saveSpotlight',()=>api.command('configure',{questionsPerCycle:Number($('cycleQuestions').value),cycles:Number($('cycleCount').value)}));
}
function renderHost(){
 if(!pub?.state)return;const s=pub.state;
 renderAffinity();
 const spotlight=isSpotlight(s);$('spotlightSettings').hidden=!spotlight;$('hiddenScores').hidden=!spotlight;
 if(spotlight){
  const picker=$('questionPick');const key=`${s.code}/${s.round}/${s.status}`;if(s.status==='revealed'&&picker.dataset.suggested!==key){const used=new Set(Object.values(pub.results||{}).map(r=>r.questionId));const nextQuestion=questions.findIndex(q=>!used.has(q.id));if(nextQuestion>=0)picker.value=nextQuestion;picker.dataset.suggested=key;}
  const version=`${s.code}/${s.questionsPerCycle}/${s.cycles}`;if($('spotlightSettings').dataset.version!==version){$('cycleQuestions').value=s.questionsPerCycle;$('cycleCount').value=s.cycles;$('spotlightSettings').dataset.version=version;}
  for(const id of ['cycleQuestions','cycleCount','saveSpotlight'])$(id).disabled=s.round>0||s.status!=='waiting';
  const next=nextSpotlight({public:pub}).id;
  $('rotationHint').textContent=s.completed?'本場已完成，心水清大師已公布。':`本場 ${s.questionsPerCycle*s.cycles} 題 · 已進行 ${s.status==='thinking'?s.round-1:s.round} 題 · ${s.targetName?'本題主角：'+s.targetName+' · ':''}下一題主角：${pub.members?.[next]?.name||'等待玩家加入'}。主角按入座順序輪換；開場後固定場次設定。`;
  $('hiddenScores').innerHTML='<h2>主角隱藏分 · 僅主持人可見</h2><p class="hint">每人猜中加 1 被猜中分，猜錯加 1 未被猜中分；漏答不計，不影響心水清排行榜。</p>'+Object.entries(pub.members||{}).map(([id,m])=>{const p=privateRoom.spotlight?.players?.[id]||{};return `<div class="hidden-score-row"><b>${esc(m.name)}</b><span>主角 ${p.turns||0} 次</span><span>被猜中 ${p.guessed||0}</span><span>未被猜中 ${p.unguessed||0}</span></div>`;}).join('');
 }

 for(const [id,field,label] of [['toggleChatEffects','chatEffects','聊天彈幕'],['toggleSubmitEffects','submitEffects','交卷彈幕']]){$(id).disabled=s.status==='ended';$(id).textContent=label+'：'+(s[field]===true?'開啟中':'已關閉');$(id).setAttribute('aria-pressed',String(s[field]===true));}
 if(s.submitEffects===true)relayOnce(s.code+'/answers/'+s.round+'/'+JSON.stringify(privateRoom.answers?.[s.round]||{}),{code:s.code,round:s.round,kind:'submissions'});
 $('submitted').textContent=`${Object.keys(privateRoom.answers?.[s.round]||{}).length} / ${Object.keys(pub.members||{}).length} 人已提交`;
 $('hostGuide').textContent={thinking:`${s.targetName}正在思考，尚未開始計時。主角提交後自動開放大家作答；沒有回答可跳過，不計分也不占題數。請保持主持頁連線。`,waiting:'朋友入座後，選一道暖場題開始。',open:'作答進行中，倒數到時會自動截止；需要更多時間，請在截止前按「延長 15 秒」。',closed:'本題已截止（倒數到時會自動截止）。請先按「揭曉答案」，再請下一題主角先作答；零人作答也可繼續。',revealed:s.completed?'本場已完成，留點時間分享，再結束房間。':'留點時間聽故事，再選下一題。',ended:'活動已結束；需要保留資料請先匯出，再清理。'}[s.status]||'';
 const waitingForPlayers=spotlight&&['waiting','revealed'].includes(s.status)&&!s.completed&&Object.keys(pub.members||{}).length<2;
 if(waitingForPlayers)$('hostGuide').textContent=`目前 ${Object.keys(pub.members||{}).length} 位入座，至少 2 位才能輪流猜主角。請分享邀請連結；主持人若要參加，也須按「我要一起玩」入座。登入主持頁不會自動算作玩家。${s.locked?'目前已鎖定加入，請先按「重新開放加入」。':''}`;
 else if(spotlight&&s.status==='waiting')$('hostGuide').textContent='人數已足夠。選好題目後，按「請主角先作答」；主角提交後，大家才開始 45 秒作答。';
 $('start').textContent=waitingForPlayers?'等待至少 2 位入座':spotlight?'請主角先作答':'開始這題 · 45 秒';
 $('start').setAttribute('aria-describedby','hostGuide');
 $('lock').textContent=s.locked?'重新開放加入':'鎖定加入';$('toggleChat').textContent=s.chatOpen?'關閉聊天':'開啟聊天';
 $('skipTarget').hidden=!targetFirst(s)||s.status!=='thinking';$('skipTarget').disabled=s.status!=='thinking'||!!privateRoom.answers?.[s.round]?.[s.targetUid];
 $('create').disabled=true;for(const id of ['lock','toggleChat','end'])$(id).disabled=s.status==='ended';$('clean').disabled=s.status!=='ended';$('start').disabled=!['waiting','revealed'].includes(s.status)||s.completed===true||(spotlight&&Object.keys(pub.members||{}).length<2);$('reveal').disabled=!['closed','revealed'].includes(s.status);$('close').disabled=s.status!=='open';$('extend').disabled=s.status!=='open'||api.now()>=s.deadline;
 const ended=s.status==='ended';
 $('roomLinks').innerHTML=`<span class="host-code-label">${ended?'本場已結束 · 不再接受加入':s.locked?'已暫停接受新朋友':'邀請朋友入座'}</span><b class="host-room-code">${esc(s.code)}</b>${ended?'<p class="hint">這是保留的上一場紀錄。確認不需保留後，清理資料即可建立新房間。</p>':''}<span class="host-links">${!ended?`<a href="${esc(link('index',s.code))}" target="_blank" rel="noopener">我要一起玩 ↗</a>`:''}<a href="${link('display')}" target="_blank" rel="noopener">開啟 OBS 展示 ↗</a></span>`;
 const management=document.querySelector('.room-management');
 if(management.dataset.roomState!==`${s.code}/${s.status}`){management.open=ended;management.dataset.roomState=`${s.code}/${s.status}`;}
 management.querySelector('summary').textContent=ended?'本場已結束：清理資料後開新場':'房間管理與登出';
 $('members').innerHTML=Object.entries(pub.members||{}).map(([uid,m])=>`<div class="member">${characterMarkup(characterId(uid,s.code))}<b>${esc(m.name)}</b><button data-mute="${esc(uid)}">${privateRoom.moderation?.[uid]?.muted?'解除禁言':'禁言'}</button><button data-remove="${esc(uid)}" class="danger">移除</button></div>`).join('')||'<p>等朋友們加入。</p>';
 $('stories').innerHTML=Object.entries(privateRoom.stories?.[s.round]||{}).map(([uid,m])=>`<article class="story-review"><b>${esc(pub.members?.[uid]?.name||'已離開的朋友')}</b><p>${esc(m.text)}</p><button data-story="${esc(uid)}">選到直播展示</button></article>`).join('')||'<p>這輪還沒有投稿。</p>';
 if(pub.story)$('stories').innerHTML+=button('withdraw','撤下展示故事');
 document.querySelectorAll('[data-mute]').forEach(b=>b.onclick=()=>act(()=>api.command('mute',{uid:b.dataset.mute,muted:!privateRoom.moderation?.[b.dataset.mute]?.muted})));
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>act(()=>api.command('remove',b.dataset.remove)));
 document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>act(()=>api.command('selectStory',{name:pub.members?.[b.dataset.story]?.name||'朋友',text:privateRoom.stories[s.round][b.dataset.story].text,round:s.round})));
 on('withdraw',()=>api.command('selectStory',null));
}
function renderAffinity(){if(!$('affinityPanel'))return;$('affinityPanel').hidden=!hostReady;const members=pub?.members||{},selected=$('affinityPlayer').value;$('affinityPlayer').innerHTML=Object.entries(members).map(([id,m])=>`<option value="${esc(id)}">${esc(m.name)}</option>`).join('');if(members[selected])$('affinityPlayer').value=selected;const show=()=>{const id=$('affinityPlayer').value;$('affinityRows').innerHTML=Object.entries(members).filter(([other])=>other!==id).map(([other,m])=>{const p=pairStats(privateRoom.affinity?.pairs,id,other);return `<div class="affinity-row"><b>${esc(m.name)}</b><span>相同 ${p.same} / 共同 ${p.shared} 題</span><strong>${p.shared?Math.round(p.same/p.shared*100)+'%':'尚無共同答案'}</strong><span>${qualifies(p)?'已達靠攏條件':p.shared<2?'共同題數不足':'尚未達靠攏條件'}</span></div>`;}).join('')||'<p>等待更多玩家加入。</p>';};$('affinityPlayer').onchange=show;show();}
function syncChats(){
 if(role==='display'||(!eligible()&&!hostReady)){for(const f of chatUnsubs.values())f();chatUnsubs.clear();chatData={};return;}
 const ids=Object.keys(pub?.members||{});
 for(const [id,f] of chatUnsubs)if(!ids.includes(id)){f();chatUnsubs.delete(id);delete chatData[id];}
 for(const id of ids)if(!chatUnsubs.has(id)){chatUnsubs.set(id,()=>{});chatUnsubs.set(id,api.watchChat(id,m=>{chatData[id]=m||{};renderChat();},()=>{delete chatData[id];renderChat();}));}
 renderChat();
}
function renderChat(){if(!$('messages'))return;const msgs=Object.entries(chatData).flatMap(([uid,m])=>Object.entries(m).map(([id,v])=>({...v,uid,id}))).sort((a,b)=>a.at-b.at).slice(-50);
 if(hostReady&&pub?.state?.chatEffects===true&&pub.state.chatOpen)for(const m of msgs)relayOnce(pub.state.code+'/chat/'+m.uid+'/'+m.id,{code:pub.state.code,kind:'chat',uid:m.uid,seq:m.id});
 const keys=msgs.map(m=>`${m.uid}/${m.id}`);if(chatInitialized&&pane!=='chat')unread+=msgs.filter(m=>m.uid!==api.uid()&&!seenMessages.has(`${m.uid}/${m.id}`)).length;keys.forEach(k=>seenMessages.add(k));chatInitialized=true;if(pane==='chat')unread=0;updateBadges();
 $('messages').innerHTML=msgs.map(m=>`<div class="message">${characterMarkup(characterId(m.uid,pub?.state?.code))}<b>${esc(pub?.members?.[m.uid]?.name||'朋友')}</b><p>${esc(m.text)}</p>${hostReady?`<button data-delete="${esc(m.uid)}" data-id="${esc(m.id)}" aria-label="刪除訊息">刪除</button>`:''}</div>`).join('')||'<p class="hint">還沒有人說話。安靜作答也很好。</p>';
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>act(()=>api.command('deleteMessage',{uid:b.dataset.delete,id:b.dataset.id})));
}
try{
 api=await connect(role,s=>{const lamp=$('connection');lamp.querySelector('.connection-label').textContent=s;lamp.title=s;lamp.dataset.state=s==='已連線'||s==='本機模擬連線'?'online':'offline';if(s==='已連線'&&api)ensureMigration();});
 const isDemo=api.mode.startsWith('本機');$('mode').hidden=!isDemo;
 if(isDemo&&role==='host'){const tools=document.createElement('div');tools.className='spotlight-settings';tools.innerHTML='<p>僅本機試玩工具 · 不會加入 Firebase 房間</p><button id="demoParticipants">加入三位示範玩家</button> <button id="demoAnswers">補齊示範玩家答案</button>';document.querySelector('.room-management').before(tools);on('demoParticipants',()=>api.command('demoParticipants'));on('demoAnswers',()=>api.command('demoAnswers'));}
 $('mode').textContent=isDemo?'試玩示範 · 只在這個瀏覽器同步，不是多人連線。主持頁建立 PARTY1 即可試玩。':'';
 if(role==='viewer'||role==='display'){const e=document.createElement('section');e.id='partyEffects';e.hidden=true;document.body.append(e);updateEffects=createEffects(api,role,e,message=>notice(message,true));}
 on('toggleChatEffects',()=>api.command('chatEffects',pub?.state?.chatEffects!==true));on('toggleSubmitEffects',()=>api.command('submitEffects',pub?.state?.submitEffects!==true));
 if(role==='host'){hostReady=await api.checkHost().catch(e=>{notice(friendly(e),true);return false;});watchPrivate();}
 api.watch('room/public',p=>{const previous=pub?.state;pub=p;const changed=p?.state?.round!==previous?.round||p?.state?.code!==previous?.code||p?.state?.attempt!==previous?.attempt;if(p?.state?.code!==previous?.code){unread=0;chatInitialized=false;seenMessages.clear();migrationCode=null;relayed.clear();}if(changed){ownAnswer=null;choice=null;prediction=null;ack='';answerRound=p?.state?.round;}render();if(!p&&$('create'))$('create').disabled=false;if(hostReady&&(privateRound!==p?.state?.round||changed))watchPrivate();if(changed||(!previous&&p))watchOwn();syncChats();},e=>notice(friendly(e),true));
 on('create',()=>api.create());on('lock',()=>api.command('lock',!pub.state.locked));on('toggleChat',()=>api.command('chatOpen',!pub.state.chatOpen));on('end',async()=>{await api.command('end');notice('房間已結束，紀錄仍保留；需要時可再清理資料。');});on('clean',async()=>{if(confirm('永久清理這個已結束房間的答案、聊天、故事和分數？'))await api.command('clean');});
 on('skipTarget',()=>api.command('skipTarget',{...pub.state}));on('start',()=>api.command('start',questions[+$('questionPick').value]));for(const action of ['extend','close','reveal'])on(action,()=>api.command(action));
 on('logout',async()=>{await api.logout();location.reload();});
 if($('chatForm'))$('chatForm').onsubmit=e=>{e.preventDefault();act(async()=>{const text=$('chatText').value.trim();if(!text)return;await api.chat(text);$('chatText').value='';notice('訊息已送出。');});};
 if($('storyForm'))$('storyForm').onsubmit=e=>{e.preventDefault();act(async()=>{const text=$('storyText').value.trim();if(!text)return;await api.story(pub.state.round,text);notice('故事已交給主持人，尚未公開。');});};
 setInterval(tick,250);
}catch(e){notice(`無法啟動：${friendly(e)}`,true);}
