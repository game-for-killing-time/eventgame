import {questions,questionCategories,filterQuestions} from './questions.js';

export function chooseQuestion(list,selected,used=new Set(),suggest=false){
 if(suggest)return list.find(q=>!used.has(q.id))?.id||list[0]?.id||'';
 return list.some(q=>q.id===selected)?selected:list[0]?.id||'';
}

export function createQuestionPicker(select,onChange){
 const doc=select.ownerDocument;
 const filters=doc.createElement('div');filters.className='bank-filters';
 filters.innerHTML='<label>題目分類<select id="questionCategory"><option value="">全部分類</option></select></label><label>搜尋題目<input id="questionSearch" type="search" placeholder="例如：旅行、朋友、鬧鐘" autocomplete="off"></label>';
 select.before(filters);
 const category=filters.querySelector('select'),search=filters.querySelector('input');
 for(const c of questionCategories){const option=doc.createElement('option');option.value=c.id;option.textContent=c.name;category.append(option);}
 const count=doc.createElement('p');count.className='hint';count.id='questionCount';count.setAttribute('role','status');
 const preview=doc.createElement('details');preview.className='bank-preview';preview.innerHTML='<summary>主持預覽選項與聊天追問</summary><div></div>';
 select.after(count,preview);select.setAttribute('aria-describedby','questionCount');
 let list=[],used=new Set(),version='';
 function showPreview(){
  const q=list.find(q=>q.id===select.value),body=preview.querySelector('div');body.replaceChildren();preview.hidden=!q;
  if(!q)return;
  const options=doc.createElement('ol');options.type='A';for(const text of q.options){const li=doc.createElement('li');li.textContent=text;options.append(li);}
  const prompt=doc.createElement('p');prompt.textContent=`揭曉後聊聊：${q.followUp}`;body.append(options,prompt);
 }
 function refresh(suggest=false){
  list=filterQuestions({category:category.value,search:search.value});
  const next=chooseQuestion(list,select.value,used,suggest);
  select.replaceChildren();
  for(const q of list){const option=doc.createElement('option');option.value=q.id;option.textContent=`${used.has(q.id)?'已出題 · ':''}${q.id.slice(1)}. ${q.text}`;select.append(option);}
  select.value=next;select.disabled=!list.length;
  count.textContent=list.length?`找到 ${list.length} / ${questions.length} 題 · 本篩選尚有 ${list.filter(q=>!used.has(q.id)).length} 題未出過。`:'沒有符合的題目，請更換分類或搜尋字。';
  showPreview();
 }
 category.onchange=search.oninput=()=>{refresh();onChange();};
 select.onchange=()=>{showPreview();onChange();};
 refresh();
 return {
  selected:()=>list.find(q=>q.id===select.value),
  sync(pub){
   const s=pub?.state,key=JSON.stringify([s?.code,s?.round,s?.status,Object.values(pub?.results||{}).map(r=>r.questionId)]);
   if(key===version)return;version=key;used=new Set(Object.values(pub?.results||{}).map(r=>r.questionId));refresh(s?.status==='revealed');
  }
 };
}
