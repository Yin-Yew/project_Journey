const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

function financeContext(){
 const ctx=vm.createContext({
  document:{addEventListener(){}},
  tripDetailsCache:{'7':{members:[{id:'1',name:'Alex',promptpay:'0812345678'},{id:'2',name:'Bee'},{id:'3',name:'Cat'}]}},
  getStoredTrips:()=>[],
  getCurrentUserId:()=> '2',
  getTripById:()=>({status:'active'}),
  getJoyMembers:()=>[],
  URLSearchParams,
  location:{search:''},
  escapeHTML:s=>s,
  avatarUrl:()=>'',
 });
 vm.runInContext(read('public/js/finance.js'),ctx);
 return ctx;
}

test('finance default equal splits and personalized balances',()=>{
 const ctx=financeContext();
 ctx.getFinanceData().expenses['7']=[{id:'e1',title:'Van',amount:120,paidBy:'1',participants:['1','2','3'],splitType:'equal',shares:{}}];
 assert.deepEqual(Array.from(ctx.computeSettlements('7'),x=>({from:x.from,to:x.to,amount:x.amount})),[
  {from:'2',to:'1',amount:40}, {from:'3',to:'1',amount:40}
 ]);
 const summary=ctx.financeSummary('7');
 assert.equal(summary.total,120);
 assert.equal(summary.owe,40);
 assert.equal(summary.receive,0);
});

test('finance paid settlements are excluded from outstanding amount',()=>{
 const ctx=financeContext();
 ctx.getFinanceData().expenses['7']=[{id:'e1',title:'Van',amount:120,paidBy:'1',participants:['1','2','3'],splitType:'equal',shares:{}}];
 ctx.getFinanceData().payments=[{tripId:'7',from:'2',to:'1',amount:40,key:'7|2|1|40.00',status:'paid'}];
 assert.equal(ctx.financeSummary('7').owe,0);
});

test('finance page has advanced splitting and only PromptPay transfer details',()=>{
 const html=read('public/expenses.html');
 assert.match(html,/id="expenseAdvancedSplit"/);
 assert.match(html,/id="expenseSplitType"/);
 assert.match(html,/id="payPromptPay"/);
 assert.doesNotMatch(html,/id="payBank"|id="paymentCode"|Demo payment code/);
});

test('profile has a single display name and no editable bank or username',()=>{
 const html=read('public/profile.html');
 assert.match(html,/id="profileName"/);
 assert.doesNotMatch(html,/id="profileBankName"|id="profileBankAccount"|id="profileUsername"/);
});

test('planner has manual status button and backend retains owner check',()=>{
 assert.match(read('public/planner.html'),/id="jjTripStatusButton"/);
 assert.match(read('public/js/planner-places.js'),/function jjSetPlannerTripStatus/);
 assert.match(read('server/app.js'),/app\.patch\('\/api\/trips\/:id\/status',[\s\S]*?membership\(req,res,true\)/);
});
