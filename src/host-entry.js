const voyage=new URLSearchParams(location.search).get('mode')==='voyage';
if(voyage){document.getElementById('app').id='story-app';await import('./voyage-app.js');}
else{await import('./style.css');await import('./host-desk.css');await import('./app.js');}
