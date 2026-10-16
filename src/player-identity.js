import {initializeApp,getApps} from 'firebase/app';
import {getAuth,browserLocalPersistence,setPersistence,updateCurrentUser} from 'firebase/auth';
import {getDatabase,ref,onValue} from 'firebase/database';
import {broadcastPath} from './broadcast-model.js';

export function followSharedEntry(app,role){
 if(window.self!==window.top)return;
 onValue(ref(getDatabase(app),broadcastPath),snapshot=>{
  const session=snapshot.val();if(session?.version!==1||session.lease)return;
  const q=new URLSearchParams();if(session.code)q.set('room',session.code);
  location.replace('./'+(role==='display'?'display':'index')+'.html'+(q.size?'?'+q:''));
 });
}

// Both game engines use the original classic identity. Adopt an existing adventure
// identity only when this browser has never signed into the shared player app.
export async function restorePlayerIdentity(app,settings){
 const auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();
 if(!auth.currentUser){
  const legacy=getApps().find(x=>x.name==='story-player')||initializeApp(settings,'story-player');
  const old=getAuth(legacy);await setPersistence(old,browserLocalPersistence);await old.authStateReady();
  if(old.currentUser)await updateCurrentUser(auth,old.currentUser);
 }
 return auth;
}
