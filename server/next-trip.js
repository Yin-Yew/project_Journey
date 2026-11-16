/* Simple, shared Next Trip vote. Registered users nominate destinations and
   cast one anonymous ballot per account during an owner-set time window. */
const validId = value => /^[1-9]\d*$/.test(String(value));
const BOARD_LOCK = 'joyjourney_next_trip_board_v1';
const timestamp = value => String(value||'').replace(' ','T')+'Z';

// All times are stored in MySQL DATETIME as UTC, never server-local time.
function utcInput(value){
  if(typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:\.\d{3})?Z$/.test(value)) return null;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return null;
  const iso=date.toISOString();
  // Reject non-canonical or impossible calendar dates.
  if(iso.slice(0,16)!==value.slice(0,16)) return null;
  return iso.slice(0,19).replace('T',' ');
}
const votePhase = (board) => {
  if(board.status!=='open')return 'closed';
  const now=Date.parse(timestamp(board.server_now));
  const start=Date.parse(timestamp(board.start_at));
  const end=Date.parse(timestamp(board.end_at));
  return now<start?'upcoming':now>=end?'ended':'active';
};
module.exports = function registerNextTrip(app,{run,pool,protect,fail}) {
  async function boardId(userId) {
    const [existing]=await run('SELECT poll_id FROM next_trip_board WHERE slot=1');
    if(existing.length)return existing[0].poll_id;
    const conn=await pool.getConnection();
    let acquired=false;
    try {
      const [[lock]]=await conn.execute('SELECT GET_LOCK(?, 10) AS acquired',[BOARD_LOCK]);
      if(Number(lock?.acquired)!==1)throw new Error('Could not initialize voting. Please try again.');
      acquired=true;
      const [ready]=await conn.execute('SELECT poll_id FROM next_trip_board WHERE slot=1');
      if(ready.length)return ready[0].poll_id;
      // Preserve existing open polls and ballots when this feature is activated.
      const [open]=await conn.execute("SELECT id FROM destination_polls WHERE status='open' ORDER BY id ASC LIMIT 1");
      let pollId=open[0]?.id;
      if(!pollId){
        const [created]=await conn.execute("INSERT INTO destination_polls (owner_id,title,status) VALUES (?,?,'open')",[userId,'Where should we go next?']);
        pollId=created.insertId;
      }
      await conn.execute('INSERT INTO next_trip_board (slot,poll_id,start_at,end_at) VALUES (1,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[pollId]);
      return pollId;
    }finally{
      if(acquired){try{await conn.execute('SELECT RELEASE_LOCK(?) AS released',[BOARD_LOCK]);}catch(error){console.error('Next trip voting lock:',error);}}
      conn.release();
    }
  }
  async function board(userId){
    await boardId(userId);
    // Earlier v7 boards have NULL times until their first v8 page load.
    await run('UPDATE next_trip_board SET start_at=UTC_TIMESTAMP(),end_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY) WHERE slot=1 AND (start_at IS NULL OR end_at IS NULL)');
    const [rows]=await run(`SELECT b.poll_id,b.start_at,b.end_at,p.owner_id,p.status,UTC_TIMESTAMP() AS server_now
      FROM next_trip_board b JOIN destination_polls p ON p.id=b.poll_id WHERE b.slot=1`);
    if(!rows.length)throw new Error('Shared vote board was not created.');
    return rows[0];
  }
  function canEdit(userId,record){return String(userId)===String(record.owner_id);}
  function enforce(res,record,action){
    const phase=votePhase(record);
    if(phase==='closed'||phase==='ended'){
      fail(res,409,'หมดเวลาโหวตแล้ว สามารถดูผลคะแนนได้ แต่แก้ไขไม่ได้');return false;
    }
    if(action==='vote'&&phase==='upcoming'){
      fail(res,409,'ยังไม่ถึงเวลาเปิดโหวต');return false;
    }
    return true;
  }
  app.get('/api/next-trip',...protect(async(req,res)=>{
    const record=await board(req.user.id);
    const [[candidates],[mine]] = await Promise.all([
      run(`SELECT c.id,c.name,COUNT(v.user_id) AS votes
        FROM destination_candidates c LEFT JOIN destination_votes v ON v.candidate_id=c.id AND v.poll_id=c.poll_id
        WHERE c.poll_id=? GROUP BY c.id,c.name ORDER BY votes DESC,c.id ASC`,[record.poll_id]),
      run('SELECT candidate_id FROM destination_votes WHERE poll_id=? AND user_id=?',[record.poll_id,req.user.id])
    ]);
    const options=candidates.map(c=>({id:String(c.id),name:c.name,votes:Number(c.votes)}));
    const phase=votePhase(record);
    res.json({options,myVote:mine.length?String(mine[0].candidate_id):null,
      totalVotes:options.reduce((n,c)=>n+c.votes,0),
      phase,canEditSchedule:canEdit(req.user.id,record),
      canAdd:phase==='upcoming'||phase==='active',canVote:phase==='active',
      startAt:timestamp(record.start_at),endAt:timestamp(record.end_at)});
  }));

  app.put('/api/next-trip/schedule',...protect(async(req,res)=>{
    const record=await board(req.user.id);
    if(!canEdit(req.user.id,record))return fail(res,403,'เฉพาะคนสร้างการโหวตเท่านั้นที่กำหนดเวลาได้');
    const start=utcInput(req.body?.startAt),end=utcInput(req.body?.endAt);
    if(!start||!end)return fail(res,400,'กรุณาเลือกวันเวลาเริ่มและสิ้นสุดที่ถูกต้อง');
    const startMs=Date.parse(timestamp(start)),endMs=Date.parse(timestamp(end));
    if(endMs<=startMs)return fail(res,400,'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มโหวต');
    if(endMs-startMs>366*24*60*60*1000)return fail(res,400,'กำหนดช่วงเวลาโหวตได้ไม่เกิน 366 วัน');
    await run('UPDATE next_trip_board SET start_at=?,end_at=? WHERE slot=1',[start,end]);
    res.json({ok:true,startAt:timestamp(start),endAt:timestamp(end)});
  }));

  // History exposes aggregate results only. Past rounds are immutable and reusable.
  app.get('/api/next-trip/history',...protect(async(req,res)=>{
    await board(req.user.id);
    const [rounds]=await run(`SELECT h.id,h.start_at,h.end_at,p.id AS poll_id,
      COUNT(DISTINCT v.user_id) AS total_votes
      FROM next_trip_rounds h JOIN destination_polls p ON p.id=h.poll_id
      LEFT JOIN destination_votes v ON v.poll_id=p.id
      GROUP BY h.id,h.start_at,h.end_at,p.id ORDER BY h.id DESC LIMIT 15`);
    const history=[];
    for(const round of rounds){
      const [options]=await run(`SELECT c.name,COUNT(v.user_id) AS votes FROM destination_candidates c
        LEFT JOIN destination_votes v ON v.poll_id=c.poll_id AND v.candidate_id=c.id
        WHERE c.poll_id=? GROUP BY c.id,c.name ORDER BY votes DESC,c.id ASC`,[round.poll_id]);
      history.push({id:String(round.id),startAt:timestamp(round.start_at),endAt:timestamp(round.end_at),
        totalVotes:Number(round.total_votes),options:options.map(o=>({name:o.name,votes:Number(o.votes)}))});
    }
    res.json({history});
  }));
  app.post('/api/next-trip/rounds',...protect(async(req,res)=>{
    const start=utcInput(req.body?.startAt),end=utcInput(req.body?.endAt);
    if(!start||!end)return fail(res,400,'Please set valid start and end times for the new round.');
    const startMs=Date.parse(timestamp(start)),endMs=Date.parse(timestamp(end));
    if(endMs<=Date.now()||endMs<=startMs||endMs-startMs>366*86400000)
      return fail(res,400,'End time must be in the future, after the start, within 366 days.');
    await board(req.user.id);
    const conn=await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Serialize overlapping requests to create rounds, and protect old results.
      const [rows]=await conn.execute(`SELECT b.poll_id,b.start_at,b.end_at,p.owner_id
        FROM next_trip_board b JOIN destination_polls p ON p.id=b.poll_id
        WHERE b.slot=1 FOR UPDATE`);
      if(!rows.length){await conn.rollback();return fail(res,404,'Voting board not found.');}
      const old=rows[0];
      if(!canEdit(req.user.id,old)){await conn.rollback();return fail(res,403,'Only the current voting organizer can start a new round.');}
      await conn.execute('INSERT INTO next_trip_rounds (poll_id,start_at,end_at) VALUES (?,?,?)',[old.poll_id,old.start_at,old.end_at]);
      await conn.execute("UPDATE destination_polls SET status='closed' WHERE id=?",[old.poll_id]);
      const [created]=await conn.execute("INSERT INTO destination_polls (owner_id,title,status) VALUES (?,?,'open')",[req.user.id,'Where should we go next?']);
      await conn.execute('UPDATE next_trip_board SET poll_id=?,start_at=?,end_at=? WHERE slot=1',[created.insertId,start,end]);
      await conn.commit();res.status(201).json({ok:true,roundId:String(created.insertId)});
    }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  }));

  app.post('/api/next-trip/destinations',...protect(async(req,res)=>{
    const name=typeof req.body?.name==='string'?req.body.name.trim():'';
    if(name.length<2||name.length>150)return fail(res,400,'กรุณากรอกชื่อสถานที่ 2–150 ตัวอักษร');
    const record=await board(req.user.id);
    if(!enforce(res,record,'add'))return;
    const [duplicates]=await run('SELECT id FROM destination_candidates WHERE poll_id=? AND LOWER(name)=LOWER(?) LIMIT 1',[record.poll_id,name]);
    if(duplicates.length)return fail(res,409,'มีสถานที่นี้แล้ว เลือกโหวตได้เลย');
    const [[count]]=await run('SELECT COUNT(*) AS total FROM destination_candidates WHERE poll_id=?',[record.poll_id]);
    if(Number(count.total)>=100)return fail(res,409,'เพิ่มสถานที่ได้สูงสุด 100 แห่ง');
    const [created]=await run('INSERT INTO destination_candidates (poll_id,name,details,image_url,created_by) VALUES (?,?,?,?,?)',[record.poll_id,name,'',null,req.user.id]);
    res.status(201).json({option:{id:String(created.insertId),name}});
  }));

  app.put('/api/next-trip/vote',...protect(async(req,res)=>{
    if(!validId(req.body?.optionId))return fail(res,400,'เลือกสถานที่ที่ต้องการโหวตก่อน');
    const record=await board(req.user.id);
    if(!enforce(res,record,'vote'))return;
    const [options]=await run('SELECT id FROM destination_candidates WHERE poll_id=? AND id=?',[record.poll_id,req.body.optionId]);
    if(!options.length)return fail(res,404,'ไม่พบสถานที่นี้ในรายการ');
    await run('INSERT INTO destination_votes (poll_id,user_id,candidate_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE candidate_id=VALUES(candidate_id)',[record.poll_id,req.user.id,req.body.optionId]);
    res.json({ok:true});
  }));

  app.delete('/api/next-trip/vote',...protect(async(req,res)=>{
    const record=await board(req.user.id);
    if(!enforce(res,record,'vote'))return;
    await run('DELETE FROM destination_votes WHERE poll_id=? AND user_id=?',[record.poll_id,req.user.id]);
    res.json({ok:true});
  }));
};
module.exports.utcInput=utcInput;
module.exports.votePhase=votePhase;
