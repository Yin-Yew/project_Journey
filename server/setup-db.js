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
  console.log(`MySQL schema ready: ${name}. No sample data was added.`);
 } finally {await con.end();}
}
if(require.main===module)setup().catch(e=>{console.error('Cannot initialize MySQL:',e.message);process.exitCode=1;});
module.exports={setup};
