if(new URLSearchParams(location.search).get('demo')==='1')await import('./story-app.js');
else await import('./story-online.js');
