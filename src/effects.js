// Host-published, bounded presentation feed. Never copy answer choices or predictions.
export function relayEffects(room,{code,kind,uid,seq,round},now){
 const s=room?.public?.state;if(!s||s.code!==code||s.status==='ended')return;
 if(kind==='chat'){
  if(s.chatEffects!==true||!s.chatOpen||!room.public.members?.[uid]||room.moderation?.[uid]?.muted||room.moderation?.[uid]?.removed)return;
  const message=room.chat?.[uid]?.messages?.[seq];
  if(!message||message.at<now-30000||message.at>now+5000||room.effects?.chat?.[uid]?.seq>=Number(seq))return;
  room.effects??={};room.effects.chat??={};room.effects.chat[uid]={seq:Number(seq),text:message.text,at:message.at};return room;
 }
 if(kind==='submissions'){
  if(s.submitEffects!==true||s.round!==round||!['open','closed'].includes(s.status))return;
  const previous=room.effects?.submissions;const feed=previous?.round===round?previous:{round,items:{}};let changed=false;feed.items??={};
  for(const [id,a] of Object.entries(room.answers?.[round]||{})){
   if(room.public.members?.[id]&&!room.moderation?.[id]?.removed&&!feed.items[id]&&a.at>=now-30000){feed.items[id]=a.at;changed=true;}
  }
  if(!changed)return;room.effects??={};room.effects.submissions=feed;return room;
 }
}
