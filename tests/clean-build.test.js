const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('clean ZIP has no demo account importer, images, or demo login',()=>{
 for(const name of ['server/seed-demo.js','server/demo-data.js','server/demo-photos.js','server/demo-assets','public/assets/demo-covers','public/photo-credits.html','START-DEMO.bat','START-DEMO.sh']){
  assert.ok(!fs.existsSync(path.join(root,name)),name+' must be absent');
 }
 assert.doesNotMatch(read('public/login.html'),/Try Demo|demoLoginButton|jj-demo-login/);
 assert.doesNotMatch(read('server/app.js'),/api\/auth\/demo|seed-demo|JJ_DEMO_MODE/);
 assert.doesNotMatch(read('public/js/auth.js'),/ensureJoyUsers|JJ_MEMBER_SEEDS|password123/);
 assert.doesNotMatch(read('public/js/finance.js'),/financeSeedData|samet-hotel/);
});
test('empty DB installer is available and contains no sample inserts',()=>{
 assert.ok(fs.existsSync(path.join(root,'server/tools/SETUP-AND-START.bat')));
 assert.ok(fs.existsSync(path.join(root,'server/setup-db.js')));
 assert.match(read('server/setup-db.js'),/schema\.sql/);
 assert.doesNotMatch(read('server/setup-db.js'),/\bINSERT INTO\b|seed-demo|JJ_DEMO_MODE/);
 assert.match(read('.env.example'),/DB_NAME=joyjourney_clean/);
 assert.doesNotMatch(read('database/schema.sql'),/demo_seed_history/);
});
