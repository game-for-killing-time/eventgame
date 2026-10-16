const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const voyagePhaseLabel={lobby:'等大家入座',intro:'故事開始',routing:'選擇路線',first:'作出你的決定',firstClosed:'等待揭曉',revealed:'大家的選擇',twistIntro:'事情有了變化',twist:'再作一個決定',twistClosed:'等待揭曉',discussion:'故事走向',ended:'冒險結局'};

function choiceFeed(s){
 const v=s?.view||{},phase=s?.phase;
 const first=['revealed','twistIntro','twist','twistClosed','discussion','ended'].includes(phase);
 const second=['discussion','ended'].includes(phase);
 const entries=[...(first?v.lines||[]:[]).map(text=>({label:'初選',text})),...(second?v.follow||[]:[]).map(text=>({label:'再選',text}))];
 const key=JSON.stringify([s?.id,s?.round,entries.length?null:phase==='ended',entries]);
 return `<section class="voyage-choice-feed" data-choice-feed data-feed-key="${esc(key)}" aria-label="玩家選擇"><div class="voyage-feed-heading"><h2>玩家選擇</h2><span>${entries.length?`第 ${s.round} 幕 · 已揭曉`:'等待揭曉'}</span></div>${entries.length?`<div class="voyage-feed-viewport" data-choice-viewport tabindex="0" role="region" aria-label="已揭曉的決定，可左右捲動"><div class="voyage-feed-track" data-choice-track><ul class="voyage-feed-group" data-choice-group>${entries.map(e=>`<li><span class="voyage-choice-label">${e.label}</span><span>${esc(e.text)}</span></li>`).join('')}</ul></div></div><button type="button" class="voyage-feed-toggle" data-choice-toggle aria-pressed="false" aria-label="暫停自動捲動">暫停</button>`:`<p class="voyage-feed-empty">${phase==='ended'?'這一幕沒有已揭曉的選擇。':'選擇揭曉後，會在這裡自動捲動播放。'}</p>`}</section>`;
}

function survivors(s){
 const players=Object.values(s.players||{}).filter(p=>p.alive!==false&&!p.spectator).sort((a,b)=>(a.seat??0)-(b.seat??0));
 return `<aside class="panel voyage-live-panel" aria-label="仍在生存的玩家"><div class="voyage-roster-heading"><h2>仍在生存的玩家</h2><strong>${players.length}<small> 人</small></strong></div>${players.length?`<ul class="voyage-survivors">${players.map(p=>`<li><img src="./art/characters/${Math.abs(Number(p.seat)||0)%10}.png" alt=""><span>${esc(p.name)}</span></li>`).join('')}</ul>`:`<p class="voyage-roster-empty">${s.phase==='lobby'?'等待玩家加入小島。':s.outcome==='bad'?'已無生還玩家。':'目前沒有生還玩家。'}</p>`}<p class="voyage-roster-note">${s.phase==='lobby'?'一起登島，準備出發。':s.phase==='ended'?'這趟冒險，走到這裡。':'每一個選擇，都會帶大家走向下一幕。'}</p></aside>`;
}

export function voyageDisplayView(s){
 if(!s)return `<div class="voyage-display-main"><section class="panel voyage-story-panel"><p class="voyage-story-label">12 幕故事</p><h1>小島還沒開場</h1><p class="voyage-story-text">等待主持人建立 12 幕冒險。</p></section></div>${choiceFeed(null)}`;
 const v=s.view||{},q=s.currentQuestion,phase=s.phase;
 const choosing=['first','firstClosed','twist','twistClosed'].includes(phase);
 const aftermath=['discussion','ended'].includes(phase),twist=['twistIntro','twist','twistClosed'].includes(phase);
 const story=phase==='ended'?v.ending:aftermath?v.reveal:twist?v.twist:v.intro;
 const title=phase==='ended'?(v.expedition?.ending?.title||v.survival?.title||'冒險結局'):(v.scene||v.title||'12 幕冒險');
 const round=Math.max(0,Math.min(12,Number(s.round)||0));
 const resources=(v.expedition?.resources||[]).filter(r=>r.earned);
 return `<div class="voyage-display-main"><section class="panel voyage-story-panel"><div class="voyage-story-meta"><span>${round?`第 ${round} 幕 / 12`:'12 幕冒險 · 等待開場'}</span><span class="voyage-phase">${voyagePhaseLabel[phase]||'冒險進行中'}<strong data-voyage-countdown></strong></span></div><ol class="voyage-story-progress" aria-label="12 幕故事進度">${Array.from({length:12},(_,i)=>`<li class="${i+1<round?'is-past':i+1===round?'is-current':''}"${i+1===round?' aria-current="step"':''}><span>${i+1}</span></li>`).join('')}</ol><h2 class="voyage-story-label">故事主要路向</h2><h1>${esc(title)}</h1><p class="voyage-story-text">${esc(story||'等待朋友們入座，一起作出改變故事的決定。')}</p>${choosing&&q?`<div class="voyage-current-decision"><h2>${esc(q.text)}</h2><div class="voyage-display-options">${q.options.map((o,i)=>`<div class="option option-${i}"><span class="letter">${'ABCDE'[i]}</span><span>${esc(o.text)}</span></div>`).join('')}</div><p class="voyage-submission">${s.submitted??0} 人已提交 · ${phase.endsWith('Closed')?'選擇已截止，等待揭曉':'請在手機作出決定'}</p></div>`:''}${resources.length?`<p class="voyage-story-resources">一路帶來的成果：${resources.map(r=>esc(r.label)).join('、')}</p>`:''}</section>${survivors(s)}</div>${choiceFeed(s)}`;
}
