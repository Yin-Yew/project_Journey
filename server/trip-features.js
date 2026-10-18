/* Persistent trip expenses, payment confirmations, and protected memory photos. */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const PHOTO_DIR = path.resolve(__dirname, '../uploads/memories');
const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const text = (v, max) => String(v || '').trim().slice(0,max);
const isId = value => /^\d+$/.test(String(value));

module.exports = function registerFeatures(app, deps) {
 const {run,pool,protect,membership,fail,dateText} = deps;
 const authorizeTrip = async(req,res,edit=false) => {
   const trip = await membership(req,res);
   if (!trip) return null;
   if (edit && trip.status === 'finished') {fail(res,409,'Reopen the trip before editing expenses.');return null;}
   return trip;
 };
 const readExpense = async (tripId) => {
   const [expenses]=await run('SELECT * FROM expenses WHERE trip_id=? ORDER BY created_at DESC,id DESC',[tripId]);
   const [splits]=await run('SELECT s.* FROM expense_splits s JOIN expenses e ON e.id=s.expense_id WHERE e.trip_id=?',[tripId]);
   return expenses.map(e=>{
     const relevant=splits.filter(s=>s.expense_id===e.id);
     return {id:String(e.id),title:e.title,category:e.category,amount:Number(e.amount),paidBy:String(e.paid_by),splitType:e.split_type,date:dateText(e.expense_date),createdAt:e.created_at,participants:relevant.map(s=>String(s.user_id)),shares:Object.fromEntries(relevant.map(s=>[String(s.user_id),e.split_type==='percentage'?Number(s.share_percentage):Number(s.share_amount)]))};
   });
 };
 const readPayments = async(tripId) => {
   const [payments]=await run('SELECT * FROM payments WHERE trip_id=? ORDER BY created_at DESC,id DESC',[tripId]);
   return payments.map(p=>({id:String(p.id),tripId:String(p.trip_id),from:String(p.payer_id),to:String(p.payee_id),amount:Number(p.amount),status:p.status,slip:p.slip_url||'',createdAt:p.created_at,verifiedAt:p.verified_at,key:`${p.trip_id}|${p.payer_id}|${p.payee_id}|${round(p.amount).toFixed(2)}`}));
 };
 app.get('/api/trips/:id/finance',...protect(async(req,res)=>{
   const trip=await authorizeTrip(req,res);if(!trip)return;
   const [expenses,payments]=await Promise.all([readExpense(trip.id),readPayments(trip.id)]);
   res.json({expenses,payments});
 }));
 const normalizeExpense = async(tripId,data) => {
   const title=text(data.title,150),category=text(data.category,80)||'Other',amount=round(data.amount);
   const paidBy=String(data.paidBy||''),splitType=data.splitType||'equal';
   const participants=[...new Set((Array.isArray(data.participants)?data.participants:[]).map(String))];
   if(!title||!Number.isFinite(amount)||amount<=0||amount>1e9||!isId(paidBy)||!['equal','percentage','custom'].includes(splitType)||participants.length<1||participants.length>100||participants.some(x=>!isId(x)))throw Object.assign(new Error('Invalid expense details.'),{status:400});
   const [members]=await run('SELECT user_id FROM trip_members WHERE trip_id=?',[tripId]);
   const ids=new Set(members.map(m=>String(m.user_id)));
   if(!ids.has(paidBy)||participants.some(id=>!ids.has(id)))throw Object.assign(new Error('Expense users must be members of this trip.'),{status:400});
   const shares={};
   if(splitType==='equal'){
     const totalCents=Math.round(amount*100),base=Math.floor(totalCents/participants.length),extra=totalCents%participants.length;
     participants.forEach((id,i)=>shares[id]=(base+(i<extra?1:0))/100);
   } else if(splitType==='percentage'){
     const percentages=participants.map(id=>Number(data.shares?.[id]));
     if(percentages.some(p=>!Number.isFinite(p)||p<0||p>100)||Math.abs(percentages.reduce((a,b)=>a+b,0)-100)>0.05)throw Object.assign(new Error('Percentages must add to 100.'),{status:400});
     let cents=Math.round(amount*100);participants.forEach((id,i)=>{const share=i===participants.length-1?cents:Math.round(amount*percentages[i]);shares[id]=share/100;cents-=share;});
     if(Object.values(shares).some(x=>x<0))throw Object.assign(new Error('Invalid percentage split.'),{status:400});
   } else {
     participants.forEach(id=>shares[id]=round(data.shares?.[id]));
     if(Object.values(shares).some(x=>!Number.isFinite(x)||x<0)||Math.abs(Object.values(shares).reduce((a,b)=>a+b,0)-amount)>0.011)throw Object.assign(new Error('Custom shares must match the total.'),{status:400});
   }
   return {title,category,amount,paidBy,splitType,participants,shares};
 };
 async function writeExpense(trip,data,expenseId=null){
   const v=await normalizeExpense(trip.id,data),conn=await pool.getConnection();
   try{
    await conn.beginTransaction();let id=expenseId;
    if(id){const [result]=await conn.execute('UPDATE expenses SET title=?,category=?,amount=?,paid_by=?,split_type=? WHERE id=? AND trip_id=?',[v.title,v.category,v.amount,v.paidBy,v.splitType,id,trip.id]);if(!result.affectedRows)throw Object.assign(new Error('Expense not found.'),{status:404});await conn.execute('DELETE FROM expense_splits WHERE expense_id=?',[id]);}
    else{const [result]=await conn.execute('INSERT INTO expenses (trip_id,title,category,amount,paid_by,split_type,expense_date) VALUES (?,?,?,?,?,?,CURDATE())',[trip.id,v.title,v.category,v.amount,v.paidBy,v.splitType]);id=result.insertId;}
    for(const userId of v.participants)await conn.execute('INSERT INTO expense_splits (expense_id,user_id,share_amount,share_percentage) VALUES (?,?,?,?)',[id,userId,v.shares[userId],v.splitType==='percentage'?Number(data.shares[userId]):null]);
    await conn.commit();return String(id);
   }catch(e){await conn.rollback();throw e;}finally{conn.release();}
 }
 app.post('/api/trips/:id/expenses',...protect(async(req,res)=>{const trip=await authorizeTrip(req,res,true);if(!trip)return;try{const id=await writeExpense(trip,req.body);res.status(201).json({id});}catch(e){if(e.status)return fail(res,e.status,e.message);throw e;}}));
 app.put('/api/trips/:id/expenses/:expenseId',...protect(async(req,res)=>{const trip=await authorizeTrip(req,res,true);if(!trip)return;if(!isId(req.params.expenseId))return fail(res,400,'Invalid expense id.');try{const id=await writeExpense(trip,req.body,req.params.expenseId);res.json({id});}catch(e){if(e.status)return fail(res,e.status,e.message);throw e;}}));
 app.delete('/api/trips/:id/expenses/:expenseId',...protect(async(req,res)=>{const trip=await authorizeTrip(req,res,true);if(!trip)return;if(!isId(req.params.expenseId))return fail(res,400,'Invalid expense id.');const [r]=await run('DELETE FROM expenses WHERE id=? AND trip_id=?',[req.params.expenseId,trip.id]);if(!r.affectedRows)return fail(res,404,'Expense not found.');res.json({ok:true});}));
 app.post('/api/trips/:id/payments',...protect(async(req,res)=>{
   const trip=await authorizeTrip(req,res);if(!trip)return;
   const from=String(req.body.from||''),to=String(req.body.to||''),amount=round(req.body.amount);
   if(from!==String(req.user.id)||!isId(to)||to===from||!Number.isFinite(amount)||amount<=0||amount>1e9)return fail(res,400,'Invalid payment. Only the payer may submit.');
   const [m]=await run('SELECT user_id FROM trip_members WHERE trip_id=? AND user_id=?',[trip.id,to]);if(!m.length)return fail(res,400,'Recipient is not a trip member.');
   const slip=String(req.body.slip||'');if(slip.length>2000000||slip&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(slip))return fail(res,400,'Invalid slip image.');
   const [existing]=await run("SELECT id FROM payments WHERE trip_id=? AND payer_id=? AND payee_id=? AND amount=? AND status IN ('paid','pending') ORDER BY id DESC LIMIT 1",[trip.id,from,to,amount]);
   if(existing.length){await run("UPDATE payments SET slip_url=? WHERE id=? AND status='pending'",[slip||null,existing[0].id]);return res.json({id:String(existing[0].id)});}
   const [r]=await run("INSERT INTO payments (trip_id,payer_id,payee_id,amount,status,slip_url) VALUES (?,?,?,?,'pending',?)",[trip.id,from,to,amount,slip||null]);res.status(201).json({id:String(r.insertId)});
 }));
 app.patch('/api/trips/:id/payments/:paymentId/verify',...protect(async(req,res)=>{
   const trip=await authorizeTrip(req,res);if(!trip)return;if(!isId(req.params.paymentId))return fail(res,400,'Invalid payment id.');
   const [r]=await run("UPDATE payments SET status='paid',verified_at=NOW() WHERE id=? AND trip_id=? AND payee_id=? AND status='pending'",[req.params.paymentId,trip.id,req.user.id]);if(!r.affectedRows)return fail(res,403,'Only the recipient can confirm a pending payment.');res.json({ok:true});
 }));
 // All metrics are computed from database rows, not template/sample values.
 app.get('/api/dashboard',...protect(async(req,res)=>{
   const [rows]=await run(`SELECT t.id,t.name,t.start_date,t.end_date,t.status,t.budget,
       (SELECT COUNT(*) FROM trip_members m2 WHERE m2.trip_id=t.id) AS member_count,
       COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.trip_id=t.id),0) AS total_expense,
       (SELECT COUNT(*) FROM payments p WHERE p.trip_id=t.id AND p.status='pending') AS pending_payments,
       (SELECT COUNT(*) FROM payments p WHERE p.trip_id=t.id AND p.status='paid') AS paid_payments,
       (SELECT COUNT(*) FROM trip_checklist_items ci WHERE ci.trip_id=t.id) AS packing_total,
       (SELECT COUNT(*) FROM trip_checklist_items ci WHERE ci.trip_id=t.id AND ci.is_checked=1) AS packing_done
       FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE m.user_id=?`,[req.user.id]);
   res.json({trips:rows.map(r=>{const total=Number(r.packing_total),packed=Number(r.packing_done);return {id:String(r.id),name:r.name,startDate:dateText(r.start_date),endDate:dateText(r.end_date),status:r.status,budget:Number(r.budget),memberCount:Number(r.member_count),totalExpense:Number(r.total_expense),packingTotal:total,packingDone:packed,packingPercent:total?Math.round(packed*100/total):0,pendingPayments:Number(r.pending_payments),paidPayments:Number(r.paid_payments)};} )});
 }));
 // Private images are retrieved only through authenticated GET /api/memories/:id/image.
 const photoData = input => {
   const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input||'');if(!m)return null;
   const data=Buffer.from(m[2],'base64');if(!data.length||data.length>5*1024*1024)return null;
   const signatures={jpeg:data.length>3&&data[0]===255&&data[1]===216&&data[2]===255,png:data.length>8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp:data.length>12&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'};
   if(!signatures[m[1]])return null;
   return {data,extension:m[1]==='jpeg'?'jpg':m[1],mime:`image/${m[1]}`};
 };
 const memoryDTO = r => ({id:String(r.id),tripId:String(r.trip_id),tripName:r.trip_name,caption:r.caption,uploadedBy:String(r.uploaded_by),createdAt:r.created_at});
 app.get('/api/memories',...protect(async(req,res)=>{
   const [rows]=await run('SELECT DISTINCT p.id,p.trip_id,p.caption,p.uploaded_by,p.created_at,t.name AS trip_name FROM memories p JOIN trips t ON t.id=p.trip_id JOIN trip_members m ON m.trip_id=t.id WHERE m.user_id=? ORDER BY p.created_at DESC,p.id DESC',[req.user.id]);
   res.json({memories:rows.map(memoryDTO)});
 }));
 app.post('/api/trips/:id/memories',...protect(async(req,res)=>{
   const trip=await authorizeTrip(req,res);if(!trip)return;
   const caption=text(req.body.caption,300);if(!caption)return fail(res,400,'Please enter a caption (up to 300 characters).');
   const photo=photoData(req.body.image);if(!photo)return fail(res,400,'Upload a valid JPEG, PNG or WebP under 5 MB.');
   const filename=`${crypto.randomUUID()}.${photo.extension}`;await fs.mkdir(PHOTO_DIR,{recursive:true});await fs.writeFile(path.join(PHOTO_DIR,filename),photo.data,{flag:'wx'});
   try{const [result]=await run('INSERT INTO memories (trip_id,uploaded_by,caption,filename,mime_type) VALUES (?,?,?,?,?)',[trip.id,req.user.id,caption,filename,photo.mime]);res.status(201).json({memory:{id:String(result.insertId),tripId:String(trip.id),tripName:trip.name,caption,uploadedBy:String(req.user.id)}});}
   catch(e){await fs.unlink(path.join(PHOTO_DIR,filename)).catch(()=>{});throw e;}
 }));
 async function findPhoto(req,res){if(!isId(req.params.memoryId)){fail(res,400,'Invalid photo id.');return null;}const [rows]=await run('SELECT p.*,t.name AS trip_name,tm.role FROM memories p JOIN trips t ON t.id=p.trip_id JOIN trip_members tm ON tm.trip_id=p.trip_id AND tm.user_id=? WHERE p.id=?',[req.user.id,req.params.memoryId]);if(!rows.length){fail(res,404,'Photo unavailable.');return null;}return rows[0];}
 app.get('/api/memories/:memoryId/image',...protect(async(req,res)=>{
   const pic=await findPhoto(req,res);if(!pic)return;
   try{const bytes=await fs.readFile(path.join(PHOTO_DIR,path.basename(pic.filename)));res.set({'Content-Type':pic.mime_type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}).send(bytes);}
   catch(e){if(e.code==='ENOENT')return fail(res,404,'Photo file missing.');throw e;}
 }));
 app.delete('/api/memories/:memoryId',...protect(async(req,res)=>{
   const pic=await findPhoto(req,res);if(!pic)return;
   if(String(pic.uploaded_by)!==String(req.user.id)&&pic.role!=='owner')return fail(res,403,'Only the uploader or trip owner can delete this photo.');
   await run('DELETE FROM memories WHERE id=?',[pic.id]);await fs.unlink(path.join(PHOTO_DIR,path.basename(pic.filename))).catch(()=>{});res.json({ok:true});
 }));
};
