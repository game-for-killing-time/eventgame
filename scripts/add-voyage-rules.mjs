import {readFileSync,writeFileSync} from 'node:fs';
const all=JSON.parse(readFileSync('database.rules.json','utf8'));
// Preserve the original game and 18-scene adventure rules verbatim.
const base=JSON.stringify(all.rules.adventure).replaceAll('adventure','voyage');
const v=JSON.parse(base),H=all.rules.adventure['.write'],R="root.child('voyage')",P=`${R}.child('public')`,M=`${R}.child('roster').child($uid)`;
const own='auth != null && auth.uid === $uid',member=`${own} && ${M}.exists() && ${R}.child('moderation').child($uid).child('removed').val() !== true`;
const valid=x=>`(${H}) || (${x})`;
const shape=(required,fields)=>({'.validate':valid(`newData.hasChildren(${JSON.stringify(required)})`),...Object.fromEntries(Object.entries(fields).map(([k,x])=>[k,{'.validate':valid(x)}])),'$other':{'.validate':H}});
const game=`newData.isString() && newData.val() === ${P}.child('id').val()`,at='newData.val() === now';
const choice="newData.isNumber() && newData.val() >= 0 && newData.val() % 1 === 0 && newData.val() <= 4 && "+P+".child('currentQuestion/options').child(newData.val() + '').exists()";
const write=phase=>`${member} && newData.exists() && ${P}.child('phase').val() === '${phase}' && ${P}.child('round').val() + '' === $round && now < ${P}.child('deadline').val()`;
const entry=(phase,required,fields,extra='')=>({'.read':member,'.write':write(phase)+extra,...shape(['game','at',...required],{game,at,...fields})});
const first=entry('first',['choice','prediction'],{choice,prediction:`newData.isNumber() && newData.val() % 1 === 0 && (($uid === ${P}.child('target').val() && newData.val() === -1) || ($uid !== ${P}.child('target').val() && newData.val() >= 0 && newData.val() <= 4 && ${P}.child('currentQuestion/options').child(newData.val() + '').exists()))`});
const prev=`${R}.child('inputs/first').child($round).child($uid)`;
const second=entry('twist',['stance','choice','text','consent'],{
 stance:"newData.val() === 'keep' || newData.val() === 'change' || newData.val() === 'depends'",
 choice:`(newData.parent().child('stance').val() === 'depends' && newData.val() === -1) || (newData.parent().child('stance').val() === 'keep' && ${prev}.exists() && newData.val() === ${prev}.child('choice').val()) || (newData.parent().child('stance').val() === 'change' && (${choice}) && newData.val() !== ${prev}.child('choice').val())`,
 text:'newData.isString() && newData.val().length <= 100',consent:'newData.isBoolean()'});
const routes=entry('routing',['route'],{route:`newData.isString() && (newData.val() === ${P}.child('routes/0/id').val() || newData.val() === ${P}.child('routes/1/id').val())`},` && $uid === ${P}.child('target').val()`);
v.inputs={first:{'$round':{'$uid':first}},second:{'$round':{'$uid':second}},routes:{'$round':{'$uid':routes}}};
v.quoteConsent={'.read':true,'$round':{'$uid':{'.write':`${member} && newData.exists() && ${R}.child('quotes').child($round).child($uid).exists()`,...shape(['game','share'],{game,share:'newData.isBoolean()'})}}};
v.hidden={'.read':true};
v.quotes={'$round':{'$uid':{'.read':`${P}.child('round').val() + '' === $round && (${P}.child('phase').val() === 'discussion' || ${P}.child('phase').val() === 'ended') && ${R}.child('quoteConsent').child($round).child($uid).child('game').val() === ${P}.child('id').val() && ${R}.child('quoteConsent').child($round).child($uid).child('share').val() === true && ${R}.child('hidden').child($round).child($uid).val() !== true && ${R}.child('moderation').child($uid).child('removed').val() !== true`}}};
// A seat claim must create its matching roster atomically, and never work after removal/lock/end.
v.seats['$seat']['.write']+=` && ${P}.exists() && ${P}.child('locked').val() !== true && ${P}.child('phase').val() !== 'ended' && ${R}.child('moderation').child(auth.uid).child('removed').val() !== true && !${R}.child('roster').child(auth.uid).exists()`;
all.rules.voyage=v;writeFileSync('database.rules.json',JSON.stringify(all,null,2)+'\n');
