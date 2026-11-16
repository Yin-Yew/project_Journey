/* A private, per-account packing list within each trip.
   All reads and writes are scoped by both trip membership and logged-in user ID.
   Existing assigned_to column now identifies the account that owns the note. */
module.exports = function registerChecklist(app,{run,protect,membership,fail}) {
 const isId = value => /^[1-9]\d*$/.test(String(value));
 const dto = row => ({id:String(row.id),label:row.label,checked:!!row.is_checked});
 const getTrip = async(req,res,write=false)=>{
  const trip=await membership(req,res);if(!trip)return null;
  if(write&&trip.status==='finished'){fail(res,409,'Finished trips are read-only.');return null;}
  return trip;
 };
 const check = body => {
  const label=typeof body?.label==='string'?body.label.trim():'';
  return label.length>0&&label.length<=150?label:null;
 };
 const ownItem = async(tripId,itemId,userId)=>{
  const [rows]=await run('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? AND id=? AND assigned_to=?',[tripId,itemId,userId]);
  return rows[0]||null;
 };
 app.get('/api/trips/:id/checklist',...protect(async(req,res)=>{
  const trip=await getTrip(req,res);if(!trip)return;
  const [rows]=await run('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? AND assigned_to=? ORDER BY id',[trip.id,req.user.id]);
  res.json({accountId:String(req.user.id),items:rows.map(dto)});
 }));
 app.post('/api/trips/:id/checklist',...protect(async(req,res)=>{
  const trip=await getTrip(req,res,true);if(!trip)return;
  // The API must not allow creating notes for another account.
  if(Object.prototype.hasOwnProperty.call(req.body||{},'assignedTo'))return fail(res,400,'Packing notes are private to your account.');
  const label=check(req.body);if(!label)return fail(res,400,'Item name must be 1–150 characters.');
  const [count]=await run('SELECT COUNT(*) AS total FROM trip_checklist_items WHERE trip_id=? AND assigned_to=?',[trip.id,req.user.id]);
  if(Number(count[0].total)>=300)return fail(res,409,'Maximum 300 packing notes per user per trip.');
  const [result]=await run('INSERT INTO trip_checklist_items (trip_id,label,is_checked,created_by,assigned_to) VALUES (?,?,0,?,?)',[trip.id,label,req.user.id,req.user.id]);
  res.status(201).json({item:{id:String(result.insertId),label,checked:false}});
 }));
 app.patch('/api/trips/:id/checklist/:itemId',...protect(async(req,res)=>{
  const trip=await getTrip(req,res,true);if(!trip)return;
  if(!isId(req.params.itemId))return fail(res,400,'Invalid item ID.');
  if(Object.prototype.hasOwnProperty.call(req.body||{},'assignedTo'))return fail(res,400,'Packing note ownership cannot be changed.');
  const item=await ownItem(trip.id,req.params.itemId,req.user.id);
  // Identical response for unknown and someone else's IDs (including trip owner).
  if(!item)return fail(res,404,'Packing note not found.');
  const hasLabel=Object.prototype.hasOwnProperty.call(req.body||{},'label');
  const hasChecked=Object.prototype.hasOwnProperty.call(req.body||{},'checked');
  if(!hasLabel&&!hasChecked)return fail(res,400,'Nothing to update.');
  if(hasChecked&&typeof req.body.checked!=='boolean')return fail(res,400,'Checked must be true or false.');
  const label=hasLabel?check(req.body):null;
  if(hasLabel&&!label)return fail(res,400,'Item name must be 1–150 characters.');
  const sets=[],params=[];
  if(hasLabel){sets.push('label=?');params.push(label);}
  if(hasChecked){sets.push('is_checked=?');params.push(req.body.checked?1:0);}
  params.push(trip.id,item.id,req.user.id);
  const [result]=await run(`UPDATE trip_checklist_items SET ${sets.join(',')} WHERE trip_id=? AND id=? AND assigned_to=?`,params);
  if(!result.affectedRows)return fail(res,409,'Packing note changed. Refresh and try again.');
  res.json({item:dto(await ownItem(trip.id,item.id,req.user.id))});
 }));
 app.delete('/api/trips/:id/checklist/:itemId',...protect(async(req,res)=>{
  const trip=await getTrip(req,res,true);if(!trip)return;
  if(!isId(req.params.itemId))return fail(res,400,'Invalid item ID.');
  const item=await ownItem(trip.id,req.params.itemId,req.user.id);
  if(!item)return fail(res,404,'Packing note not found.');
  const [result]=await run('DELETE FROM trip_checklist_items WHERE trip_id=? AND id=? AND assigned_to=?',[trip.id,item.id,req.user.id]);
  if(!result.affectedRows)return fail(res,409,'Packing note changed. Refresh and try again.');
  res.json({ok:true});
 }));
};
