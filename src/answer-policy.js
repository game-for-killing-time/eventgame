import {hasConsented} from './auto-reveal.js';
export function nextRevision(answer){return answer?(answer.revision??0)+1:0;}
export function answerEditable(pub,uid,answer){return !(answer&&pub?.state?.ruleset==='spotlight-v1'&&pub.state.targetUid===uid)&&!hasConsented(pub,uid)&&(!answer||(answer.revision??0)<1);}
export function answerHint(pub,uid,answer){
 if(hasConsented(pub,uid))return '已同意立即截止，答案已鎖定。';
 if(!answer)return '首次提交後，截止前還可修改一次。';
 return (answer.revision??0)<1?'已提交，還可修改一次；兩組選擇一起更新。':'已使用唯一一次修改，答案已鎖定。';
}
