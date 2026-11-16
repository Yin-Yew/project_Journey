/* Local-only portable database snapshot with attached memory photos.
   No mysqldump binary needed. Treat snapshot as confidential: contains user
   records, password hashes, PromptPay and optional embedded payment slips. */
require('dotenv').config({path:require('path').join(__dirname,'.env')});
const fs=require('fs/promises');
const path=require('path');
const mysql=require('mysql2/promise');
const ROOT=path.resolve(__dirname,'..');
const backupRoot=path.join(ROOT,'backups');
const safeName=name=>/^[a-z][a-z0-9_]{0,63}$/i.test(name);
function connectionConfig(){
 const db=process.env.DB_NAME||'joyjourney';if(!safeName(db))throw new Error('Invalid DB_NAME.');
 return {host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:db,dateStrings:true,decimalNumbers:false};
}
async function withConnection(fn){const con=await mysql.createConnection(connectionConfig());try{return await fn(con);}finally{await con.end();}}
async function copyUploads(from,to){try{await fs.cp(from,to,{recursive:true,force:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
function safeBackupDirectory(dir){
 const resolved=path.resolve(dir);
 if(!resolved.startsWith(backupRoot+path.sep))throw new Error('Choose a backup folder inside JoyJourney/backups.');
 return resolved;
}
async function backup(){
 await fs.mkdir(backupRoot,{recursive:true});
 const date=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
 const folder=path.join(backupRoot,'joyjourney-'+date);
 const payload=await withConnection(async con=>{
  await con.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await con.beginTransaction();
  try{
   const [tables]=await con.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
   const data={format:'joyjourney-backup-v1',createdAt:new Date().toISOString(),tables:{}};
   for(const {TABLE_NAME:name} of tables){if(!safeName(name))throw new Error('Unexpected table: '+name);
    const [rows]=await con.query('SELECT * FROM '+mysql.escapeId(name));data.tables[name]=rows;
   }
   await con.commit();return data;
  }catch(e){await con.rollback();throw e;}
 });
 await fs.mkdir(folder,{recursive:true});
 await fs.writeFile(path.join(folder,'database.json'),JSON.stringify(payload,null,2),'utf8');
 await copyUploads(path.join(ROOT,'uploads','memories'),path.join(folder,'uploads','memories'));
 return folder;
}
async function restore(folder,approval){
 if(approval!=='RESTORE')throw new Error('Restore cancelled: explicit RESTORE approval required.');
 folder=safeBackupDirectory(folder);
 const snapshot=JSON.parse(await fs.readFile(path.join(folder,'database.json'),'utf8'));
 if(snapshot.format!=='joyjourney-backup-v1'||!snapshot.tables||Array.isArray(snapshot.tables))throw new Error('Not a supported JoyJourney backup.');
 const names=Object.keys(snapshot.tables);
 if(!names.length||names.some(name=>!safeName(name)||!Array.isArray(snapshot.tables[name])))throw new Error('Invalid backup tables.');
 await withConnection(async con=>{
  const [existing]=await con.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
  const expected=new Set(existing.map(r=>r.TABLE_NAME));
  if(names.some(name=>!expected.has(name)))throw new Error('Database schema is missing tables. Run SETUP-AND-START.bat first.');
  await con.query('SET FOREIGN_KEY_CHECKS=0');await con.beginTransaction();
  try{
   for(const name of existing.map(r=>r.TABLE_NAME))await con.query('DELETE FROM '+mysql.escapeId(name));
   for(const name of names){
    const rows=snapshot.tables[name];if(!rows.length)continue;
    const [columns]=await con.query('SHOW COLUMNS FROM '+mysql.escapeId(name));
    const allowed=new Set(columns.map(c=>c.Field));
    for(const row of rows){
     const fields=Object.keys(row);if(fields.some(col=>!allowed.has(col)||!safeName(col)))throw new Error('Invalid columns in '+name);
     await con.execute('INSERT INTO '+mysql.escapeId(name)+' ('+fields.map(field=>mysql.escapeId(field)).join(',')+') VALUES ('+fields.map(()=>'?').join(',')+')',fields.map(f=>typeof row[f]==='object'&&row[f]!==null?JSON.stringify(row[f]):row[f]));
    }
   }
   await con.commit();
  }catch(e){await con.rollback();throw e;}finally{await con.query('SET FOREIGN_KEY_CHECKS=1');}
 });
 await copyUploads(path.join(folder,'uploads','memories'),path.join(ROOT,'uploads','memories'));
 return names.length;
}
if(require.main===module){
 (async()=>{
  const [action,arg,approval]=process.argv.slice(2);
  if(action==='backup'){console.log('Backup saved to:',await backup());}
  else if(action==='restore'){console.log('Restored',await restore(arg,approval),'tables. Please restart the server.');}
  else throw new Error('Usage: node database-snapshot.js backup | restore <backup-directory> RESTORE');
 })().catch(e=>{console.error('Backup/restore failed:',e.message);process.exitCode=1;});
}
module.exports={backup,restore,safeBackupDirectory};
