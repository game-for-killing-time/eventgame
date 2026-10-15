if(new URLSearchParams(location.search).get('demo')==='1')await import('./voyage-app.js');
else if(new URLSearchParams(location.search).get('demo')==='legacy')await import('./story-app.js');
else if(new URLSearchParams(location.search).get('legacy')==='1')await import('./story-online.js');
else await import('./voyage-app.js');
