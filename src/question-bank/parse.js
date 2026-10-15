export function parseQuestions(source,category,start){
 return source.trim().split('\n').map((line,i)=>{
  const cells=line.trim().split('|');
  if(cells.length!==6||cells.some(x=>!x.trim()))throw Error(`Invalid question ${category}:${i+1}`);
  const [text,a,b,c,d,followUp]=cells;
  return {id:`q${start+i}`,category,text,options:[a,b,c,d],followUp};
 });
}
