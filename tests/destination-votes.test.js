const test=require('node:test');
const assert=require('node:assert/strict');
const register=require('../server/destination-votes');
const handlers=new Map();
const polls=[{id:8,owner_id:1,status:'open',title:'Where next?',created_at:'2026-10-19'}];
const options=[{id:5,poll_id:8,name:'Chiang Mai',details:'mountains',image_url:'',created_by:1},{id:6,poll_id:8,name:'Phuket',details:'beach',image_url:'',created_by:2}];
const ballots=new Map();
let nextPollId=9;
const app=Object.fromEntries(['get','post','patch','put','delete'].map(method=>[method,(path,...fns)=>handlers.set(`${method.toUpperCase()} ${path}`,fns.at(-1))]));
const fail=(res,code,message)=>res.status(code).json({error:message});
async function run(sql,args=[]){
 if(sql==='SELECT * FROM destination_polls WHERE id=?')return [polls.filter(p=>p.id===Number(args[0]))];
 if(sql.includes('FROM destination_polls p ORDER BY'))return [polls.map(p=>({...p,option_count:options.filter(o=>o.poll_id===p.id).length,vote_count:ballots.size}))];
 if(sql.startsWith('INSERT INTO destination_polls')){const id=nextPollId++;polls.push({id,owner_id:args[0],title:args[1],status:'open'});return [{insertId:id}];}
 if(sql.startsWith('SELECT id FROM destination_candidates WHERE id='))return [options.filter(x=>Number(args[0])===x.id&&Number(args[1])===x.poll_id)];
 if(sql.startsWith('INSERT INTO destination_votes')){ballots.set(`${args[0]}:${args[1]}`,Number(args[2]));return [{affectedRows:1}];}
 if(sql.startsWith('DELETE FROM destination_votes')){ballots.delete(`${args[0]}:${args[1]}`);return [{affectedRows:1}];}
 if(sql.startsWith('SELECT c.id,c.name,c.details'))return [options.filter(o=>o.poll_id===Number(args[0])).map(o=>({...o,votes:[...ballots.values()].filter(id=>id===o.id).length}))];
 if(sql.startsWith('SELECT candidate_id FROM destination_votes')){const id=ballots.get(`${args[0]}:${args[1]}`);return [id?[{candidate_id:id}]:[]];}
 if(sql.startsWith('UPDATE destination_polls SET')){const poll=polls.find(p=>p.id===Number(args[2]));poll.title=args[0];poll.status=args[1];return [{affectedRows:1}];}
 if(sql.startsWith('DELETE FROM destination_polls WHERE')){polls.splice(polls.findIndex(p=>p.id===Number(args[0])),1);return [{affectedRows:1}];}
 if(sql.startsWith('SELECT COUNT(*) AS total FROM destination_candidates'))return [[{total:options.filter(o=>o.poll_id===Number(args[0])).length}]];
 if(sql.startsWith('INSERT INTO destination_candidates')){const id=Math.max(...options.map(o=>o.id))+1;options.push({id,poll_id:Number(args[0]),name:args[1],details:args[2],image_url:args[3],created_by:args[4]});return [{insertId:id}];}
 if(sql.startsWith('SELECT id,created_by FROM destination_candidates'))return [options.filter(o=>o.id===Number(args[0])&&o.poll_id===Number(args[1]))];
 throw new Error('Unexpected mock SQL: '+sql);
}
register(app,{run,protect:handler=>[handler],fail});
async function call(method,path,userId=1,body={},params={}){
 const fn=handlers.get(`${method} ${path}`);assert(fn,`Missing handler: ${method} ${path}`);
 const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await fn({user:{id:userId},body,params:{id:'8',...params}},res);
 return res;
}
test('a new poll needs no trip or invite code and appears to other signed-in users',async()=>{
 let response=await call('POST','/api/destination-polls',1,{title:'Next holiday'});
 assert.equal(response.code,201);assert.equal(response.body.poll.id,'9');
 assert.equal(response.body.poll.code,undefined);
 response=await call('GET','/api/destination-polls',47);
 assert.equal(response.body.polls.length,2);
 assert.equal(response.body.polls.find(p=>p.id==='8').role,'voter');
});
test('an account that never joined can read a poll and vote',async()=>{
 const res=await call('PUT','/api/destination-polls/:id/vote',99,{optionId:5});
 assert.equal(res.code,200);
 const detail=await call('GET','/api/destination-polls/:id',99);
 assert.equal(detail.body.myVote,'5');assert.equal(detail.body.poll.role,'voter');
});
test('one active ballot per account; switching overwrites rather than adds',async()=>{
 ballots.clear();
 await call('PUT','/api/destination-polls/:id/vote',1,{optionId:5});
 await call('PUT','/api/destination-polls/:id/vote',2,{optionId:6});
 await call('PUT','/api/destination-polls/:id/vote',2,{optionId:5});
 assert.equal(ballots.size,2);assert.equal(ballots.get('8:2'),5);
 const detail=await call('GET','/api/destination-polls/:id',2);
 assert.equal(detail.body.options.find(o=>o.id==='5').votes,2);
 await call('DELETE','/api/destination-polls/:id/vote',2);
 assert.equal(ballots.size,1);
});
test('invalid option IDs or option from other polls are rejected',async()=>{
 let res=await call('PUT','/api/destination-polls/:id/vote',3,{optionId:999});assert.equal(res.code,404);
 res=await call('PUT','/api/destination-polls/:id/vote',3,{optionId:'5; DROP TABLE'});assert.equal(res.code,400);
});
test('only owner can close, closed polls reject votes and suggestions, results remain public to accounts',async()=>{
 let res=await call('PATCH','/api/destination-polls/:id',3,{status:'closed'});assert.equal(res.code,403);
 res=await call('PATCH','/api/destination-polls/:id',1,{status:'closed'});assert.equal(res.code,200);
 res=await call('PUT','/api/destination-polls/:id/vote',4,{optionId:5});assert.equal(res.code,409);
 res=await call('POST','/api/destination-polls/:id/options',4,{name:'Osaka'});assert.equal(res.code,409);
 res=await call('GET','/api/destination-polls/:id',4);assert.equal(res.code,200);
 await call('PATCH','/api/destination-polls/:id',1,{status:'open'});
});
test('all signed-in accounts can suggest while input is validated',async()=>{
 let res=await call('POST','/api/destination-polls/:id/options',77,{name:'Osaka',image:'javascript:alert(1)'});assert.equal(res.code,400);
 res=await call('POST','/api/destination-polls/:id/options',77,{name:'Osaka',details:'Food'});assert.equal(res.code,201);
 assert.equal(res.body.option.name,'Osaka');
});
test('new schema has direct user voting, no poll membership prerequisite',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const sql=fs.readFileSync(path.join(__dirname,'../database/schema.sql'),'utf8');
 assert.match(sql,/PRIMARY KEY \(poll_id,user_id\)/);
 assert.match(sql,/fk_destination_votes_user FOREIGN KEY \(user_id\) REFERENCES users\(id\)/);
 assert.doesNotMatch(sql,/CREATE TABLE IF NOT EXISTS destination_poll_members/);
});
test('v6 migration preserves data, converts vote FK and removes code requirement',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const sql=fs.readFileSync(path.join(__dirname,'../database/migrate_v6.sql'),'utf8');
 assert.match(sql,/MODIFY COLUMN invite_code CHAR\(10\) NULL/);
 assert.match(sql,/DROP FOREIGN KEY/);
 assert.match(sql,/fk_destination_votes_user/);
 assert.doesNotMatch(sql,/DELETE FROM destination_votes/i);
});
