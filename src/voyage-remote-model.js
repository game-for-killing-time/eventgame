import * as E from './voyage-engine.js';
import {fingerprint} from './story-remote-model.js';
import {islandLayout} from './affinity.js';
export {fingerprint};
export function hydrate(r){
 if(!r)return r;const s=r.hostOnly;
 for(const k of ['players','routes','first','second','scored','shared','hidden','turns','results'])s[k]??={};
 for(const k of ['history','chat','cast'])s[k]??=[];
 s.affinity??={};s.affinity.rounds??={};s.affinity.pairs??={};s.island??=islandLayout();s.island.positions??={};
 for(const p of Object.values(s.players)){p.events??=[];p.traits??={};}
 for(const h of s.history)h.entries??=[];
 for(const result of Object.values(s.results)){if(result){result.rows??=[];result.choice??=null;result.wrong??=null;}}
 for(const k of ['roster','inputs','moderation','consent','quoteConsent','hidden','seats','departed'])r[k]??={};
 return r;
}
export function createVoyage(code,now=Date.now(),packId){return project({code,hostOnly:E.create(now,packId),locked:false,chatOpen:true});}
export function ingest(r){hydrate(r);const s=r.hostOnly;
 for(const [uid,m]of Object.entries(r.roster)){if(r.moderation[uid]?.removed)continue;if(!s.players[uid]&&s.phase!=='ended'){E.join(s,uid,m.name);if(r.departed[uid]){s.players[uid]={...r.departed[uid],name:m.name};delete r.departed[uid];}s.players[uid].seat=Number(m.seat);}}
 const kinds={routing:'routes',first:'first',twist:'second'},kind=kinds[s.phase];
 if(kind)for(const [id,a]of Object.entries(r.inputs[kind]?.[s.round]||{})){if(!s.players[id]||s.players[id].alive===false||r.moderation[id]?.removed||a.game!==s.id)continue;
  if(kind==='routes')E.route(s,id,a.route,a.at);
  if(kind==='first')E.submitFirst(s,id,s.round,a.choice,a.prediction,a.at);
  if(kind==='second')E.submitSecond(s,id,s.round,a,a.at);
 }
 for(const [round,entries]of Object.entries(r.quoteConsent))for(const [id,c]of Object.entries(entries)){if(c.game!==s.id)continue;const e=s.players[id]?.events.find(x=>x.round===Number(round));if(e)E.consent(s,id,Number(round),c.share);}
 return r;
}
export function project(r){hydrate(r);const s=r.hostOnly,v=E.publicView(s);delete v.quotes;delete v.cards;
 r.public={id:s.id,version:3,packId:s.packId||null,code:r.code,locked:!!r.locked,chatOpen:r.chatOpen!==false,phase:s.phase,outcome:s.outcome||null,round:s.round,deadline:s.deadline,duration:s.duration,target:s.target||'',cast:s.cast,currentQuestion:s.currentQuestion||null,routes:E.scene(s)?.routes?.map(x=>({id:x.id,name:x.name}))||[],players:Object.fromEntries(Object.entries(s.players).map(([id,p])=>[id,{name:p.name,seat:p.seat,points:p.points,alive:p.alive!==false,spectator:!!p.spectator,group:p.group||'red',deathRound:p.deathRound||null,deathReason:p.deathReason||null,misunderstood:E.misunderstoodScore(s,id)}])),island:s.island,submitted:Object.keys(s.phase==='routing'?s.routes:s.phase==='twist'||s.phase==='twistClosed'?s.second:s.first).length,view:v};
 r.inbox={};r.quotes={};r.sharedCards={};
 for(const [id,p]of Object.entries(s.players)){
  r.inbox[id]={game:s.id,round:s.round,player:p,first:s.first[id]||null,second:s.second[id]||null,route:s.routes[id]||'',card:s.phase==='ended'?E.card(s,id):null};
  if(s.phase==='ended'){const c=E.card(s,id);c.events=c.events.map(e=>({...e,text:''}));r.sharedCards[id]=c;}
  for(const e of p.events)if(e.text){r.quotes[e.round]??={};r.quotes[e.round][id]={name:p.name,text:e.text};r.quoteConsent[e.round]??={};r.quoteConsent[e.round][id]??={game:s.id,share:e.consent===true};}
 }
 return JSON.parse(JSON.stringify(r));
}
export function remoteCommand(r,action,value,expected,now=Date.now()){
 if(!r)return;hydrate(r);const s=r.hostOnly;
 if(expected&&(s.id!==expected.id||s.round!==expected.round||s.phase!==expected.phase))return;
 for(const m of Object.values(r.moderation))delete m.removed;
 ingest(r);
 if(action==='next'){if(![15,45,60,90].includes(value))throw Error('請選擇有效作答時間');E.next(s,now,value);}
 else if(action==='autoAdvance')E.autoAdvance(s,now);
 else if(['begin','close','extend','revealFirst','twist','revealSecond'].includes(action))E[action](s,now);
 else if(action==='lock')r.locked=!r.locked;
 else if(action==='chat')r.chatOpen=!r.chatOpen;
 else if(action==='end'){if(s.phase!=='ended')s.outcome='aborted';s.phase='ended';s.ending??=1;r.locked=true;}
 else if(action==='hide'){r.hidden[value.round]??={};r.hidden[value.round][value.uid]=true;}
 else if(action==='mute'){r.moderation[value]??={};r.moderation[value].muted=!r.moderation[value].muted;}
 else if(action==='remove'){
  if(s.players[value])r.departed[value]=structuredClone(s.players[value]);
  if(r.moderation[value])delete r.moderation[value].removed;const seat=r.roster[value]?.seat;
  delete r.roster[value];if(seat!==undefined)delete r.seats[seat];delete s.players[value];delete s.first[value];delete s.second[value];delete s.routes[value];delete s.shared[value];delete r.chat?.[value];delete r.consent[value];
  // A removed target ends this unanswered round without fabricating a replacement answer.
  if(s.target===value){const wasRouting=s.phase==='routing';s.target=null;if(['routing','first','firstClosed'].includes(s.phase)){s.phase='revealed';s.results[s.round]={target:value,targetName:'已離場玩家',choice:null,options:s.currentQuestion?.options.map(o=>o.text)||[],total:0,correct:0,wrong:null,rows:[]};if(wasRouting)s.phase='discussion';s.deadline=now+15000;}}
  if(E.pack(s).id==='last-light-survival-v1'&&s.round>0){const live=Object.keys(s.players).filter(id=>s.players[id].alive!==false);if(!live.length){s.phase='ended';s.outcome='aborted';}else if(s.phase==='intro'&&!s.target){s.target=live[0];s.cast=[s.target];}}
  s.island.positions&&delete s.island.positions[value];
 }
 else if(action==='deleteMessage')delete r.chat?.[value.uid]?.messages?.[value.id];
 else if(action==='clean'){if(s.phase!=='ended')throw Error('請先結束房間');return null;}
 else if(action!=='sync')throw Error('未知主持操作');
 return project(r);
}
