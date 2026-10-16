import {voyageConnect} from './voyage-online-backend.js';
import {islandLayout} from './affinity.js';
// Only whitelisted public data and this viewer's inbox enter the player/display state.
export async function startVoyageOnline(role,changed,failed){
 const rt={uid:'',state:null,hostReady:false,online:false,loading:true,moderation:{}};
 let api,pub=null,inbox=null,host=null,roster=null,consent={},quoteConsent={},hidden={},quotes={},cards={},chat={},stops=[],privateStops=[],key='',syncing=false,again=false,timer;
 const sharedStops=new Map(),chatStops=new Map();
 const fail=e=>failed(e);
 function state(){if(!pub){rt.state=null;changed();return;}
  const base={...pub,players:structuredClone(pub.players||{}),routes:{},first:{},second:{},history:[],shared:{},hidden:{},chat:[],cast:pub.cast||[],affinity:{pairs:{},rounds:{}},results:{},island:pub.island||islandLayout(),currentQuestion:pub.currentQuestion||null,ending:undefined};
  base.island.positions??={};for(const p of Object.values(base.players)){p.events=[];p.traits={};}
  if(inbox?.game===pub.id&&base.players[rt.uid]){base.players[rt.uid]={...inbox.player,events:inbox.player?.events||[],traits:inbox.player?.traits||{}};if(inbox.round===pub.round){if(inbox.first)base.first[rt.uid]=inbox.first;if(inbox.second)base.second[rt.uid]=inbox.second;base.routes[rt.uid]=inbox.route||'';}}
  for(const [id,c]of Object.entries(consent))if(c.game===pub.id)base.shared[id]=c.share;
  for(const e of base.players[rt.uid]?.events||[]){const c=quoteConsent[e.round]?.[rt.uid];if(c?.game===pub.id)e.consent=c.share;}
  base.chat=Object.entries(chat).flatMap(([id,m])=>Object.entries(m||{}).map(([message,c])=>({...c,id,message,name:pub.players?.[id]?.name||'島民'}))).sort((a,b)=>a.at-b.at).slice(-40);
  base.view={...pub.view,lines:pub.view?.lines||[],follow:pub.view?.follow||[],quotes:Object.entries(quotes).map(([id,q])=>({id,...q})),cards:Object.values(cards),guessResult:pub.view?.guessResult?{...pub.view.guessResult,choice:pub.view.guessResult.choice??null,wrong:pub.view.guessResult.wrong??null,rows:pub.view.guessResult.rows||[]}:null};
  if(host&&rt.hostReady){rt.state={...host.hostOnly,code:pub.code,submitted:pub.submitted,locked:pub.locked,chatOpen:pub.chatOpen,view:base.view,chat:base.chat};for(const k of ['first','second','routes','shared','turns','results'])rt.state[k]??={};rt.state.players??={};rt.state.affinity??={pairs:{}};rt.state.affinity.pairs??={};rt.state.island.positions??={};for(const p of Object.values(rt.state.players||{})){p.events??=[];p.traits??={};}rt.state.moderation=host.moderation||{};}else rt.state=base;
  changed();
 }
 function sync(){if(!rt.hostReady||!rt.online)return;if(syncing){again=true;return;}if(timer)return;timer=setTimeout(async()=>{timer=null;syncing=true;try{await api.command('sync');}catch(e){fail(e);}finally{syncing=false;if(again){again=false;sync();}}},120);}
 function subscriptions(){
  const next=`${pub?.id||''}/${pub?.round||0}`;
  if(next!==key){key=next;privateStops.forEach(f=>f());privateStops=[];inbox=null;quotes={};cards={};for(const f of sharedStops.values())f();sharedStops.clear();
   if(role==='player'&&rt.uid&&pub&&roster&&roster.game===pub.id)privateStops.push(api.watch(`voyage/inbox/${rt.uid}`,x=>{inbox=x;state();},fail));
  }
  const wanted=new Map();
  if(pub&&['discussion','ended'].includes(pub.phase))for(const [id,c]of Object.entries(quoteConsent[pub.round]||{}))if(c.share&&c.game===pub.id&&pub.players?.[id]&&!hidden[pub.round]?.[id])wanted.set(`q/${id}`,`voyage/quotes/${pub.round}/${id}`);
  if(pub?.phase==='ended')for(const [id,c]of Object.entries(consent))if(c.share&&c.game===pub.id&&pub.players?.[id])wanted.set(`c/${id}`,`voyage/sharedCards/${id}`);
  for(const [k,stop]of sharedStops)if(!wanted.has(k)){stop();sharedStops.delete(k);delete (k.startsWith('q/')?quotes:cards)[k.slice(2)];}
  for(const [k,path]of wanted)if(!sharedStops.has(k))sharedStops.set(k,api.watch(path,x=>{const group=k.startsWith('q/')?quotes:cards;if(x)group[k.slice(2)]=x;else delete group[k.slice(2)];state();},()=>{delete (k.startsWith('q/')?quotes:cards)[k.slice(2)];state();}));
  const ids=role==='display'||(!rt.hostReady&&!pub?.players?.[rt.uid])||rt.moderation.removed?[]:Object.keys(pub?.players||{});
  for(const [id,stop]of chatStops)if(!ids.includes(id)){stop();chatStops.delete(id);delete chat[id];}
  for(const id of ids)if(!chatStops.has(id))chatStops.set(id,api.watchChat(id,x=>{chat[id]=x||{};state();},()=>{delete chat[id];state();}));
 }
 function hostWatch(){stops.push(api.watch('voyage',r=>{host=r;sync();state();},fail));}
 api=await voyageConnect(role,x=>{rt.online=x;changed();});rt.uid=api.uid();
 rt.now=api.now;rt.expected=()=>pub?{id:pub.id,round:pub.round,phase:pub.phase}:null;
 rt.login=async(email,password)=>{await api.login(email,password);rt.uid=api.uid();rt.hostReady=true;hostWatch();subscriptions();state();};
 rt.logout=async()=>{stops.forEach(f=>f());await api.logout();location.reload();};
 rt.create=()=>api.create();rt.command=(action,value)=>api.command(action,value,rt.expected());
 rt.join=async(code,name)=>{await api.join(code,name);rt.uid=api.uid();};
 rt.send=(kind,data)=>api.send(kind,data,pub);rt.quote=(round,value)=>api.quote(pub,round,value);rt.share=value=>api.share(pub,value);rt.chat=text=>api.chat(text,pub);
 rt.export=()=>host;
 if(role==='host'){rt.hostReady=await api.host();if(rt.hostReady)hostWatch();}
 if(role==='player'){
  stops.push(api.watch(`voyage/roster/${rt.uid}`,x=>{roster=x;key='';subscriptions();state();},fail));
  stops.push(api.watch(`voyage/moderation/${rt.uid}`,x=>{rt.moderation=x||{};if(x?.removed){inbox=null;privateStops.forEach(f=>f());privateStops=[];}subscriptions();state();},fail));
 }
 stops.push(api.watch('voyage/public',x=>{pub=x;rt.loading=false;subscriptions();state();},e=>{rt.loading=false;fail(e);}));
 for(const [path,set]of [['consent',x=>consent=x||{}],['quoteConsent',x=>quoteConsent=x||{}],['hidden',x=>hidden=x||{}]])stops.push(api.watch(`voyage/${path}`,x=>{set(x);subscriptions();state();},fail));
 return rt;
}
