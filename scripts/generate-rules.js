import {writeFileSync} from 'node:fs';
const host="auth != null && auth.uid === root.child('config/hostUid').val() && auth.token.firebase.sign_in_provider !== 'anonymous'";
const member="auth != null && root.child('room/public/members').child(auth.uid).exists() && !root.child('room/moderation').child(auth.uid).child('removed').val()";
const own=`(${member}) && auth.uid === $uid`;
const speaking=`(${own}) && !root.child('room/moderation').child(auth.uid).child('muted').val() && root.child('room/public/state/status').val() !== 'ended'`;
const state="root.child('room/public/state')";
const rules={rules:{'.read':false,'.write':false,config:{hostUid:{'.read':'auth != null'}},room:{'.read':host,'.write':host,public:{'.read':true,state:{},members:{'.validate':`(${host}) || newData.numChildren() <= 20`,'$uid':{'.write':`auth != null && auth.uid === $uid && !data.exists() && newData.exists() && !root.child('room/moderation').child($uid).child('removed').val() && ${state}.exists() && !${state}.child('locked').val() && ${state}.child('status').val() !== 'ended'`,'.validate':"newData.hasChildren(['name','joined','code'])",name:{'.validate':"newData.isString() && newData.val().length > 0 && newData.val().length <= 20"},joined:{'.validate':'newData.val() === now'},code:{'.validate':`newData.val() === ${state}.child('code').val()`},'$other':{'.validate':false}}}},moderation:{'$uid':{'.read':'auth != null && auth.uid === $uid'}},answers:{'$round':{'$uid':{'.read':own,'.write':`(${own}) && newData.exists() && $round === '' + ${state}.child('round').val() && ${state}.child('status').val() === 'open' && now < ${state}.child('deadline').val()`,'.validate':"newData.hasChildren(['choice','prediction','at'])",choice:{'.validate':'newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= 0 && newData.val() < 4'},prediction:{'.validate':'newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= 0 && newData.val() < 4'},at:{'.validate':'newData.val() === now'},'$other':{'.validate':false}}}},stories:{'$round':{'$uid':{'.read':own,'.write':`(${speaking}) && newData.exists() && $round === '' + ${state}.child('round').val() && ${state}.child('status').val() === 'revealed'`,'.validate':"newData.hasChildren(['text','at'])",text:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 500'},at:{'.validate':'newData.val() === now'},'$other':{'.validate':false}}}},chat:{'$uid':{
lastSent:{'.read':own,'.write':`(${speaking}) && ${state}.child('chatOpen').val() && newData.val() === now && (!data.exists() || now >= data.val() + 3000)`},
seq:{'.read':own,'.write':`(${speaking}) && newData.val() === (data.exists() ? data.val() + 1 : 1) && newData.parent().child('lastSent').val() === now`},
messages:{'.read':`(${member}) && query.orderByChild === 'at' && query.limitToLast <= 3`,'.indexOn':['at'],'$id':{
'.write':`(${speaking}) && ${state}.child('chatOpen').val() && !data.exists() && newData.exists() && $id === '' + (root.child('room/chat').child($uid).child('seq').exists() ? root.child('room/chat').child($uid).child('seq').val() + 1 : 1)`,
'.validate':"newData.hasChildren(['text','at']) && newData.parent().parent().child('lastSent').val() === now && $id === '' + newData.parent().parent().child('seq').val()",
text:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 240'},at:{'.validate':'newData.val() === now'},'$other':{'.validate':false}}},'$other':{'.validate':false}}}}}};
delete rules.rules.room.public.members['.validate'];
const membership=rules.rules.room.public.members.$uid;
membership['.validate']="newData.hasChildren(['name','joined','code','seat']) && newData.parent().parent().child('seats').child(newData.child('seat').val()).val() === auth.uid";
membership.seat={'.validate':"newData.isString() && newData.val().matches(/^([0-9]|1[0-9])$/)"};
rules.rules.room.public.seats={'$seat':{'.write':"auth != null && !data.exists() && newData.val() === auth.uid && $seat.matches(/^([0-9]|1[0-9])$/)",'.validate':"newData.parent().parent().child('members').child(auth.uid).child('seat').val() === $seat"}};
function trustedValidation(node) {for(const [key,value] of Object.entries(node)) {if(typeof value==='string'&&key.startsWith('.'))node[key]=value.replace(/!((?:root|data|newData)(?:\.child\([^)]*\))+\.val\(\))/g,'$1 !== true').replace(/(root\.child\('room\/public\/state'\)\.child\('chatOpen'\)\.val\(\))/g,'$1 === true');if(key==='.validate') node[key]=`(${host}) || (${node[key]})`; else if(value && typeof value==='object') trustedValidation(value);}}
rules.rules.room.hostOnly={'.read':host,'.write':host};
const targetRule=`${state}.child('ruleset').val() === 'spotlight-v1' && ${state}.child('targetUid').val() === auth.uid`;
rules.rules.room.answers.$round.$uid.prediction['.validate']=`newData.isNumber() && newData.val() % 1 === 0 && ((${targetRule}) ? newData.val() === -1 : (newData.val() >= 0 && newData.val() < 4))`;

const firstRule=`${state}.child('answerFlow').val() === 'target-first-v1'`;
const answer=rules.rules.room.answers.$round.$uid;
answer['.write']=`(${own}) && newData.exists() && $round === '' + ${state}.child('round').val() && ((${firstRule}) ? (newData.child('attempt').val() === ${state}.child('attempt').val() && ((${targetRule}) ? (${state}.child('status').val() === 'thinking' && !data.exists()) : (${state}.child('status').val() === 'open' && now < ${state}.child('deadline').val()))) : (${state}.child('status').val() === 'open' && now < ${state}.child('deadline').val()))`;
answer.attempt={'.validate':`newData.isNumber() && newData.val() === ${state}.child('attempt').val()`};

rules.rules.room.public.island={'.write':host};
rules.rules.room.effects={
 chat:{'.read':`${state}.child('chatEffects').val() === true && ${state}.child('chatOpen').val() === true && ${state}.child('status').val() !== 'ended'`,'.write':host},
 submissions:{'.read':`${state}.child('submitEffects').val() === true && ${state}.child('status').val() !== 'ended'`,'.write':host}
};
trustedValidation(rules.rules);
writeFileSync('database.rules.json',JSON.stringify(rules,null,2)+'\n');
