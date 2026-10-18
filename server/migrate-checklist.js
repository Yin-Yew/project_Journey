/* One-time backfill, rerunnable without duplicating items. Requires migrate_v4.sql.
   For each trip, lock transaction and mark legacy migration only after inserts. */
require('dotenv').config({path:require('path').join(__dirname,'.env')});
const pool=require('./database');
(async()=>{
 const [rows]=await pool.execute('SELECT trip_id,module_data FROM trip_modules ORDER BY trip_id');
 let done=0,added=0;
 for(const row of rows){
  const conn=await pool.getConnection();
  try{
   await conn.beginTransaction();
   // Unique migration marker serializes concurrent runs for the same trip.
   const [marker]=await conn.execute('INSERT IGNORE INTO trip_checklist_migrations (trip_id) VALUES (?)',[row.trip_id]);
   if(!marker.affectedRows){await conn.commit();continue;}
   const data=typeof row.module_data==='string'?JSON.parse(row.module_data):row.module_data||{};
   const items=Array.isArray(data.checklistItems)?data.checklistItems.slice(0,300):[];
   const [owner]=await conn.execute('SELECT owner_id FROM trips WHERE id=?',[row.trip_id]);
   if(!owner.length){await conn.rollback();continue;}
   const [existing]=await conn.execute('SELECT COUNT(*) AS n FROM trip_checklist_items WHERE trip_id=?',[row.trip_id]);
   // If users already added items using the new API, don't merge stale items.
   if(!existing[0].n){for(const item of items){
    const label=String(item?.label||'').trim().slice(0,150);
    if(label){await conn.execute('INSERT INTO trip_checklist_items (trip_id,label,is_checked,created_by) VALUES (?,?,?,?)',[row.trip_id,label,item.checked?1:0,owner[0].owner_id]);added++;}
   }}
   await conn.commit();done++;
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
 }
 console.log(`Checklist migration complete: ${done} trips, ${added} legacy items copied.`);
})().catch(e=>{console.error('Migration failed:',e.message);process.exitCode=1;}).finally(()=>pool.end());
