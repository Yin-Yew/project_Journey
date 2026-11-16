const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const register=require('../server/next-trip');
const {utcInput,votePhase}=register;
const NOW='2026-11-16 04:00:00'; // Test clock is UTC; wall-clock 11:00 in Bangkok.
const BASE_START='2026-11-15 04:00:00';
const BASE_END='2026-11-22 04:00:00';
function fixture(hasDemo=true){
 const handlers=new Map();
 const polls=hasDemo?[{id:8,owner_id:2,title:'Demo destinations',status:'open'},{id:9,owner_id:1,status:'closed'}]:[];
 const options=hasDemo?[{id:5,poll_id:8,name:'Nan',created_by:2},{id:6,poll_id:8,name:'Phuket',created_by:1}]:[];
 const ballots=new Map(hasDemo?[['8:1',6],['8:2',5]]:[]);
 let nextPoll=10,nextOption=10,boardId=null,locks=0;
 let schedule={start_at:null,end_at:null};
 const app=Object.fromEntries(['get','post','put','delete'].map(method=>[method,(route,...fns)=>handlers.set(`${method.toUpperCase()} ${route}`,fns.at(-1))]));
 const fail=(res,code,msg)=>res.status(code).json({error:msg});
 function respond(sql,args=[]){
   if(sql==='SELECT poll_id FROM next_trip_board WHERE slot=1')return [boardId?[{poll_id:boardId}]:[]];
   if(sql.startsWith("SELECT id FROM destination_polls WHERE status='open'"))return [polls.filter(p=>p.status==='open').sort((a,b)=>a.id-b.id).slice(0,1)];
   if(sql.startsWith('INSERT INTO destination_polls')){const id=nextPoll++;polls.push({id,owner_id:Number(args[0]),status:'open',title:args[1]});return [{insertId:id}];}
   if(sql.startsWith('INSERT INTO next_trip_board')){boardId=args[0];schedule={start_at:BASE_START,end_at:BASE_END};return [{affectedRows:1}];}
   if(sql.startsWith('SELECT GET_LOCK')){locks++;return [[{acquired:1}]];}
   if(sql.startsWith('SELECT RELEASE_LOCK')){locks--;return [[{released:1}]];}
   if(sql.startsWith('UPDATE next_trip_board SET start_at=UTC_TIMESTAMP()')){
     if(schedule.start_at===null||schedule.end_at===null)schedule={start_at:BASE_START,end_at:BASE_END};
     return [{affectedRows:1}];
   }
   if(sql.startsWith('SELECT b.poll_id,b.start_at')){
     const poll=polls.find(p=>p.id===Number(boardId));
     return [[{...schedule,poll_id:boardId,owner_id:poll.owner_id,status:poll.status,server_now:NOW}]];
   }
   if(sql.startsWith('UPDATE next_trip_board SET start_at=?')){schedule={start_at:args[0],end_at:args[1]};return [{affectedRows:1}];}
   if(sql.includes('FROM destination_candidates c LEFT JOIN destination_votes')){
     return [options.filter(x=>x.poll_id===Number(args[0])).map(x=>({id:x.id,name:x.name,votes:[...ballots.entries()].filter(([key,id])=>Number(key.split(':')[0])===Number(args[0])&&id===x.id).length})).sort((a,b)=>b.votes-a.votes||a.id-b.id)];
   }
   if(sql.startsWith('SELECT candidate_id FROM destination_votes')){
     const id=ballots.get(`${args[0]}:${args[1]}`);return [id?[{candidate_id:id}]:[]];
   }
   if(sql.startsWith('SELECT id FROM destination_candidates WHERE poll_id=? AND LOWER(name)='))return [options.filter(x=>x.poll_id===Number(args[0])&&x.name.toLowerCase()===String(args[1]).toLowerCase())];
   if(sql.startsWith('SELECT COUNT(*) AS total FROM destination_candidates'))return [[{total:options.filter(x=>x.poll_id===Number(args[0])).length}]];
   if(sql.startsWith('INSERT INTO destination_candidates')){const id=nextOption++;options.push({id,poll_id:Number(args[0]),name:args[1],created_by:args[4]});return [{insertId:id}];}
   if(sql.startsWith('SELECT id FROM destination_candidates WHERE poll_id=? AND id=?'))return [options.filter(x=>x.poll_id===Number(args[0])&&x.id===Number(args[1]))];
   if(sql.startsWith('INSERT INTO destination_votes')){ballots.set(`${args[0]}:${args[1]}`,Number(args[2]));return [{affectedRows:1}];}
   if(sql.startsWith('DELETE FROM destination_votes')){ballots.delete(`${args[0]}:${args[1]}`);return [{affectedRows:1}];}
   throw new Error('Unexpected mock SQL: '+sql);
 }
 const run=async(sql,args=[])=>respond(sql,args);
 const pool={async getConnection(){return {execute:run,release(){}};}};
 register(app,{run,pool,protect:fn=>[fn],fail});
 async function call(method,route,userId,body={}){
   const handler=handlers.get(`${method} ${route}`);assert(handler,'No handler for '+method+' '+route);
   const res={code:200,status(n){this.code=n;return this;},json(value){this.body=value;return this;}};
   await handler({user:{id:userId},body},res);return res;
 }
 return {call,polls,options,ballots,board:()=>boardId,locks:()=>locks,schedule:()=>schedule};
}

test('friends use one board; anonymous results include only totals and own vote',async()=>{
 const f=fixture();
 const gun=await f.call('GET','/api/next-trip',1);
 const ploy=await f.call('GET','/api/next-trip',4);
 assert.equal(f.board(),8);assert.equal(gun.body.options.length,2);
 assert.equal(gun.body.totalVotes,2);assert.equal(ploy.body.totalVotes,2);
 assert.equal(gun.body.myVote,'6');assert.equal(ploy.body.myVote,null);
 assert.equal(gun.body.phase,'active');assert.equal(gun.body.canVote,true);
 assert.equal(gun.body.canEditSchedule,false);
 assert.equal((await f.call('GET','/api/next-trip',2)).body.canEditSchedule,true);
 assert.equal(gun.body.options.find(o=>o.id==='5').votes,1);
 assert.equal(JSON.stringify(gun.body).includes('Yind'),false);
 assert.equal(JSON.stringify(gun.body).includes('Gun'),false);
 assert.equal('voters' in gun.body.options[0],false);
 assert.equal('createdBy' in gun.body.options[0],false);
 assert.equal(f.locks(),0);
});
test('friends add a name only; duplicates and invalid names are rejected',async()=>{
 const f=fixture();
 let result=await f.call('POST','/api/next-trip/destinations',3,{name:'  Chiang Rai  '});
 assert.equal(result.code,201);assert.equal(result.body.option.name,'Chiang Rai');
 result=await f.call('POST','/api/next-trip/destinations',4,{name:'chiang rai'});assert.equal(result.code,409);
 result=await f.call('POST','/api/next-trip/destinations',4,{name:'A'});assert.equal(result.code,400);
 result=await f.call('GET','/api/next-trip',4);
 assert.equal(result.body.options.some(o=>o.name==='Chiang Rai'),true);
});
test('one vote per account; switching and canceling do not expose identity',async()=>{
 const f=fixture();
 let result=await f.call('PUT','/api/next-trip/vote',3,{optionId:'5'});assert.equal(result.code,200);
 result=await f.call('PUT','/api/next-trip/vote',3,{optionId:'6'});assert.equal(result.code,200);
 assert.equal(f.ballots.size,3);
 result=await f.call('GET','/api/next-trip',3);assert.equal(result.body.myVote,'6');
 assert.equal(result.body.options.find(o=>o.id==='6').votes,2);
 await f.call('DELETE','/api/next-trip/vote',3);assert.equal(f.ballots.size,2);
 result=await f.call('PUT','/api/next-trip/vote',3,{optionId:'999'});assert.equal(result.code,404);
});
test('the board owner controls start/end and other friends cannot change it',async()=>{
 const f=fixture();
 let result=await f.call('PUT','/api/next-trip/schedule',1,{startAt:'2026-11-18T03:00:00.000Z',endAt:'2026-11-20T03:00:00.000Z'});
 assert.equal(result.code,403);
 result=await f.call('PUT','/api/next-trip/schedule',2,{startAt:'2026-11-18T03:00:00.000Z',endAt:'2026-11-20T03:00:00.000Z'});
 assert.equal(result.code,200);
 assert.equal(f.schedule().end_at,'2026-11-20 03:00:00');
 result=await f.call('GET','/api/next-trip',3);
 assert.equal(result.body.phase,'upcoming');assert.equal(result.body.canVote,false);assert.equal(result.body.canAdd,true);
 assert.equal(result.body.startAt,'2026-11-18T03:00:00Z');
 assert.equal((await f.call('PUT','/api/next-trip/vote',3,{optionId:5})).code,409);
 assert.equal((await f.call('POST','/api/next-trip/destinations',3,{name:'Osaka'})).code,201);
});
test('after end time, voting and adding stop, but results stay visible',async()=>{
 const f=fixture();
 await f.call('PUT','/api/next-trip/schedule',2,{startAt:'2026-11-13T04:00:00.000Z',endAt:'2026-11-15T04:00:00.000Z'});
 let result=await f.call('GET','/api/next-trip',1);
 assert.equal(result.body.phase,'ended');assert.equal(result.body.canVote,false);assert.equal(result.body.totalVotes,2);
 result=await f.call('PUT','/api/next-trip/vote',3,{optionId:5});assert.equal(result.code,409);
 result=await f.call('DELETE','/api/next-trip/vote',1);assert.equal(result.code,409);
 result=await f.call('POST','/api/next-trip/destinations',4,{name:'Osaka'});assert.equal(result.code,409);
 assert.equal(f.ballots.size,2);
});
test('schedule rejects bad timestamps, reversed dates and excessive windows',async()=>{
 const f=fixture();
 let result=await f.call('PUT','/api/next-trip/schedule',2,{startAt:'2026-11-18T03:00:00.000Z',endAt:'2026-11-17T03:00:00.000Z'});
 assert.equal(result.code,400);
 result=await f.call('PUT','/api/next-trip/schedule',2,{startAt:'invalid',endAt:'2026-11-20T03:00:00.000Z'});
 assert.equal(result.code,400);
 result=await f.call('PUT','/api/next-trip/schedule',2,{startAt:'2026-11-18T03:00:00.000Z',endAt:'2028-11-20T03:00:00.000Z'});
 assert.equal(result.code,400);
 assert.equal(utcInput('2026-02-30T00:00:00Z'),null);
 assert.equal(votePhase({status:'open',server_now:NOW,start_at:BASE_START,end_at:BASE_END}),'active');
});
test('empty database creates one shared board and accepts place suggestions',async()=>{
 const f=fixture(false);
 const first=await f.call('GET','/api/next-trip',1);assert.equal(first.code,200);
 const second=await f.call('GET','/api/next-trip',4);assert.equal(second.code,200);
 assert.equal(f.polls.length,1);assert.equal(f.board(),10);assert.equal(f.locks(),0);
 assert.equal(first.body.canEditSchedule,true);assert.equal(second.body.canEditSchedule,false);
 const created=await f.call('POST','/api/next-trip/destinations',4,{name:'Japan'});
 assert.equal(created.code,201);assert.equal(f.options[0].poll_id,10);
});
test('schema/migration, setup, UI and client never show voter identities',()=>{
 const root=path.join(__dirname,'..');
 const sql=fs.readFileSync(path.join(root,'database/schema.sql'),'utf8');
 const migration=fs.readFileSync(path.join(root,'database/migrate_v8.sql'),'utf8');
 const setup=fs.readFileSync(path.join(root,'server/setup-db.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'public/voting.html'),'utf8');
 const script=fs.readFileSync(path.join(root,'public/js/destination-votes.js'),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS next_trip_board/);
 assert.match(sql,/start_at DATETIME/);assert.match(sql,/end_at DATETIME/);
 assert.match(migration,/ALTER TABLE next_trip_board ADD COLUMN start_at/);
 assert.match(setup,/schema\.sql/);
 assert.match(html,/name="name" type="text" required/);
 assert.match(html,/type="datetime-local" required/);
 assert.doesNotMatch(html,/Create Poll|Poll title|Photo URL|jjPollCreateModal/);
 assert.doesNotMatch(script,/item\.voters|addedBy|createdBy/);
 assert.match(script,/\/api\/next-trip\/schedule/);
});
