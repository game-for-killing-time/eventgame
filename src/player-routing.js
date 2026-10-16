import {selectedMode,validMode} from './broadcast-model.js';

export const roomCodePath=mode=>mode==='voyage'?'voyage/public/code':'room/public/state/code';

// A room invitation selects its own game; broadcast selection only supplies a default.
export async function resolvePlayerMode(code,preferredMode,get){
 const normalized=String(code??'').trim().toUpperCase();
 if(!normalized)return null;
 const preferred=selectedMode({mode:preferredMode});
 for(const mode of [preferred,preferred==='voyage'?'classic':'voyage']){
  if(await get(roomCodePath(mode))===normalized)return mode;
 }
 return null;
}

export async function initialEntryMode({role,search='',broadcast,get}){
 const broadcastMode=selectedMode(broadcast);
 if(role==='display')return broadcastMode;
 const query=new URLSearchParams(search),explicit=query.get('mode');
 const preferred=validMode(explicit)?explicit:broadcastMode;
 const code=query.get('room');
 return code?(await resolvePlayerMode(code,preferred,get))??preferred:preferred;
}

export function playerInvitation(mode,room=''){
 const query=new URLSearchParams({mode:selectedMode({mode})});
 if(room)query.set('room',room);
 return './index.html?'+query;
}
