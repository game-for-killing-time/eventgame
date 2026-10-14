export function pageLink(page, {demo=false, room=''}={}) {
 const query=new URLSearchParams();
 if(demo)query.set('demo','1');
 if(room)query.set('room',room);
 return `./${page}.html${query.size?'?'+query.toString():''}`;
}
