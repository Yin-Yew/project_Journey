require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('./database');
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json({limit:'8mb'}));
app.use(express.urlencoded({extended:false, limit:'3mb'}));
app.use('/api', (req,res,next) => {res.set('Cache-Control','no-store'); next();});
// No external rate-limit dependency: restrict repeated attempts per IP and route.
// For deployment behind a proxy, set an explicitly trusted proxy in your server setup.
const attempts = new Map();
function authRateLimit(req,res,next) {
  const now=Date.now(),key=`${req.ip}|${req.path}`;
  const record=attempts.get(key);
  if(!record||record.until<=now){attempts.set(key,{count:1,until:now+15*60*1000});return next();}
  record.count++;
  if(record.count>20){res.set('Retry-After',String(Math.ceil((record.until-now)/1000)));return res.status(429).json({error:'Too many attempts. Please try again later.'});}
  next();
}
app.use(['/api/auth/login','/api/auth/register'],authRateLimit);
// Evict expired counters opportunistically; memory footprint stays bounded.
function pruneRateLimit(){if(attempts.size<=10000)return;const now=Date.now();for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);}
app.use('/api/auth',(req,res,next)=>{pruneRateLimit();next();});
app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'});next();});
const run = (sql,params=[]) => pool.execute(sql,params);
const fail = (res,status,message) => res.status(status).json({error:message});
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const safeUser = u => ({id:String(u.id),name:u.name,email:u.email,username:u.username,avatar:u.avatar,style:u.travel_style,promptpay:u.promptpay,bankName:u.bank_name,bankAccount:u.bank_account});
const dateText = d => d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : String(d || '').slice(0,10);
const tripDTO = t => ({id:String(t.id),name:t.name,destination:t.destination||'',startDate:dateText(t.start_date),endDate:dateText(t.end_date),budget:Number(t.budget),cover:t.cover_url||'',inviteCode:t.invite_code,status:t.status,ownerId:String(t.owner_id),role:t.role || 'member',memberCount:Number(t.member_count || 1),activityCount:Number(t.activity_count || 0)});
const validateTrip = body => {
  const name=String(body.name||'').trim(),destination=String(body.destination||'').trim();
  const startDate=String(body.startDate||''),endDate=String(body.endDate||'');
  const budget=Number(body.budget||0),cover=String(body.cover||'');
  if(!name||name.length>150||!destination||destination.length>150) return 'Name and destination are required (max 150 characters).';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||Number.isNaN(Date.parse(startDate))||Number.isNaN(Date.parse(endDate))||startDate>endDate) return 'Enter valid trip dates in chronological order.';
  if(!Number.isFinite(budget)||budget<0||budget>9999999999) return 'Invalid budget.';
  if(cover.length>2000000 || (cover && !/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(cover) && !/^https:\/\//.test(cover))) return 'Invalid cover image.';
  return null;
};
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
async function auth(req,res,next){
  const match=/^Bearer (\S+)$/.exec(req.get('authorization')||'');
  if(!match) return fail(res,401,'Please log in.');
  const [rows]=await run('SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() LIMIT 1',[tokenHash(match[1])]);
  if(!rows.length) return fail(res,401,'Session expired. Please log in again.');
  req.user=rows[0]; next();
}
const protect = fn => [wrap(auth),wrap(fn)];
async function membership(req,res,ownerOnly=false){
  if(!/^\d+$/.test(req.params.id)) {fail(res,400,'Invalid trip ID.');return null;}
  const [rows]=await run('SELECT t.*, m.role FROM trips t JOIN trip_members m ON m.trip_id=t.id AND m.user_id=? WHERE t.id=?',[req.user.id,req.params.id]);
  if(!rows.length){fail(res,404,'Trip not found or you are not a member.');return null;}
  if(ownerOnly && rows[0].role!=='owner'){fail(res,403,'Only the owner can do this.');return null;}
  return rows[0];
}
async function createSession(res,user){
  const token=crypto.randomBytes(32).toString('hex');
  await run('INSERT INTO auth_sessions (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 7 DAY))',[user.id,tokenHash(token)]);
  res.json({token,user:safeUser(user)});
}
app.post('/api/auth/register',wrap(async(req,res)=>{
  const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(name.length<2||name.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>150||password.length<8||password.length>128) return fail(res,400,'Enter a name, valid email and password of at least 8 characters.');
  const [existing]=await run('SELECT id FROM users WHERE email=?',[email]);
  if(existing.length) return fail(res,409,'Email is already registered.');
  const hash=await bcrypt.hash(password,12);
  const [result]=await run('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)',[name,email,hash]);
  const [users]=await run('SELECT * FROM users WHERE id=?',[result.insertId]);
  await createSession(res,users[0]);
}));
app.post('/api/auth/login',wrap(async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  const [users]=await run('SELECT * FROM users WHERE email=?',[email]);
  if(!users.length||!(await bcrypt.compare(password,users[0].password_hash))) return fail(res,401,'Email or password is incorrect.');
  await createSession(res,users[0]);
}));
app.get('/api/auth/me',...protect(async(req,res)=>res.json({user:safeUser(req.user)})));
app.post('/api/auth/logout',...protect(async(req,res)=>{const token=req.get('authorization').slice(7);await run('DELETE FROM auth_sessions WHERE token_hash=?',[tokenHash(token)]);res.json({ok:true});}));
app.patch('/api/auth/me',...protect(async(req,res)=>{
  const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase();
  if(name.length<2||name.length>100||!/^\S+@\S+\.\S+$/.test(email)) return fail(res,400,'Invalid profile.');
  await run('UPDATE users SET name=?,email=?,username=?,travel_style=?,promptpay=?,bank_name=?,bank_account=?,avatar=? WHERE id=?',[name,email, String(req.body.username||'').slice(0,80)||null,String(req.body.style||'').slice(0,100),String(req.body.promptpay||'').slice(0,30),String(req.body.bankName||'').slice(0,80),String(req.body.bankAccount||'').slice(0,100),String(req.body.avatar||'').slice(0,500)||null,req.user.id]);
  const [rows]=await run('SELECT * FROM users WHERE id=?',[req.user.id]);res.json({user:safeUser(rows[0])});
}));
app.get('/api/trips',...protect(async(req,res)=>{
 const [rows]=await run('SELECT t.*,m.role,(SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id=t.id) AS member_count,(SELECT COUNT(*) FROM trip_activities ta WHERE ta.trip_id=t.id) AS activity_count FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE m.user_id=? ORDER BY t.created_at DESC',[req.user.id]);
 res.json({trips:rows.map(tripDTO)});
}));
async function fetchTrip(id,userId){
 const [rows]=await run('SELECT t.*,m.role,(SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id=t.id) AS member_count,(SELECT COUNT(*) FROM trip_activities ta WHERE ta.trip_id=t.id) AS activity_count FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE t.id=? AND m.user_id=?',[id,userId]);return rows[0];
}
app.post('/api/trips',...protect(async(req,res)=>{
 const error=validateTrip(req.body);if(error)return fail(res,400,error);
 const {name,destination,startDate,endDate,cover}=req.body;
 const connection=await pool.getConnection();
 try {
  await connection.beginTransaction();
  let result,code;
  for(let i=0;i<5;i++){
    code=crypto.randomBytes(5).toString('hex').toUpperCase();
    try{[result]=await connection.execute('INSERT INTO trips (owner_id,name,destination,start_date,end_date,budget,cover_url,invite_code,status) VALUES (?,?,?,?,?,?,?,?,?)',[req.user.id,name.trim(),destination.trim(),startDate,endDate,Number(req.body.budget||0),cover||null,code,'active']);break;}
    catch(e){if(e.code!=='ER_DUP_ENTRY')throw e;}
  }
  if(!result)throw new Error('Could not generate invite code.');
  await connection.execute("INSERT INTO trip_members (trip_id,user_id,role) VALUES (?,?,'owner')",[result.insertId,req.user.id]);
  await connection.commit();
  const row=await fetchTrip(result.insertId,req.user.id);res.status(201).json({trip:tripDTO(row)});
 } catch(e){await connection.rollback();throw e;}finally{connection.release();}
}));
app.post('/api/trips/join',...protect(async(req,res)=>{
 const code=String(req.body.code||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{10}$/.test(code))return fail(res,400,'Invite code must have 10 characters.');
 const [rows]=await run('SELECT * FROM trips WHERE invite_code=?',[code]);
 if(!rows.length)return fail(res,404,'Invite code not found.');
 if(rows[0].status==='finished')return fail(res,409,'This trip is finished.');
 const [already]=await run('SELECT 1 FROM trip_members WHERE trip_id=? AND user_id=?',[rows[0].id,req.user.id]);
 if(already.length)return fail(res,409,'You are already in this trip.');
 await run("INSERT INTO trip_members (trip_id,user_id,role) VALUES (?,?,'member')",[rows[0].id,req.user.id]);
 const trip=await fetchTrip(rows[0].id,req.user.id);res.status(201).json({trip:tripDTO(trip)});
}));
app.get('/api/trips/:id',...protect(async(req,res)=>{
 const trip=await membership(req,res);if(!trip)return;
 const [members]=await run('SELECT u.id,u.name,u.email,u.avatar,tm.role FROM trip_members tm JOIN users u ON tm.user_id=u.id WHERE tm.trip_id=? ORDER BY (tm.role="owner") DESC,tm.joined_at',[trip.id]);
 res.json({trip:tripDTO(trip),members:members.map(m=>({id:String(m.id),name:m.name,email:m.email,avatar:m.avatar,role:m.role}))});
}));
app.patch('/api/trips/:id',...protect(async(req,res)=>{
 const trip=await membership(req,res,true);if(!trip)return;
 const merged={name:req.body.name??trip.name,destination:req.body.destination??trip.destination,startDate:req.body.startDate??dateText(trip.start_date),endDate:req.body.endDate??dateText(trip.end_date),budget:req.body.budget??trip.budget,cover:req.body.cover??trip.cover_url};
 const error=validateTrip(merged);if(error)return fail(res,400,error);
 await run('UPDATE trips SET name=?,destination=?,start_date=?,end_date=?,budget=?,cover_url=? WHERE id=?',[merged.name.trim(),merged.destination.trim(),merged.startDate,merged.endDate,Number(merged.budget),merged.cover||null,trip.id]);
 res.json({trip:tripDTO(await fetchTrip(trip.id,req.user.id))});
}));
app.patch('/api/trips/:id/status',...protect(async(req,res)=>{
 const trip=await membership(req,res,true);if(!trip)return;
 if(!['active','finished'].includes(req.body.status))return fail(res,400,'Status must be active or finished.');
 await run('UPDATE trips SET status=? WHERE id=?',[req.body.status,trip.id]);res.json({trip:tripDTO(await fetchTrip(trip.id,req.user.id))});
}));
app.delete('/api/trips/:id',...protect(async(req,res)=>{
 const trip=await membership(req,res,true);if(!trip)return;
 const [pictures]=await run('SELECT filename FROM memories WHERE trip_id=?',[trip.id]);
 await run('DELETE FROM trips WHERE id=?',[trip.id]);
 for(const picture of pictures)require('fs/promises').unlink(path.join(__dirname,'../uploads/memories',path.basename(picture.filename))).catch(()=>{});
 res.json({ok:true});
}));
app.post('/api/trips/:id/members',...protect(async(req,res)=>{
 const trip=await membership(req,res,true);if(!trip)return;
 if(trip.status==='finished')return fail(res,409,'Cannot add members to a finished trip.');
 const email=String(req.body.email||'').trim().toLowerCase();
 const [users]=await run('SELECT id FROM users WHERE email=?',[email]);if(!users.length)return fail(res,404,'No registered user with that email.');
 const [existing]=await run('SELECT 1 FROM trip_members WHERE trip_id=? AND user_id=?',[trip.id,users[0].id]);
 if(existing.length)return fail(res,409,'Already a member.');
 await run("INSERT INTO trip_members (trip_id,user_id,role) VALUES (?,?,'member')",[trip.id,users[0].id]);res.status(201).json({ok:true});
}));
app.delete('/api/trips/:id/members/:userId',...protect(async(req,res)=>{
 const trip=await membership(req,res);if(!trip)return;
 if(!/^\d+$/.test(req.params.userId))return fail(res,400,'Invalid user ID.');
 const userId=Number(req.params.userId);
 if(userId!==req.user.id && trip.role!=='owner')return fail(res,403,'Only owners can remove another member.');
 if(userId===trip.owner_id)return fail(res,403,'An owner cannot be removed.');
 const [result]=await run("DELETE FROM trip_members WHERE trip_id=? AND user_id=? AND role='member'",[trip.id,userId]);
 if(!result.affectedRows)return fail(res,404,'Member not found.');res.json({ok:true});
}));
app.get('/api/trips/:id/modules',...protect(async(req,res)=>{
 const trip=await membership(req,res);if(!trip)return;
 const [[rows],[items]]=await Promise.all([
   run('SELECT module_data FROM trip_modules WHERE trip_id=?',[trip.id]),
   run('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? ORDER BY id',[trip.id])
 ]);
 const modules=rows.length?(typeof rows[0].module_data==='string'?JSON.parse(rows[0].module_data):rows[0].module_data):{};
 // Always return authoritative row-level checklist, never old JSON data.
 modules.checklistItems=items.map(item=>({id:String(item.id),label:item.label,checked:!!item.is_checked}));
 modules.packing=null;
 res.json({modules});
}));
app.put('/api/trips/:id/modules',...protect(async(req,res)=>{
 const trip=await membership(req,res);if(!trip)return;
 if(trip.status==='finished')return fail(res,409,'Finished trips are read-only.');
 const {activities=[]}=req.body||{};
 if(!Array.isArray(activities)||activities.length>300)return fail(res,400,'Invalid module data.');
 // Compatibility endpoint only persists legacy activity notes. Checklist writes
 // MUST go through /checklist/:itemId, avoiding concurrent replacement.
 const modules={activities:activities.map(x=>({time:String(x.time||'').slice(0,20),title:String(x.title||'').slice(0,150),note:String(x.note||'').slice(0,1000)}))};
 await run('INSERT INTO trip_modules (trip_id,module_data) VALUES (?,?) ON DUPLICATE KEY UPDATE module_data=VALUES(module_data)',[trip.id,JSON.stringify(modules)]);res.json({modules});
}));
require('./checklist')(app,{run,protect,membership,fail});
require('./trip-features')(app,{run,pool,protect,membership,fail,dateText});
require('./planner-places')(app,{run,pool,protect,membership,fail,dateText});
require('./destination-votes')(app,{run,pool,protect,fail});
app.get('/api/health',wrap(async(req,res)=>{await run('SELECT 1');res.json({app:'JoyJourney',status:'ok',database:'connected'});}));
app.use('/api',(req,res)=>fail(res,404,'API route not found.'));
app.use(express.static(path.join(__dirname,'../public')));
app.use((error,req,res,next)=>{
 console.error(error);
 if(error.code==='ER_DUP_ENTRY')return fail(res,409,'This email or value already exists.');
 if(error.code==='ER_NO_SUCH_TABLE'||error.code==='ER_BAD_FIELD_ERROR')return fail(res,503,'Database schema is missing or outdated. Import database/schema.sql.');
 return fail(res,500,'Server error. Check database configuration and logs.');
});
if(require.main===module)app.listen(PORT,()=>console.log(`JoyJourney running at http://localhost:${PORT}`));
module.exports=app;
