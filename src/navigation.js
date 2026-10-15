export function pageLink(page, {demo=false, room=''}={}) {
 const query=new URLSearchParams();
 // Give current invitations a distinct HTML URL from pre-spotlight bookmarks.
 query.set('v','reveal-20261015');
 if(demo)query.set('demo','1');
 if(room)query.set('room',room);
 return `./${page}.html${query.size?'?'+query.toString():''}`;
}
