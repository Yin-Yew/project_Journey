const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('planner still sorts chronologically without manual move controls',()=>{
 const js=read('public/js/planner-places.js');
 const api=read('server/planner-places.js');
 assert.doesNotMatch(js,/data-jj-move/);
 assert.doesNotMatch(js,/activities\/reorder\/day/);
 assert.match(js,/a\.time\.localeCompare\(b\.time\)/);
 assert.match(api,/ORDER BY day_number,start_time,id/);
 assert.doesNotMatch(api,/activities\/reorder\/day/);
});
test('private packing UI is a plain note list, without member tabs or assignees',()=>{
 const html=read('public/checklist.html');
 const js=read('public/js/features.js');
 assert.match(html,/Your private packing notes/);
 assert.doesNotMatch(html,/jjChecklistModal|jjChecklistAssignee/);
 assert.match(js,/data-jj-note-add/);
 assert.match(js,/jj-note-items/);
 assert.match(js,/data-check-edit/);
 assert.doesNotMatch(js,/data-check-view|jj-check-groups|assignedTo|checklistMembers/);
 assert.match(read('public/js/script.js'),/jj-note-sheet/);
});
test('private checklist is filtered in all APIs and dashboard',()=>{
 const route=read('server/checklist.js');
 assert.match(route,/WHERE trip_id=\? AND assigned_to=\? ORDER BY id/);
 assert.match(route,/AND id=\? AND assigned_to=\?/);
 assert.doesNotMatch(route,/trip\.role==='owner'/);
 assert.match(read('server/app.js'),/WHERE trip_id=\? AND assigned_to=\? ORDER BY id/);
 const dash=read('server/trip-features.js');
 assert.match(dash,/ci\.trip_id=t\.id AND ci\.assigned_to=\?/);
 assert.match(dash,/ci\.trip_id=t\.id AND ci\.assigned_to=\? AND ci\.is_checked=1/);
});
test('v12 setup migration keeps old notes but makes creator sole owner',()=>{
 const setup=read('server/setup-db.js');
 assert.match(setup,/SET c\.assigned_to=c\.created_by/);
 assert.match(read('database/migrate_v11.sql'),/SET assigned_to = created_by/);
 assert.doesNotMatch(setup,/DELETE FROM trip_checklist_items/);
});
