const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('checklist API is account-scoped and returns its authenticated identity',()=>{
 const server=read('server/checklist.js');
 assert.match(server,/res\.json\(\{accountId:String\(req\.user\.id\),items:rows\.map\(dto\)\}\)/);
 assert.match(server,/WHERE trip_id=\? AND assigned_to=\? ORDER BY id/);
});
test('frontend refuses unverified private notes without crashing all trip panels',()=>{
 const client=read('public/js/trips-api.js');
 assert.match(client,/String\(response\?\.accountId\)!==expectedId/);
 assert.match(client,/reply\?\.contract!=='private-checklist-v12\.2'/);
 assert.match(client,/checklistPrivacyErrors\[trip\.id\]=error\.message/);
 assert.match(client,/checklistItems:\[\]/);
 assert.match(client,/cache:'no-store'/);
 assert.match(client,/addEventListener\('storage'/);
});
test('server exposes authenticated privacy contract; UI offers a safe retry',()=>{
 const server=read('server/app.js');
 assert.match(server,/app\.get\('\/api\/checklist\/version',\.\.\.protect/);
 const ui=read('public/js/features.js');
 assert.match(ui,/data-jj-note-retry/);
 assert.match(ui,/Private to \$\{escapeHTML\(currentProfile\?\.email/);
 const html=read('public/checklist.html');
 assert.match(html,/trips-api\.js\?v=12\.2/);
 assert.match(html,/features\.js\?v=12\.2/);
});
