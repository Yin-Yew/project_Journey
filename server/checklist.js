/* Row-level checklist updates. Each write touches only one item, preventing stale
   full-document writes from overwriting another member's changes. */
module.exports = function registerChecklist(app,{run,protect,membership,fail}) {
 const isId = s => /^\d+$/.test(String(s));
 const dto = row => ({id:String(row.id),label:row.label,checked:!!row.is_checked});
 const getTrip = async(req,res,write=false)=>{
  const trip=await membership(req,res);if(!trip)return null;
  if(write&&trip.status==='finished'){fail(res,409,'Finished trips are read-only.');return null;}
  return trip;
 };
 const readList = async tripId=>{
  const [rows]=await run('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? ORDER BY id',[tripId]);
  return rows.map(dto);
 };
 const check = (data) => {
  const label=typeof data?.label==='string'?data.label.trim():'';
  return label.length>0&&label.length<=150?label:null;
 };
 app.get('/api/trips/:id/checklist',...protect(async(req,res)=>{
  const trip=await getTrip(req,res);if(!trip)return;
  res.json({items:await readList(trip.id)});
 }));
 app.post('/api/trips/:id/checklist',...protect(async(req,res)=>{
  const trip=await getTrip(req,res,true);if(!trip)return;
  const label=check(req.body);if(!label)return fail(res,400,'Item name must be 1–150 characters.');
  const [count]=await run('SELECT COUNT(*) AS total FROM trip_checklist_items WHERE trip_id=?',[trip.id]);
  if(count[0].total>=300)return fail(res,409,'Maximum 300 checklist items per trip.');
  const [result]=await run('INSERT INTO trip_checklist_items (trip_id,label,is_checked,created_by) VALUES (?,?,0,?)',[trip.id,label,req.user.id]);
  res.status(201).json({item:{id:String(result.insertId),label,checked:false}});
 }));
 app.patch('/api/trips/:id/checklist/:itemId',...protect(async(req,res)=>{
  const trip=await getTrip(req,res,true);if(!trip)return;
  if(!isId(req.params.itemId))return fail(res,400,'Invalid item ID.');
  const hasLabel=Object.prototype.hasOwnProperty.call(req.body||{},'label');
  const hasChecked=Object.prototype.hasOwnProperty.call(req.body||{},'checked');
  if(!hasLabel&&!hasChecked)return fail(res,400,'Nothing to update.');
  if(hasChecked&&typeof req.body.checked!=='boolean')return fail(res,400,'Checked must be true or false.');
  const label=hasLabel?check(req.body):null;
  if(hasLabel&&!label)return fail(res,400,'Item name must be 1–150 characters.');
  const sets=[],params=[];
  if(hasLabel){sets.push('label=?');params.push(label);}
  if(hasChecked){sets.push('is_checked=?');params.push(req.body.checked?1:0);}
  params.push(trip.id,req.params.itemId);
  const [result]=await run(`UPDATE trip_checklist_items SET ${sets.join(',')} WHERE trip_id=? AND id=?`,params);
  if(!result.affectedRows)return fail(res,404,'Checklist item not found.');
  const [rows]=await run('SELECT id,label,is_checked FROM trip_checklist_items WHERE trip_id=? AND id=?',[trip.id,req.params.itemId]);
  res.json({item:dto(rows[0])});
 }));
 app.delete('/api/trips/:id/checklist/:itemId',...protect(async(req,res)=>{
  const trip=await getTrip(req,res,true);if(!trip)return;
  if(!isId(req.params.itemId))return fail(res,400,'Invalid item ID.');
  const [result]=await run('DELETE FROM trip_checklist_items WHERE trip_id=? AND id=?',[trip.id,req.params.itemId]);
  if(!result.affectedRows)return fail(res,404,'Checklist item not found.');
  res.json({ok:true});
 }));
};
