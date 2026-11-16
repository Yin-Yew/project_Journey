const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../public/js/trips-api.js'),'utf8');
function boot(api){
 const seen=[];
 const context={
  console, URLSearchParams, setInterval(){}, clearInterval(){},
  localStorage:{getItem(){return 'test-token';},setItem(){},removeItem(){}},
  window:{addEventListener(){}},
  document:{addEventListener(){},querySelector(){return null;}},
  location:{pathname:'/checklist.html',href:'',replace(){}},
  fetch:async(url,opts)=>{seen.push({url,authorization:opts.headers.Authorization});
   const result=api[url]||{status:404,body:{error:'API route not found.'}};
   return {ok:result.status===200,status:result.status,json:async()=>result.body};}
 };
 vm.createContext(context);
 vm.runInContext(script,context);
 vm.runInContext('currentProfile={id:"10",email:"account@example.com"};',context);
 return {seen,call:()=>vm.runInContext('readPrivateChecklist("5")',context)};
}
test('accepts only matching authenticated account with valid contract and notes',async()=>{
 const c=boot({'/api/checklist/version':{status:200,body:{contract:'private-checklist-v12.2',accountId:'10'}},'/api/trips/5/checklist':{status:200,body:{accountId:'10',items:[{id:'1',label:'Passport',checked:false}]}}});
 const result=await c.call();
 assert.equal(result.length,1);assert.equal(result[0].label,'Passport');
 assert.equal(c.seen.length,2);assert.equal(c.seen[0].authorization,'Bearer test-token');
});
test('an old backend is blocked BEFORE any checklist data can be read',async()=>{
 const c=boot({'/api/trips/5/checklist':{status:200,body:{items:[{label:'someone else'}]}}});
 await assert.rejects(c.call(),/older JoyJourney version/);
 assert.deepEqual(c.seen.map(x=>x.url),['/api/checklist/version']);
});
test('rejects a stale or switched account with no checklist request',async()=>{
 const c=boot({'/api/checklist/version':{status:200,body:{contract:'private-checklist-v12.2',accountId:'22'}}});
 await assert.rejects(c.call(),/sign-in changed/);
 assert.deepEqual(c.seen.map(x=>x.url),['/api/checklist/version']);
});
test('rejects a mismatched checklist payload without returning its items',async()=>{
 const c=boot({'/api/checklist/version':{status:200,body:{contract:'private-checklist-v12.2',accountId:'10'}},'/api/trips/5/checklist':{status:200,body:{accountId:'22',items:[{label:'Private'}]}}});
 await assert.rejects(c.call(),/could not be verified/);
});
