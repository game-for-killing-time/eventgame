const params=new URLSearchParams(location.search);
if(params.get('mode')==='voyage'){
 document.getElementById('app').id='story-app';
 await import('./voyage-app.js');
}else{
 await import('./style.css');
 await import('./app.js');
}
