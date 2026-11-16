# JoyJourney v11 — ฉบับไม่มี Demo

## ใช้งานบน Windows
1. เปิด MySQL Server (MySQL 8)
2. แตก ZIP และเปิดโฟลเดอร์ใน VS Code
3. เปิด `server/.env` หากมีไฟล์เดิม ให้ตรวจ `DB_NAME=joyjourney_clean` ก่อน หากยังไม่มี ไม่ต้องสร้างเอง (ตัวเปิดจะคัดลอกจาก `.env.example`)
4. ถ้า MySQL มีรหัสผ่าน ให้กรอก `DB_PASSWORD` ใน `server/.env` (ไฟล์นี้ไม่ควร Push ขึ้น GitHub)
5. ดับเบิลคลิก `server/tools/SETUP-AND-START.bat`
6. เปิด `http://localhost:3000/register.html` และสมัครบัญชีของคุณเอง
7. สร้างทริปใหม่ เชิญเพื่อนตามรหัสทริป และใช้ฟีเจอร์อื่นได้ทันที

**ไม่มี Try Demo** และระบบจะไม่เพิ่มบัญชีหรือทริปทดสอบลง MySQL

## อัปเดต GitHub Repository เดิม
- ใช้โฟลเดอร์ที่ Clone มาจาก GitHub ซึ่งมี `.git` อยู่แล้ว
- นำ **เนื้อหาภายใน** โฟลเดอร์ที่แตก ZIP ไปแทนไฟล์เก่า ไม่ลบ `.git`
- ตรวจคำสั่งใน `server/tools/CLEAN-OLD-DEMO-FILES.bat` ก่อนเรียกใช้ หากต้องลบไฟล์เดโมที่ค้างจากรุ่นเก่า หลังคัดลอกไฟล์ใหม่ เพื่อเก็บกวาดโค้ดและรูปเดโมเก่าที่อาจยังค้างใน Repository (ไม่ยุ่งกับ MySQL)
- ใน VS Code ตรวจ `git status`, `git add -A`, `git diff --cached --name-only`, `git commit -m "Use JoyJourney v11 clean build"`, แล้ว `git push`
- อย่า Commit `server/.env`, `node_modules`, `backups`, หรือข้อมูลส่วนตัว

**คำเตือน:** ถ้าใช้ `DB_NAME=joyjourney` หรือฐานเก่าที่มีข้อมูลเดโมอยู่ ข้อมูลเดิมจะยังอยู่ เพราะเราไม่ลบข้อมูลจากฐานเดิม ต้องใช้ฐานใหม่อย่าง `joyjourney_clean` เพื่อเริ่มว่างโดยปลอดภัย

## อัปเดต v11 และข้อมูลเดิม
- ให้ Backup ก่อน โดยใช้ `server/tools/BACKUP-DATABASE.bat`
- วางไฟล์ ZIP ใหม่ทับใน Repository เดิม (เก็บ `.git` และ `server/.env` ไว้)
- เปิด `server/tools/SETUP-AND-START.bat` เพื่ออัปเกรด Checklist ของฐานข้อมูลเดิมอัตโนมัติ
- Planner เรียงกิจกรรมตามเวลาอัตโนมัติ ไม่ใช้ปุ่มเลื่อนขึ้น/ลง
- Checklist แบ่งรายการตามสมาชิก โดยเลือกผู้รับผิดชอบในหน้าต่าง Add Item
