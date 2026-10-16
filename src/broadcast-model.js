export const broadcastPath='room/public/broadcast';
export const validMode=m=>m==='classic'||m==='voyage';
export const selectedMode=b=>validMode(b?.mode)?b.mode:'classic';
// Broadcast selection survives room cleanup and is never treated as a playable room.
export function createBroadcastRoom(room,factory){if(room?.public?.state)return;const next=factory();if(room?.public?.broadcast)next.public.broadcast=room.public.broadcast;return next;}
export function cleanBroadcastRoom(room){if(room?.public?.state&&room.public.state.status!=='ended')return;return room?.public?.broadcast?{public:{broadcast:room.public.broadcast}}:null;}
export function entrySource(role,mode,search=''){const q=new URLSearchParams(search);q.delete('mode');q.delete('role');if(mode==='voyage')q.set('role',role==='display'?'display':'player');const page=mode==='voyage'?'story.html':role==='display'?'classic-display.html':'classic.html';return './'+page+(q.size?'?'+q:'');}
