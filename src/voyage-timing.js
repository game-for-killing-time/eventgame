export const VOYAGE_DURATIONS=Object.freeze([15,45,60,90,120,180,300,600]);

export const validDuration=(value,local=false)=>VOYAGE_DURATIONS.includes(value)||(local&&value===0);

export function durationOptions(selected=60,local=false){
 const values=local?[...VOYAGE_DURATIONS,0]:VOYAGE_DURATIONS;
 return values.map(seconds=>{
  const label=seconds===0?'不限時（本機檢查）':seconds===15&&local?'15 秒（快速試玩）':seconds>=120?`${seconds/60} 分鐘（${seconds} 秒）`:`${seconds} 秒`;
  return `<option value="${seconds}"${seconds===selected?' selected':''}>${label}</option>`;
 }).join('');
}
