import {questionCategories} from './questions.js';
import {nextPlannedQuestion} from './question-plan.js';

export function createAutomaticQuestionPicker(container,onChange){
 container.innerHTML='<label for="automaticCategory">本場題目分類</label><select id="automaticCategory"><option value="">全部分類混合抽題</option></select><p id="questionPlanCount" class="hint" role="status"></p><details class="bank-preview"><summary>預覽下一題</summary><div></div></details>';
 const select=container.querySelector('select'),count=container.querySelector('p'),preview=container.querySelector('details'),body=preview.querySelector('div');
 for(const c of questionCategories){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;select.append(option);}
 select.onchange=onChange;
 return {
  category:()=>select.value,
  sync(s,plan){
   if(plan)select.value=plan.category;
   const locked=!!plan&&s.round>plan.startRound;
   select.disabled=locked||!['waiting','revealed'].includes(s.status)||s.completed===true;
   const remaining=plan?Math.max(0,plan.total-s.round):s.questionsPerCycle*s.cycles-s.round;
   count.textContent=plan?`已抽好 ${plan.ids.length} 題，不重複 · 尚餘 ${remaining} 題。${locked?'本場題單已固定。':'開始後固定題單。'}`:`將自動抽取 ${remaining} 題，不重複。選擇分類後即儲存題單；也可直接開始混合抽題。`;
   const q=nextPlannedQuestion(s,plan);preview.hidden=!q;body.replaceChildren();
   if(q){const title=document.createElement('h3');title.textContent=q.text;const options=document.createElement('ol');options.type='A';for(const text of q.options){const li=document.createElement('li');li.textContent=text;options.append(li);}const prompt=document.createElement('p');prompt.textContent=`揭曉後聊聊：${q.followUp}`;body.append(title,options,prompt);}
  }
 };
}
