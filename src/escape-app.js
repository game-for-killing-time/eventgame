import './escape-style.css';
import {connectEscape} from './escape-backend.js';
import {esc,phases,publicPanel,historyPanel} from './escape-view.js';
import {escapeRole} from './story-routing.js';
const params=new URLSearchParams(location.search),role=escapeRole(location.search,document.body.dataset.role);
const root=document.getElementById('story-app')||document.getElementById('app');
let rt={public:null,private:null,uid:null,host:false,now:()=>Date.now()},api,error='',signature='',draftKey='',draft={},sending=false;
const link=r=>`story.html?role=${r}${r==='player'&&rt.public?'&code='+rt.public.code:''}`;
const button=(action,text)=>`<button type="button" data-command="${action}" ${sending?'disabled':''}>${text}</button>`;
function choices(name,options,selected){return options.map(([value,text])=>`<label class="choice"><input type="radio" name="${name}" value="${esc(value)}" ${String(selected)===String(value)?'checked':''} required><span>${esc(text)}</span></label>`).join('');}
function playerPanel(s){
 if(!s)return '';
 const p=s.players?.[rt.uid],mine=rt.private;
 if(!p)return s.phase==='lobby'?'<form id="join" class="controls"><h2>加入生還者</h2><label>房間碼<input name="code" autocomplete="off" maxlength="6" required value="'+esc(params.get('code')||'')+'"></label><label>你的名字<input name="name" autocomplete="nickname" maxlength="20" required></label><button>加入遊戲</button></form>':'<p class="notice">遊戲已開始，你可以觀看公開進度。</p>';
 const wolf=mine?.role==='wolf';
 let html=`<section class="personal"><div class="identity"><div class="portrait">${wolf?'<span class="private-star" aria-label="只有你可見的狼人記號">★</span>':''}<img src="./art/characters/${p.seat%10}.png" alt=""></div><div><h2>${esc(p.name)}</h2><p>${p.alive?'你的行動':'你已出局，只能觀戰'}${wolf?' · 狼人（僅自己可見）':''}</p></div></div>`;
 if(!p.alive||s.phase==='ended'||s.phase==='lobby'||s.pausedAt!==null)return html+'</section>';
 if(['choose','twist'].includes(s.phase)){
  const final=s.phase==='twist',saved=final?mine?.final:mine?.first;
  const allowed=final?s.twist.allowed:[0,1];
  html+=`<form id="answer"><fieldset><legend>你要走哪一條路？</legend>${choices('route',s.routes.map((name,i)=>[i,name]).filter(([i])=>allowed.includes(i)),draft.route??saved?.route)}</fieldset><fieldset><legend>抵達後，你要做甚麼？</legend>${choices('choice',s.actions.map((text,i)=>[i,text]),draft.choice??saved?.action)}</fieldset>`;
  if(final&&wolf){html+=`<fieldset class="secret"><legend>狼人秘密行動 · 只有你可見</legend><p>每輪最多殺一人。只能襲擊最後與你走同一路線的人；若對方改道，襲擊落空。死者本輪行動無效。</p><label>下手目標<select name="kill"><option value="">暫不下手</option>${Object.entries(s.players).filter(([id,p])=>id!==rt.uid&&p.alive).map(([id,p])=>`<option value="${esc(id)}" ${(draft.kill??mine?.kill)===id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></fieldset>`;}
  html+=`<button ${sending?'disabled':''}>${saved?'更新我的決定':'確認我的決定'}</button><p class="hint">${final?'必須提交最後決定；未提交便不執行探索，也不發動襲擊。未改道時沿用仍開放的初選路線，否則走第一條可通行路線；未提交仍可能遇襲。':'小變化公布後，你還要確認一次最終行動。'}截止前可以修改。</p></form>`;
 }else if(s.phase==='vote'){
  const options=Object.entries(s.players).filter(([id,p])=>id!==rt.uid&&p.alive&&(!s.runoff||s.candidates.includes(id))).map(([id,p])=>[id,p.name]);options.push(['','棄票']);
  html+=`<form id="vote"><fieldset><legend>${s.runoff?'同票決選：誰是狼人？':'你認為誰是狼人？'}</legend>${choices('target',options,draft.target??mine?.vote)}</fieldset><button ${sending?'disabled':''}>確認秘密投票</button><p class="hint">截止後一起公布票數。唯一最高票者出局；再同票則無人出局。</p></form>`;
 }else html+=`<p>${s.phase==='discuss'?'先看公開紀錄，再與其他生還者討論；討論結束後秘密投票。':'請閱讀公共故事，等待下一階段。'}</p>`;
 return html+'</section>';
}
function hostPanel(s){
 if(!rt.host)return '<form id="login" class="controls"><h2>主持登入</h2><label>電郵<input type="email" name="email" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label><button>登入</button></form>';
 let html='<section class="controls"><h2>主持控制</h2><p>你只能查看公開資訊，無法讀取身份、襲擊目標或未揭曉的選票。</p>';
 if(!s||s.phase==='ended')html+=button('create','建立新逃生房間');
 if(s?.phase==='lobby')html+='<form id="start"><label>撤離總時限（分鐘）<input name="minutes" type="number" min="5" max="120" value="20" required></label><p>至少 3 人；3 人局首次命案就可能觸發反殺，建議 5 人以上。</p><button>抽選身份並開始</button></form>';
 if(s&&s.phase!=='ended'&&s.phase!=='lobby')html+=button('pause',s.pausedAt!==null?'繼續遊戲':'暫停遊戲')+(!['choose','twist','vote'].includes(s.phase)&&s.pausedAt===null?button('advance','繼續下一階段'):'');
 if(s&&s.phase!=='ended')html+='<details><summary>結束本場</summary><p>提前結束不判勝負，並會揭曉狼人。</p>'+button('end','結束遊戲並揭曉身份')+'</details>';
 return html+'</section>';
}
function showRole(){
 const mine=rt.private,s=rt.public;const existing=document.querySelector('#identity-dialog');if(existing&&(existing.dataset.game!==s?.id||s?.phase==='ended'))existing.remove();if(role!=='player'||!mine?.role||s?.phase==='ended')return;
 const key='escape-role-'+s.id+'-'+rt.uid;if(sessionStorage.getItem(key)||document.querySelector('#identity-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='identity-dialog';dialog.dataset.game=s.id;const wolf=mine.role==='wolf';
 dialog.innerHTML=`<h2>${wolf?'你是狼人':'你是生還者'}</h2><p>${wolf?'你要阻止其他玩家在限時內離島。每輪可秘密襲擊一名同行者，也可不下手。你照常選路和探索。':'找出狼人，或完成求救並離島。第一次命案後，每輪都會投票。'}</p><p>${wolf?'你的星號只有自己看得到。只剩你與一名普通玩家時，對方會反殺，你會落敗。':'只剩你與狼人時，你會反殺獲勝。'}</p><button autofocus>我知道了</button>`;
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{sessionStorage.setItem(key,'1');dialog.remove();});document.body.append(dialog);dialog.showModal();
}
function render(force=false){
 const s=rt.public,key=`${s?.id}/${s?.round}/${s?.revision}/${rt.uid}`;if(key!==draftKey){draftKey=key;draft={};}
 const next=JSON.stringify([s,rt.private,rt.host,error,sending]);if(!force&&signature===next){showRole();return;}signature=next;
 // Preserve typed lobby/login forms across incoming public roster changes.
 const form=root.querySelector('#join,#login,#start');const fields=form?Object.fromEntries(new FormData(form)):null;const oldForm=form?.id;
 root.className='escape-app '+(role==='display'?'display':'');
 root.innerHTML=`<header><a class="brand" href="${esc(link(role))}">墜機之後<span>荒島逃生 × 秘密狼人</span></a><div class="clock"><span>${s?.phase==='lobby'?'房間碼':'撤離倒數'}</span><strong id="escape-clock">${s?.phase==='lobby'?esc(s.code):'—'}</strong><small id="phase-clock"></small></div></header>${error?`<p role="alert" class="error">${esc(error)}</p>`:''}${role==='host'?hostPanel(s):''}${role==='player'?playerPanel(s):''}${publicPanel(s)}${historyPanel(s)}<footer>${role==='host'?`<a href="${link('player')}" target="_blank" rel="noopener">玩家入口</a><a href="${link('display')}" target="_blank" rel="noopener">開啟 display</a>`:''}<span>先找設備，再發求救，最後離島。</span></footer>`;
 if(fields&&oldForm)for(const [name,value]of Object.entries(fields)){const input=root.querySelector(`#${oldForm} [name="${name}"]`);if(input)input.value=value;}
 root.querySelectorAll('#answer input,#answer select,#vote input').forEach(el=>el.addEventListener('change',()=>{draft[el.name]=el.value;}));
 root.querySelectorAll('[data-command]').forEach(el=>el.onclick=()=>perform(()=>api.call(el.dataset.command)));
 for(const id of ['join','login','start','answer','vote']){const f=root.querySelector('#'+id);if(f)f.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));perform(()=>id==='login'?api.login(d.email,d.password):api.call(id==='answer'?'answer':id,id==='start'?{minutes:Number(d.minutes)}:id==='answer'?{route:Number(d.route),choice:Number(d.choice),kill:d.kill||null}:id==='vote'?{target:d.target||null}:d));};}
 updateClocks();showRole();
}
function updateClocks(){const s=rt.public;if(!s||s.phase==='lobby')return;const now=s.pausedAt??rt.now();const fmt=end=>{const n=Math.max(0,Math.ceil((end-now)/1000));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};const a=root.querySelector('#escape-clock'),b=root.querySelector('#phase-clock');if(a)a.textContent=s.phase==='ended'?'已結束':fmt(s.escapeDeadline);if(b)b.textContent=s.phase==='ended'?'':`${phases[s.phase]} ${fmt(s.deadline)}`;}
async function perform(fn){if(sending)return;sending=true;error='';render();try{await fn();}catch(e){error=e.message;}finally{sending=false;render();}}
render();
try{api=await connectEscape(role,state=>{rt=state;render();},e=>{error=e.code==='functions/not-found'?'多人逃生服務尚未部署。請完成伺服器部署後再建立房間。':e.message;render();});}catch(e){error=e.message;render();}
setInterval(updateClocks,1000);
