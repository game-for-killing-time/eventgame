import test from 'node:test';
import assert from 'node:assert/strict';
import {createEscape,command,tick,publicEscape,privateEscape} from '../functions/escape-engine.js';
import {prepareInteractions,personalInteraction,dropItems} from '../functions/escape-interactions.js';
const rng={pick:0,twists:Array(96).fill(2)};
function act(s,id,action,data={}){return command(s,{uid:id,host:id==='host'},{action,game:s.id,round:s.round,revision:s.revision,...data},s.deadline?s.deadline-1:1,rng);}
function game(n){const s=createEscape('test','ABCDEF',0);for(let i=0;i<n;i++)act(s,'p'+i,'join',{code:s.code,name:['阿明','阿晴','阿健','小美','阿樂','阿強','阿詩','阿文'][i]});act(s,'host','start',{minutes:120});return s;}
const next=s=>tick(s,s.deadline);
const living=s=>Object.keys(s.players).filter(id=>s.players[id].alive);
function play(s,first={},final={}){next(s);for(const id of living(s))act(s,id,'answer',{route:0,choice:first[id]??1});next(s);for(const id of living(s))if(final[id]!==null)act(s,id,'answer',{route:0,choice:1,...final[id]});next(s);}
function nextRound(s){while(!['intro','ended'].includes(s.phase))next(s);}

for(let n=3;n<=8;n++)test(`${n} players: at most one request, fair rotating partners, and solo escape without deadlock`,()=>{
 const s=game(n);const old={...s.partners};assert.equal(new Set(Object.values(old)).size,n);for(const id of living(s)){assert.notEqual(old[id],id);assert.ok(s.players[old[id]].alive);}
 // Assignments are completely independent of the wolf's identity.
 const clone=structuredClone(s);clone.wolf='p2';prepareInteractions(clone);assert.deepEqual(clone.partners,s.partners);assert.deepEqual(clone.tasks,s.tasks);
 for(let round=0;round<12&&s.phase!=='ended';round++){play(s);nextRound(s);}
 assert.equal(s.outcome,'escaped');assert.ok(s.history.flatMap(h=>h.lines).some(line=>line.includes('阿晴')));
 const changed=game(n);changed.round=2;prepareInteractions(changed);assert.notDeepEqual(changed.partners,old);
});
test('named request acceptance sacrifices helper task and records real causal result',()=>{
 const s=game(5);const a='p0',b=s.partners[a],other=Object.keys(s.players).filter(id=>![a,b].includes(id));
 next(s);act(s,a,'answer',{route:0,choice:0});next(s);assert.equal(privateEscape(s,b).interaction.incoming.name,s.players[a].name);assert.equal(privateEscape(s,'host',true),null);assert.equal('partners' in publicEscape(s),false);
 act(s,a,'answer',{route:0,choice:0});act(s,b,'answer',{route:0,choice:1,accept:true});for(const id of other)act(s,id,'answer',{route:0,choice:2});next(s);
 assert.equal(s.resources[s.tasks[a]],true);assert.equal(s.work[s.tasks[b]]||0,0);assert.ok(s.lines.some(l=>l.includes(s.players[b].name+'答應'+s.players[a].name)));assert.ok(s.lines.some(l=>l.includes('即時完成')));
});
test('refusal, no answer, route mismatch and changed plan never fabricate cooperation',()=>{
 for(const mode of ['refuse','absent','route','changed']){const s=game(3),a='p0',b=s.partners[a];next(s);act(s,a,'answer',{route:0,choice:0});next(s);act(s,a,'answer',{route:0,choice:mode==='changed'?1:0});if(mode!=='absent')act(s,b,'answer',{route:mode==='route'?1:0,choice:2,accept:mode!=='refuse'});next(s);assert.ok(!s.lines.some(l=>l.includes('即時完成')));assert.equal(s.work[s.tasks[a]],1);}
});
test('murdered helper contributes nothing; assignments only include survivors next round',()=>{
 const s=game(5),a='p0',b=s.partners[a];next(s);act(s,a,'answer',{route:0,choice:0});next(s);act(s,a,'answer',{route:0,choice:0,kill:b});act(s,b,'answer',{route:0,choice:1,accept:true});next(s);assert.equal(s.players[b].alive,false);assert.equal(s.work[s.tasks[a]],1);assert.ok(!s.lines.some(l=>l.includes('即時完成')));nextRound(s);assert.ok(!Object.values(s.partners).includes(b));assert.ok(!Object.hasOwn(s.tasks,b));
});
test('murdered requester cannot complete a task via a surviving helper',()=>{
 const s=game(5),a='p2',b=s.partners[a];next(s);act(s,a,'answer',{route:0,choice:0});next(s);act(s,a,'answer',{route:0,choice:0});act(s,b,'answer',{route:0,choice:1,accept:true});act(s,'p0','answer',{route:0,choice:2,kill:a});next(s);assert.equal(s.work[s.tasks[a]]||0,0);assert.ok(s.lines.some(l=>l.includes('伙伴已出局')));
});
test('handoff changes custody; dead carrier drops recoverable supplies; no role exposed',()=>{
 const s=game(5),a='p0',b=s.partners[a];s.resources.radio=true;s.items.radio={holder:a,ground:false,place:'海灘'};
 play(s,{}, {[a]:{choice:2},[b]:{choice:2}});assert.equal(s.items.radio.holder,b);
 s.players[b].alive=false;dropItems(s,b,'集合處');assert.equal(s.resources.radio,false);assert.equal(s.items.radio.ground,true);assert.equal(s.items.radio.holder,null);s.round=4;prepareInteractions(s);assert.ok(Object.values(s.tasks).includes('radio'));
 const c=Object.keys(s.tasks).find(id=>s.tasks[id]==='radio');assert.match(personalInteraction(s,c).task,/拾回/);
 s.phase='intro';play(s,{},Object.fromEntries(living(s).map(id=>[id,{choice:id===c?1:2}])));assert.equal(s.resources.radio,true);assert.equal(s.items.radio.holder,c);
});
test('three-player kill still ends immediately and ninth join is rejected',()=>{
 const s=game(3);play(s,{}, {p0:{choice:2,kill:'p1'}});assert.equal(s.outcome,'counter');
 const lobby=createEscape('id','ABCDEF',0);for(let i=0;i<8;i++)act(lobby,'p'+i,'join',{name:'玩家'+i,code:lobby.code});assert.throws(()=>act(lobby,'p8','join',{name:'第九人',code:lobby.code}));
});
test('voted-out carrier leaves items recoverable and a dead transfer never executes',()=>{
 const s=game(5);s.items.radio={holder:'p1',ground:false,place:'營地'};s.resources.radio=true;
 play(s,{}, {p0:{choice:2,kill:'p4'}});next(s);next(s);for(const id of ['p0','p2','p3'])act(s,id,'vote',{target:'p1'});next(s);
 assert.equal(s.items.radio.holder,null);assert.equal(s.items.radio.ground,true);assert.ok(s.voteLines.some(l=>l.includes('之後可以拾回')));
 const other=game(5);other.items.radio={holder:'p1',ground:false,place:'海灘'};other.resources.radio=true;play(other,{}, {p0:{choice:2,kill:'p1'},p1:{choice:2}});assert.equal(other.items.radio.holder,null);assert.equal(other.resources.radio,false);
});
test('no forged request acceptance; serialized state retains private requests and progress',()=>{
 let s=game(4);next(s);act(s,'p0','answer',{route:0,choice:0});next(s);
 assert.throws(()=>act(s,'p2','answer',{route:0,choice:1,accept:true}),/沒有收到求助/);
 s=JSON.parse(JSON.stringify(s));assert.equal(privateEscape(s,'p1').interaction.incoming.name,'阿明');act(s,'p1','answer',{route:0,choice:1,accept:true});act(s,'p0','answer',{route:0,choice:0});next(s);assert.ok(s.lines.some(l=>l.includes('阿晴答應阿明')));
});
