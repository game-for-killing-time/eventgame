import {newRoom} from './game.js';
import {createVoyage,hydrate,ingest,project,remoteCommand} from './voyage-remote-model.js';
import {selectedMode,validMode} from './broadcast-model.js';

export const sessionOf=room=>room?.public?.broadcast;
export const isSession=s=>s?.version===1&&!!s.code;
export const codeOf=(mode,r)=>mode==='classic'?r?.public?.state?.code:r?.code;
export function membersOf(mode,r){
 const entries=mode==='classic'?r?.public?.members:r?.roster;
 return Object.fromEntries(Object.entries(entries||{}).filter(([id])=>!r?.moderation?.[id]?.removed).map(([id,m])=>[id,{name:m.name,seat:String(m.seat),joined:m.joined||m.at||0}]));
}
// Freeze writes at the existing server-enforced phase/lock gates before copying a roster.
// Saved countdowns resume with remaining time, rather than elapsing in another mode.
export function pauseMode(mode,input,now){
 if(!codeOf(mode,input))return input;
 const r=structuredClone(input);if(r.sessionPause)return r;
 if(mode==='voyage')ingest(r);
 const s=mode==='classic'?r.public.state:r.hostOnly;
 r.sessionPause={phase:mode==='classic'?s.status:s.phase,remaining:Math.max(0,(s.deadline||0)-now),timed:!!s.deadline,locked:mode==='classic'?!!s.locked:!!r.locked,chatOpen:mode==='classic'?s.chatOpen!==false:r.chatOpen!==false};
 r.sessionActive=false;s.deadline=0;
 if(mode==='classic'){s.status='waiting';s.locked=true;s.chatOpen=false;return r;}
 s.phase='lobby';r.locked=true;r.chatOpen=false;return project(r);
}
export function resumeMode(mode,input,now){
 const r=structuredClone(input),p=r.sessionPause;
 if(p){const s=mode==='classic'?r.public.state:r.hostOnly;
  s.deadline=p.timed?now+Math.max(1000,p.remaining):0;
  if(mode==='classic'){s.status=p.phase;s.locked=p.locked;s.chatOpen=p.chatOpen;}
  else{s.phase=p.phase;r.locked=p.locked;r.chatOpen=p.chatOpen;}
  delete r.sessionPause;
 }
 r.sessionActive=true;return mode==='voyage'?project(r):r;
}
export function syncMembers(mode,input,members,code,now){
 let r=structuredClone(input);const ids=new Set(Object.keys(members));
 if(ids.size>20)throw Error('兩個舊房間合共超過 20 位玩家，請先整理玩家名單再統一。');
 const seats={};for(const [id,m] of Object.entries(members)){
  if(!m.name?.trim()||m.name.length>20)throw Error('玩家暱稱不正確。');
  if(!/^([0-9]|1[0-9])$/.test(m.seat)||seats[m.seat])throw Error('玩家座位重複，請重新整理後再試。');
  seats[m.seat]=id;
 }
 if(mode==='classic'){
  r.public.state.code=code;r.public.members=Object.fromEntries(Object.entries(members).map(([id,m])=>[id,{...m,code,joined:m.joined||now}]));r.public.seats=seats;
 }else{
  const paused=!!r.sessionPause;
  if(paused)r=resumeMode('voyage',r,now);
  hydrate(r);r.code=code;
  for(const id of Object.keys(r.hostOnly.players))if(!ids.has(id))r=remoteCommand(r,'remove',id,null,now);
  r.roster=Object.fromEntries(Object.entries(members).map(([id,m])=>[id,{name:m.name,seat:m.seat,game:r.hostOnly.id,at:m.joined||now}]));r.seats=seats;
  // Existing participants remain participants, including after the story's ending.
  const phase=r.hostOnly.phase;r.hostOnly.phase=phase==='ended'?'lobby':phase;
  for(const id of ids)if(r.moderation[id])delete r.moderation[id].removed;
  ingest(r);r.hostOnly.phase=phase;
  for(const [id,m] of Object.entries(members)){r.hostOnly.players[id].name=m.name;r.hostOnly.players[id].seat=Number(m.seat);}
  if(paused)r=pauseMode('voyage',r,now);
 }
 for(const id of ids)if(r.moderation?.[id])delete r.moderation[id].removed;
 return mode==='voyage'?project(r):r;
}
export function mergeLegacyMembers(primary,secondary){
 const result=structuredClone(primary),used=new Set(Object.values(result).map(m=>m.seat));
 for(const [id,m] of Object.entries(secondary))if(!result[id]){const seat=Array.from({length:20},(_,i)=>String(i)).find(x=>!used.has(x));if(seat===undefined)throw Error('兩個舊房間合共超過 20 位玩家，請先整理玩家名單再統一。');result[id]={...m,seat};used.add(seat);}
 return result;
}
export function transitionSession({room,voyage},mode,now,{createCode,token}={}){
 if(!validMode(mode))throw Error('無效的主持模式。');
 const old=sessionOf(room),unified=isSession(old),source=unified?old.mode:(codeOf(selectedMode(old),selectedMode(old)==='classic'?room:voyage)?selectedMode(old):codeOf('classic',room)?'classic':'voyage');
 const sourceRoom=source==='classic'?room:voyage;
 const code=unified?old.code:codeOf(source,sourceRoom)||createCode;
 if(!code)return {room:{public:{broadcast:{mode,version:1,revision:(old?.revision||0)+1}}},voyage:null};
 let members=membersOf(source,sourceRoom);
 if(!unified)members=mergeLegacyMembers(members,membersOf(source==='classic'?'voyage':'classic',source==='classic'?voyage:room));
 let classic=codeOf('classic',room)?structuredClone(room):newRoom(code);
 let adventure=codeOf('voyage',voyage)?structuredClone(voyage):createVoyage(code,now);
 classic=syncMembers('classic',classic,members,code,now);adventure=syncMembers('voyage',adventure,members,code,now);
 for(const id of Object.keys(members)){
  const muted=sourceRoom?.moderation?.[id]?.muted===true;
  classic.moderation??={};classic.moderation[id]??={};classic.moderation[id].muted=muted;
  adventure.moderation??={};adventure.moderation[id]??={};adventure.moderation[id].muted=muted;
 }
 classic=mode==='classic'?resumeMode('classic',classic,now):pauseMode('classic',classic,now);
 adventure=mode==='voyage'?resumeMode('voyage',adventure,now):pauseMode('voyage',adventure,now);
 const sourcePause=sourceRoom?.sessionPause;
 // Room-wide controls follow the host; per-mode progress stays independent.
 const locked=sourcePause?.locked??(source==='classic'?sourceRoom?.public?.state?.locked:sourceRoom?.locked)??false;
 const chatOpen=sourcePause?.chatOpen??(source==='classic'?sourceRoom?.public?.state?.chatOpen:sourceRoom?.chatOpen)??true;
 if(mode==='classic'){classic.public.state.locked=locked;classic.public.state.chatOpen=chatOpen;}
 else{adventure.locked=locked;adventure.chatOpen=chatOpen;adventure=project(adventure);}
 classic.public.broadcast={version:1,code,mode,revision:(old?.revision||0)+1,status:old?.status==='ended'?'ended':'active',at:now,...(token?{operation:token}:{})};
 return {room:classic,voyage:adventure};
}
