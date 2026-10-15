import test from 'node:test';
import assert from 'node:assert/strict';
import {removeRoomMember,allowRemovedMembersToRejoin} from '../src/member-removal.js';
test('removal frees only the member seat and effects; preserves history, answer limits and mute',()=>{
 const r={public:{state:{code:'PARTY1'},members:{a:{seat:'0'},b:{seat:'1'}},seats:{0:'a',1:'b'},results:{1:{points:{a:1}}},island:{positions:{a:{x:1},b:{x:2}}}},moderation:{a:{removed:true,muted:true}},answers:{2:{a:{choice:1,revision:1}}},effects:{chat:{a:{}},submissions:{items:{a:{}}}}};
 const history=JSON.stringify({answers:r.answers,results:r.public.results});
 assert.equal(removeRoomMember(r,'a','OTHER1'),undefined);assert.ok(r.public.members.a);
 removeRoomMember(r,'a','PARTY1');assert.equal(r.public.members.a,undefined);assert.equal(r.public.seats[0],undefined);assert.equal(r.public.seats[1],'b');assert.equal(r.moderation.a.removed,undefined);assert.equal(r.moderation.a.muted,true);assert.equal(r.public.island.positions.a,undefined);assert.equal(r.effects.chat.a,undefined);assert.equal(r.effects.submissions.items.a,undefined);
 assert.equal(JSON.stringify({answers:r.answers,results:r.public.results}),history);
 r.public.seats[0]='c';removeRoomMember(r,'a','PARTY1');assert.equal(r.public.seats[0],'c');
});
test('host migration clears old bans without changing membership, locks, mutes or scores',()=>{
 const r={public:{state:{code:'PARTY1',locked:true},members:{b:{}},results:{1:{points:{a:1}}}},moderation:{a:{removed:true,muted:true},b:{muted:false}}};
 const p=JSON.stringify(r.public);allowRemovedMembersToRejoin(r);assert.equal(JSON.stringify(r.public),p);assert.deepEqual(r.moderation,{a:{muted:true},b:{muted:false}});allowRemovedMembersToRejoin(r);assert.equal(allowRemovedMembersToRejoin(null),null);
});

test('an empty transaction cache requests a server retry rather than aborting removal',()=>{assert.equal(removeRoomMember(null,'a','PARTY1'),null);});
