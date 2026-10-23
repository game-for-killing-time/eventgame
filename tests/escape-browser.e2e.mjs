// Real UI + deterministic engine transport. This does NOT replace emulator permission tests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createEscape,command,tick,publicEscape,privateEscape} from '../functions/escape-engine.js';
const pw=process.env.PLAYWRIGHT_MODULE||'C:/Users/Nebula-Gary/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(pw));
const base=process.env.ESCAPE_TEST_URL||'http://127.0.0.1:5187';
const server=process.env.ESCAPE_TEST_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5187','--strictPort'],{windowsHide:true,stdio:'ignore'});
let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready){server?.kill();throw Error('Local test server did not start');}
const out='test-results/escape';await fs.mkdir(out,{recursive:true});
let s=createEscape('ui-test','ESCAPE',Date.now());const rng={pick:0,twists:Array(96).fill(2)};
const errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Users/Nebula-Gary/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});
const pages={};
try{
 for(const [uid,role]of [['host','host'],['p0','player'],['p1','player'],['p2','player'],['p3','player'],['p4','player'],['display','display']]){
  const context=await browser.newContext({viewport:role==='player'?{width:390,height:844}:{width:1440,height:1000}});
  await context.route('**/src/escape-backend.js',route=>route.fulfill({contentType:'text/javascript',body:`export async function connectEscape(role,changed,failed){const uid=${JSON.stringify(uid)};async function call(action,payload={}){const r=await fetch('/__escape_test',{method:'POST',body:JSON.stringify({uid,action,...payload})});const d=await r.json();if(d.error)throw Error(d.error);changed({...d,now:()=>Date.now()});return d;}await call('sync');const timer=setInterval(()=>call('sync').catch(failed),250);return {call,login:()=>call('sync'),dispose:()=>clearInterval(timer)};}`}));
  await context.route('**/__escape_test',async route=>{const d=JSON.parse(route.request().postData());try{if(d.action!=='sync')command(s,{uid:d.uid,host:d.uid==='host'},{...d,game:s.id,round:s.round,revision:s.revision},Date.now(),rng);await route.fulfill({json:{public:publicEscape(s),private:privateEscape(s,d.uid,d.uid==='host'||d.uid==='display'),uid:d.uid,host:d.uid==='host'}});}catch(e){await route.fulfill({json:{error:e.message}});}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/story.html?role=${role}&code=ESCAPE`);pages[uid]=page;
 }
 for(const [uid,name]of [['p0','阿健'],['p1','阿晴'],['p2','阿樂'],['p3','小美'],['p4','阿明']]){await pages[uid].locator('#join [name=name]').fill(name);await pages[uid].locator('#join button').click();await pages[uid].locator('.identity h2').waitFor();}
 await pages.host.locator('#start button').click();
 for(const uid of ['p0','p1','p2','p3','p4'])await pages[uid].locator('#identity-dialog').waitFor();
 assert.match(await pages.p0.locator('#identity-dialog').innerText(),/你是狼人/);assert.equal(await pages.host.locator('.private-star').count(),0);assert.equal(await pages.display.locator('.private-star').count(),0);
 await pages.p0.screenshot({path:out+'/wolf-popup.png',fullPage:true});
 for(const uid of ['p0','p1','p2','p3','p4'])await pages[uid].locator('#identity-dialog button').click();
 await pages.p0.reload();await pages.p0.locator('.private-star').waitFor();assert.equal(await pages.p0.locator('#identity-dialog').count(),0);
 assert.equal(await pages.p1.locator('.private-star').count(),0);
 const advance=()=>tick(s,s.deadline);
 advance();
 for(const uid of ['p0','p1','p2','p3','p4']){await pages[uid].locator('#answer [name=route][value="0"]').check();await pages[uid].locator('#answer [name=choice][value="2"]').check();await pages[uid].locator('#answer button').click();await pages[uid].waitForFunction(()=>document.querySelector('#answer button')?.disabled===false);}
 advance();
 for(const uid of ['p0','p1','p2','p3','p4']){await pages[uid].getByText('必須提交最後決定',{exact:false}).waitFor();await pages[uid].locator('#answer [name=route][value="0"]').check();await pages[uid].locator('#answer [name=choice][value="2"]').check();await pages[uid].locator('#answer button').click();await pages[uid].waitForFunction(()=>document.querySelector('#answer button')?.disabled===false);}
 advance();advance();advance();advance(); // round 2 twist
 for(const uid of ['p0','p1','p2','p3','p4'])await pages[uid].getByRole('heading',{name:'穿過森林',exact:true}).waitFor();await pages.p0.locator('[name=kill]').waitFor();
 for(const uid of ['p0','p1','p2','p3','p4']){await pages[uid].locator('#answer [name=route][value="0"]').check();await pages[uid].locator('#answer [name=choice][value="'+(uid==='p2'?1:2)+'"]').check();if(uid==='p0')await pages[uid].locator('[name=kill]').selectOption('p2');await pages[uid].locator('#answer button').click();await pages[uid].waitForFunction(()=>document.querySelector('#answer button')?.disabled===false);}
 assert.equal(s.attack,'p2');assert.equal(s.phase,'twist');await pages.p0.screenshot({path:out+'/wolf-action.png',fullPage:true});advance();
 await pages.display.getByText('阿樂遭人殺害！',{exact:true}).first().waitFor();assert.equal(s.resources.battery,false);assert.equal(await pages.p2.locator('#answer').count(),0);
 const displayText=await pages.display.locator('body').innerText();assert.ok(!displayText.includes('兇手曾與'));assert.ok(!displayText.includes('狼人身份：'));await pages.display.screenshot({path:out+'/display-murder.png',fullPage:true});
 advance();advance();
 for(const uid of ['p0','p1','p3','p4']){await pages[uid].locator('#vote [name=target][value="'+(uid==='p0'?'p1':'p0')+'"]').check();await pages[uid].locator('#vote button').click();await pages[uid].waitForFunction(()=>document.querySelector('#vote button')?.disabled===false);}
 await pages.p1.screenshot({path:out+'/player-vote.png',fullPage:true});advance();
 await pages.display.getByRole('heading',{name:'狼人現形'}).waitFor();assert.equal(s.outcome,'caught');await pages.display.screenshot({path:out+'/display-ending.png',fullPage:true});
 for(const width of [360,390,430]){await pages.p1.setViewportSize({width,height:844});assert.equal(await pages.p1.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify({passed:true,transport:'mocked; engine real',outcome:s.outcome,errors},null,2));console.log('PASS: 7 browser contexts, popup, private star, reload, murder invalidation, secret ballot, caught ending, 360/390/430px');
}finally{await browser.close();server?.kill();}
