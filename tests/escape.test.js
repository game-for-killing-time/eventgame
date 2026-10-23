import test from 'node:test';
import assert from 'node:assert/strict';
import {createEscape,command,tick,publicEscape,privateEscape,normalize} from '../functions/escape-engine.js';
import {publicPanel} from '../src/escape-view.js';
const host={uid:'host',host:true},rng={pick:0,twists:Array(96).fill(2)};
function cmd(s,uid,action,props={},now=1){return command(s,uid==='host'?host:{uid},{action,game:s.id,round:s.round,revision:s.revision,...props},now,rng);}
function game(n=5){const s=createEscape('test','ABCDEF',0);for(let i=0;i<n;i++)cmd(s,'p'+i,'join',{name:['阿健','阿晴','阿樂','小美','阿明'][i]||'伙伴'+i,code:s.code});cmd(s,'host','start',{minutes:120});return s;}
function phase(s){tick(s,s.deadline);}
function round(s,answers={},kill=null){if(s.phase==='intro')phase(s);for(const id of Object.keys(s.players).filter(id=>s.players[id].alive)){const [route,choice]=answers[id]||[0,2];cmd(s,id,'answer',{route,choice},s.deadline-1);}phase(s);for(const id of Object.keys(s.players).filter(id=>s.players[id].alive)){const [route,choice]=answers[id]||[0,2];cmd(s,id,'answer',{route,choice,kill:id===s.wolf?kill:null},s.deadline-1);}phase(s);}
function next(s){while(s.phase!=='intro'&&s.phase!=='ended')phase(s);}
test('server assigns exactly one wolf; host and public never receive identity, attack or ballots',()=>{
 const s=game();assert.equal(s.wolf,'p0');assert.equal(privateEscape(s,'p0').role,'wolf');assert.equal(privateEscape(s,'p1').role,'survivor');assert.equal(privateEscape(s,'p0',true),null);
 s.attack='p2';s.votes={p0:'p1'};const p=publicEscape(s);assert.equal(p.wolf,null);for(const key of ['attack','votes','twistPlan','final','first'])assert.equal(key in p,false);assert.equal(JSON.stringify(p).includes('"role"'),false);
 assert.throws(()=>cmd(s,'host','join',{code:s.code,name:'host'}));
});
test('six-act no-kill route escapes with equipment, signal and living civilian boarding',()=>{
 const s=game();round(s,{p1:[0,0],p2:[1,1]});next(s);round(s);next(s);round(s);next(s);round(s,{p1:[0,0]});assert.equal(s.resources.signal,true);next(s);round(s);next(s);round(s,{p1:[0,0]});assert.equal(s.outcome,'escaped');assert.equal(publicEscape(s).wolf,'p0');
});
test('murder invalidates victim action, does not leak route hint, triggers voting on this and every later round',()=>{
 const s=game();round(s);next(s);round(s,{p0:[0,2],p2:[0,1]},'p2');assert.equal(s.players.p2.alive,false);assert.equal(s.resources.battery,false);assert.ok(s.lines.includes('阿樂遭人殺害！'));assert.equal(s.lines.some(x=>x.includes('兇手')),false);phase(s);assert.equal(s.phase,'discuss');phase(s);assert.equal(s.phase,'vote');phase(s);assert.equal(s.phase,'voteResult');phase(s);round(s);phase(s);assert.equal(s.phase,'discuss');
});
test('kill remains one target even after overwrite; cannot target another final route or self',()=>{
 const s=game();round(s);next(s);phase(s);phase(s);cmd(s,'p0','answer',{route:0,choice:2,kill:'p1'},s.deadline-1);cmd(s,'p0','answer',{route:0,choice:2,kill:'p2'},s.deadline-1);cmd(s,'p1','answer',{route:0,choice:2},s.deadline-1);cmd(s,'p2','answer',{route:1,choice:2},s.deadline-1);assert.throws(()=>cmd(s,'p0','answer',{route:0,choice:2,kill:'p0'},s.deadline-1));phase(s);assert.ok(s.players.p1.alive&&s.players.p2.alive);
});
test('ordinary players cannot submit kills; wolf can act from round one; closed routes reject choices',()=>{
 const s=game();phase(s);phase(s);cmd(s,'p0','answer',{route:0,choice:2,kill:'p1'},s.deadline-1);assert.throws(()=>cmd(s,'p1','answer',{route:0,choice:2,kill:'p2'},s.deadline-1));s.twist=0;assert.throws(()=>cmd(s,'p0','answer',{route:0,choice:2},s.deadline-1));
});
test('one wolf and one civilian counter-kills immediately after murder; no extra vote',()=>{
 const s=game(3);round(s);next(s);round(s,{},'p2');assert.equal(s.phase,'ended');assert.equal(s.outcome,'counter');assert.match(s.ending,/阿晴.*阿健.*反殺/);
});
test('voting wolf immediately wins; dead cannot vote; same voter cannot add extra votes',()=>{
 const s=game();round(s);next(s);round(s,{},'p2');phase(s);phase(s);for(const id of ['p1','p3','p4'])cmd(s,id,'vote',{target:'p0'},s.deadline-1);cmd(s,'p1','vote',{target:'p0'},s.deadline-1);assert.throws(()=>cmd(s,'p2','vote',{target:'p0'},s.deadline-1));phase(s);assert.equal(s.outcome,'caught');assert.equal(s.voteCounts.p0,3);
});
test('wrong vote leaving one-on-one triggers counter-kill',()=>{
 const s=game(4);round(s);next(s);round(s,{},'p2');phase(s);phase(s);cmd(s,'p0','vote',{target:'p3'},s.deadline-1);cmd(s,'p1','vote',{target:'p3'},s.deadline-1);phase(s);assert.equal(s.outcome,'counter');
});
test('one runoff, second tie expels nobody; non-candidate votes rejected',()=>{
 const s=game();round(s);next(s);round(s,{},'p2');phase(s);phase(s);for(const [id,target]of [['p0','p1'],['p1','p0'],['p3','p0'],['p4','p1']])cmd(s,id,'vote',{target},s.deadline-1);phase(s);assert.equal(s.phase,'vote');assert.ok(s.runoff);assert.throws(()=>cmd(s,'p0','vote',{target:'p4'},s.deadline-1));cmd(s,'p0','vote',{target:'p1'},s.deadline-1);cmd(s,'p1','vote',{target:'p0'},s.deadline-1);phase(s);assert.equal(s.phase,'voteResult');assert.equal(Object.values(s.players).filter(p=>p.alive).length,4);
});
test('timeout wins before late boarding, host pause shifts both deadlines, repeats are harmless',()=>{
 const s=game();const expiry=s.escapeDeadline;cmd(s,'host','pause',{},100);tick(s,expiry+100);assert.equal(s.outcome,null);cmd(s,'host','pause',{},1000);assert.equal(s.escapeDeadline,expiry+900);tick(s,s.escapeDeadline);assert.equal(s.outcome,'timeout');const snapshot=JSON.stringify(s);tick(s,s.escapeDeadline+1);assert.equal(JSON.stringify(s),snapshot);
});
test('missing final is not a contribution; replayed old revisions cannot act in another phase',()=>{
 const s=game();phase(s);const revision=s.revision;cmd(s,'p1','answer',{route:0,choice:0},s.deadline-1);phase(s);assert.throws(()=>command(s,{uid:'p1'},{game:s.id,round:s.round,revision,action:'answer',route:0,choice:0},s.deadline-1,rng));phase(s);assert.equal(s.resources.radio,false);
});
test('disconnect/reload normalization handles Firebase omitted nulls and empty objects',()=>{
 const s=game();delete s.pausedAt;delete s.first;delete s.final;delete s.votes;delete s.history;normalize(s);phase(s);assert.equal(s.phase,'choose');assert.deepEqual(privateEscape(s,'p1').first,null);
});
test('display escapes names, shows murder without deductive hint; no private star',()=>{
 const s=game();s.players.p1.name='<script>bad</script>';s.lines=['阿樂遭人殺害！'];s.phase='result';const html=publicPanel(publicEscape(s));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('阿樂遭人殺害！'));assert.ok(!html.includes('兇手曾與'));assert.ok(!html.includes('private-star'));
});
test('only living civilian boarding can win; last act repeats if escape is incomplete',()=>{
 const s=game();for(let n=0;n<5;n++){round(s);next(s);}round(s,{p0:[0,0]});assert.equal(s.outcome,null);next(s);assert.equal(s.round,7);assert.equal(publicEscape(s).title,'最後登船');
});
test('victim cannot evade murder by withholding final answer; only action contribution is skipped',()=>{
 const s=game();round(s);next(s);phase(s);cmd(s,'p2','answer',{route:0,choice:1},s.deadline-1);phase(s);cmd(s,'p0','answer',{route:0,choice:2,kill:'p2'},s.deadline-1);phase(s);assert.equal(s.players.p2.alive,false);assert.equal(s.resources.battery,false);assert.equal(s.history.at(-1).routes.find(p=>p.name==='阿樂').action,'本輪行動無效');
});
