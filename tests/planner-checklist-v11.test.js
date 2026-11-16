const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('planner removed manual move controls and sorts chronologically in backend and frontend',()=>{
 const js=read('public/js/planner-places.js');
 const api=read('server/planner-places.js');
 assert.doesNotMatch(js,/data-jj-move/);
 assert.doesNotMatch(js,/activities\/reorder\/day/);
 assert.match(js,/a\.time\.localeCompare\(b\.time\)/);
 assert.match(api,/ORDER BY day_number,start_time,id/);
 assert.doesNotMatch(api,/activities\/reorder\/day/);
});
test('checklist add-item modal has assignee dropdown and per-member groups',()=>{
 const html=read('public/checklist.html');
 const js=read('public/js/features.js');
 assert.match(html,/id="jjChecklistModal"/);
 assert.match(html,/id="jjChecklistAssignee"/);
 assert.match(html,/id="jjChecklistForm"/);
 assert.match(js,/jj-check-groups/);
 assert.match(js,/data-check-view="mine"/);
 assert.match(js,/canEditChecklistItem/);
 assert.match(js,/assignedTo/);
 assert.doesNotMatch(js,/prompt\('Edit packing item'/);
});
test('schema and automatic setup preserve existing items and add assignee',()=>{
 assert.match(read('database/schema.sql'),/assigned_to INT NULL/);
 assert.match(read('database/migrate_v10.sql'),/JOIN trip_members/);
 const setup=read('server/setup-db.js');
 assert.match(setup,/information_schema\.COLUMNS/);
 assert.match(setup,/if\(!columns\.length\)/);
 assert.match(setup,/SET c\.assigned_to=c\.created_by/);
 assert.match(read('server/app.js'),/assignedTo:item\.assigned_to/);
});
