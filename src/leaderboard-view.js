import './leaderboard.css';
import {leaderboard} from './game.js';
import {isSpotlight} from './spotlight.js';
import {misunderstoodLeaderboard} from './misunderstood.js';
import {masterCard} from './spotlight-view.js';
import {characterId,characterMarkup} from './characters.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function leaderboardPanel(pub,selected='insight'){
 const spotlight=isSpotlight(pub.state),misunderstood=spotlight&&selected==='misunderstood';
 const members=pub.members||{},results=pub.results||{};
 const board=misunderstood?misunderstoodLeaderboard(results,members):leaderboard(results,members);
 const title=misunderstood?'被誤會最深排行榜':spotlight?'心水清排行榜':'猜大家排行榜';
 const toggle=spotlight?`<div class="leaderboard-switch" role="group" aria-label="選擇排行榜"><button type="button" id="rank-insight" data-rank-board="insight" aria-pressed="${!misunderstood}">心水清</button><button type="button" id="rank-misunderstood" data-rank-board="misunderstood" aria-pressed="${misunderstood}">被誤會最深</button></div>`:'';
 const explanation=spotlight?`<p class="leaderboard-rule">${misunderstood?'任主角時，每被猜錯 1 人累積 1 分；漏答不計。':'每猜中主角 1 次累積 1 分；主角不猜自己。'}</p>`:'';
 return `<section class="panel leaderboard" aria-label="${title}" data-rank-kind="${misunderstood?'misunderstood':'insight'}">${toggle}<h2>${title}</h2>${explanation}${spotlight&&!misunderstood?masterCard(pub.awards,members):''}${board.length?board.map((p,i)=>`<div class="rank"><span>${i&&p.score===board[i-1].score?'＝':board.findIndex(x=>x.score===p.score)+1}</span>${characterMarkup(characterId(p.id,pub.state.code))}<b>${esc(p.name)}${!misunderstood&&pub.awards?.winners?.[p.id]?'<span class="master-badge">心水清大師</span>':''}</b><strong>${p.score} <small>分</small></strong></div>`).join(''):'<p>還沒有人入座。</p>'}</section>`;
}
