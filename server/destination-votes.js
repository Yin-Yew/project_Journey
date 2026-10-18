/* Public destination polls shared across all JoyJourney accounts; independent of trips. */
const validId = value => /^[1-9]\d*$/.test(String(value));
const clean = (value,limit) => typeof value==='string' ? value.trim().slice(0,limit+1) : '';
function validateCandidate(body={}) {
  const name=clean(body.name,150),details=clean(body.details,1000),image=clean(body.image,1500);
  if(!name||name.length>150||details.length>1000||image.length>1500||(image&&!/^https:\/\/[^\s]+$/i.test(image)))return null;
  return {name,details,image};
}
const pollDTO = (row,userId) => ({
  id:String(row.id),title:row.title,status:row.status,
  role:String(row.owner_id)===String(userId)?'owner':'voter',ownerId:String(row.owner_id),
  options:Number(row.option_count||0),votes:Number(row.vote_count||0)
});
module.exports=function registerDestinationVotes(app,{run,protect,fail}){
  async function findPoll(req,res,ownerOnly=false){
    if(!validId(req.params.id)){fail(res,400,'Invalid poll ID.');return null;}
    const [rows]=await run('SELECT * FROM destination_polls WHERE id=?',[req.params.id]);
    if(!rows.length){fail(res,404,'Voting poll not found.');return null;}
    const poll=rows[0];
    poll.role=String(poll.owner_id)===String(req.user.id)?'owner':'voter';
    if(ownerOnly&&poll.role!=='owner'){fail(res,403,'Only the poll owner may do this.');return null;}
    return poll;
  }
  function ensureOpen(res,poll){if(poll.status!=='open'){fail(res,409,'Voting is closed. Ask the owner to reopen it.');return false;}return true;}
  async function details(poll,userId){
    const [[candidates],[ballot]] = await Promise.all([
      run('SELECT c.id,c.name,c.details,c.image_url,c.created_by,COUNT(v.user_id) AS votes FROM destination_candidates c LEFT JOIN destination_votes v ON v.candidate_id=c.id AND v.poll_id=c.poll_id WHERE c.poll_id=? GROUP BY c.id ORDER BY votes DESC,c.id ASC',[poll.id]),
      run('SELECT candidate_id FROM destination_votes WHERE poll_id=? AND user_id=?',[poll.id,userId])
    ]);
    return {poll:{id:String(poll.id),title:poll.title,status:poll.status,role:poll.role,ownerId:String(poll.owner_id)},
      options:candidates.map(o=>({id:String(o.id),name:o.name,details:o.details||'',image:o.image_url||'',createdBy:String(o.created_by),votes:Number(o.votes)})),
      myVote:ballot.length?String(ballot[0].candidate_id):null};
  }
  // No join/invite step: every signed-in account can discover and vote in every open poll.
  app.get('/api/destination-polls',...protect(async(req,res)=>{
    const [rows]=await run(`SELECT p.*,
    (SELECT COUNT(*) FROM destination_candidates WHERE poll_id=p.id) AS option_count,
    (SELECT COUNT(*) FROM destination_votes WHERE poll_id=p.id) AS vote_count
    FROM destination_polls p ORDER BY p.created_at DESC,p.id DESC`);
    res.json({polls:rows.map(row=>pollDTO(row,req.user.id))});
  }));
  app.post('/api/destination-polls',...protect(async(req,res)=>{
    const title=clean(req.body?.title,150);
    if(!title||title.length>150)return fail(res,400,'Please enter a poll title (up to 150 characters).');
    const [result]=await run("INSERT INTO destination_polls (owner_id,title,status) VALUES (?,?,'open')",[req.user.id,title]);
    res.status(201).json({poll:{id:String(result.insertId),title,status:'open',role:'owner',ownerId:String(req.user.id)}});
  }));
  app.get('/api/destination-polls/:id',...protect(async(req,res)=>{
    const poll=await findPoll(req,res);if(!poll)return;
    res.json(await details(poll,req.user.id));
  }));
  app.patch('/api/destination-polls/:id',...protect(async(req,res)=>{
    const poll=await findPoll(req,res,true);if(!poll)return;
    const body=req.body||{};
    const title=body.title===undefined?poll.title:clean(body.title,150);
    const status=body.status===undefined?poll.status:body.status;
    if(!title||title.length>150||!['open','closed'].includes(status))return fail(res,400,'Invalid poll title or status.');
    await run('UPDATE destination_polls SET title=?,status=? WHERE id=?',[title,status,poll.id]);
    res.json({ok:true});
  }));
  app.delete('/api/destination-polls/:id',...protect(async(req,res)=>{
    const poll=await findPoll(req,res,true);if(!poll)return;
    await run('DELETE FROM destination_polls WHERE id=?',[poll.id]);res.json({ok:true});
  }));
  app.post('/api/destination-polls/:id/options',...protect(async(req,res)=>{
    const poll=await findPoll(req,res);if(!poll)return;if(!ensureOpen(res,poll))return;
    const candidate=validateCandidate(req.body);if(!candidate)return fail(res,400,'Enter a destination and optionally a description or HTTPS photo URL.');
    const [count]=await run('SELECT COUNT(*) AS total FROM destination_candidates WHERE poll_id=?',[poll.id]);
    if(Number(count[0].total)>=100)return fail(res,409,'A poll supports at most 100 destinations.');
    const [result]=await run('INSERT INTO destination_candidates (poll_id,name,details,image_url,created_by) VALUES (?,?,?,?,?)',[poll.id,candidate.name,candidate.details,candidate.image||null,req.user.id]);
    res.status(201).json({option:{id:String(result.insertId),...candidate,votes:0}});
  }));
  app.patch('/api/destination-polls/:id/options/:optionId',...protect(async(req,res)=>{
    const poll=await findPoll(req,res);if(!poll)return;if(!ensureOpen(res,poll))return;
    if(!validId(req.params.optionId))return fail(res,400,'Invalid destination ID.');
    const [rows]=await run('SELECT id,created_by FROM destination_candidates WHERE id=? AND poll_id=?',[req.params.optionId,poll.id]);
    if(!rows.length)return fail(res,404,'Destination not found.');
    if(poll.role!=='owner'&&String(rows[0].created_by)!==String(req.user.id))return fail(res,403,'Only its creator or the owner may edit this destination.');
    const candidate=validateCandidate(req.body);if(!candidate)return fail(res,400,'Invalid destination details.');
    await run('UPDATE destination_candidates SET name=?,details=?,image_url=? WHERE id=? AND poll_id=?',[candidate.name,candidate.details,candidate.image||null,req.params.optionId,poll.id]);res.json({ok:true});
  }));
  app.delete('/api/destination-polls/:id/options/:optionId',...protect(async(req,res)=>{
    const poll=await findPoll(req,res);if(!poll)return;if(!ensureOpen(res,poll))return;
    if(!validId(req.params.optionId))return fail(res,400,'Invalid destination ID.');
    const [rows]=await run('SELECT id,created_by FROM destination_candidates WHERE id=? AND poll_id=?',[req.params.optionId,poll.id]);
    if(!rows.length)return fail(res,404,'Destination not found.');
    if(poll.role!=='owner'&&String(rows[0].created_by)!==String(req.user.id))return fail(res,403,'Only its creator or the owner may delete this destination.');
    await run('DELETE FROM destination_candidates WHERE id=? AND poll_id=?',[req.params.optionId,poll.id]);res.json({ok:true});
  }));
  app.put('/api/destination-polls/:id/vote',...protect(async(req,res)=>{
    const poll=await findPoll(req,res);if(!poll)return;if(!ensureOpen(res,poll))return;
    if(!validId(req.body?.optionId))return fail(res,400,'Choose a valid destination.');
    const [options]=await run('SELECT id FROM destination_candidates WHERE id=? AND poll_id=?',[req.body.optionId,poll.id]);
    if(!options.length)return fail(res,404,'Destination not found in this poll.');
    // PK (poll_id,user_id) ensures each registered account has only one live choice per poll.
    await run('INSERT INTO destination_votes (poll_id,user_id,candidate_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE candidate_id=VALUES(candidate_id)',[poll.id,req.user.id,req.body.optionId]);
    res.json({ok:true,optionId:String(req.body.optionId)});
  }));
  app.delete('/api/destination-polls/:id/vote',...protect(async(req,res)=>{
    const poll=await findPoll(req,res);if(!poll)return;if(!ensureOpen(res,poll))return;
    await run('DELETE FROM destination_votes WHERE poll_id=? AND user_id=?',[poll.id,req.user.id]);res.json({ok:true});
  }));
};
module.exports.validateCandidate=validateCandidate;
