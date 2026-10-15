import {targetFirst} from './spotlight.js';
import {characterId,characterMarkup} from './characters.js';
import {voteStack} from './voter-view.js';
import {countdown,revealSummary} from './spotlight-presentation.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep option wording identical in both answer groups, including older room snapshots.
export const predictionText=option=>String(option);
const discussionPrompt=(s,result)=>result&&s.question?.followUp?`<aside class="question-discussion"><h3>揭曉後聊聊</h3><p>${esc(s.question.followUp)}</p><small>想分享再說，也可以只聽。</small></aside>`:'';
export function spotlightQuestion({s,result,pub,role,uid,joined,canAnswer,choice,prediction,sending,ack,ownSubmitted=false,now=Date.now()}){
 const first=targetFirst(s),thinking=first&&s.status==='thinking',target=uid===s.targetUid,options=s.question?.options||[],name=esc(s.targetName||'主角');
 const roundLabel=`第 ${s.cycle} / ${s.cycles} 回合 · 第 ${s.questionInCycle} / ${s.questionsPerCycle} 題`;
 if(result&&['viewer','display'].includes(role)&&['revealed','ended'].includes(s.status))return `<article class="question spotlight-question spotlight-summary"><div class="section-title">${roundLabel}</div><p class="reveal-waiting-label" role="status">${s.completed?'本場完成！看看今晚的心水清大師。':s.status==='ended'?'本場已結束，謝謝一起玩。':'等待主持人開始下一題'}</p>${revealSummary(s,result,pub.members)}${joined&&!target&&result.targetAnswered?`<p class="reveal-personal">${Object.hasOwn(result.points||{},uid)?result.points[uid]?'你猜中了！＋1 分':'這題沒有猜中，聽聽主角的理由吧。':'你本題沒有有效提交，下題再來。'}</p>`:''}${discussionPrompt(s,result)}</article>`;
 const clock=countdown(s,now),timer=`<span id="timer" class="timer spotlight-clock" data-urgent="${clock.urgent}" aria-label="${esc(clock.text)}">${clock.markup}</span>`;
 if(target&&ownSubmitted)canAnswer=false;
 let html=`<article class="question spotlight-question">${role==='display'?`<div class="spotlight-clock-row">${timer}</div>`:''}<div class="section-title"><span>${roundLabel}</span>${role==='host'?timer:''}</div><div class="target-banner">${characterMarkup(characterId(s.targetUid,s.code))}<div class="target-identity"><small>本題主角${target?' · 本人作答':''}</small><h2>${name}</h2></div>${role==='viewer'?timer:''}</div>`;
 if(!s.question)return html+'</article>';
 html+=`<h1>${esc(s.question.text)}</h1><p class="question-perspective">${target?'你是本題主角，按照自己的想法選一項。':`同一個情境：先猜 ${name}，再回答如果是你會怎樣選。`}</p>`;
 if(thinking&&!(role==='viewer'&&joined&&target))return html+`<section class="thinking-card" role="status"><h2>${name}正在思考…</h2><p>主角提交並鎖定答案後，才開始大家的 45 秒作答時間。</p></section></article>`;
 if(role==='viewer'&&joined&&!result&&s.status!=='ended'){
 if(!target)html+=`<fieldset ${canAnswer?'':'disabled'}><legend>① 猜主角：${name} 會選哪項？ <small>猜中主角的答案 +1 分</small></legend><div class="predictions">${options.map((o,i)=>`<label class="prediction prediction-${i} ${prediction===i?'selected':''}"><input id="prediction-${i}" name="prediction" type="radio" value="${i}" aria-label="猜 ${name}：${'ABCD'[i]} · ${esc(predictionText(o))}" ${prediction===i?'checked':''}><b>${'ABCD'[i]}</b><span>${esc(predictionText(o))}</span></label>`).join('')}</div></fieldset>`;
 html+=`<fieldset ${canAnswer?'':'disabled'}><legend>${target?'我的答案：我會選哪項？':'② 自己的答案：如果是你，會選哪項？'} <small>${target?'提交後讓大家猜，答案會鎖定。':'這一區不計猜題分數；與主角同選項可累積默契。'}</small></legend><div class="options">${options.map((o,i)=>`<label class="option option-${i} ${choice===i?'selected':''}"><input id="choice-${i}" name="choice" type="radio" value="${i}" aria-label="自己的答案：${'ABCD'[i]} · ${esc(o)}" ${choice===i?'checked':''}><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
 if(target)html+=`<p class="hint">${ownSubmitted?'答案已提交並鎖定，請等待大家作答。':first?'選好後提交，答案會鎖定；大家才開始限時猜題。':'選好後提交，主角答案便會鎖定。'}</p>`;
 html+=`<div class="submit-row">${target&&ownSubmitted?'<p class="target-answer-locked" role="status"><span aria-hidden="true">✓</span> 答案已鎖定</p>':`<button id="submit" class="primary" ${!canAnswer||sending||choice===null||(!target&&prediction===null)?'disabled':''}>${sending?'等伺服器確認…':target?'提交我的答案':'提交答案'}</button>`}<span id="ack" role="status">${esc(target&&ownSubmitted?'無法再修改，等大家猜猜看。':ack||(target?'本題主角只需提交自己的答案。':'先猜主角，再選自己的答案，一起提交。'))}</span></div>`;
 }else{
 if(result)html+=`<div class="target-reveal" role="status">${result.targetAnswered?`${name}選了 <b>${'ABCD'[result.targetChoice]} · ${esc(options[result.targetChoice])}</b>`:'主角本題沒有有效作答，所有人不計分，也不增加默契。'}${joined&&!target&&result.targetAnswered?`<p>${Object.hasOwn(result.points||{},uid)?result.points[uid]?'你猜中了！＋1 分':'這題沒有猜中，聽聽主角的理由吧。':'你本題沒有有效提交，下題再來。'}</p>`:''}</div>`;
 html+=`<div class="options ${result?'revealed':''}">${options.map((o,i)=>`<div class="option option-${i} ${result?.targetAnswered&&result.targetChoice===i?'target-choice':''}"><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}${result?.targetAnswered&&result.targetChoice===i?'<small class="target-choice-tag">主角的選擇</small>':''}</span>${result?(role==='host'?`<strong>${result.counts[i]} 人</strong>`:voteStack(i,result,pub.members||{},uid,s.code)):''}</div>`).join('')}</div>`;
 if(result)html+='<p class="hint">這裡顯示大家自己的答案。猜中主角才加分；自己的答案相同，則累積與主角的默契。</p>';
 }
 if(s.completed&&role==='viewer')html+='<p class="hint">本場完成！到「排行榜」看看今晚的心水清大師。</p>';
 return html+discussionPrompt(s,result)+'</article>';
}
export function masterCard(awards,members){
 if(!awards)return '';
 const names=Object.keys(awards.winners||{}).filter(id=>members[id]).map(id=>esc(members[id].name));
 return `<section class="master-card"><p>今晚的心水清大師</p><h2>${names.length?names.join('、'):'今晚還沒有得主'}</h2><p>${names.length?`以 ${awards.score} 分${names.length>1?'並列':''}獲封！最懂猜朋友心意的就是你${names.length>1?'們':''}。`:'這場沒有猜中紀錄，聊到新發現一樣值得。'}</p></section>`;
}
