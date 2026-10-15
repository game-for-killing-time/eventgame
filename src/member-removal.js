// Removing a member releases their seat, without banning their browser identity.
// Keep answers and settled scores so rejoining cannot reset answer edit limits.
export function removeRoomMember(room,uid,expectedCode){
 if(!room||room.public?.state?.code!==expectedCode)return;
 const seat=room.public.members?.[uid]?.seat;
 if(room.public.members)delete room.public.members[uid];
 if(seat!==undefined&&room.public.seats?.[seat]===uid)delete room.public.seats[seat];
 if(room.moderation?.[uid])delete room.moderation[uid].removed;
 if(room.public.island?.positions)delete room.public.island.positions[uid];
 if(room.effects?.chat)delete room.effects.chat[uid];
 if(room.effects?.submissions?.items)delete room.effects.submissions.items[uid];
 return room;
}

// Host-only migration for rooms created before removal stopped acting as a ban.
export function allowRemovedMembersToRejoin(room){
 for(const moderation of Object.values(room?.moderation||{}))if(moderation)delete moderation.removed;
 return room;
}
