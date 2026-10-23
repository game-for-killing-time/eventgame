// Existing story links now resolve to the secret-wolf game, including old demo links.
// Archived implementations remain available only through explicit archive URLs.
export function storyImplementation(search=''){
 const q=new URLSearchParams(search);
 return q.get('archive')==='voyage'?'voyage':q.get('archive')==='story'?'story':'escape';
}
export function escapeRole(search='',fallback='player'){
 const role=new URLSearchParams(search).get('role');return ['host','display'].includes(role)?role:role==='player'?'player':fallback==='host'?'host':'player';
}
