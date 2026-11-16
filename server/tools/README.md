# เครื่องมือสำหรับ JoyJourney (Windows / macOS / Linux)

ไฟล์เหล่านี้ย้ายมาไว้ใน `server/tools/` เพื่อให้โฟลเดอร์หลักของโปรเจกต์มีเพียง `database/`, `public/`, `server/`, `tests/`, `uploads/`, `.env.example`, `.gitignore` และ `README.md` ตามโครงสร้างที่ต้องการ

- `SETUP-AND-START.bat`: เริ่มเซิร์ฟเวอร์บน Windows และเตรียมตาราง MySQL ว่าง
- `SETUP-AND-START.sh`: เริ่มเซิร์ฟเวอร์บน macOS/Linux
- `BACKUP-DATABASE.bat` / `.sh`: สำรองฐานข้อมูล
- `RESTORE-DATABASE.bat`: กู้คืนฐานข้อมูล (เขียนทับข้อมูลเดิม ใช้ด้วยความระมัดระวัง)
- `CLEAN-OLD-DEMO-FILES.bat`: เครื่องมือเสริมสำหรับเก็บกวาดไฟล์เดโมจากเวอร์ชันเก่าที่อาจหลงเหลือหลังคัดลอกไฟล์ทับใน Clone เดิม **ให้ตรวจโค้ดและรายการไฟล์ก่อนรัน**

ไฟล์ `.env` สำหรับเชื่อม MySQL ควรอยู่ใน `server/.env` และต้องไม่ Push ขึ้น GitHub
