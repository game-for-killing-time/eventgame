// Loaded only by the signed-in host. The entire engine state is host-only in RTDB.
import * as E from './story-engine.js';
// RTDB omits empty nodes and can materialize numeric-key objects as arrays.
export function fingerprint(value){function normalize(v){if(v===null||v===undefined)return null;if(typeof v!=='object')return v;const out={};for(const k of Object.keys(v).sort()){const x=normalize(v[k]);if(x!==null)out[k]=x;}return Object.keys(out).length?out:null;}return JSON.stringify(normalize(value));}
export function hydrate(r){
 if(!r?.hostOnly)return r;const s=r.hostOnly;s.players??={};s.routes??={};s.answers??={};s.results??={};s.history??=[];s.runoffVotes??={};s.shared??={};s.chat??=[];
 for(const p of Object.values(s.players)){p.flags??=[];p.events??=[];for(const e of p.events)e.companions??=[];}
 r.roster??={};r.inputs??={};r.moderation??={};return r;
}
export function createAdventure(code,now=Date.now(),pack){const s=E.newStory(pack??undefined,now);s.id=crypto.randomUUID();return project({hostOnly:s,code,locked:false,chatOpen:true,roster:{},inputs:{},moderation:{}});}
export function ingest(r){hydrate(r);const s=r.hostOnly;
 for(const [uid,m]of Object.entries(r.roster)){
  if(r.moderation[uid]?.removed){delete s.players[uid];delete s.answers[uid];delete s.routes[uid];continue;}
  if(!s.players[uid]&&s.phase!=='ended'){E.joinStory(s,uid,m.name);s.players[uid].seat=+m.seat;}
 }
 if(s.phase==='routing')for(const [id,a]of Object.entries(r.inputs.routes?.[s.round]||{}))if(s.players[id]&&a.game===s.id)try{E.selectRoute(s,id,a.route,a.at);}catch{}
 if(s.phase==='open')for(const [id,a]of Object.entries(r.inputs.answers?.[s.round]||{}))if(s.players[id]&&a.game===s.id)try{E.submit(s,id,s.round,a.qid,a.choice,a.prediction,a.at);}catch{}
 if(s.phase==='runoff')for(const [id,a]of Object.entries(r.inputs.runoff||{}))if(s.players[id]&&a.game===s.id)try{E.submitRunoff(s,id,a.choice,a.at);}catch{}
 return r;
}
export function project(r){hydrate(r);const s=r.hostOnly,scene=E.scene(s),v=E.publicView(s);
 const pub={version:1,id:s.id,code:r.code,locked:!!r.locked,chatOpen:r.chatOpen!==false,phase:s.phase,round:s.round,deadline:s.deadline,title:s.pack.title,intro:scene?.intro||s.pack.opening,sceneTitle:scene?.title||'準備登島',scored:E.isScored(s),submitted:Object.keys(s.answers).length,members:Object.fromEntries(Object.entries(s.players).map(([id,p])=>[id,{name:p.name,seat:p.seat,points:p.points}])),routes:scene?.routes?.map(t=>({id:t.id,name:t.name}))||[],routeCounts:v.routes,history:s.history,ending:v.ending,endingReason:s.endingReason||'',campfire:s.round&&s.round%3===0?s.pack.chapters[Math.ceil(s.round/3)-1][1]:'',runoffOptions:s.runoffOptions||[],runoffLabels:s.round===16?s.pack.rounds[15].question.options.map(o=>o.text):[]};
 r.public=pub;r.inbox={};r.sharedCards={};
 for(const [id,p]of Object.entries(s.players)){
  const q=E.questionFor(s,id);const event=p.events.find(e=>e.round===s.round);const result=s.results[s.round]?.groups[q?.id];
  r.inbox[id]={game:s.id,round:s.round,route:s.routes[id]||'',trapped:p.trappedRound===s.round,question:q?{id:q.id,text:q.text,options:q.options.map(o=>o.text)}:null,echo:s.round===15?E.echoFor(p):'',outcome:event?.text||'',counts:result?.counts||null};
  if(s.phase==='ended'){const card=E.cardFor(s,id);r.inbox[id].card=card;r.sharedCards[id]=card;}
 }
 return JSON.parse(JSON.stringify(r));
}
export function remoteCommand(r,action,value,expected,now=Date.now()){
 if(!r)return;hydrate(r);const s=r.hostOnly;
 if(expected&&(s.id!==expected.id||s.round!==expected.round||s.phase!==expected.phase))return;
 ingest(r);
 if(action==='next')E.nextRound(s,now,value||60);
 else if(action==='begin')E.beginAnswers(s,now);
 else if(action==='close')E.closeRound(s);
 else if(action==='extend')E.extendRound(s,now);
 else if(action==='reveal'){if(s.phase==='runoff-closed')E.settleRunoff(s);else E.settle(s,now);}
 else if(action==='lock')r.locked=!r.locked;
 else if(action==='chat')r.chatOpen=r.chatOpen===false;
 else if(action==='end'){s.phase='ended';r.locked=true;s.ending??=1;}
 else if(action==='mute'){r.moderation[value]??={};r.moderation[value].muted=!r.moderation[value].muted;}
 else if(action==='remove'){r.moderation[value]={removed:true,muted:true};delete s.players[value];delete s.answers[value];delete s.routes[value];const seat=r.roster[value]?.seat;if(seat!==undefined&&r.seats)delete r.seats[seat];delete r.roster[value];delete r.chat?.[value];delete r.consent?.[value];}
 else if(action==='deleteMessage'){delete r.chat?.[value.uid]?.messages?.[value.id];}
 else if(action==='clean'){if(s.phase!=='ended')throw Error('請先結束房間');return null;}
 else if(action!=='sync')throw Error('未知操作');
 return project(r);
}


