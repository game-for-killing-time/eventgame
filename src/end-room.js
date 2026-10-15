import {awardMasters} from './spotlight.js';

// A null cache must reach the server so Firebase can retry with current data.
export function endRoom(room,expectedCode){
 if(!room)return null;
 if(room.public.state.code!==expectedCode)return undefined;
 Object.assign(room.public.state,{status:'ended',locked:true,chatOpen:false});
 return awardMasters(room);
}
