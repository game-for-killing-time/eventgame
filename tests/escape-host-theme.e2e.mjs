// Exercise the production CSS chunks with simulated host responses, never mutate a live room.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createEscape,publicEscape} from '../functions/escape-engine.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/Nebula-Gary/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.env.ESCAPE_TEST_URL||'http://127.0.0.1:5198/';
const server=process.env.ESCAPE_TEST_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5198','--strictPort'],{windowsHide:true,stdio:'ignore'});
const out='test-results/escape-host-theme';await fs.mkdir(out,{recursive:true});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Users/Nebula-Gary/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1400,height:950}});let state=null;let replies=0;
 await context.route('https://hoho-escape.hoho-events.workers.dev/command',async route=>{replies++;await route.fulfill({json:{host:true,private:null,public:state?publicEscape(state):null,serverNow:Date.now()}});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function check(name){
  await page.goto(new URL('host.html?mode=voyage',base).href,{waitUntil:'domcontentloaded'});await page.locator('.host-desk').waitFor();
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
  const theme=await page.evaluate(()=>Object.fromEntries(['.host-desk','.host-welcome','.host-room','.question-picker h2'].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [selector,{background:s.backgroundColor,color:s.color}];})));
  assert.match(theme['.host-desk'].background,/rgba\(0, 0, 0, 0\.5/);assert.equal(theme['.host-welcome'].background,'rgba(0, 0, 0, 0)');assert.equal(theme['.host-room'].background,'rgba(0, 0, 0, 0)');assert.equal(theme['.question-picker h2'].color,'rgb(255, 248, 232)');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await check('before-create');state=createEscape('theme-test','THEME1',Date.now());state.players={p1:{name:'阿晴',seat:0,alive:true},p2:{name:'阿健',seat:1,alive:true},p3:{name:'阿樂',seat:2,alive:true}};await check('lobby');
 state.round=1;state.phase='choose';state.deadline=Date.now()+40000;state.escapeDeadline=Date.now()+1200000;await check('playing');
 await page.setViewportSize({width:390,height:844});await check('mobile');assert.deepEqual(errors,[]);assert.ok(replies>=4);
 console.log('PASS production build host theme: before create, lobby, playing and mobile; private backend responses mocked, no live room writes.');
}finally{await browser?.close();server?.kill();}
