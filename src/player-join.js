import {resolvePlayerMode,playerInvitation} from './player-routing.js';

const pendingKey='hoho-pending-player-join';
const pendingLifetime=2*60*1000;
const normalizeCode=code=>String(code??'').trim().toUpperCase();

// Carry an explicitly submitted join across the mode change in this tab only.
export async function joinPlayer(mode,api,code,name,{
 storage=sessionStorage,
 navigate=url=>window.top.location.assign(new URL(url,location.href).href),
 now=Date.now
}={}){
 code=normalizeCode(code);
 const target=await resolvePlayerMode(code,mode,path=>api.get(path));
 if(target&&target!==mode){
  storage.setItem(pendingKey,JSON.stringify({mode:target,code,name,at:now()}));
  navigate(playerInvitation(target,code));
  return false;
 }
 await api.join(code,name);
 return true;
}

export function takePendingJoin(mode,room,{storage=sessionStorage,now=Date.now}={}){
 const raw=storage.getItem(pendingKey);
 if(raw===null)return null;
 let pending;
 try{pending=JSON.parse(raw);}catch{
  storage.removeItem(pendingKey);
  return null;
 }
 const age=now()-pending?.at;
 if(!pending||!['classic','voyage'].includes(pending.mode)||
    typeof pending.code!=='string'||!/^[A-Z0-9]{6}$/.test(pending.code)||
    typeof pending.name!=='string'||!pending.name.trim()||pending.name.length>20||
    !Number.isFinite(pending.at)||age<0||age>pendingLifetime){
  storage.removeItem(pendingKey);
  return null;
 }
 if(pending.mode!==mode||pending.code!==normalizeCode(room))return null;
 storage.removeItem(pendingKey);
 return {code:pending.code,name:pending.name};
}
