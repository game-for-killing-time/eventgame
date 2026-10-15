import {config} from '../config.js';
import {initializeApp} from 'firebase/app';
import * as A from 'firebase/auth';
import * as D from 'firebase/database';
export async function voyageConnect(role,connection){
 if(!config.firebase)throw Error('尚未設定 Firebase');
 const testing=import.meta.env.DEV&&import.meta.env.VITE_STORY_EMULATOR==='1';
 const settings=testing?{apiKey:'demo-key',projectId:'demo-hoho',databaseURL:'https://demo-hoho.firebaseio.com'}:config.firebase;
 const app=initializeApp(settings,`story-${role}`),auth=A.getAuth(app),db=D.getDatabase(app);
 if(config.emulators||testing){A.connectAuthEmulator(auth,'http://127.0.0.1:9099');D.connectDatabaseEmulator(db,'127.0.0.1',9000);}
 await A.setPersistence(auth,role==='display'?A.inMemoryPersistence:A.browserLocalPersistence);await auth.authStateReady();
 let online=false,offset=0;D.onValue(D.ref(db,'.info/connected'),s=>{online=s.val()===true;connection(online);});D.onValue(D.ref(db,'.info/serverTimeOffset'),s=>offset=s.val()||0);
 const ref=p=>D.ref(db,p),get=async p=>(await D.get(ref(p))).val(),ready=()=>{if(!online)throw Error('目前離線，請重連後操作。');};
 const api={uid:()=>auth.currentUser?.uid,now:()=>Date.now()+offset,watch:(p,fn,err)=>D.onValue(ref(p),s=>fn(s.val()),err),get,
  async host(){return !!auth.currentUser&&!auth.currentUser.isAnonymous&&(await get('config/hostUid'))===auth.currentUser.uid;},
  async login(email,password){await A.signInWithEmailAndPassword(auth,email,password);if(!await api.host())throw Error('此帳號不是指定主持人。');},async logout(){await A.signOut(auth);},
  async guest(){if(!auth.currentUser)await A.signInAnonymously(auth);},
  async create(pack){ready();const {createVoyage}=await import('./voyage-remote-model.js');const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');const room=createVoyage(code,api.now(),pack);const res=await D.runTransaction(ref('voyage'),r=>r?undefined:room,{applyLocally:false});if(!res.committed)throw Error('已有故事房間，請先結束並清理。');},
  async command(action,value,expected){ready();const {remoteCommand,fingerprint}=await import('./voyage-remote-model.js');let changed=false;const result=await D.runTransaction(ref('voyage'),r=>{if(!r)return null;const before=fingerprint(r),next=remoteCommand(r,action,value,expected,api.now());if(next===undefined)return;if(action==='sync'&&before===fingerprint(next))return;changed=true;return next;},{applyLocally:false});if(!result.committed&&action!=='sync')throw Error('房間狀態已更新，請再確認。');return changed;},
  async join(code,name){ready();await api.guest();name=name.trim();if(!name||name.length>20)throw Error('暱稱需為 1–20 字');for(let n=0;n<20;n++){const p=await get('voyage/public');if(!p||p.code!==code.trim().toUpperCase())throw Error('房間碼不正確');if(p.players?.[api.uid()])return;if(p.phase==='ended'||p.locked)throw Error('房間已結束或鎖定');const seats=await get('voyage/seats')||{},seat=Array.from({length:20},(_,i)=>String(i)).find(i=>!seats[i]);if(seat===undefined)throw Error('房間已滿');try{await D.update(ref('voyage'),{[`roster/${api.uid()}`]:{name,seat,game:p.id,at:D.serverTimestamp()},[`seats/${seat}`]:api.uid()});return;}catch(e){if(n===19)throw e;}}},
  async send(kind,payload,pub){ready();if(!api.uid())throw Error('請先加入');const path=`inputs/${kind}/${pub.round}/${api.uid()}`;await D.set(ref(`voyage/${path}`),{...payload,game:pub.id,at:D.serverTimestamp()});},
  async quote(pub,round,value){ready();await D.set(ref(`voyage/quoteConsent/${round}/${api.uid()}`),{game:pub.id,share:value});},
  async share(pub,value){ready();await D.set(ref(`voyage/consent/${api.uid()}`),{game:pub.id,share:value});},
  watchChat(uid,fn,err){return D.onValue(D.query(ref(`voyage/chat/${uid}/messages`),D.orderByChild('at'),D.limitToLast(3)),s=>fn(s.val()),err);},
  async chat(text,pub){ready();const seq=(await get(`voyage/chat/${api.uid()}/seq`)||0)+1;await D.update(ref(`voyage/chat/${api.uid()}`),{seq,lastSent:D.serverTimestamp(),[`messages/${seq}`]:{text,at:D.serverTimestamp(),game:pub.id}});}
 };
 if(role==='player')await api.guest();return api;
}

