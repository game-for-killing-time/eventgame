import {initializeApp} from 'firebase/app';
import {getAuth,signInAnonymously,signInWithEmailAndPassword,setPersistence,browserLocalPersistence,connectAuthEmulator} from 'firebase/auth';
import {getDatabase,ref,onValue,connectDatabaseEmulator} from 'firebase/database';
import {getFunctions,httpsCallable,connectFunctionsEmulator} from 'firebase/functions';
import {config} from '../config.js';
import {escapeWorkerUrl} from './escape-config.js';
export async function connectEscape(role,changed,failed){
 const emulated=import.meta.env.DEV&&import.meta.env.VITE_ESCAPE_EMULATOR==='1';
 const settings=emulated?{apiKey:'demo-key',projectId:'demo-hoho',databaseURL:'https://demo-hoho.firebaseio.com'}:config.firebase;
 if(!settings)throw Error('尚未設定多人遊戲連線。');
 const app=initializeApp(settings,role==='host'?'escape-host':'escape-'+role),auth=getAuth(app),db=getDatabase(app),fn=getFunctions(app,'asia-east1');
 if(emulated||config.emulators){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectDatabaseEmulator(db,'127.0.0.1',9000);connectFunctionsEmulator(fn,'127.0.0.1',5001);}
 await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();
 if(!auth.currentUser)await signInAnonymously(auth);
 const useWorker=!emulated&&!config.emulators;
 if(useWorker&&!escapeWorkerUrl)throw Error('免費狼人服務尚未部署。請稍後再試。');
 const callable=httpsCallable(fn,'escapeCommand');let publicState=null,privateState=null,isHost=false,offset=0,busy=false;
 const normalizePublic=s=>s?{...s,pausedAt:s.pausedAt??null,players:s.players||{},resources:s.resources||{},history:s.history||[],lines:s.lines||[],firstRoutes:s.firstRoutes||[],candidates:s.candidates||[],voteLines:s.voteLines||[]}:null;
 const notify=()=>changed({public:publicState,private:privateState,host:isHost,uid:auth.currentUser?.uid,now:()=>Date.now()+offset});
 async function call(action,payload={}){
  const data={action,game:publicState?.id,round:publicState?.round,revision:publicState?.revision,...payload};
  let result;
  if(useWorker){
   const send=async refresh=>fetch(escapeWorkerUrl+'/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await auth.currentUser.getIdToken(refresh)},body:JSON.stringify(data),cache:'no-store'});
   let response=await send(false);if(response.status===401)response=await send(true);result=await response.json();
   if(!response.ok||result.error)throw Error(result.error||'暫時無法連線，請稍後重試。');
  }else result=(await callable(data)).data;
  offset=result.serverNow-Date.now();publicState=normalizePublic(result.public);privateState=result.private;isHost=result.host;notify();return result;
 }
 // Public snapshots contain neither roles nor unpublished choices/ballots.
 const stop=useWorker?()=>{}:onValue(ref(db,'escapeGame/public'),snap=>{publicState=normalizePublic(snap.val());if(privateState?.game!==publicState?.id)privateState=null;notify();},failed);
 const poll=async()=>{if(busy)return;busy=true;try{await call('sync');}catch(e){failed(e);}finally{busy=false;}};
 await poll();const timer=setInterval(poll,3000);
 return {call,login:async(email,password)=>{await signInWithEmailAndPassword(auth,email,password);await poll();},dispose:()=>{stop();clearInterval(timer);}};
}
