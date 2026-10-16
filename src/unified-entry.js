import './entry-shell.css';
import {initializeApp} from 'firebase/app';
import {getDatabase,ref,onValue,get,connectDatabaseEmulator} from 'firebase/database';
import {config} from '../config.js';
import {broadcastPath,selectedMode,entrySource} from './broadcast-model.js';
import {initialEntryMode,roomCodePath} from './player-routing.js';
const role=document.body.dataset.entry,params=new URLSearchParams(location.search),root=document.querySelector('#entry-shell');
root.innerHTML='<p id="entry-status" role="status">正在連線到小島…</p><aside id="entry-switch" hidden><span></span><button type="button">進入目前模式</button></aside><iframe id="game-frame" title="'+(role==='display'?'直播展示':'玩家入口')+'" allow="autoplay; fullscreen" hidden></iframe>';
const frame=document.querySelector('#game-frame'),status=document.querySelector('#entry-status'),banner=document.querySelector('#entry-switch');let current=null,wanted=null,db=null,revision=0;
const read=async path=>(await get(ref(db,path))).val();
function updateBanner(){banner.hidden=role==='display'||wanted===current;banner.querySelector('span').textContent='主持人目前展示'+(wanted==='voyage'?'12 幕冒險':'選邊站')+'。你的目前畫面會保留，準備好後再進入。';}
async function show(mode,{preserveRoom=false,request=++revision}={}){
 const q=new URLSearchParams(location.search);
 if(!preserveRoom)q.delete('room');
 try{
  if(db&&!q.has('room')){const code=await read(roomCodePath(mode));if(code)q.set('room',code);}
  if(request!==revision)return;
  current=mode;frame.src=entrySource(role,mode,q.toString());frame.hidden=false;status.hidden=true;updateBanner();
 }catch{if(request===revision){status.hidden=false;status.textContent='無法讀取房間，請稍後重新整理。';}}
}
async function receive(value){
 wanted=selectedMode(value);
 if(!current){const request=++revision;try{const mode=await initialEntryMode({role,search:location.search,broadcast:value,get:read});if(request===revision)await show(mode,{preserveRoom:role==='player',request});}catch{if(request===revision){status.hidden=false;status.textContent='無法讀取房間，請稍後重新整理。';}}}
 else if(role==='display'){if(wanted!==current)show(wanted);else revision++;}
 else updateBanner();
}
banner.querySelector('button').onclick=()=>show(wanted);
if(params.get('demo')==='1'||!config.firebase){wanted=params.get('mode')==='voyage'?'voyage':'classic';show(wanted,{preserveRoom:true});}
else{const testing=import.meta.env.DEV&&import.meta.env.VITE_STORY_EMULATOR==='1',project=import.meta.env.VITE_TEST_PROJECT||'demo-hoho';const app=initializeApp(testing?{projectId:project,databaseURL:`https://${project}.firebaseio.com`}:config.firebase,'entry-'+role);db=getDatabase(app);if(testing||config.emulators)connectDatabaseEmulator(db,'127.0.0.1',Number(import.meta.env.VITE_TEST_DB_PORT||9000));onValue(ref(db,broadcastPath),s=>receive(s.val()),()=>{status.hidden=false;status.textContent='暫時無法讀取展示模式，請檢查網絡後重新整理。';});}
