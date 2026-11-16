const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {netBalances,settlementsForBalances,cents}=require('../server/finance-ledger');
const nextTrip=require('../server/next-trip');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('confirmed partial payment is credited in cents, pending is not',()=>{
 const expenses=[{paid_by:1,amount:'120.00'}];
 const splits=[{user_id:1,share_amount:40},{user_id:2,share_amount:40},{user_id:3,share_amount:40}];
 const payments=[{payer_id:2,payee_id:1,amount:'15.00',status:'paid'},{payer_id:3,payee_id:1,amount:'30.00',status:'pending'}];
 assert.deepEqual(netBalances(expenses,splits,payments,[1,2,3]),{'1':6500,'2':-2500,'3':-4000});
 assert.deepEqual(settlementsForBalances(netBalances(expenses,splits,payments,[1,2,3])),[
  {from:'3',to:'1',amount:40},{from:'2',to:'1',amount:25}
 ]);
});
test('adding a later expense retains payment credit, without double counting',()=>{
 const expenses=[{paid_by:1,amount:120},{paid_by:3,amount:90}];
 const splits=[{user_id:1,share_amount:40},{user_id:2,share_amount:40},{user_id:3,share_amount:40},{user_id:1,share_amount:30},{user_id:2,share_amount:30},{user_id:3,share_amount:30}];
 const payments=[{payer_id:2,payee_id:1,amount:15,status:'paid'}];
 const net=netBalances(expenses,splits,payments,[1,2,3]);
 assert.equal(Object.values(net).reduce((s,n)=>s+n,0),0);
 assert.deepEqual(settlementsForBalances(net),[{from:'2',to:'1',amount:35},{from:'2',to:'3',amount:20}]);
});
test('money is always represented as integer satang, including decimal cases',()=>{
 assert.equal(cents('12.39'),1239);assert.equal(cents('0.01'),1);
 assert.deepEqual(settlementsForBalances({'1':100,'2':-1,'3':-99}),[{from:'3',to:'1',amount:.99},{from:'2',to:'1',amount:.01}]);
});
test('finance client uses confirmed payments in balances and has partial payment controls',()=>{
 const ctx=vm.createContext({document:{addEventListener(){}},tripDetailsCache:{'7':{members:[{id:'1'},{id:'2'},{id:'3'}]}},getStoredTrips:()=>[],getCurrentUserId:()=> '2',getTripById:()=>({status:'active'}),getJoyMembers:()=>[],URLSearchParams,location:{search:''},escapeHTML:s=>s,avatarUrl:()=>''});
 vm.runInContext(read('public/js/finance.js'),ctx);
 ctx.getFinanceData().expenses['7']=[{amount:120,paidBy:'1',participants:['1','2','3'],splitType:'equal',shares:{}}];
 ctx.getFinanceData().payments=[{tripId:'7',from:'2',to:'1',amount:15,status:'paid'},{tripId:'7',from:'3',to:'1',amount:30,status:'pending'}];
 assert.equal(ctx.financeSummary('7').owe,25);
 assert.equal(ctx.financeSummary('7').receive,0);
 assert.match(read('public/expenses.html'),/id="payPartialAmount"/);
 assert.match(read('server/trip-features.js'),/ledgerFor\(conn,trip\.id\)/);
});
test('new voting rounds have protected history, schema and controls',()=>{
 assert.match(read('database/schema.sql'),/CREATE TABLE IF NOT EXISTS next_trip_rounds/);
 assert.match(read('server/next-trip.js'),/app\.post\('\/api\/next-trip\/rounds'/);
 assert.match(read('server/next-trip.js'),/FOR UPDATE/);
 assert.match(read('server/next-trip.js'),/app\.get\('\/api\/next-trip\/history'/);
 assert.doesNotMatch(read('public/js/destination-votes.js'),/createdBy|item\.voters/);
 assert.match(read('public/voting.html'),/jjNextRoundForm/);
 assert.match(read('public/voting.html'),/jjNextHistory/);
});
test('clean edition has no sample-login or importer endpoints',()=>{
 const app=read('server/app.js');
 assert.doesNotMatch(app,/JJ_DEMO_MODE|\/api\/auth\/demo|seed-demo/);
 assert.doesNotMatch(read('public/login.html'),/Try Demo|demoLoginButton|jj-demo-login/);
 assert.match(read('server/setup-db.js'),/schema\.sql/);
 assert.doesNotMatch(read('database/schema.sql'),/demo_seed_history/);
});
test('backup/restore, migration, and deletion confirmation are bundled',()=>{
 assert.ok(read('server/database-snapshot.js').includes('joyjourney-backup-v1'));
 assert.ok(read('server/tools/RESTORE-DATABASE.bat').includes('RESTORE'));
 assert.ok(read('server/tools/BACKUP-DATABASE.bat').includes('database-snapshot.js backup'));
 assert.match(read('public/trip-detail.html'),/jjDeleteTripName/);
 assert.match(read('server/app.js'),/confirmName/);
 assert.match(read('public/js/trips-api.js'),/copyTripInviteLink/);
 assert.match(read('public/trips.html'),/jjTripFilter/);
});

test('only current organizer can archive and create a new round',async()=>{
 const handlers=new Map();let boardId=8,closed=false,oldArchived=false,created=0;
 const app=Object.fromEntries(['get','post','put','delete'].map(m=>[m,(route,...fns)=>handlers.set(`${m.toUpperCase()} ${route}`,fns.at(-1))]));
 const base={poll_id:8,start_at:'2026-11-15 04:00:00',end_at:'2026-11-22 04:00:00',owner_id:2,status:'open',server_now:'2026-11-16 04:00:00'};
 const respond=(sql,args)=>{
  if(sql==='SELECT poll_id FROM next_trip_board WHERE slot=1')return [[{poll_id:boardId}]];
  if(sql.startsWith('UPDATE next_trip_board SET start_at=UTC_TIMESTAMP()'))return [{affectedRows:0}];
  if(sql.startsWith('SELECT b.poll_id,b.start_at'))return [[{...base,poll_id:boardId}]];
  if(sql.includes('WHERE b.slot=1 FOR UPDATE'))return [[{poll_id:boardId,start_at:base.start_at,end_at:base.end_at,owner_id:2}]];
  if(sql.startsWith('INSERT INTO next_trip_rounds')){oldArchived=true;return [{insertId:1}];}
  if(sql.startsWith("UPDATE destination_polls SET status='closed'")){closed=true;return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO destination_polls')){created++;return [{insertId:9}];}
  if(sql.startsWith('UPDATE next_trip_board SET poll_id=')){boardId=args[0];return [{affectedRows:1}];}
  if(sql.includes('FROM next_trip_rounds h'))return [[{id:1,poll_id:8,start_at:base.start_at,end_at:base.end_at,total_votes:3}]];
  if(sql.includes('FROM destination_candidates c'))return [[{name:'Nan',votes:2},{name:'Krabi',votes:1}]];
  throw new Error('Unexpected query: '+sql);
 };
 const run=async(sql,args=[])=>respond(sql,args);
 const pool={async getConnection(){return{execute:run,async beginTransaction(){},async commit(){},async rollback(){},release(){}};}};
 nextTrip(app,{run,pool,protect:fn=>[fn],fail:(res,code,message)=>res.status(code).json({error:message})});
 const body={startAt:new Date(Date.now()+86400000).toISOString(),endAt:new Date(Date.now()+2*86400000).toISOString()};
 async function call(method,url,id,b={}){const res={code:200,status(n){this.code=n;return this;},json(v){this.data=v;return this;}};await handlers.get(`${method} ${url}`)({user:{id},body:b},res);return res;}
 assert.equal((await call('POST','/api/next-trip/rounds',1,body)).code,403);
 assert.equal(boardId,8);assert.equal(oldArchived,false);
 assert.equal((await call('POST','/api/next-trip/rounds',2,body)).code,201);
 assert.equal(boardId,9);assert.equal(oldArchived,true);assert.equal(closed,true);assert.equal(created,1);
 const history=await call('GET','/api/next-trip/history',1);
 assert.equal(history.data.history[0].totalVotes,3);
 assert.deepEqual(history.data.history[0].options,[{name:'Nan',votes:2},{name:'Krabi',votes:1}]);
 assert.equal(JSON.stringify(history.data).includes('created_by'),false);
});
