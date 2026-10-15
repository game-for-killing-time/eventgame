import {questions,questionCategories} from './questions.js';
import {isSpotlight,configureSpotlight} from './spotlight.js';
import {startRound} from './game.js';

export function prepareQuestionPlan(room,{category='',questionsPerCycle,cycles},random=Math.random){
 const s=room.public.state,old=room.hostOnly?.questionPlan;
 if(!isSpotlight(s)||!['waiting','revealed'].includes(s.status)||s.completed)throw Error('請在開場前或本題揭曉後設定題單。');
 if(category&&!questionCategories.some(c=>c.id===category))throw Error('請選擇有效的題目分類。');
 if(old&&s.round>old.startRound)throw Error('本場題單已開始，分類及題數會保持固定。');
 if(s.round===0)configureSpotlight(room,{questionsPerCycle,cycles});
 const total=s.questionsPerCycle*s.cycles,remaining=total-s.round;
 if(old&&old.category===category&&old.total===total)return room;
 const used=new Set(Object.values(room.public.results||{}).map(r=>r.questionId));
 if(s.question?.id)used.add(s.question.id);
 const pool=questions.filter(q=>(!category||q.category===category)&&!used.has(q.id));
 if(pool.length<remaining)throw Error(`這個分類尚有 ${pool.length} 題未出過，不足 ${remaining} 題。請選擇其他分類或減少題數。`);
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 room.hostOnly??={};
 room.hostOnly.questionPlan={category,total,startRound:s.round,ids:pool.slice(0,remaining).map(q=>q.id)};
 return room;
}

export function nextPlannedQuestion(state,plan){
 return questions.find(q=>q.id===plan?.ids?.[state.round-plan.startRound]);
}

export function startNextQuestion(room,request,now){
 if(!room)return null;
 const s=room.public.state,e=request.expected;
 // A second click or another host tab cannot consume the following question.
 if(!e||s.code!==e.code||s.round!==e.round||s.status!==e.status)return undefined;
 if(!room.hostOnly?.questionPlan)prepareQuestionPlan(room,request);
 const q=nextPlannedQuestion(s,room.hostOnly.questionPlan);
 if(!q)throw Error('本場題單已完成，請結束房間。');
 room.public.state=startRound(room,q,now);
 delete room.public.story;
 return room;
}
