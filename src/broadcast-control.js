import {getAuth,onAuthStateChanged} from 'firebase/auth';
import {getDatabase,ref,onValue,get} from 'firebase/database';
import {broadcastPath,selectedMode} from './broadcast-model.js';
import {isSession} from './session-model.js';
function confirmSwitch(){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='mode-confirm';
  dialog.innerHTML='<form method="dialog"><h2>切換整場遊戲模式？</h2><p>目前回合會暫停，房間碼、玩家及各模式進度都會保留。玩家和直播展示將一起切換。</p><div class="toolbar"><button value="cancel" autofocus>取消</button><button value="switch" class="primary">確認切換</button></div></form>';
  dialog.addEventListener('close',()=>{const confirmed=dialog.returnValue==='switch';dialog.remove();resolve(confirmed);},{once:true});
  document.body.append(dialog);dialog.showModal();
 });
}
export function startBroadcastControl(app,current,session){
 const db=getDatabase(app),auth=getAuth(app);let allowed=false,busy=false,message='',state;
 const navigate=mode=>{if(mode!==current)location.replace('./host.html?mode='+mode);};
 const paint=()=>{const status=document.querySelector('[data-broadcast-status]');if(status)status.textContent=message||(state?.lease?'正在切換模式…':'玩家與直播展示會同步切換');document.querySelectorAll('[data-host-mode]').forEach(a=>a.setAttribute('aria-disabled',String(!allowed||busy||!!state?.lease)));};
 onAuthStateChanged(auth,async user=>{
  allowed=false;paint();if(!user||user.isAnonymous)return;
  try{
   if((await get(ref(db,'config/hostUid'))).val()!==user.uid)return;
   state=await session.ensure(current);allowed=true;message='';paint();navigate(selectedMode(state));
  }catch(e){message=e.message;paint();}
 });
 onValue(ref(db,broadcastPath),s=>{state=s.val();paint();if(allowed&&!busy&&isSession(state)&&!state.lease)navigate(state.mode);});
 document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-host-mode]');if(!a)return;e.preventDefault();
  if(!allowed||busy||state?.lease)return;
  const mode=a.dataset.hostMode;if(mode===current)return;
  if(state?.status==='ended'){message='整場已結束；請先清理房間，再建立新場次。';paint();return;}
  if(isSession(state)&&!await confirmSwitch())return;
  busy=true;message='正在同步玩家及切換模式…';paint();
  try{await session.switch(mode);navigate(mode);}catch(e){message=e.message;}finally{busy=false;paint();}
 });
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-broadcast-status]')||n.querySelector?.('[data-broadcast-status]')))))paint();}).observe(document.body,{childList:true,subtree:true});
}
