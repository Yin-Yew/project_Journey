// Isolated API behavior tests using a minimal in-memory SQL double.
// No DB server/dependencies required; run with `node --test tests/*.test.js`.
const test=require('node:test');
const assert=require('node:assert/strict');
const register=require('../server/checklist');
const endpoints=new Map();
let nextId=1;
let rows=[];
let finished=false;
const app={get:(route,...f)=>endpoints.set(`GET ${route}`,f.at(-1)),post:(route,...f)=>endpoints.set(`POST ${route}`,f.at(-1)),patch:(route,...f)=>endpoints.set(`PATCH ${route}`,f.at(-1)),delete:(route,...f)=>endpoints.set(`DELETE ${route}`,f.at(-1))};
async function run(sql,params=[]){
 if(sql.startsWith('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? ORDER'))return [rows.filter(x=>x.trip_id===String(params[0]))];
 if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:rows.filter(x=>x.trip_id===String(params[0])).length}]];
 if(sql.startsWith('INSERT INTO trip_checklist_items')){
  const r={id:nextId++,trip_id:String(params[0]),label:params[1],is_checked:0};rows.push(r);return [{insertId:r.id}];
 }
 if(sql.startsWith('UPDATE trip_checklist_items')){
  const r=rows.find(x=>x.trip_id===String(params.at(-2))&&String(x.id)===String(params.at(-1)));
  if(!r)return [{affectedRows:0}];
  if(sql.includes('label=?'))r.label=params[0];
  if(sql.includes('is_checked=?'))r.is_checked=params[sql.includes('label=?')?1:0];
  return [{affectedRows:1}];
 }
 if(sql.startsWith('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? AND id=?'))return [rows.filter(x=>x.trip_id===String(params[0])&&String(x.id)===String(params[1]))];
 if(sql.startsWith('DELETE FROM trip_checklist_items')){
  const before=rows.length;rows=rows.filter(x=>!(x.trip_id===String(params[0])&&String(x.id)===String(params[1])));return [{affectedRows:before-rows.length}];
 }
 throw Error(`Unexpected query: ${sql}`);
}
register(app,{run,protect:fn=>[fn],membership:async(req,res)=>req.params.id==='1'?{id:1,status:finished?'finished':'active'}:(respond(res,404,{error:'Not a member'}),null),fail:(res,status,message)=>respond(res,status,{error:message})});
function respond(res,status,data){res.statusCode=status;res.body=data;return res;}
async function call(method,route,params={},body={}){
 const fn=endpoints.get(`${method} ${route}`);assert(fn,`missing ${method} ${route}`);
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 await fn({params:{id:'1',...params},body,user:{id:10}},res);return res;
}
test('create, edit, check and delete independent rows',async()=>{
 let res=await call('POST','/api/trips/:id/checklist',{}, {label:'Passport'});
 assert.equal(res.statusCode,201);assert.equal(res.body.item.label,'Passport');
 const a=res.body.item.id;
 res=await call('POST','/api/trips/:id/checklist',{}, {label:'Power bank'});
 const b=res.body.item.id;
 await call('PATCH','/api/trips/:id/checklist/:itemId',{itemId:a},{checked:true});
 await call('PATCH','/api/trips/:id/checklist/:itemId',{itemId:b},{label:'Charged power bank'});
 res=await call('GET','/api/trips/:id/checklist');
 assert.deepEqual(res.body.items.map(x=>[x.label,x.checked]),[['Passport',true],['Charged power bank',false]]);
 await call('DELETE','/api/trips/:id/checklist/:itemId',{itemId:a});
 res=await call('GET','/api/trips/:id/checklist');assert.equal(res.body.items.length,1);
});
test('reject invalid data and unrelated trip IDs',async()=>{
 let res=await call('POST','/api/trips/:id/checklist',{}, {label:' '.repeat(10)});assert.equal(res.statusCode,400);
 res=await call('PATCH','/api/trips/:id/checklist/:itemId',{itemId:'999'},{checked:true});assert.equal(res.statusCode,404);
 res=await call('GET','/api/trips/:id/checklist',{id:'9'});assert.equal(res.statusCode,404);
});
test('finished trip is read only',async()=>{
 finished=true;
 const res=await call('POST','/api/trips/:id/checklist',{}, {label:'Tent'});assert.equal(res.statusCode,409);
 const read=await call('GET','/api/trips/:id/checklist');assert.equal(read.statusCode,200);
 finished=false;
});
