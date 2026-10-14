// Compile the Firebase path as well as the default demo. No network services are used.
import {build} from 'vite';
import {resolve} from 'node:path';
const configPath=resolve('config.js').replaceAll('\\','/');
const result=await build({logLevel:'warn',base:'./',plugins:[{name:'test-public-config',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/')===configPath)return `export const config={firebase:{apiKey:'demo-key',authDomain:'demo-hoho.firebaseapp.com',databaseURL:'https://demo-hoho-default-rtdb.firebaseio.com',projectId:'demo-hoho',appId:'demo-app'},twitchUrl:'https://www.twitch.tv/',emulators:false};`;}}],build:{write:false}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output);
if(!outputs.some(x=>x.type==='chunk'&&Object.keys(x.modules).some(k=>k.includes('@firebase/database'))))throw Error('Firebase adapter was not included in test build');
console.log('Firebase production code path: build passed (no service connection).');
