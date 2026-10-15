import {settleRoom} from './game.js';
import {isSpotlight,targetFirst} from './spotlight.js';

export function sameRound(state,expected){
 return !!state&&!!expected&&state.code===expected.code&&state.round===expected.round&&state.attempt===expected.attempt;
}

// Check the current room, not a cached answer count, inside the host transaction.
export function ballotMatches(ballot,state){
 return !!ballot&&ballot.code===state?.code&&ballot.round===state?.round&&ballot.attempt===(state?.attempt||0);
}
export function hasConsented(pub,uid){return ballotMatches(pub?.earlyClose,pub?.state)&&ballotMatches(pub.earlyClose.votes?.[uid],pub.state);}
export function allAnswered(room){
 const s=room?.public?.state;
 if(s?.status!=='open')return false;
 const members=Object.keys(room.public.members||{}).filter(id=>!room.moderation?.[id]?.removed);
 const answers=room.answers?.[s.round]||{};
 const complete=members.length>0&&members.every(id=>{
  const a=answers[id];
  return a&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<4&&
   (isSpotlight(s)&&id===s.targetUid?a.prediction===-1:Number.isInteger(a.prediction)&&a.prediction>=0&&a.prediction<4)&&
   (!targetFirst(s)||a.attempt===s.attempt);
 });
 return complete;
}
export function autoRevealReason(room,now){
 const s=room?.public?.state;if(s?.status!=='open')return null;
 if(s.deadline>0&&now>=s.deadline)return 'timeout';
 const complete=allAnswered(room),ballot=room.public.earlyClose,current=ballotMatches(ballot,s);
 if(complete&&current&&Object.keys(room.public.members||{}).filter(id=>!room.moderation?.[id]?.removed).every(id=>hasConsented(room.public,id)))return 'unanimous';
 if(complete!==!!(current&&ballot.ready))return 'sync-consent';
 return null;
}

export function autoRevealRound(room,expected,now,revealedAt=now){
 // Returning null lets Firebase retry a cold cache against the existing room.
 if(!room)return null;
 const s=room.public?.state;
 const reason=autoRevealReason(room,now);
 if(!sameRound(s,expected)||!reason)return undefined;
 if(reason==='sync-consent'){
  const old=room.public.earlyClose;
  room.public.earlyClose={code:s.code,round:s.round,attempt:s.attempt||0,ready:allAnswered(room),votes:ballotMatches(old,s)?old.votes||{}:{}};
  return room;
 }
 // Closing and scoring in one transaction prevents a manual close or a new round
 // from being overwritten by an automatic reveal that was queued earlier.
 s.status='closed';
 return settleRoom(room,s.round,s.code,revealedAt);
}
