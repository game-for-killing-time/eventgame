import {characterId,characterMarkup} from './characters.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const voters=(result,members,index)=>Object.entries(result?.choices||{}).filter(([id,c])=>c===index&&members[id]).map(([id])=>({id,...members[id]})).sort((a,b)=>Number(a.seat)-Number(b.seat));
export function voteStack(index,result,members,uid,code){
 const people=voters(result,members,index),total=result.counts[index];
 if(!total)return '<span class="vote-empty">尚無人選</span>';
 return `<div class="vote-summary"><span class="avatar-stack" aria-hidden="true">${people.slice(0,3).map(p=>`<span class="avatar-circle ${p.id===uid?'avatar-self':''}">${characterMarkup(characterId(p.id,code))}</span>`).join('')}${people.length>3?`<span class="avatar-circle avatar-more">+${people.length-3}</span>`:''}</span><button type="button" class="view-voters" data-view-voters="${index}" aria-haspopup="dialog" aria-label="查看選項 ${'ABCD'[index]} 的 ${total} 位作答者">查看 <small>${total}</small></button>${result.winners.includes(index)?'<span class="vote-winner" aria-label="最多人選">★</span>':''}</div>`;
}
export function createVoterDialog(root,getState){
 const dialog=document.createElement('dialog');dialog.className='voter-dialog';dialog.setAttribute('aria-labelledby','voterDialogTitle');
 dialog.innerHTML='<div class="voter-dialog-heading"><div><p id="voterDialogCount"></p><h2 id="voterDialogTitle"></h2></div><button type="button" class="voter-dialog-close" aria-label="關閉作答名單" autofocus>×</button></div><div class="voter-dialog-list"></div>';
 document.body.append(dialog);let selected=null,trigger=null;
 const close=()=>dialog.close();dialog.querySelector('button').onclick=close;
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.addEventListener('close',()=>{const index=selected?.index;selected=null;const target=trigger?.isConnected?trigger:root.querySelector(`[data-view-voters="${index}"]`);target?.focus({preventScroll:true});});
 function refresh(){
  if(!selected)return;const s=getState();
  if(!s||s.code!==selected.code||s.round!==selected.round||!['revealed','ended'].includes(s.status)){close();return;}
  const people=voters(s.result,s.members,selected.index),total=s.result?.counts[selected.index]||0;
  dialog.querySelector('h2').textContent=`${'ABCD'[selected.index]} · ${s.options[selected.index]}`;
  dialog.querySelector('#voterDialogCount').textContent=`${total} 人選擇${people.length!==total?' · 以下為仍在房間的玩家':''}`;
  dialog.querySelector('.voter-dialog-list').innerHTML=people.map(p=>`<div class="voter-detail ${p.id===s.uid?'voter-detail-self':''}"><span class="avatar-circle">${characterMarkup(characterId(p.id,s.code))}</span><b>${esc(p.name)}</b><small>P${String(Number(p.seat)+1).padStart(2,'0')}</small>${p.id===s.uid?'<span class="self-label">你</span>':''}</div>`).join('')||'<p>目前沒有可顯示的玩家名單。</p>';
 }
 root.addEventListener('click',e=>{const button=e.target.closest('[data-view-voters]');if(!button)return;const s=getState();if(!s||!['revealed','ended'].includes(s.status))return;trigger=button;selected={code:s.code,round:s.round,index:Number(button.dataset.viewVoters)};refresh();dialog.showModal();});
 return refresh;
}
