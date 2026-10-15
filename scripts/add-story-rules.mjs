import {readFileSync,writeFileSync} from 'node:fs';
const file='database.rules.json',all=JSON.parse(readFileSync(file,'utf8'));
const H="auth != null && auth.uid === root.child('config/hostUid').val() && auth.token.firebase.sign_in_provider !== 'anonymous'";
const R="root.child('adventure')",P=`${R}.child('public')`,M=`${R}.child('roster').child($uid)`,I=`${R}.child('inbox').child($uid)`;
const own=`auth != null && auth.uid === $uid`,member=`${own} && ${M}.exists() && ${R}.child('moderation').child($uid).child('removed').val() !== true`;
const valid=x=>`(${H}) || (${x})`;
const shape=(children,fields)=>({'.validate':valid(`newData.hasChildren(${JSON.stringify(children)})`),...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{'.validate':valid(v)}])),'$other':{'.validate':H}});
const game=`newData.isString() && newData.val() === ${P}.child('id').val()`;
const at='newData.val() === now';
const chatWrite=(parent)=>`${member} && ${P}.child('chatOpen').val() === true && ${R}.child('moderation').child($uid).child('muted').val() !== true && newData.exists() && (!${R}.child('chat').child($uid).child('lastSent').exists() || now - ${R}.child('chat').child($uid).child('lastSent').val() >= 3000) && ${parent}.child('lastSent').val() === now && ${parent}.child('seq').val() === (${R}.child('chat').child($uid).child('seq').exists() ? ${R}.child('chat').child($uid).child('seq').val() + 1 : 1)`;
const answer=kind=>{
 const phase=kind==='routes'?'routing':'open';
 const entry={'.read':member,'.write':`${member} && newData.exists() && ${P}.child('phase').val() === '${phase}' && ${P}.child('round').val() + '' === $round && now < ${P}.child('deadline').val()`};
 if(kind==='routes')return {...entry,...shape(['game','at','route'],{game,at,route:`newData.isString() && (newData.val() === ${P}.child('routes/0/id').val() || newData.val() === ${P}.child('routes/1/id').val())`})};
 return {...entry,...shape(['game','at','qid','choice','prediction'],{game,at,qid:`newData.isString() && newData.val() === ${I}.child('question/id').val() && ${I}.child('game').val() === ${P}.child('id').val() && ${I}.child('round').val() + '' === $round`,choice:'newData.isNumber() && newData.val() >= 0 && newData.val() <= 3 && newData.val() % 1 === 0',prediction:`newData.isNumber() && newData.val() % 1 === 0 && ((${P}.child('scored').val() === true && newData.val() >= 0 && newData.val() <= 3) || (${P}.child('scored').val() !== true && newData.val() === -1))`})};
};
all.rules.adventure={'.read':H,'.write':H,
 public:{'.read':true},hostOnly:{},moderation:{'$uid':{'.read':own}},
 seats:{'.read':'auth != null','$seat':{'.write':`auth != null && !data.exists() && newData.val() === auth.uid && $seat.matches(/^([0-9]|1[0-9])$/)`,'.validate':valid(`newData.parent().parent().child('roster').child(auth.uid).child('seat').val() === $seat`)}},
 roster:{'$uid':{'.read':own,'.write':`${own} && !data.exists() && newData.exists() && ${P}.exists() && ${P}.child('phase').val() !== 'ended' && ${P}.child('locked').val() !== true && ${R}.child('moderation').child($uid).child('removed').val() !== true`,...shape(['name','seat','game','at'],{name:'newData.isString() && newData.val().length > 0 && newData.val().length <= 20',seat:`newData.isString() && newData.val().matches(/^([0-9]|1[0-9])$/) && newData.parent().parent().parent().child('seats').child(newData.val()).val() === $uid`,game,at})}},
 inbox:{'$uid':{'.read':member}},
 inputs:{answers:{'$round':{'$uid':answer('answers')}},routes:{'$round':{'$uid':answer('routes')}},runoff:{'$uid':{'.read':member,'.write':`${member} && newData.exists() && ${P}.child('phase').val() === 'runoff' && now < ${P}.child('deadline').val()`,...shape(['game','at','choice'],{game,at,choice:`newData.isNumber() && (newData.val() === ${P}.child('runoffOptions/0').val() || newData.val() === ${P}.child('runoffOptions/1').val() || newData.val() === ${P}.child('runoffOptions/2').val() || newData.val() === ${P}.child('runoffOptions/3').val())`})}}},
 consent:{'.read':true,'$uid':{'.write':`${member} && ${P}.child('phase').val() === 'ended' && newData.exists()`,...shape(['game','share'],{game,share:'newData.isBoolean()'})}},
 sharedCards:{'$uid':{'.read':`${P}.child('phase').val() === 'ended' && ${R}.child('consent').child($uid).child('game').val() === ${P}.child('id').val() && ${R}.child('consent').child($uid).child('share').val() === true && ${R}.child('moderation').child($uid).child('removed').val() !== true`}},
 chat:{'$uid':{
 '.validate':valid("newData.hasChildren(['seq','lastSent','messages'])"),
 seq:{'.read':own,'.write':chatWrite('newData.parent()'),'.validate':valid('newData.isNumber() && newData.val() > 0 && newData.val() % 1 === 0')},lastSent:{'.write':chatWrite('newData.parent()'),'.validate':valid(at)},
 messages:{'.indexOn':['at'],'.read':`auth != null && ${R}.child('roster').child(auth.uid).exists() && ${R}.child('moderation').child(auth.uid).child('removed').val() !== true && query.orderByChild === 'at' && query.limitToLast != null && query.limitToLast <= 3`,
 '$message':{'.write':`!data.exists() && ${chatWrite('newData.parent().parent()')}`,'.validate':valid(`(data.exists()) || ($message === newData.parent().parent().child('seq').val() + '' && newData.hasChildren(['text','at','game']))`),text:{'.validate':valid('newData.isString() && newData.val().length > 0 && newData.val().length <= 300')},at:{'.validate':valid('data.exists() ? newData.val() === data.val() : newData.val() === now')},game:{'.validate':valid(game)},'$other':{'.validate':H}}},'$other':{'.validate':H}
 }}
};
writeFileSync(file,JSON.stringify(all,null,2)+'\n');

