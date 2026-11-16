const test=require('node:test');
const assert=require('node:assert/strict');
const register=require('../server/checklist');
const endpoints=new Map();
let rows=[],nextId=1,finished=false;
const app=Object.fromEntries(['get','post','patch','delete'].map(m=>[m,(route,...f)=>endpoints.set(`${m.toUpperCase()} ${route}`,f.at(-1))]));
async function run(sql,params=[]){
 if(sql.startsWith('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? AND id=? AND assigned_to=?')){
  return [rows.filter(r=>r.trip_id===String(params[0])&&String(r.id)===String(params[1])&&String(r.assigned_to)===String(params[2]))];
 }
 if(sql.startsWith('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? AND assigned_to=? ORDER BY id')){
  return [rows.filter(r=>r.trip_id===String(params[0])&&String(r.assigned_to)===String(params[1]))];
 }
 if(sql.startsWith('SELECT COUNT(*) AS total FROM trip_checklist_items')){
  return [[{total:rows.filter(r=>r.trip_id===String(params[0])&&String(r.assigned_to)===String(params[1])).length}]];
 }
 if(sql.startsWith('INSERT INTO trip_checklist_items')){
  const r={id:nextId++,trip_id:String(params[0]),label:params[1],is_checked:0,created_by:params[2],assigned_to:params[3]};
  rows.push(r);return [{insertId:r.id}];
 }
 if(sql.startsWith('UPDATE trip_checklist_items')){
  const target=rows.find(row=>row.trip_id===String(params.at(-3))&&String(row.id)===String(params.at(-2))&&String(row.assigned_to)===String(params.at(-1)));
  if(!target)return [{affectedRows:0}];
  const fields=sql.match(/SET (.*?) WHERE/)[1].split(',');
  fields.forEach((field,i)=>{const key=field.split('=')[0];if(key==='label')target.label=params[i];if(key==='is_checked')target.is_checked=params[i];});
  return [{affectedRows:1}];
 }
 if(sql.startsWith('DELETE FROM trip_checklist_items')){
  const before=rows.length;
  rows=rows.filter(r=>!(r.trip_id===String(params[0])&&String(r.id)===String(params[1])&&String(r.assigned_to)===String(params[2])));
  return [{affectedRows:before-rows.length}];
 }
 throw Error('Unexpected query: '+sql);
}
const respond=(res,status,data)=>{res.statusCode=status;res.body=data;return res;};
register(app,{run,protect:fn=>[fn],membership:async(req,res)=>
 ['1','2'].includes(req.params.id)?{id:Number(req.params.id),status:finished?'finished':'active',role:req.user.id===10?'owner':'member'}:(respond(res,404,{error:'Not a member'}),null),
 fail:(res,status,message)=>respond(res,status,{error:message})});
async function call(method,route,userId=10,params={},body={}){
 const fn=endpoints.get(`${method} ${route}`);assert(fn,`Missing ${method} ${route}`);
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
 await fn({params:{id:'1',...params},body,user:{id:userId}},res);return res;
}
const base='/api/trips/:id/checklist',itemRoute=base+'/:itemId';
test.beforeEach(()=>{rows=[];nextId=1;finished=false;});
test('private notes: each account sees only their own packing list, even the trip owner',async()=>{
 await call('POST',base,10,{}, {label:'Passport'});
 await call('POST',base,20,{}, {label:'Phone charger'});
 assert.deepEqual((await call('GET',base,10)).body.items.map(x=>x.label),['Passport']);
 assert.deepEqual((await call('GET',base,20)).body.items.map(x=>x.label),['Phone charger']);
 assert.equal((await call('GET',base,30)).body.items.length,0);
 assert.ok(!JSON.stringify((await call('GET',base,10)).body).includes('Phone charger'));
});
test('users cannot create notes for someone else or transfer ownership',async()=>{
 assert.equal((await call('POST',base,10,{}, {label:'Suitcase',assignedTo:'20'})).statusCode,400);
 const item=(await call('POST',base,20,{}, {label:'Camera'})).body.item;
 assert.deepEqual(Object.keys(item).sort(),['checked','id','label']);
 assert.equal((await call('PATCH',itemRoute,20,{itemId:item.id},{assignedTo:'10'})).statusCode,400);
 assert.equal((await call('GET',base,10)).body.items.length,0);
});
test('members and owners cannot read/edit/delete another account’s note by guessing its ID',async()=>{
 const item=(await call('POST',base,20,{}, {label:'Private medication'})).body.item;
 assert.equal((await call('PATCH',itemRoute,10,{itemId:item.id},{checked:true})).statusCode,404);
 assert.equal((await call('DELETE',itemRoute,10,{itemId:item.id})).statusCode,404);
 assert.equal((await call('PATCH',itemRoute,30,{itemId:item.id},{label:'Stolen'})).statusCode,404);
 assert.equal((await call('DELETE',itemRoute,30,{itemId:item.id})).statusCode,404);
 assert.deepEqual((await call('GET',base,20)).body.items.map(x=>x.label),['Private medication']);
});
test('account can add, tick, edit and delete own note; trips remain isolated',async()=>{
 const item=(await call('POST',base,20,{}, {label:'USB charger'})).body.item;
 const change=await call('PATCH',itemRoute,20,{itemId:item.id},{checked:true,label:'Laptop charger'});
 assert.equal(change.statusCode,200);
 assert.deepEqual(change.body.item,{id:item.id,label:'Laptop charger',checked:true});
 assert.equal((await call('GET',base,20,{id:'2'})).body.items.length,0);
 assert.equal((await call('DELETE',itemRoute,20,{itemId:item.id})).statusCode,200);
 assert.equal((await call('GET',base,20)).body.items.length,0);
});
test('finished trips remain viewable but read-only; validation prevents malformed notes',async()=>{
 assert.equal((await call('POST',base,10,{}, {label:'   '})).statusCode,400);
 assert.equal((await call('POST',base,10,{}, {label:'p'.repeat(151)})).statusCode,400);
 const item=(await call('POST',base,10,{}, {label:'Passport'})).body.item;
 assert.equal((await call('PATCH',itemRoute,10,{itemId:item.id},{checked:1})).statusCode,400);
 finished=true;
 assert.equal((await call('POST',base,10,{}, {label:'Sunscreen'})).statusCode,409);
 assert.equal((await call('PATCH',itemRoute,10,{itemId:item.id},{checked:true})).statusCode,409);
 assert.equal((await call('DELETE',itemRoute,10,{itemId:item.id})).statusCode,409);
 assert.equal((await call('GET',base,10)).body.items.length,1);
});
test('reject foreign trip IDs with no data leak',async()=>{
 const r=await call('GET',base,20,{id:'9'});assert.equal(r.statusCode,404);
});
