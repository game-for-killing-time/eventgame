import {DurableObject} from 'cloudflare:workers';
import {verifyIdentity} from './auth.js';
import {createEscape,command,publicEscape,privateEscape,tick,normalize} from '../functions/escape-engine.js';
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const random=n=>{const a=new Uint32Array(1),limit=0x100000000-0x100000000%n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;};
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN;
  const cors=origin===allowed?{'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, GET, OPTIONS'}:{};
  if(origin&&origin!==allowed)return json({error:'來源不獲允許。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const url=new URL(request.url);
  if(url.pathname==='/health')return json({service:'hoho-escape',version:1,storage:'sqlite-durable-object'},200,cors);
  if(url.pathname!=='/command'||request.method!=='POST')return json({error:'找不到此操作。'},404,cors);
  if(!env.HOST_UID||env.HOST_UID==='CONFIGURE_BEFORE_DEPLOY')return json({error:'主持尚未設定。'},503,cors);
  if(Number(request.headers.get('Content-Length'))>8192)return json({error:'請求太長。'},413,cors);
  try{
   const bearer=request.headers.get('Authorization')||'';if(!bearer.startsWith('Bearer '))return json({error:'請先登入。'},401,cors);
   let actor;try{actor=await verifyIdentity(bearer.slice(7),env.FIREBASE_PROJECT);}catch{return json({error:'登入已過期，請重新登入。'},401,cors);}
   const text=await request.text();if(text.length>8192)return json({error:'請求太長。'},413,cors);
   let data;try{data=JSON.parse(text);}catch{return json({error:'操作格式不正確。'},400,cors);}
   if(!data||typeof data.action!=='string')return json({error:'操作無效。'},400,cors);
   // The public endpoint never trusts a caller-supplied UID or host flag.
   actor.host=actor.uid===env.HOST_UID&&actor.provider!=='anonymous';actor.hostAccount=actor.uid===env.HOST_UID;
   const room=env.GAME.get(env.GAME.idFromName('main'));
   const result=await room.dispatch(actor,data);
   return json(result,result.error?400:200,cors);
  }catch{return json({error:'服務暫時未能完成操作，請稍後重試。'},503,cors);}
 }
};
export class EscapeRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS game (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)');this.lastRequests=new Map();}
 read(){const row=this.sql.exec('SELECT state FROM game WHERE id=1').toArray()[0];return row?normalize(JSON.parse(row.state)):null;}
 write(s){this.sql.exec('INSERT INTO game(id,state) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state',JSON.stringify(s));}
 schedule(s){if(!s||s.phase==='lobby'||s.phase==='ended'||s.pausedAt!==null)return this.ctx.storage.deleteAlarm();return this.ctx.storage.setAlarm(Math.max(Date.now()+100,Math.min(s.deadline,s.escapeDeadline)));}
 async dispatch(actor,data){
  const now=Date.now();
  // Allow a poll and a player action together, while limiting sustained bursts.
  const prior=this.lastRequests.get(actor.uid);
  const bucket=prior&&now-prior.start<10000?prior:{start:now,count:0};
  if(++bucket.count>30)return {error:'操作太快，請稍候。'};
  this.lastRequests.set(actor.uid,bucket);if(this.lastRequests.size>500)this.lastRequests.clear();
  let s=this.read();const before=s?JSON.stringify(s):'';let error;
  if(s&&data.action!=='create')tick(s,now);
  try{
   if(data.action==='create'){
    if(!actor.host)throw Error('只有主持可以建立房間。');
    if(s&&s.phase!=='ended')throw Error('請先結束目前遊戲。');
    if(s&&data.game!==s.id)throw Error('房間已更新。');
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';s=createEscape(crypto.randomUUID(),Array.from({length:6},()=>alphabet[random(alphabet.length)]).join(''),now);
   }else if(data.action!=='sync'){
    if(!s)throw Error('主持尚未建立房間。');
    if(data.action==='join'&&actor.hostAccount)throw Error('主持帳號不能同時參與秘密身份遊戲。');
    const candidate=structuredClone(s);
    command(candidate,actor,data,now,{pick:random(2147483647),twists:Array.from({length:96},()=>random(3))});s=candidate;
   }
  }catch(e){error=e.message;}
  // No await before this write: each actor command is atomic in the Object.
  const changed=s&&JSON.stringify(s)!==before;if(changed)this.write(s);
  const response={public:s?publicEscape(s):null,private:s?privateEscape(s,actor.uid,actor.hostAccount):null,host:actor.host,serverNow:now,...(error?{error}:{})};
  if(changed)await this.schedule(s);return response;
 }
 async alarm(){const s=this.read();if(!s)return;if(tick(s,Date.now()))this.write(s);await this.schedule(s);}
}
