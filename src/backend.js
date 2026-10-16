import {createBroadcastRoom,cleanBroadcastRoom} from './broadcast-model.js';
import {startBroadcastControl} from './broadcast-control.js';
import {removeRoomMember,allowRemovedMembersToRejoin} from './member-removal.js';
import {prepareQuestionPlan,startNextQuestion} from './question-plan.js';
import {isSpotlight,configureSpotlight,awardMasters,targetFirst,activateGuesses,skipTarget} from './spotlight.js';
import {endRoom} from './end-room.js';
import {autoRevealRound,sameRound,ballotMatches,hasConsented} from './auto-reveal.js';
import {nextRevision,answerEditable} from './answer-policy.js';
import {migrateAffinity} from './affinity.js';
import {relayEffects} from './effects.js';
import {config} from '../config.js';
import {newRoom,startRound,settleRoom,publishRevealedChoices} from './game.js';

export async function connect(role,onConnection) {
 if(!config.firebase || new URLSearchParams(location.search).get('demo')==='1') return demo(role,onConnection);
 const [{initializeApp},a,d]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/database')]);
 const testing=import.meta.env.DEV&&import.meta.env.VITE_STORY_EMULATOR==='1';
 const settings=testing?{apiKey:'demo-key',projectId:import.meta.env.VITE_TEST_PROJECT||'demo-hoho',databaseURL:'https://'+(import.meta.env.VITE_TEST_PROJECT||'demo-hoho')+'.firebaseio.com'}:config.firebase;
 const app=initializeApp(settings,role), auth=a.getAuth(app), db=d.getDatabase(app);
 if(config.emulators||testing){a.connectAuthEmulator(auth,'http://127.0.0.1:'+(import.meta.env.VITE_TEST_AUTH_PORT||9099));d.connectDatabaseEmulator(db,'127.0.0.1',Number(import.meta.env.VITE_TEST_DB_PORT||9000));}
 await a.setPersistence(auth,role==='display'?a.inMemoryPersistence:a.browserLocalPersistence); await auth.authStateReady();
 let online=false,offset=0;
 d.onValue(d.ref(db,'.info/connected'),s=>{online=s.val()===true;onConnection(online?'已連線':'離線／重新連線中');});
 d.onValue(d.ref(db,'.info/serverTimeOffset'),s=>offset=s.val()||0);
 const ref=p=>d.ref(db,p), get=async p=>(await d.get(ref(p))).val();
 const ready=()=>{if(!online) throw Error('目前離線，請連線後再操作。');};
 const api={mode:'Firebase 多人模式',now:()=>Date.now()+offset,uid:()=>auth.currentUser?.uid,
 async login(email,password){await a.signInWithEmailAndPassword(auth,email,password);await api.checkHost();},
 async logout(){await a.signOut(auth);},
 async checkHost(){if(!auth.currentUser||auth.currentUser.isAnonymous) return false; const ok=await get('config/hostUid')===api.uid();if(!ok) throw Error('這個帳號未被指定為主持人。');return true;},
 async guest(){if(!auth.currentUser) await a.signInAnonymously(auth);},
 watch(path,fn,error){return d.onValue(ref(path),s=>fn(s.val()),error);},
 watchChat(uid,fn,error){return d.onValue(d.query(ref(`room/chat/${uid}/messages`),d.orderByChild('at'),d.limitToLast(3)),s=>fn(s.val()),error);},
 get,
 async create(){ready();const result=await d.runTransaction(ref('room'),room=>createBroadcastRoom(room,()=>newRoom(makeCode())),{applyLocally:false});if(!result.committed) throw Error('已有房間；請結束並清理後再建立。');},
 async join(code,name){ready();await api.guest();for(let attempt=0;attempt<20;attempt++){const p=await get('room/public');if(p?.state?.code!==code)throw Error('房間碼不正確。');if(p.members?.[api.uid()])return;if(p.state.locked||p.state.status==='ended')throw Error('房間已鎖定或結束。');const seat=Array.from({length:20},(_,i)=>String(i)).find(i=>!p.seats?.[i]);if(seat===undefined)throw Error('房間已滿 20 人。');try{await d.update(ref('room/public'),{[`members/${api.uid()}`]:{name,code,seat,joined:d.serverTimestamp()},[`seats/${seat}`]:api.uid()});return;}catch(e){if((await get(`room/moderation/${api.uid()}`))?.removed||attempt===19)throw e;}}},
 async answer(round,choice,prediction,attempt,revision=0){ready();const answer={choice,prediction,revision,...(attempt!==undefined?{attempt}:{}),at:d.serverTimestamp()};await d.set(ref(`room/answers/${round}/${api.uid()}`),answer);return answer;},
 async consent(expected){ready();await d.set(ref(`room/public/earlyClose/votes/${api.uid()}`),{code:expected.code,round:expected.round,attempt:expected.attempt||0,at:d.serverTimestamp()});},
 async chat(text){ready();const uid=api.uid(), seq=(await get(`room/chat/${uid}/seq`)||0)+1;await d.update(ref(`room/chat/${uid}`),{seq,lastSent:d.serverTimestamp(),[`messages/${seq}`]:{text,at:d.serverTimestamp()}});},
 async story(round,text){ready();await d.set(ref(`room/stories/${round}/${api.uid()}`),{text,at:d.serverTimestamp()});},
 async command(action,value){ready();
 if(action==='prepareQuestions'||action==='startNext'){const result=await d.runTransaction(ref('room'),r=>{if(!r)return null;if(action==='startNext')return startNextQuestion(r,value,api.now());if(r.public.state.code!==value.expected?.code||r.public.state.round!==value.expected?.round)return;return prepareQuestionPlan(r,value);},{applyLocally:false});if(!result.committed)throw Error('房間或題目已變更，請確認目前進度。');return;}
 if(action==='relayEffects'){await d.runTransaction(ref('room'),r=>r?relayEffects(r,value,api.now()):null,{applyLocally:false});return;}
 if(action==='chatEffects'||action==='submitEffects'){await d.update(ref('room'),{[`public/state/${action}`]:value,[`effects/${action==='chatEffects'?'chat':'submissions'}`]:null});return;}
 if(action==='clean'){const r=await d.runTransaction(ref('room'),room=>cleanBroadcastRoom(room),{applyLocally:false});if(!r.committed) throw Error('請先結束房間。');return;}
 if(action==='migrate'){const expected=await get('room/public/state');if(!expected)return;await d.runTransaction(ref('room'),r=>!r?null:r.public.state.code===expected.code?allowRemovedMembersToRejoin(publishRevealedChoices(migrateAffinity(r))):undefined,{applyLocally:false});return;}
 if(action==='autoReveal'){await d.runTransaction(ref('room'),room=>autoRevealRound(room,value,api.now(),d.serverTimestamp()),{applyLocally:false});return;}
 if(action==='reveal'){const expected=value||await get('room/public/state');const r=await d.runTransaction(ref('room'),room=>!room?null:sameRound(room.public.state,expected)?settleRoom(room,expected.round,expected.code,d.serverTimestamp()):undefined,{applyLocally:false});if(!r.committed)throw Error('這輪狀態已改變，請重新確認。');return;}
 if(action==='configure'){const result=await d.runTransaction(ref('room'),r=>r?configureSpotlight(r,value):null,{applyLocally:false});if(!result.committed)throw Error('請先建立房間。');return;}
 if(action==='openGuesses'||action==='skipTarget'){const expected=value||await get('room/public/state');const result=await d.runTransaction(ref('room'),r=>action==='openGuesses'?activateGuesses(r,expected,api.now()):skipTarget(r,expected),{applyLocally:false});if(action==='skipTarget'&&!result.committed)throw Error('主角已提交或題目已變更，不能跳過。');return;}
 if(action==='start'){const expected=await get('room/public/state');const result=await d.runTransaction(ref('room'),r=>{if(!r)return null;if(r.public.state.code!==expected?.code||r.public.state.round!==expected.round)return; r.public.state=startRound(r,value,api.now());delete r.public.story;return r;},{applyLocally:false});if(!result.committed)throw Error('房間已變更，請確認目前題目。');return;}
 if(action==='close'||action==='extend'){const expected=value||await get('room/public/state');await d.runTransaction(ref('room/public/state'),s=>{if(!s)return null;if(!sameRound(s,expected)||s.status!=='open'||(action==='extend'&&s.deadline<=api.now())) return;return {...s,...(action==='close'?{status:'closed'}:{deadline:s.deadline+15000})};},{applyLocally:false});return;}
 if(action==='end'){const expected=await get('room/public/state');if(!expected)throw Error('目前沒有房間可結束。');const result=await d.runTransaction(ref('room'),r=>endRoom(r,expected.code),{applyLocally:false});if(!result.committed||result.snapshot.val()?.public?.state?.status!=='ended')throw Error('房間已變更，請重新確認後再結束。');return;}
 if(action==='lock'||action==='chatOpen'){await d.set(ref(`room/public/state/${action==='lock'?'locked':'chatOpen'}`),value);return;}
 if(action==='mute'){await d.update(ref('room'),{[`moderation/${value.uid}/muted`]:value.muted,...(value.muted?{[`effects/chat/${value.uid}`]:null}:{})});return;}
 if(action==='remove'){const expected=await get('room/public/state');await d.runTransaction(ref('room'),r=>removeRoomMember(r,value,expected?.code),{applyLocally:false});return;}
 if(action==='deleteMessage'){await d.runTransaction(ref('room'),r=>{if(!r)return null;if(r.chat?.[value.uid]?.messages)delete r.chat[value.uid].messages[value.id];if(String(r.effects?.chat?.[value.uid]?.seq)===String(value.id))delete r.effects.chat[value.uid];return r;},{applyLocally:false});return;}
 if(action==='selectStory'){await d.set(ref('room/public/story'),value);return;}
 }
 };
 if(role==='host')startBroadcastControl(app,'classic');
 if(role==='viewer') await api.guest();
 return api;
}
function makeCode(){return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');}

function demo(role,onConnection){
 const key='hoho-spotlight-demo-v1',uid=localStorage.getItem('hoho-demo-uid')||crypto.randomUUID();localStorage.setItem('hoho-demo-uid',uid);
 const listeners=new Set();
 const read=()=>JSON.parse(localStorage.getItem(key)||'null');
 const notify=()=>listeners.forEach(f=>f());
 const save=room=>{localStorage.setItem(key,JSON.stringify(room));notify();};
 window.addEventListener('storage',notify);onConnection('本機模擬連線');
 const pathGet=path=>{const room=read();return path.split('/').slice(1).reduce((x,k)=>x?.[k],room)??null;};
 const api={mode:'本機模擬 · 非多人連線',now:()=>Date.now(),uid:()=>uid,guest:async()=>{},login:async()=>{},logout:async()=>{},checkHost:async()=>true,get:async p=>pathGet(p),
 watch(p,fn){let last;const f=()=>{const value=pathGet(p),serialized=JSON.stringify(value);if(serialized!==last){last=serialized;fn(value);}};listeners.add(f);f();return()=>listeners.delete(f);},
 watchChat(id,fn){return api.watch(`room/chat/${id}/messages`,m=>fn(Object.fromEntries(Object.entries(m||{}).slice(-3))));},
 async create(){if(read()) throw Error('請先結束並清理目前房間。');save(newRoom('PARTY1'));},
 async join(code,name){const r=read();if(code!=='PARTY1')throw Error('目前是本機模擬模式，無法加入 Firebase 房間。請開啟主持頁提供的觀眾網址，移除 demo=1 並重新整理。');if(!r||r.public.state.code!==code)throw Error('模擬房間尚未建立。請在模擬主持頁建立 PARTY1 房間。');if(r.moderation?.[uid]?.removed)throw Error('你已被移出房間。');if(r.public.members?.[uid])return;if(r.public.state.locked||r.public.state.status==='ended'||Object.keys(r.public.members||{}).length>=20)throw Error('房間已鎖定或額滿。');r.public.members??={};r.public.members[uid]={name,code,seat:String(Array.from({length:20},(_,i)=>i).find(i=>!Object.values(r.public.members).some(m=>Number(m.seat)===i))),joined:Date.now()};save(r);},
 async answer(round,choice,prediction,attempt,revision=0){const r=read(),s=r?.public.state;const old=r?.answers?.[round]?.[uid];if(!answerEditable(r?.public,uid,old)||revision!==nextRevision(old)||old&&(old.choice===choice&&old.prediction===prediction))throw Error("答案已鎖定或沒有變更。");const first=targetFirst(s),target=s?.targetUid===uid,allowed=first&&target?s.status==='thinking'&&!r.answers?.[round]?.[uid]:s?.status==='open'&&Date.now()<s.deadline;if(!r?.public.members?.[uid]||!allowed||s.round!==round||(first&&attempt!==s.attempt))throw Error('本題已截止，答案未提交。');if(!Number.isInteger(choice)||choice<0||choice>3||!Number.isInteger(prediction)||(isSpotlight(s)&&s.targetUid===uid?prediction!==-1:prediction<0||prediction>3))throw Error('請完成本題選擇。');r.answers??={};r.answers[round]??={};r.answers[round][uid]={choice,prediction,revision,...(attempt!==undefined?{attempt}:{}),at:Date.now()};if(first&&target)activateGuesses(r,s,Date.now());save(r);return r.answers[round][uid];},
 async consent(expected){const r=read(),s=r?.public.state;if(!sameRound(s,expected)||s.status!=="open"||Date.now()>=s.deadline||!r.public.members?.[uid]||r.moderation?.[uid]?.removed||!r.answers?.[s.round]?.[uid]||!ballotMatches(r.public.earlyClose,s)||!r.public.earlyClose.ready||hasConsented(r.public,uid))throw Error("目前不能同意截止。");r.public.earlyClose.votes??={};r.public.earlyClose.votes[uid]={code:s.code,round:s.round,attempt:s.attempt||0,at:Date.now()};save(r);},
 async chat(text){const r=read();if(!r?.public.members?.[uid]||r.moderation?.[uid]?.muted||!r.public.state.chatOpen)throw Error('目前無法發言。');r.chat??={};const c=r.chat[uid]??={seq:0,messages:{},lastSent:0};if(Date.now()-c.lastSent<3000||text.length>240)throw Error('請隔三秒再發言，最多 240 字。');c.messages[++c.seq]={text,at:Date.now()};c.lastSent=Date.now();save(r);},
 async story(round,text){const r=read();if(!r?.public.members?.[uid]||r.moderation?.[uid]?.muted||r.public.state.status!=='revealed'||text.length>500)throw Error('現在不能投稿。');r.stories??={};r.stories[round]??={};r.stories[round][uid]={text,at:Date.now()};save(r);},
 async command(action,value){let r=read();if(!r)throw Error('請先建立房間。');const s=r.public.state;
 if(action==='prepareQuestions'||action==='startNext'){if(s.code!==value.expected?.code||s.round!==value.expected?.round)throw Error('房間或題目已變更，請確認目前進度。');const next=action==='startNext'?startNextQuestion(r,value,Date.now()):prepareQuestionPlan(r,value);if(!next)throw Error('題目已變更，請確認目前進度。');save(next);return;}
 if(action==='autoReveal'){const next=autoRevealRound(r,value,Date.now());if(next)save(next);return;}
 if(action==='relayEffects'){const next=relayEffects(r,value,Date.now());if(next)save(next);return;}
 if(action==='chatEffects'||action==='submitEffects'){s[action]=value;if(r.effects)delete r.effects[action==='chatEffects'?'chat':'submissions'];}
 if(action==='demoParticipants'){
  if(s.locked||s.status==='ended')throw Error('房間已鎖定。');r.public.members??={};
  for(let i=0;i<3;i++){const id=`demo-friend-${i}`;if(r.public.members[id])continue;const seat=Array.from({length:20},(_,n)=>n).find(n=>!Object.values(r.public.members).some(m=>Number(m.seat)===n));if(seat===undefined)break;r.public.members[id]={name:['示範小美','示範阿樂','示範琪琪'][i],code:s.code,seat:String(seat),joined:Date.now()+i,demo:true};}
 }
 if(action==='demoAnswers'){
  if(!['thinking','open'].includes(s.status)||(s.status==='open'&&Date.now()>=s.deadline))throw Error('請先開始一題，截止前才可補示範答案。');r.answers??={};const answers=r.answers[s.round]??={};
  for(const [id,m] of Object.entries(r.public.members||{}))if(m.demo&&!answers[id]&&(s.status!=='thinking'||id===s.targetUid))answers[id]={choice:(s.round+Number(m.seat))%4,prediction:id===s.targetUid?-1:0,...(targetFirst(s)?{attempt:s.attempt}:{}),at:Date.now()};
  if(s.status==='thinking')activateGuesses(r,s,Date.now());
 }
 if(action==='openGuesses'){const next=activateGuesses(r,value||s,Date.now());if(next)save(next);return;}
 if(action==='skipTarget'){const next=skipTarget(r,value||s);if(!next)throw Error('主角已提交或題目已變更，不能跳過。');save(next);return;}
 if(action==='configure')configureSpotlight(r,value);
 if(action==='start'){r.public.state=startRound(r,value,Date.now());delete r.public.story;}
 if(action==='close'&&sameRound(s,value||s)&&s.status==='open')s.status='closed';
 if(action==='extend'&&s.status==='open'&&s.deadline>Date.now())s.deadline+=15000;
 if(action==='migrate')r=allowRemovedMembersToRejoin(publishRevealedChoices(migrateAffinity(r)));
 if(action==='reveal'&&sameRound(s,value||s))r=settleRoom(r,s.round,s.code)||r;
 if(action==='end'){s.status='ended';s.locked=true;s.chatOpen=false;awardMasters(r);}
 if(action==='clean'){if(s.status!=='ended')throw Error('請先結束房間。');r=null;}
 if(action==='lock')s.locked=value;
 if(action==='chatOpen')s.chatOpen=value;
 if(action==='mute'){r.moderation??={};r.moderation[value.uid]??={};r.moderation[value.uid].muted=value.muted;if(value.muted&&r.effects?.chat)delete r.effects.chat[value.uid];}
 if(action==='remove')removeRoomMember(r,value,s.code);
 if(action==='deleteMessage'){delete r.chat[value.uid].messages[value.id];if(String(r.effects?.chat?.[value.uid]?.seq)===String(value.id))delete r.effects.chat[value.uid];}
 if(action==='selectStory')r.public.story=value;
 save(r);
 }};return api;
}
