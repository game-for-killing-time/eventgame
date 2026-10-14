export const characters=['花衫橘貓','花裙兔兔','葉子小熊','紫花松鼠','水手鴨鴨','連帽灰狼','吊帶小豬','口袋倉鼠','圍巾企鵝','外套青蛙'];

// Anonymous Auth UIDs are random. A stable room-specific mapping keeps every
// client in agreement, permits duplicates, and needs no new writable role data.
export function characterId(uid,code) {
 let hash=2166136261;
 for(const c of `${code}:${uid}`) hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 return hash%characters.length;
}

export function characterMarkup(id,large=false) {
 const n=Number.isInteger(id)&&id>=0&&id<characters.length?id:0;
 return `<span class="character ${large?'character-large':''}" role="img" aria-label="${characters[n]}"><img src="./art/characters/${n}.png" alt="" loading="lazy"></span>`;
}
