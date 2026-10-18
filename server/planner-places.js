/* Database-backed itinerary and places. All routes require authenticated trip membership. */
const okId = v => /^[1-9]\d*$/.test(String(v));
const clean = (v,max) => typeof v === 'string' ? v.trim().slice(0,max+1) : '';
const activityDTO = r => ({id:String(r.id),tripId:String(r.trip_id),day:Number(r.day_number),time:String(r.start_time).slice(0,5),title:r.title,location:r.location||'',details:r.details||'',order:Number(r.sort_order)});
const placeDTO = r => ({id:String(r.id),tripId:String(r.trip_id),name:r.name,category:r.category,details:r.details||'',image:r.image_url||'',votes:Number(r.votes||0),voted:!!Number(r.voted||0),createdBy:String(r.created_by)});
const ymd = d => d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : String(d).slice(0,10);
const daySpan = trip => Math.round((Date.parse(ymd(trip.end_date)+'T00:00:00Z')-Date.parse(ymd(trip.start_date)+'T00:00:00Z'))/86400000)+1;
function validateActivity(raw,trip){
 const title=clean(raw.title,150),location=clean(raw.location,200),details=clean(raw.details,2000),time=String(raw.time||'');
 const day=Number(raw.day);
 if(!title||title.length>150||location.length>200||details.length>2000||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isInteger(day)||day<1||day>daySpan(trip))return null;
 return {title,location,details,time,day};
}
function validateImage(value){
 if(!value)return '';
 if(typeof value!=='string'||value.length>2200000)return null;
 if(/^https:\/\//i.test(value))return value.length<=1500?value:null;
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
 if(!match)return null;
 const raw=Buffer.from(match[2],'base64');if(raw.length>1500000||raw.length===0)return null;
 const type=match[1];
 const valid=(type==='jpeg'&&raw[0]===255&&raw[1]===216&&raw[2]===255)||
   (type==='png'&&raw.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||
   (type==='webp'&&raw.toString('ascii',0,4)==='RIFF'&&raw.toString('ascii',8,12)==='WEBP');
 return valid?value:null;
}
function validatePlace(raw){
 const name=clean(raw.name,150),details=clean(raw.details,2000),category=String(raw.category||''),image=validateImage(raw.image||'');
 if(!name||name.length>150||details.length>2000||!['attraction','restaurant','cafe'].includes(category)||image===null)return null;
 return {name,details,category,image};
}
module.exports=function registerPlannerPlaces(app,{run,pool,protect,membership,fail}){
 async function permitted(req,res,edit=false){
  const trip=await membership(req,res);if(!trip)return null;
  if(edit&&trip.status==='finished'){fail(res,409,'Finished trip is read-only. Reopen it to make changes.');return null;}
  return trip;
 }
 async function activityInTrip(req,res,trip){
  if(!okId(req.params.activityId)){fail(res,400,'Invalid activity ID.');return null;}
  const [rows]=await run('SELECT * FROM trip_activities WHERE id=? AND trip_id=?',[req.params.activityId,trip.id]);
  if(!rows.length){fail(res,404,'Activity not found in this trip.');return null;}
  return rows[0];
 }
 app.get('/api/trips/:id/activities',...protect(async(req,res)=>{
  const trip=await permitted(req,res);if(!trip)return;
  const [rows]=await run('SELECT * FROM trip_activities WHERE trip_id=? ORDER BY day_number,sort_order,id',[trip.id]);
  res.json({activities:rows.map(activityDTO),days:daySpan(trip)});
 }));
 app.post('/api/trips/:id/activities',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const data=validateActivity(req.body||{},trip);if(!data)return fail(res,400,'Enter a title, valid day and HH:MM time.');
  const [order]=await run('SELECT COALESCE(MAX(sort_order),0)+10 AS next_order FROM trip_activities WHERE trip_id=? AND day_number=?',[trip.id,data.day]);
  const [r]=await run('INSERT INTO trip_activities (trip_id,day_number,start_time,title,location,details,sort_order,created_by) VALUES (?,?,?,?,?,?,?,?)',[trip.id,data.day,data.time,data.title,data.location,data.details,order[0].next_order,req.user.id]);
  const [rows]=await run('SELECT * FROM trip_activities WHERE id=?',[r.insertId]);res.status(201).json({activity:activityDTO(rows[0])});
 }));
 app.put('/api/trips/:id/activities/:activityId',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const current=await activityInTrip(req,res,trip);if(!current)return;
  const data=validateActivity(req.body||{},trip);if(!data)return fail(res,400,'Enter a title, valid day and HH:MM time.');
  let order=current.sort_order;
  if(data.day!==Number(current.day_number)){
   const [rows]=await run('SELECT COALESCE(MAX(sort_order),0)+10 AS next_order FROM trip_activities WHERE trip_id=? AND day_number=?',[trip.id,data.day]);order=rows[0].next_order;
  }
  await run('UPDATE trip_activities SET day_number=?,start_time=?,title=?,location=?,details=?,sort_order=? WHERE id=? AND trip_id=?',[data.day,data.time,data.title,data.location,data.details,order,current.id,trip.id]);
  const [rows]=await run('SELECT * FROM trip_activities WHERE id=?',[current.id]);res.json({activity:activityDTO(rows[0])});
 }));
 app.delete('/api/trips/:id/activities/:activityId',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  if(!okId(req.params.activityId))return fail(res,400,'Invalid activity ID.');
  const [result]=await run('DELETE FROM trip_activities WHERE trip_id=? AND id=?',[trip.id,req.params.activityId]);
  if(!result.affectedRows)return fail(res,404,'Activity not found.');res.json({ok:true});
 }));
 app.put('/api/trips/:id/activities/reorder/day',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const day=Number(req.body.day),ids=req.body.ids;
  if(!Number.isInteger(day)||day<1||day>daySpan(trip)||!Array.isArray(ids)||ids.length>500||ids.some(i=>!okId(i))||new Set(ids.map(String)).size!==ids.length)return fail(res,400,'Invalid activity order.');
  const conn=await pool.getConnection();
  try{
   await conn.beginTransaction();
   const [rows]=await conn.execute('SELECT id FROM trip_activities WHERE trip_id=? AND day_number=? FOR UPDATE',[trip.id,day]);
   const expected=new Set(rows.map(r=>String(r.id)));
   if(expected.size!==ids.length||ids.some(id=>!expected.has(String(id)))){await conn.rollback();return fail(res,409,'Activity list changed. Reload and try again.');}
   for(let n=0;n<ids.length;n++)await conn.execute('UPDATE trip_activities SET sort_order=? WHERE trip_id=? AND day_number=? AND id=?',[(n+1)*10,trip.id,day,ids[n]]);
   await conn.commit();res.json({ok:true});
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
 }));
 async function placeInTrip(req,res,trip){
  if(!okId(req.params.placeId)){fail(res,400,'Invalid place ID.');return null;}
  const [rows]=await run('SELECT * FROM trip_places WHERE id=? AND trip_id=?',[req.params.placeId,trip.id]);
  if(!rows.length){fail(res,404,'Place not found in this trip.');return null;}return rows[0];
 }
 app.get('/api/trips/:id/places',...protect(async(req,res)=>{
  const trip=await permitted(req,res);if(!trip)return;
  const [rows]=await run(`SELECT p.*,
   (SELECT COUNT(*) FROM place_votes v JOIN trip_members m ON m.user_id=v.user_id AND m.trip_id=p.trip_id WHERE v.place_id=p.id) AS votes,
   (SELECT COUNT(*) FROM place_votes v WHERE v.place_id=p.id AND v.user_id=?) AS voted
   FROM trip_places p WHERE p.trip_id=? ORDER BY p.created_at DESC,p.id DESC`,[req.user.id,trip.id]);
  res.json({places:rows.map(placeDTO)});
 }));
 app.post('/api/trips/:id/places',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const data=validatePlace(req.body||{});if(!data)return fail(res,400,'Valid name, category, details and image required.');
  const [r]=await run('INSERT INTO trip_places (trip_id,name,category,details,image_url,created_by) VALUES (?,?,?,?,?,?)',[trip.id,data.name,data.category,data.details,data.image||null,req.user.id]);
  res.status(201).json({place:{id:String(r.insertId),tripId:String(trip.id),...data,votes:0,voted:false,createdBy:String(req.user.id)}});
 }));
 app.put('/api/trips/:id/places/:placeId',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const place=await placeInTrip(req,res,trip);if(!place)return;
  if(trip.role!=='owner'&&String(place.created_by)!==String(req.user.id))return fail(res,403,'Only the creator or trip owner can edit this place.');
  const data=validatePlace(req.body||{});if(!data)return fail(res,400,'Valid name, category, details and image required.');
  await run('UPDATE trip_places SET name=?,category=?,details=?,image_url=? WHERE trip_id=? AND id=?',[data.name,data.category,data.details,data.image||null,trip.id,place.id]);res.json({ok:true});
 }));
 app.delete('/api/trips/:id/places/:placeId',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const place=await placeInTrip(req,res,trip);if(!place)return;
  if(trip.role!=='owner'&&String(place.created_by)!==String(req.user.id))return fail(res,403,'Only the creator or trip owner can delete this place.');
  await run('DELETE FROM trip_places WHERE id=? AND trip_id=?',[place.id,trip.id]);res.json({ok:true});
 }));
 app.put('/api/trips/:id/places/:placeId/vote',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const place=await placeInTrip(req,res,trip);if(!place)return;
  await run('INSERT IGNORE INTO place_votes (place_id,user_id) VALUES (?,?)',[place.id,req.user.id]);res.json({ok:true,voted:true});
 }));
 app.delete('/api/trips/:id/places/:placeId/vote',...protect(async(req,res)=>{
  const trip=await permitted(req,res,true);if(!trip)return;
  const place=await placeInTrip(req,res,trip);if(!place)return;
  await run('DELETE FROM place_votes WHERE place_id=? AND user_id=?',[place.id,req.user.id]);res.json({ok:true,voted:false});
 }));
};
