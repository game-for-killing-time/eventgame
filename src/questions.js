import {originalQuestions} from './question-bank/original.js';
import {routineQuestions} from './question-bank/routine.js';
import {foodQuestions} from './question-bank/food.js';
import {travelQuestions} from './question-bank/travel.js';
import {digitalQuestions} from './question-bank/digital.js';
import {socialQuestions} from './question-bank/social.js';
import {valuesQuestions} from './question-bank/values.js';
import {newthingsQuestions} from './question-bank/newthings.js';
import {leisureQuestions} from './question-bank/leisure.js';
import {tasteQuestions} from './question-bank/taste.js';
import {imaginationQuestions} from './question-bank/imagination.js';
export const questionCategories=[['routine','日常小習慣','日常暖場'],['food','吃喝與聚餐','日常暖場'],['travel','出門與旅行','日常暖場'],['digital','手機與數碼生活','日常暖場'],['social','朋友與團體相處','生活取捨'],['values','時間金錢與選擇','生活取捨'],['newthings','新挑戰與突發狀況','生活取捨'],['leisure','休閒與興趣','興趣品味'],['taste','品味與收藏','興趣品味'],['imagination','回憶與腦洞','興趣品味']].map(([id,name,group])=>({id,name,group}));
// Existing room snapshots keep their original wording; IDs remain stable.
export const questions=[...originalQuestions,...routineQuestions,...foodQuestions,...travelQuestions,...digitalQuestions,...socialQuestions,...valuesQuestions,...newthingsQuestions,...leisureQuestions,...tasteQuestions,...imaginationQuestions];
export function filterQuestions({category='',search=''}={}){
 const terms=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return questions.filter(q=>(!category||q.category===category)&&terms.every(t=>`${q.text} ${q.options.join(' ')} ${q.followUp}`.toLocaleLowerCase().includes(t)));
}
