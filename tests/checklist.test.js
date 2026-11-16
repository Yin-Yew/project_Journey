// API tests with a SQL double: per-member packing and ownership checks.
const test=require('node:test');
const assert=require('node:assert/strict');
const register=require('../server/checklist');
const endpoints=new Map();
let rows=[],nextId=1,finished=false;
const app=Object.fromEntries(['get','post','patch','delete'].map(m=>[m,(route,...f)=>endpoints.set(`${m.toUpperCase()} ${route}`,f.at(-1))]));
const memberIds=new Set(['10','20','30']);
async function run(sql,params=[]){
 if(sql.startsWith('SELECT 1 FROM trip_members'))return [memberIds.has(String(params[1]))&&String(params[0])==='1'?[{one:1}]:[]];
 if(sql.startsWith('SELECT id,label,is_checked,assigned_to,created_by FROM trip_checklist_items WHERE trip_id=? ORDER BY id'))return [rows.filter(r=>r.trip_id===String(params[0]))];
 if(sql.startsWith('SELECT id,label,is_checked,assigned_to,created_by FROM trip_checklist_items WHERE trip_id=? AND id=?'))return [rows.filter(r=>r.trip_id===String(params[0])&&String(r.id)===String(params[1]))];
 if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:rows.filter(r=>r.trip_id===String(params[0])).length}]];
 if(sql.startsWith('INSERT INTO trip_checklist_items')){
  const r={id:nextId++,trip_id:String(params[0]),label:params[1],is_checked:0,created_by:params[2],assigned_to:params[3]};
  rows.push(r);return [{insertId:r.id}];
 }
 if(sql.startsWith('UPDATE trip_checklist_items')){
  const r=rows.find(row=>row.trip_id===String(params.at(-3))&&String(row.id)===String(params.at(-2))&&String(row.assigned_to)===String(params.at(-1)));
  if(!r)return [{affectedRows:0}];
  const fields=sql.match(/SET (.*?) WHERE/)[1].split(',');
  fields.forEach((field,i)=>{const key=field.split('=')[0];if(key==='label')r.label=params[i];if(key==='is_checked')r.is_checked=params[i];if(key==='assigned_to')r.assigned_to=params[i];});
  return [{affectedRows:1}];
 }
 if(sql.startsWith('DELETE FROM trip_checklist_items')){
  const before=rows.length;
  rows=rows.filter(r=>!(r.trip_id===String(params[0])&&String(r.id)===String(params[1])&&String(r.assigned_to)===String(params[2])));
  return [{affectedRows:before-rows.length}];
 }
 throw Error(`Unexpected query: ${sql}`);
}
const respond=(res,status,data)=>{res.statusCode=status;res.body=data;return res;};
register(app,{run,protect:fn=>[fn],membership:async(req,res)=>req.params.id==='1'?{id:1,status:finished?'finished':'active',role:req.user.id===10?'owner':'member'}:(respond(res,404,{error:'Not a member'}),null),fail:(res,status,message)=>respond(res,status,{error:message})});
async function call(method,route,userId=10,params={},body={}){
 const fn=endpoints.get(`${method} ${route}`);assert(fn,`missing ${method} ${route}`);
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
 await fn({params:{id:'1',...params},body,user:{id:userId}},res);return res;
}
const base='/api/trips/:id/checklist',itemRoute=base+'/:itemId';
test.beforeEach(()=>{rows=[];nextId=1;finished=false;});
test('each item belongs to a trip member and all members can see grouped data',async()=>{
 let result=await call('POST',base,10,{}, {label:'Camera',assignedTo:'20'});
 assert.equal(result.statusCode,201);assert.equal(result.body.item.assignedTo,'20');
 result=await call('POST',base,30,{}, {label:'Passport'});
 assert.equal(result.body.item.assignedTo,'30');
 const read=await call('GET',base,20);
 assert.deepEqual(read.body.items.map(x=>[x.label,x.assignedTo]),[['Camera','20'],['Passport','30']]);
});
test('assigned member or trip owner can check/edit/delete, but other members cannot',async()=>{
 const create=await call('POST',base,10,{}, {label:'Charger',assignedTo:'20'});
 const id=create.body.item.id;
 assert.equal((await call('PATCH',itemRoute,30,{itemId:id},{checked:true})).statusCode,403);
 assert.equal((await call('DELETE',itemRoute,30,{itemId:id})).statusCode,403);
 let result=await call('PATCH',itemRoute,20,{itemId:id},{checked:true,label:'USB charger'});
 assert.equal(result.statusCode,200);assert.equal(result.body.item.checked,true);
 result=await call('PATCH',itemRoute,10,{itemId:id},{assignedTo:'30'});
 assert.equal(result.statusCode,200);assert.equal(result.body.item.assignedTo,'30');
 assert.equal((await call('PATCH',itemRoute,20,{itemId:id},{checked:false})).statusCode,403);
 assert.equal((await call('DELETE',itemRoute,30,{itemId:id})).statusCode,200);
 assert.equal((await call('GET',base)).body.items.length,0);
});
test('invalid member assignments, empty labels and foreign trip reject writes',async()=>{
 assert.equal((await call('POST',base,10,{}, {label:'Suitcase',assignedTo:'999'})).statusCode,400);
 assert.equal((await call('POST',base,10,{}, {label:'   '})).statusCode,400);
 const create=await call('POST',base,10,{}, {label:'Passport',assignedTo:'20'});
 assert.equal((await call('PATCH',itemRoute,10,{itemId:create.body.item.id},{assignedTo:'999'})).statusCode,400);
 assert.equal((await call('PATCH',itemRoute,10,{itemId:'999'},{checked:true})).statusCode,404);
 assert.equal((await call('GET',base,10,{id:'9'})).statusCode,404);
});
test('finished trip is read-only while checklist remains visible',async()=>{
 await call('POST',base,10,{}, {label:'Tent',assignedTo:'10'});
 finished=true;
 assert.equal((await call('POST',base,10,{}, {label:'Flashlight'})).statusCode,409);
 assert.equal((await call('PATCH',itemRoute,10,{itemId:'1'},{checked:true})).statusCode,409);
 assert.equal((await call('GET',base)).body.items.length,1);
});
