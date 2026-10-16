import test from 'node:test';
import assert from 'node:assert/strict';
import {joinPlayer,takePendingJoin} from '../src/player-join.js';
import {roomCodePath} from '../src/player-routing.js';

function memoryStorage(){
 const entries=new Map();
 return {entries,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
}

function backend(codes={},error){
 const reads=[],joins=[];
 return {reads,joins,
  async get(path){reads.push(path);return codes[path]??null;},
  async join(code,name){joins.push({code,name});if(error)throw error;}
 };
}

for(const [source,target] of [['classic','voyage'],['voyage','classic']]){
 test(`${source} join redirects to ${target}, preserving the submitted nickname privately`,async()=>{
  const api=backend({[roomCodePath(target)]:'ABC234'}),storage=memoryStorage(),destinations=[];
  const joined=await joinPlayer(source,api,' abc234 ','阿樂',{storage,navigate:url=>destinations.push(url),now:()=>1000});
  assert.equal(joined,false);
  assert.deepEqual(api.joins,[]);
  assert.deepEqual(api.reads,[roomCodePath(source),roomCodePath(target)]);
  assert.deepEqual(destinations,[`./index.html?room=ABC234`]);
  assert.deepEqual(JSON.parse([...storage.entries.values()][0]),{mode:target,code:'ABC234',name:'阿樂',at:1000});
  assert.deepEqual(takePendingJoin(target,'abc234',{storage,now:()=>1001}),{code:'ABC234',name:'阿樂'});
  assert.equal(takePendingJoin(target,'ABC234',{storage,now:()=>1002}),null);
  assert.equal(storage.entries.size,0);
 });

 test(`${source} matching room joins once without checking another mode`,async()=>{
  const api=backend({[roomCodePath(source)]:'ABC234',[roomCodePath(target)]:'ABC234'}),storage=memoryStorage();
  const result=await joinPlayer(source,api,' abc234 ','琪琪',{storage,navigate:()=>assert.fail('Unexpected navigation')});
  assert.equal(result,true);
  assert.deepEqual(api.reads,[roomCodePath(source)]);
  assert.deepEqual(api.joins,[{code:'ABC234',name:'琪琪'}]);
  assert.equal(storage.entries.size,0);
 });
}

test('an ordinary invitation has no pending join',()=>{
 assert.equal(takePendingJoin('voyage','ABC234',{storage:memoryStorage()}),null);
});

test('another mode or room cannot consume a pending join',async()=>{
 const storage=memoryStorage(),api=backend({[roomCodePath('voyage')]:'ABC234'});
 await joinPlayer('classic',api,'ABC234','琪琪',{storage,navigate:()=>{},now:()=>1000});
 assert.equal(takePendingJoin('classic','ABC234',{storage,now:()=>1001}),null);
 assert.equal(takePendingJoin('voyage','DEF567',{storage,now:()=>1001}),null);
 assert.equal(storage.entries.size,1);
 assert.deepEqual(takePendingJoin('voyage','ABC234',{storage,now:()=>1001}),{code:'ABC234',name:'琪琪'});
});

test('unknown room keeps the existing backend room-code error',async()=>{
 const error=Error('房間碼不正確。'),api=backend({},error),storage=memoryStorage();
 await assert.rejects(joinPlayer('voyage',api,'ABC234','琪琪',{storage}),value=>value===error);
 assert.deepEqual(api.joins,[{code:'ABC234',name:'琪琪'}]);
 assert.equal(storage.entries.size,0);
});

for(const message of ['房間已鎖定。','房間已結束。','PERMISSION_DENIED']){
 test(`matching room preserves the backend error: ${message}`,async()=>{
  const error=Error(message),api=backend({[roomCodePath('voyage')]:'ABC234'},error),storage=memoryStorage();
  await assert.rejects(joinPlayer('voyage',api,'ABC234','琪琪',{storage}),value=>value===error);
  assert.deepEqual(api.reads,[roomCodePath('voyage')]);
  assert.equal(api.joins.length,1);
  assert.equal(storage.entries.size,0);
 });
}

test('public-code permission errors propagate without joining or redirecting',async()=>{
 const error=Error('PERMISSION_DENIED'),api=backend(),storage=memoryStorage();
 api.get=async()=>{throw error;};
 await assert.rejects(joinPlayer('classic',api,'ABC234','琪琪',{storage}),value=>value===error);
 assert.deepEqual(api.joins,[]);
 assert.equal(storage.entries.size,0);
});

test('malformed, invalid, expired and future pending joins are removed',async()=>{
 const good={mode:'voyage',code:'ABC234',name:'琪琪',at:1000};
 const invalid=[
  '{broken', 'null', '[]', '42',
  ...[
   {...good,mode:'other'}, {...good,code:'abc234'}, {...good,code:'BAD'},
   {...good,name:''}, {...good,name:'  '}, {...good,name:123}, {...good,name:'x'.repeat(21)},
   {...good,at:'1000'}, {...good,at:null}, {...good,at:-120001}, {...good,at:2001}
  ].map(JSON.stringify)
 ];
 for(const raw of invalid){
  const storage=memoryStorage(),api=backend({[roomCodePath('voyage')]:'ABC234'});
  await joinPlayer('classic',api,'ABC234','琪琪',{storage,navigate:()=>{},now:()=>1000});
  const key=[...storage.entries.keys()][0];
  storage.setItem(key,raw);
  assert.equal(takePendingJoin('voyage','ABC234',{storage,now:()=>2000}),null,raw);
  assert.equal(storage.entries.size,0,raw);
 }
});

test('pending joins expire after two minutes',async()=>{
 const storage=memoryStorage(),api=backend({[roomCodePath('voyage')]:'ABC234'});
 await joinPlayer('classic',api,'ABC234','琪琪',{storage,navigate:()=>{},now:()=>1000});
 assert.equal(takePendingJoin('voyage','ABC234',{storage,now:()=>121001}),null);
 assert.equal(storage.entries.size,0);
});
