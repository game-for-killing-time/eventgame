import {storyImplementation} from './story-routing.js';
const implementation=storyImplementation(location.search);
if(implementation==='escape')await import('./escape-app.js');
else if(implementation==='story')await import('./story-app.js');
else if(new URLSearchParams(location.search).get('role')==='display'){document.getElementById('story-app').id='app';await import('./voyage-display.js');}
else await import('./voyage-app.js');
