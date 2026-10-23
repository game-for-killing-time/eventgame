import test from 'node:test';
import assert from 'node:assert/strict';
import {storyImplementation,escapeRole} from '../src/story-routing.js';
test('all original story URLs now open the wolf game, including cached demo/voyage bookmarks',()=>{
 for(const query of ['','?demo=1','?voyage=1&role=player','?legacy=1&role=host','?role=display','?mode=voyage'])assert.equal(storyImplementation(query),'escape');
 assert.equal(storyImplementation('?archive=voyage'),'voyage');assert.equal(storyImplementation('?archive=story'),'story');
});
test('original host entry retains host role and display overrides it',()=>{
 assert.equal(escapeRole('?mode=voyage','host'),'host');assert.equal(escapeRole('?mode=voyage&role=display','host'),'display');assert.equal(escapeRole('?role=player','host'),'player');assert.equal(escapeRole(''),'player');
});
