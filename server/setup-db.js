/** Initialize an empty JoyJourney MySQL schema. Never seeds accounts or trips. */
require('dotenv').config({path:require('path').join(__dirname,'.env')});
const mysql=require('mysql2/promise');
const fs=require('node:fs/promises');
const path=require('node:path');

const name=process.env.DB_NAME||'joyjourney_clean';
if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)) {
 console.error('DB_NAME must start with a letter and contain only letters, digits and underscore.');
 process.exit(1);
}
async function setup(){
 const con=await mysql.createConnection({
  host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),
  user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',
  multipleStatements:true
 });
 try {
  const schema=await fs.readFile(path.join(__dirname,'../database/schema.sql'),'utf8');
  // Use the configured DB name in the original CREATE DATABASE and USE clauses.
  const sql=schema.replace(/CREATE DATABASE IF NOT EXISTS joyjourney;/,`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(name)};`)
   .replace(/USE joyjourney;/,`USE ${mysql.escapeId(name)};`);
  if(sql===schema)throw new Error('Unexpected schema.sql format.');
  await con.query(sql);
  // Upgrade existing installations without dropping or resetting checklists.
  const [columns]=await con.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='trip_checklist_items' AND COLUMN_NAME='assigned_to'`,[name]);
  if(!columns.length){
   await con.query(`ALTER TABLE ${mysql.escapeId(name)}.trip_checklist_items
      ADD COLUMN assigned_to INT NULL AFTER created_by,
      ADD INDEX idx_checklist_assignee (trip_id,assigned_to),
      ADD CONSTRAINT fk_checklist_assignee FOREIGN KEY (assigned_to) REFERENCES ${mysql.escapeId(name)}.users(id) ON DELETE SET NULL`);
   console.log('Updated existing checklist table with member assignments.');
  }
  // v12: private notes belong to the account that originally CREATED the item.
  // This safely converts v11's "assigned to another person" records once the
  // same startup procedure is run. It does not delete notes or alter their checks.
  await con.query(`UPDATE ${mysql.escapeId(name)}.trip_checklist_items c
    SET c.assigned_to=c.created_by WHERE c.created_by IS NOT NULL
      AND (c.assigned_to IS NULL OR c.assigned_to<>c.created_by)`);
  // Historic rows without a surviving creator go to their trip's owner.
  await con.query(`UPDATE ${mysql.escapeId(name)}.trip_checklist_items c
    JOIN ${mysql.escapeId(name)}.trips t ON t.id=c.trip_id
    SET c.assigned_to=t.owner_id WHERE c.assigned_to IS NULL`);
  console.log(`MySQL schema ready: ${name}. No sample data was added.`);
 } finally {await con.end();}
}
if(require.main===module)setup().catch(e=>{console.error('Cannot initialize MySQL:',e.message);process.exitCode=1;});
module.exports={setup};
