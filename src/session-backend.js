import {getDatabase,ref,get,update,runTransaction} from 'firebase/database';
import {broadcastPath,selectedMode} from './broadcast-model.js';
import {isSession,codeOf,pauseMode,resumeMode,transitionSession} from './session-model.js';
import {endRoom} from './end-room.js';
import {remoteCommand} from './voyage-remote-model.js';

export function sessionBackend(app,now=()=>Date.now(),database=getDatabase(app)){
 const db=database,read=async path=>(await get(ref(db,path))).val();let ensuring;
 async function change(mode,{create=false,finish=false,clean=false}={}){
  const token=crypto.randomUUID();
  await get(ref(db,broadcastPath));
  const claim=await runTransaction(ref(db,broadcastPath),s=>{
   if(s?.lease&&s.lease.until>now())return;
   return {...s,mode:selectedMode(s),lease:{token,until:now()+60000,target:mode}};
  },{applyLocally:false});
  if(!claim.committed)throw Error('正在切換模式，請稍候再試。');
  const previous=claim.snapshot.val();let frozen=false;const restore=[];
  try{
   let [room,voyage]=await Promise.all([read('room'),read('voyage')]);
   if(create&&(codeOf('classic',room)||codeOf('voyage',voyage)))throw Error('已有房間；請結束並清理後再建立。');
   const currentFinished=previous.mode==='classic'?room?.public?.state?.status==='ended':voyage?.hostOnly?.phase==='ended';
   if(clean&&isSession(previous)&&previous.status!=='ended'&&!currentFinished)throw Error('請先結束整場遊戲，再清理房間。');
   if(previous.status==='ended'&&!clean)throw Error('請先清理已結束的房間。');
   for(const [path,m,r]of [['room','classic',room],['voyage','voyage',voyage]])if(codeOf(m,r)&&!r.sessionPause)restore.push([path,m]);
   // Transactions fence late joins and late host actions before taking the final snapshot.
   frozen=true;
   for(const [path,m]of [['room','classic'],['voyage','voyage']]){
    const result=await runTransaction(ref(db,path),r=>codeOf(m,r)?pauseMode(m,r,now()):r,{applyLocally:false});
    if(path==='room')room=result.snapshot.val();else voyage=result.snapshot.val();
   }
   if((await read(broadcastPath))?.lease?.token!==token)throw Error('房間操作已更新，請重新整理。');
   if(clean){await update(ref(db),{room:{public:{broadcast:{version:1,mode,revision:(previous.revision||0)+1}}},voyage:null});return;}
   const createCode=create?Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join(''):undefined;
   const next=transitionSession({room,voyage},mode,now(),{createCode,token});
   if(finish&&next.room.public.state){
    endRoom(next.room,next.room.public.state.code);
    delete next.room.sessionPause;next.room.sessionActive=false;
    next.voyage.sessionActive=true;next.voyage=remoteCommand(next.voyage,'end',null,null,now());
    next.voyage.public.chatOpen=false;
    next.voyage.locked=true;next.voyage.chatOpen=false;next.voyage.sessionActive=false;delete next.voyage.sessionPause;
    next.room.public.broadcast.status='ended';
   }
   // The room, both rosters and the mode pointer become visible in one server commit.
   let changes;
   if(isSession(previous)&&!finish&&!create&&previous.mode!==mode){
    changes=mode==='voyage'?{'room/public/broadcast':next.room.public.broadcast}: {room:next.room};
   }else changes={room:next.room};
   if(mode==='voyage'||finish||!isSession(previous)||create){
    if(next.voyage){
     // Consent can be withdrawn even while a mode is paused. Never overwrite it
     // with a snapshot taken before a concurrent withdrawal.
     for(const [key,value]of Object.entries(next.voyage))if(!['consent','quoteConsent'].includes(key))changes['voyage/'+key]=value;
     changes['voyage/sessionPause']=next.voyage.sessionPause||null;
    }else changes.voyage=null;
   }
   await update(ref(db),changes);
  }catch(error){
   try{
    if((await read(broadcastPath))?.lease?.token===token){
     if(frozen)for(const [path,m]of restore)await runTransaction(ref(db,path),r=>codeOf(m,r)?resumeMode(m,r,now()):r,{applyLocally:false});
     await runTransaction(ref(db,broadcastPath),s=>{if(!s)return null;if(s.lease?.token!==token)return;const next={...s};delete next.lease;return next;},{applyLocally:false});
    }
   }catch{}
   // After a connection loss the frozen snapshot and expiring lease permit safe retry.
   throw error;
  }
 }
 return {
  ensure(mode){return ensuring??=(async()=>{const s=await read(broadcastPath);if(s?.lease){if(s.lease.until>now())throw Error('正在切換模式，請稍候重新整理。');await change(s.lease.target||selectedMode(s));}else if(s?.version!==1)await change(selectedMode(s)||mode);return read(broadcastPath);})().finally(()=>{ensuring=null;});},
  switch:mode=>change(mode),create:mode=>change(mode,{create:true}),end:mode=>change(mode,{finish:true}),clean:mode=>change(mode,{clean:true}),
  async assertActive(mode){const s=await read(broadcastPath);if(s?.lease)throw Error('正在切換模式，請稍候。');if(isSession(s)&&(s.mode!==mode||s.status==='ended'))throw Error('主持模式已切換或整場已結束，請重新整理。');},
  read
 };
}
