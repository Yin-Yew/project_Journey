const test=require('node:test');
const assert=require('node:assert/strict');
const register=require('../server/destination-votes');
const handlers=new Map();
const app=Object.fromEntries(['get','post','patch','put','delete'].map(method=>[method,(path,...handlers)=>{handlersMap.set(`${method.toUpperCase()} ${path}`,handlers.at(-1));}]));
// Ensure obsolete invitation/member routes cannot be used to enter/leave public polls.
const handlersMap=new Map();
register(app,{run:async()=>[[]],protect:fn=>[fn],fail:()=>{}});
test('public poll routes have no invite-code join or member-removal endpoints',()=>{
 assert.equal(handlersMap.has('POST /api/destination-polls/join'),false);
 assert.equal(handlersMap.has('DELETE /api/destination-polls/:id/members/:userId'),false);
 assert.equal(handlersMap.has('GET /api/destination-polls'),true);
 assert.equal(handlersMap.has('PUT /api/destination-polls/:id/vote'),true);
});
test('vote page has no join form or invite-code field',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../public/voting.html'),'utf8');
 assert.doesNotMatch(html,/jjPollJoinForm|jjPollJoinCode/);
 assert.match(html,/Public Voting Polls/);
});
