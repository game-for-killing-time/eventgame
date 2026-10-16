import {getAuth,onAuthStateChanged} from 'firebase/auth';
import {getDatabase,ref,onValue,set,get,serverTimestamp} from 'firebase/database';
import {broadcastPath,selectedMode} from './broadcast-model.js';
export function startBroadcastControl(app,current){
 const db=getDatabase(app),auth=getAuth(app);let selected='classic',allowed=false,busy=false,message='';
 const paint=()=>{const b=document.querySelector('[data-broadcast]'),status=document.querySelector('[data-broadcast-status]');if(b){b.disabled=!allowed||busy||selected===current;b.textContent=selected===current?'目前展示此模式':'切換至展示';}if(status)status.textContent=message||'目前播放：'+(selected==='voyage'?'12 幕冒險':'選邊站');};
 onAuthStateChanged(auth,async user=>{allowed=false;paint();if(user&&!user.isAnonymous){try{allowed=(await get(ref(db,'config/hostUid'))).val()===user.uid;}catch{}paint();}});
 onValue(ref(db,broadcastPath),s=>{selected=selectedMode(s.val());message='';paint();},()=>{message='無法讀取展示模式，請檢查連線';paint();});
 document.addEventListener('click',async e=>{if(!e.target.closest('[data-broadcast]')||!allowed||busy)return;busy=true;message='正在切換…';paint();try{await set(ref(db,broadcastPath),{mode:current,at:serverTimestamp()});message='展示與新入場入口已切換';}catch{message='切換失敗，請確認主持帳號及連線';}finally{busy=false;paint();}});
 const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-broadcast]')||n.querySelector?.('[data-broadcast]')))))paint();});observer.observe(document.body,{childList:true,subtree:true});paint();
}
