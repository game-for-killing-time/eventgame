import './entry-shell.css';
import {initializeApp} from 'firebase/app';
import {getDatabase,ref,onValue,get,connectDatabaseEmulator} from 'firebase/database';
import {config} from '../config.js';
import {broadcastPath,selectedMode,entrySource} from './broadcast-model.js';
const role=document.body.dataset.entry,params=new URLSearchParams(location.search),root=document.querySelector('#entry-shell');
root.innerHTML='<p id="entry-status" role="status">正在連線到小島…</p><aside id="entry-switch" hidden><span></span><button type="button">進入目前模式</button></aside><iframe id="game-frame" title="'+(role==='display'?'直播展示':'玩家入口')+'" allow="autoplay; fullscreen" hidden></iframe>';
const frame=document.querySelector('#game-frame'),status=document.querySelector('#entry-status'),banner=document.querySelector('#entry-switch');let current=null,wanted=null,db=null;
async function show(mode){current=mode;banner.hidden=true;const q=new URLSearchParams(location.search);if(db){q.delete('room');try{const code=(await get(ref(db,mode==='voyage'?'voyage/public/code':'room/public/state/code'))).val();if(code)q.set('room',code);}catch{status.hidden=false;status.textContent='無法讀取房間，請稍後重新整理。';return;}}if(current!==mode)return;frame.src=entrySource(role,mode,q.toString());frame.hidden=false;status.hidden=true;}
function receive(value){wanted=selectedMode(value);if(!current||role==='display'){if(wanted!==current)show(wanted);}else{banner.hidden=wanted===current;banner.querySelector('span').textContent='主持人已切換至'+(wanted==='voyage'?'12 幕冒險':'選邊站')+'。你的目前畫面會保留，準備好後再進入。';}}
banner.querySelector('button').onclick=()=>show(wanted);
if(params.get('demo')==='1'||!config.firebase){show(params.get('mode')==='voyage'?'voyage':'classic');}
else{const testing=import.meta.env.DEV&&import.meta.env.VITE_STORY_EMULATOR==='1';const app=initializeApp(testing?{projectId:'demo-hoho',databaseURL:'https://demo-hoho.firebaseio.com'}:config.firebase,'entry-'+role);db=getDatabase(app);if(testing||config.emulators)connectDatabaseEmulator(db,'127.0.0.1',Number(import.meta.env.VITE_TEST_DB_PORT||9000));onValue(ref(db,broadcastPath),s=>receive(s.val()),()=>{status.hidden=false;status.textContent='暫時無法讀取展示模式，請檢查網絡後重新整理。';});}
