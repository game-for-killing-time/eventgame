import {targetFirst} from './spotlight.js';
import {characterId,characterMarkup} from './characters.js';
import {voteStack} from './voter-view.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const predictionText=option=>'他會'+String(option).replace(/^我想要/,'選').replace(/^我/,'');
export function spotlightQuestion({s,result,pub,role,uid,joined,canAnswer,choice,prediction,sending,ack,ownSubmitted=false}){
 const first=targetFirst(s),thinking=first&&s.status==='thinking',target=uid===s.targetUid,options=s.question?.options||[],name=esc(s.targetName||'主角');
 let html=`<article class="question spotlight-question"><div class="section-title"><span>第 ${s.cycle} / ${s.cycles} 回合 · 第 ${s.questionInCycle} / ${s.questionsPerCycle} 題</span><span id="timer" class="timer"></span></div><div class="target-banner">${characterMarkup(characterId(s.targetUid,s.code))}<div><small>本題主角${target?' · 本人作答':''}</small><h2>${name}</h2><p>${target?`${name}的真心答案，讓大家猜猜看。`:`先猜${name}的選擇，再留下自己的答案。`}</p></div></div>`;
 if(!s.question)return html+'</article>';
 html+=`<h1>${esc(s.question.text.replaceAll('你',s.targetName||'主角'))}</h1>`;
 if(thinking&&!(role==='viewer'&&joined&&target))return html+`<section class="thinking-card" role="status"><h2>${name}正在思考…</h2><p>主角提交並鎖定答案後，才開始大家的 45 秒作答時間。</p></section></article>`;
 if(role==='viewer'&&joined&&!result&&s.status!=='ended'){
 if(!target)html+=`<fieldset ${canAnswer?'':'disabled'}><legend>你猜 ${name}，他會怎樣選？ <small>猜中 +1 分</small></legend><div class="predictions">${options.map((o,i)=>`<label class="prediction prediction-${i} ${prediction===i?'selected':''}"><input id="prediction-${i}" name="prediction" type="radio" value="${i}" aria-label="${'ABCD'[i]}：${esc(predictionText(o))}" ${prediction===i?'checked':''}><b>${'ABCD'[i]}</b><span>${esc(predictionText(o))}</span></label>`).join('')}</div></fieldset>`;
 html+=`<fieldset ${canAnswer?'':'disabled'}><legend>我的答案 <small>揭曉前只有自己及主持可見</small></legend><div class="options">${options.map((o,i)=>`<label class="option option-${i} ${choice===i?'selected':''}"><input id="choice-${i}" name="choice" type="radio" value="${i}" ${choice===i?'checked':''}><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
 if(first&&target)html+=`<p class="hint">${ownSubmitted?'答案已提交並鎖定，請等待大家作答。':'選好後提交，答案會鎖定；大家才開始限時猜題。'}</p>`;
 html+=`<div class="submit-row"><button id="submit" class="primary" ${!canAnswer||sending||choice===null||(!target&&prediction===null)?'disabled':''}>${first&&target&&ownSubmitted?'答案已鎖定':sending?'等伺服器確認…':ack==='已提交'?'更新我的答案':target?'提交我的答案':'一起提交'}</button><span id="ack" role="status">${esc(ack||(target?'本題主角只需提交自己的答案。':'先猜主角，再選自己的答案，一起提交。'))}</span></div>`;
 }else{
 if(result)html+=`<div class="target-reveal" role="status">${result.targetAnswered?`${name}選了 <b>${'ABCD'[result.targetChoice]} · ${esc(options[result.targetChoice])}</b>`:'主角本題沒有有效作答，所有人不計分，也不增加默契。'}${joined&&!target&&result.targetAnswered?`<p>${Object.hasOwn(result.points||{},uid)?result.points[uid]?'你猜中了！＋1 分':'這題沒有猜中，聽聽主角的理由吧。':'你本題沒有有效提交，下題再來。'}</p>`:''}</div>`;
 html+=`<div class="options ${result?'revealed':''}">${options.map((o,i)=>`<div class="option option-${i} ${result?.targetAnswered&&result.targetChoice===i?'target-choice':''}"><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}${result?.targetAnswered&&result.targetChoice===i?'<small class="target-choice-tag">主角的選擇</small>':''}</span>${result?(role==='host'?`<strong>${result.counts[i]} 人</strong>`:voteStack(i,result,pub.members||{},uid,s.code)):''}</div>`).join('')}</div>`;
 if(result)html+='<p class="hint">這裡顯示大家自己的答案。猜中主角才加分；自己的答案相同，則累積與主角的默契。</p>';
 }
 if(s.completed&&role==='viewer')html+='<p class="hint">本場完成！到「排行榜」看看今晚的心水清大師。</p>';
 return html+'</article>';
}
export function masterCard(awards,members){
 if(!awards)return '';
 const names=Object.keys(awards.winners||{}).filter(id=>members[id]).map(id=>esc(members[id].name));
 return `<section class="master-card"><p>今晚的心水清大師</p><h2>${names.length?names.join('、'):'今晚還沒有得主'}</h2><p>${names.length?`以 ${awards.score} 分${names.length>1?'並列':''}獲封！最懂猜朋友心意的就是你${names.length>1?'們':''}。`:'這場沒有猜中紀錄，聊到新發現一樣值得。'}</p></section>`;
}
