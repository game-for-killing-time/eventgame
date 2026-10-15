import './story-style.css';
import {storyPack,traits} from './story-pack.js';
import * as E from './story-engine.js';
const root=document.getElementById('story-app'),params=new URLSearchParams(location.search),role=params.get('role')||'host',uid=params.get('player')||'local-player';
const KEY='hoho-story-local-v1',PACK='hoho-story-author-v1';
let state=read(),draftChoice=null,draftPrediction=null,draftKey='',message='',error=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
function savedPack(){try{return E.validatePack(JSON.parse(localStorage.getItem(PACK)||'null'));}catch{return storyPack;}}
function link(role,id){return `./story.html?demo=1&role=${role}${id?`&player=${encodeURIComponent(id)}`:''}`;}
function button(id,text,disabled=false){return `<button id="${id}" ${disabled?'disabled':''}>${text}</button>`;}
function on(id,fn){document.getElementById(id)?.addEventListener('click',()=>Promise.resolve().then(fn).catch(fail));}
function fail(e){message=e.message||String(e);error=true;render();}
async function mutate(fn,success=''){
 if(!navigator.locks)throw Error('請使用支援 Web Locks 的現代瀏覽器，在 localhost 開啟試玩。');
 const expected=state?.id;
 await navigator.locks.request(KEY,()=>{const current=read();if(expected&&current?.id!==expected)throw Error('房間已重新建立，請重新整理後再操作。');const next=fn(current)||current;localStorage.setItem(KEY,JSON.stringify(next));});
 state=read();message=success;error=false;render();
}
const avatar=seat=>`<img class="avatar" src="./art/characters/${seat%10}.png" alt="島民角色">`;
function card(c){return `<article class="ending-card"><p class="eyebrow">${esc(c.name)} 的冒險回顧</p><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><ul>${c.events.map(e=>`<li>第 ${e.round} 幕：${esc(e.text)}</li>`).join('')}</ul>${c.companions.length?`<p>曾同行的伙伴：${c.companions.map(esc).join('、')}</p>`:''}<blockquote>${esc(c.keepsake)}</blockquote><small>${esc(c.note)}</small></article>`;}
function publicScreen(s){const v=E.publicView(s);return `<section class="scene"><p class="eyebrow">${v.round?`第 ${v.round} 幕 / 18`:'準備登島'} · ${v.players.length} 位島民</p><h1>${esc(v.scene?.title||v.title)}</h1><p class="narrative">${esc(v.scene?.intro||s.pack.opening)}</p><div class="pills">${v.routes.map(r=>`<span>${esc(r.name)} · ${r.count} 人</span>`).join('')}</div><p>${v.submitted} 人已交卷 · <span data-timer></span></p>${['revealed','ended','runoff','runoff-closed'].includes(v.phase)?`<blockquote>${esc(v.history.at(-1)?.text)}</blockquote>`:''}</section>${v.ending?`<section class="scene"><p class="eyebrow">${v.phase==='ended'?'共同結局':'今晚的結局方向'}</p><h2>${esc(v.ending.title)}</h2>${v.phase==='ended'?`<p>${esc(v.ending.text)}</p>`:''}</section>`:''}${v.shared.map(card).join('')}`;}
function sceneIntro(s){const r=E.scene(s),chapter=s.pack.chapters[Math.floor((s.round-1)/3)];return `<p class="eyebrow">第 ${Math.ceil(s.round/3)} 章 · ${esc(chapter[0])} · 第 ${s.round} 幕 / 18</p><div class="section-heading"><h1>${esc(r.title)}</h1><span class="timer" data-timer></span></div><p class="narrative">${esc(r.intro)}</p>`;}
function options(q,choice,disabled=false,allowed=[0,1,2,3]){return `<fieldset ${disabled?'disabled':''}><legend>我的選擇</legend>${q.options.map((o,i)=>allowed.includes(i)?`<label class="option color-${i} ${choice===i?'selected':''}"><input type="radio" name="choice" value="${i}" ${choice===i?'checked':''}><b>${'ABCD'[i]}</b><span>${esc(o.text)}</span><i>${choice===i?'✓':''}</i></label>`:'').join('')}</fieldset>`;}
function playerScreen(s){const p=s.players[uid];if(!p)return `<section class="scene"><h1>一起登上潮汐島</h1><p>${esc(s.pack.opening)}</p><form id="joinForm"><label>你的暱稱<input id="name" maxlength="20" required autocomplete="nickname"></label><button>加入冒險</button></form><p>這個分頁是一位本機模擬玩家；其他裝置無法加入。</p></section>`;
 let html=`<div class="identity">${avatar(p.seat)}<strong>${esc(p.name)}</strong><span>${p.points} 分 · ${p.events.length} 次故事選擇</span></div>`;
 if(s.phase==='lobby')return html+`<section class="scene"><h1>你的邀請函</h1><p>${esc(s.pack.opening)}</p><p>等待主持人開始。你可以只作答，不必聊天。</p></section>`;
 if(s.phase==='ended')return html+`<section class="scene"><p class="eyebrow">冒險完成</p><h1>${esc(s.pack.endings[s.ending??1].title)}</h1><p>${esc(s.pack.endings[s.ending??1].text)}</p></section>${card(E.cardFor(s,uid))}${button('share',s.shared[uid]?'撤回直播分享':'分享結局卡到展示頁')}<p class="hint">只有你按分享，展示頁才會顯示這張卡。</p>`;
 html+=`<section class="scene">${sceneIntro(s)}`;
 if(s.phase==='routing')return html+`<h2>這一幕，你想往哪裡走？</h2><p>選路本身不計性格，稍後會重新集合。</p><div class="route-grid">${E.scene(s).routes.map(r=>`<button data-route="${r.id}" aria-pressed="${s.routes[uid]===r.id}">${esc(r.name)}${s.routes[uid]===r.id?' ✓':''}</button>`).join('')}</div><p>未選路者開始作答時會按座位交替安排，不累積性格。</p></section>`;
 if(s.phase==='runoff'||s.phase==='runoff-closed'){const q=s.pack.rounds[15].question;return html+`<h2>結局方向同票 · 30 秒決選</h2>${options(q,s.runoffVotes[uid],s.phase!=='runoff',s.runoffOptions)}${button('runoff-submit','提交決選',s.phase!=='runoff')}<p>不重複加分或性格。再次同票依 A–D 固定順序。</p></section>`;}
 const q=E.questionFor(s,uid);if(!q)return html+'<p>等待題目安排。</p></section>';
 if(s.round===9&&p.trappedRound===9)html+='<p class="notice">你暫時被困一回合。這幕揭曉後一定能回到隊伍。</p>';
 if(s.round===9){const items=[['spare-cookie','你拿出了備用餅乾。'],['tea','熱茶讓等待暖和了一點。'],['torch','手電筒照亮了周圍。']].filter(([f])=>p.flags.includes(f));html+=items.map(([,t])=>`<p>${t}</p>`).join('');}
 if(s.round===15)html+=`<blockquote>${esc(E.echoFor(p))}</blockquote>`;
 if(s.phase==='revealed'){
  const event=p.events.find(e=>e.round===s.round);html+=`<h2>這一幕的回應</h2><blockquote>${esc(event?.text||'你隨隊回到集合點。這輪沒有作答，不累積性格或分數。')}</blockquote><p>${esc(E.scene(s).reveal)}</p>`;
  const result=s.results[s.round]?.groups[q.id];if(result&&E.isScored(s))html+=`<div class="pills">${result.counts.map((c,i)=>`<span>${'ABCD'[i]} · ${c} 票</span>`).join('')}</div><p>猜中最高票任一選項得 1 分。你目前 ${p.points} 分。</p>`;
 }else{
  html+=`<h2>${esc(q.text)}</h2>${options(q,draftChoice,s.phase!=='open')}`;
  if(E.isScored(s))html+=`<fieldset ${s.phase!=='open'?'disabled':''}><legend>猜大家最多會選哪個 · 猜中 +1 分</legend><div class="predictions">${q.options.map((o,i)=>`<label class="color-${i}"><input type="radio" name="prediction" value="${i}" ${draftPrediction===i?'checked':''}><b>${'ABCD'[i]}</b></label>`).join('')}</div></fieldset>`;
  html+=button('submit',s.phase==='closed'?'作答已鎖定，等待揭曉':'提交我的選擇',s.phase!=='open')+`<p role="status" class="hint">${s.answers[uid]?'本機已儲存本輪答案，可在截止前修改。':'尚未提交。這是本機確認，不是伺服器確認。'}</p>`;
 }
 if(s.phase==='revealed'&&s.round%3===0)html+=`<aside class="campfire"><h3>篝火聊聊 · 可以跳過</h3><p>${esc(s.pack.chapters[Math.ceil(s.round/3)-1][1])}</p></aside>`;
 return html+'</section>';
}
function hostScreen(s){let html=`<section class="scene"><p class="eyebrow">主持人的航海桌</p><h1>今晚，燈塔不打烊</h1><p>整套故事已寫好，不用逐題輸入。6 章、18 輪、6 次分隊、4 個共同結局。</p><p class="hint">約 2 小時含聊天：登島 6 分鐘，每章約 17 分鐘，結局分享 12 分鐘。加速試玩可用 15 秒題目或提前截止。</p>${!s?button('create','建立本機故事房間'):''}<details><summary>故事包：匯入、匯出與修改</summary><p>匯出 JSON 可修改題文、選項、性格標記及回應，再匯入。場景 ID 與事件旗標保留，避免破壞被困及結局流程。匯入只影響下一場。</p>${button('export','匯出完整故事包')}<label>匯入故事包（最大 1 MB）<input id="import" type="file" accept=".json,application/json"></label></details></section>`;
 if(!s)return html;
 html+=`<section class="scene"><div class="section-heading"><h2>${s.phase==='lobby'?'島民準備中':`第 ${s.round} 幕 · ${esc(E.scene(s).title)}`}</h2><span data-timer></span></div><p>已加入 ${Object.keys(s.players).length} / 20 人 · 本輪已交卷 ${Object.keys(s.answers).length} 人</p><div class="toolbar"><label>下一輪作答秒數<select id="duration"><option value="60">60 秒</option><option value="45">45 秒</option><option value="15">15 秒（快速試玩）</option></select></label>${button('next',s.phase==='lobby'?'開始冒險':'下一幕',!['lobby','revealed'].includes(s.phase))}${button('begin','完成選路，開始作答',s.phase!=='routing')}${button('extend','延長 15 秒',!['routing','open','runoff'].includes(s.phase))}${button('close','提前截止',!['open','runoff'].includes(s.phase))}${button('reveal','揭曉',!['closed','runoff-closed'].includes(s.phase))}</div><p class="hint">等待大家聊天後再按下一幕。無人作答仍可揭曉，漏答不增加性格。</p><a href="${link('display')}" target="_blank" rel="noopener">開啟本機展示頁 ↗</a></section>`;
 html+=`<section class="scene"><h2>模擬玩家</h2><p>每個連結代表獨立玩家；在同一瀏覽器的不同分頁試玩。</p><form id="addForm"><label>暱稱<input id="addName" maxlength="20" required placeholder="例如：阿樂"></label><button>新增一位</button></form>${button('add-demo','加入阿樂、小美、阿明、你',Object.keys(s.players).length>16)}<div class="roster">${Object.entries(s.players).map(([id,p])=>`<div><a href="${link('player',id)}" target="_blank" rel="noopener">${esc(p.name)} ↗</a><span>${p.trappedRound===s.round?'被困中':s.routes[id]?esc(E.scene(s)?.routes?.find(r=>r.id===s.routes[id])?.name):'在隊伍中'} · ${s.answers[id]?'已交卷':'未交卷'}</span></div>`).join('')}</div><details><summary>快速試玩工具</summary><p>只替尚未提交的本機玩家自動選路或作答，不覆蓋你已提交的選擇。</p>${button('auto','填入其他模擬玩家答案',!['routing','open','runoff'].includes(s.phase))}</details></section>`;
 if(s.round){html+=publicScreen(s);if(s.phase==='revealed'&&s.round%3===0)html+=`<section class="scene campfire"><h2>篝火聊聊</h2><p>${esc(s.pack.chapters[Math.ceil(s.round/3)-1][1])}</p></section>`;}
 html+=`<details class="scene"><summary>主持人專用：性格與事件紀錄</summary><p>玩家頁不顯示隱藏數值；本機模擬共用瀏覽器儲存空間，不提供正式權限隔離。</p>${Object.values(s.players).map(p=>`<h3>${esc(p.name)}</h3><p>${Object.entries(p.traits).map(([t,n])=>`${traits[t]} ${n}`).join(' · ')}</p><ul>${p.events.map(e=>`<li>第 ${e.round} 幕：${esc(e.text)}</li>`).join('')}</ul>`).join('')}</details><details class="scene"><summary>結束本機測試與重新開始</summary><p>只重設這個故事的本機存檔，原有 Firebase 房間及一般模擬模式不受影響。</p>${button('reset','重設這場本機故事')}</details>`;return html;
}
function chatScreen(s){return `<details class="scene"><summary>篝火留言 · ${s.chat.length} 則</summary><p class="hint">本機共同聊天，不送往正式直播。最多顯示最近 40 則。</p><div class="chat">${s.chat.slice(-40).map(c=>`<p><b>${esc(c.name)}</b>：${esc(c.text)}</p>`).join('')||'還沒有人留言。'}</div><form id="chatForm"><label>想說的話<textarea id="chatText" maxlength="300" required></textarea></label><button>送出</button></form></details>`;}
function render(){
 state=read();const s=state;const currentKey=`${s?.id}/${s?.round}/${s?.phase}/${uid}`;if(currentKey!==draftKey){if(draftKey)message='';draftKey=currentKey;draftChoice=s?.phase?.startsWith('runoff')?(s.runoffVotes[uid]??null):(s?.answers[uid]?.choice??null);draftPrediction=s?.answers[uid]?.prediction??null;}
 const textDraft=document.getElementById('chatText')?.value||'';const openChat=document.getElementById('chatForm')?.closest('details')?.open;
 const opened=new Set([...document.querySelectorAll('details[open]')].map(d=>d.querySelector('summary')?.textContent));
 const fieldValues=Object.fromEntries(['name','addName','duration'].map(id=>[id,document.getElementById(id)?.value]));
 const active=document.activeElement;const focusId=active?.id;const focusRadio=active?.matches('input[type=radio]')?{name:active.name,value:active.value}:null;
 root.innerHTML=`<header><a href="${link('host')}">潮汐島 · 故事冒險</a><a href="./index.html" target="_blank" rel="noopener">原有遊戲 ↗</a></header><div class="demo-note">本機模擬 · 同一瀏覽器分頁同步 · 非 Firebase 多人連線</div><main class="${role==='display'?'display':''}">${message?`<div role="status" class="notice ${error?'error':''}">${esc(message)} ${button('dismiss','關閉')}</div>`:''}${role==='host'?hostScreen(s):!s?`<section class="scene"><h1>等待主持人建立本機故事</h1><a href="${link('host')}">前往主持頁</a></section>`:role==='display'?publicScreen(s):playerScreen(s)}${s&&role!=='display'&&(role==='host'||s.players[uid])?chatScreen(s):''}</main>`;
 if(document.getElementById('chatText')){document.getElementById('chatText').value=textDraft;document.getElementById('chatForm').closest('details').open=!!openChat;}
 document.querySelectorAll('details').forEach(d=>{if(opened.has(d.querySelector('summary')?.textContent))d.open=true;});
 for(const [id,value]of Object.entries(fieldValues))if(value!==undefined&&document.getElementById(id))document.getElementById(id).value=value;
 if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});else if(focusRadio)document.querySelector(`input[name="${focusRadio.name}"][value="${focusRadio.value}"]`)?.focus({preventScroll:true});
 bind();tick();
}
function bind(){
 on('dismiss',()=>{message='';render();});on('create',()=>mutate(s=>{if(s)throw Error('已有本機故事');return E.newStory(savedPack());}));
 const reset=document.getElementById('reset');if(reset){reset.insertAdjacentHTML('afterend',button('restore','還原上一場備份',!localStorage.getItem(KEY+'-backup')));}
 on('reset',()=>mutate(s=>{localStorage.setItem(KEY+'-backup',JSON.stringify(s));return E.newStory(savedPack());},'已重新開始；上一場可按「還原上一場備份」恢復。'));
 on('restore',()=>mutate(s=>{const backup=JSON.parse(localStorage.getItem(KEY+'-backup')||'null');if(!backup)throw Error('沒有上一場備份');localStorage.setItem(KEY+'-backup',JSON.stringify(s));return backup;}));
 on('next',()=>{const duration=Number(document.getElementById('duration').value);return mutate(s=>E.nextRound(s,Date.now(),duration));});
 on('begin',()=>mutate(s=>E.beginAnswers(s)));on('extend',()=>mutate(s=>E.extendRound(s)));on('close',()=>mutate(s=>E.closeRound(s)));on('reveal',()=>mutate(s=>{if(s.phase==='runoff-closed')E.settleRunoff(s);else E.settle(s);}));
 document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>mutate(s=>E.selectRoute(s,uid,b.dataset.route),'路線已在本機儲存').catch(fail));
 document.querySelectorAll('input[name="choice"]').forEach(input=>input.onchange=()=>{draftChoice=+input.value;document.querySelectorAll('.option').forEach(l=>{const checked=l.querySelector('input').checked;l.classList.toggle('selected',checked);l.querySelector('i').textContent=checked?'✓':'';});});
 document.querySelectorAll('input[name="prediction"]').forEach(input=>input.onchange=()=>draftPrediction=+input.value);
 on('submit',()=>{const r=state.round,q=E.questionFor(state,uid)?.id,c=draftChoice,p=draftPrediction;return mutate(s=>E.submit(s,uid,r,q,c,p),'本機已儲存你的選擇。');});
 on('runoff-submit',()=>mutate(s=>E.submitRunoff(s,uid,draftChoice),'決選已在本機儲存'));
 on('share',()=>mutate(s=>{if(s.phase!=='ended')throw Error('故事尚未結束');s.shared[uid]=!s.shared[uid];}));
 const form=(id,fn)=>{const f=document.getElementById(id);if(f)f.onsubmit=e=>{e.preventDefault();Promise.resolve().then(fn).catch(fail);};};
 form('joinForm',()=>{const name=document.getElementById('name').value;return mutate(s=>E.joinStory(s,uid,name));});
 form('addForm',()=>{const name=document.getElementById('addName').value;return mutate(s=>E.joinStory(s,crypto.randomUUID(),name));});
 on('add-demo',()=>mutate(s=>{for(const name of ['阿樂','小美','阿明','你'])E.joinStory(s,crypto.randomUUID(),name);}));
 on('auto',()=>mutate(s=>{const now=Date.now();for(const [id,p]of Object.entries(s.players)){if(s.phase==='routing'&&!s.routes[id])E.selectRoute(s,id,E.scene(s).routes[p.seat%2].id,now);else if(s.phase==='open'&&!s.answers[id])E.submit(s,id,s.round,E.questionFor(s,id).id,p.seat%4,p.seat%4,now);else if(s.phase==='runoff'&&s.runoffVotes[id]===undefined)E.submitRunoff(s,id,s.runoffOptions[p.seat%s.runoffOptions.length],now);}}));
 form('chatForm',async()=>{const text=document.getElementById('chatText').value.trim();await mutate(s=>{if(!text||text.length>300)throw Error('請輸入 1–300 字');const id=role==='host'?'host':uid;if(role!=='host'&&!s.players[id])throw Error('請先加入');const previous=s.chat.findLast(c=>c.id===id);if(previous&&Date.now()-previous.at<3000)throw Error('請隔 3 秒再留言');s.chat.push({id,name:role==='host'?'主持人':s.players[id].name,text,at:Date.now()});s.chat=s.chat.slice(-100);});document.getElementById('chatText').value='';});
 on('export',()=>{const blob=new Blob([JSON.stringify(savedPack(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='潮汐島故事包.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const upload=document.getElementById('import');if(upload)upload.onchange=async()=>{try{const file=upload.files[0];if(!file)return;if(file.size>1024*1024)throw Error('檔案不能超過 1 MB');const p=E.validatePack(JSON.parse(await file.text()));localStorage.setItem(PACK,JSON.stringify(p));message='故事包已儲存，下一場建立房間時使用。目前這場不受影響。';error=false;render();}catch(e){fail(e);}};
}
let ticking=false;
async function tick(){const s=state;if(!s)return;const seconds=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));const active=['routing','open','runoff'].includes(s.phase);document.querySelectorAll('[data-timer]').forEach(e=>e.textContent=active?(seconds?`${seconds} 秒`:'時間到，已鎖定'):({lobby:'等待開場',closed:'已截止',revealed:'已揭曉',ended:'冒險完成','runoff-closed':'決選已截止'}[s.phase]||''));if(active&&!seconds){document.querySelectorAll('fieldset,[data-route],#submit,#runoff-submit').forEach(e=>e.disabled=true);if(role==='host'&&!ticking){ticking=true;try{await mutate(r=>{if(r.round!==s.round||r.phase!==s.phase||r.deadline>Date.now())return;if(r.phase==='routing')E.beginAnswers(r);else E.closeRound(r);});}catch(e){fail(e);}finally{ticking=false;}}}}
addEventListener('storage',e=>{if(e.key===KEY)render();});setInterval(tick,250);render();

