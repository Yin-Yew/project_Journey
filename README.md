# JoyJourney — ระบบวางแผนทริปและโหวตจุดหมายท่องเที่ยว

> **Repository:** https://github.com/Yin-Yew/project_Journey

JoyJourney คือเว็บแอปสำหรับวางแผนท่องเที่ยวร่วมกับเพื่อน มีระบบบัญชีผู้ใช้ สร้างทริป เชิญสมาชิก จัดตารางเที่ยว เก็บสถานที่ จัดการค่าใช้จ่ายและการชำระเงิน เตรียมของ บันทึกรูปความทรงจำ และ **โหวตจุดหมายของทริปถัดไปโดยแยกออกจากทริป** ข้อมูลหลักบันทึกใน **MySQL** ผ่าน **Node.js/Express API**


---

## สารบัญ

1. [ความสามารถของระบบ](#ความสามารถของระบบ)
2. [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
3. [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
4. [ติดตั้งใหม่บน Windows](#ติดตั้งใหม่บน-windows)
5. [อัปเกรดฐานข้อมูลเดิมโดยไม่ลบข้อมูล](#อัปเกรดฐานข้อมูลเดิมโดยไม่ลบข้อมูล)
6. [วิธีใช้งานและสิทธิ์ผู้ใช้](#วิธีใช้งานและสิทธิ์ผู้ใช้)
7. [การตรวจสอบและทดสอบระบบ](#การตรวจสอบและทดสอบระบบ)
8. [API ที่สำคัญ](#api-ที่สำคัญ)
9. [โครงสร้างฐานข้อมูล](#โครงสร้างฐานข้อมูล)
10. [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)
11. [ความปลอดภัย การสำรองข้อมูล และข้อจำกัด](#ความปลอดภัย-การสำรองข้อมูล-และข้อจำกัด)

## ความสามารถของระบบ

| ส่วน | ความสามารถหลัก | การเก็บข้อมูล |
| --- | --- | --- |
| **Account** | Register, Login, Logout, แก้โปรไฟล์, เซสชันบนเซิร์ฟเวอร์ | MySQL (`users`, `auth_sessions`) |
| **My Trips** | สร้าง/แก้ไข/ลบทริป, งบประมาณ, วันที่, รูปปก, ค้นหาทริป | MySQL (`trips`) |
| **Trip Members** | Invite Code **สำหรับทริป**, Join Trip, เพิ่ม/ลบสมาชิก, Owner/Member | MySQL (`trip_members`) |
| **Trip Status** | `active` และ `finished` | MySQL (`trips.status`) |
| **Dashboard** | ข้อมูลทริป, จำนวนสมาชิก, งบ, ค่าใช้จ่ายรวม, Packing %, สถานะชำระเงิน และข้อมูลการเดินทาง | รวมข้อมูลจาก API/MySQL |
| **Planner** | แผนรายวัน Day 1–N, เวลา, สถานที่, รายละเอียด, เพิ่ม/แก้ไข/ลบ, จัดลำดับ | MySQL (`trip_activities`) |
| **Places** | บันทึกสถานที่รายทริป: Attraction, Restaurant, Cafe; รูปและรายละเอียด | MySQL (`trip_places`) |
| **Expenses** | เพิ่ม/แก้ไข/ลบรายจ่าย, แบ่งเท่า ๆ กัน/เปอร์เซ็นต์/กำหนดเอง | MySQL (`expenses`, `expense_splits`) |
| **Payments** | แจ้งชำระพร้อมสลิป และให้ผู้รับเงินกดยืนยัน | MySQL (`payments`) |
| **Checklist** | เพิ่ม/แก้ไข/ลบ/ติ๊กรายการแยกตามทริป, คำนวณ Packing % | MySQL (`trip_checklist_items`) |
| **Memories** | อัลบั้มแยกทริป, All Photos, อัปโหลดรูป, Caption, ดูรูปใหญ่, ลบรูป | MySQL + `uploads/memories/` |
| **Next Trip Vote (v6)** | โพลสาธารณะในเว็บ, เสนอจุดหมาย, หนึ่งโหวตต่อบัญชีต่อโพล, เปลี่ยน/ถอนโหวต, ปิดโพล | MySQL (`destination_*`) |

### Trip ต่างจาก Next Trip Vote อย่างไร?

- **Trip:** ต้องสร้างทริปก่อน ข้อมูลจำกัดให้ **สมาชิกทริป** ใช้งานร่วมกัน การเข้าร่วมทริปด้วยตัวเองต้องใช้ **Trip Invite Code 10 ตัว** หรือเจ้าของเพิ่มสมาชิกผ่านอีเมลที่สมัครแล้ว
- **Next Trip Vote:** โหวต **ก่อนสร้างทริป** ได้ ทุกบัญชีที่ล็อกอินเห็นทุกโพล ไม่มีรหัสเชิญโพล ไม่ต้อง Join และคะแนนไม่ผูกกับทริป
- **Places:** บันทึกสถานที่ที่สนใจ *ภายในทริปนั้น* หน้า Places ไม่ใช่หน้าเลือกจุดหมายทริปถัดไป (โครงสร้าง `place_votes` จากเวอร์ชันก่อนยังอยู่เพื่อรักษาข้อมูลเดิม)
- ผลโหวต **ไม่ได้สร้าง Trip อัตโนมัติ** หลังได้จุดหมายที่ต้องการ ให้สร้างทริปที่หน้า My Trips

## เทคโนโลยีที่ใช้

| ชั้น | เทคโนโลยี |
| --- | --- |
| Frontend | HTML, CSS, JavaScript (Vanilla JS) |
| Backend | Node.js, Express 4 |
| Database | MySQL 8.x และ `mysql2` |
| Password | `bcryptjs` สำหรับแฮชรหัสผ่านบัญชีเว็บ |
| Configuration | `dotenv` |
| Testing | Node.js built-in test runner (`node --test`) |
| Icons/Fonts | Phosphor Icons และ Google Fonts ผ่าน CDN/อินเทอร์เน็ต |

> **สิ่งที่ต้องติดตั้ง:** Node.js รุ่น LTS (แนะนำ 20 ขึ้นไป), npm, MySQL Server 8.x และ MySQL Workbench (สำหรับจัดการฐานข้อมูลผ่าน UI) โปรแกรม VS Code และ Git เป็นตัวช่วยในการพัฒนา ไม่ใช่ข้อบังคับของเว็บขณะรัน

## โครงสร้างโปรเจกต์

```text
project_Journey/
├── README.md
├── .env.example             # ตัวอย่างตัวแปรสภาพแวดล้อม (ไม่มีรหัสจริง)
├── .gitignore               # ป้องกัน .env / node_modules / ไฟล์อัปโหลด
├── database/
│   ├── schema.sql           # สำหรับติดตั้งฐานข้อมูลใหม่เป็น v6
│   ├── migrate_existing.sql # สำหรับฐานข้อมูลเก่าบางชุดเท่านั้น
│   ├── migrate_v2.sql
│   ├── migrate_v3.sql
│   ├── migrate_v4.sql
│   ├── migrate_v5.sql        # เพิ่มระบบโพลครั้งแรก
│   └── migrate_v6.sql        # เปลี่ยนโพลเป็นสาธารณะภายในเว็บ
├── server/
│   ├── app.js               # Express server, Auth และ Trip API
│   ├── database.js          # MySQL connection pool
│   ├── trip-features.js     # Dashboard, Expenses, Payments, Memories
│   ├── planner-places.js    # Planner และ Places API
│   ├── checklist.js         # Checklist API รายรายการ
│   ├── destination-votes.js # Public Next Trip Vote API
│   ├── migrate-checklist.js # ย้าย Checklist JSON เก่า (รันครั้งเดียว)
│   ├── package.json
│   └── .env                 # สร้างเองบนเครื่อง ห้าม Commit
├── public/
│   ├── index.html           # Dashboard
│   ├── login.html
│   ├── register.html
│   ├── trips.html           # My Trips
│   ├── trip-detail.html
│   ├── planner.html
│   ├── places.html
│   ├── voting.html          # Next Trip Vote (v6)
│   ├── expenses.html
│   ├── checklist.html
│   ├── memories.html
│   ├── profile.html
│   ├── settings.html
│   ├── css/style.css
│   ├── js/                  # JavaScript ฝั่ง Browser
│   └── assets/
├── tests/
│   ├── checklist.test.js
│   ├── destination-votes.test.js
│   └── destination-join.test.js
└── uploads/
    └── memories/           # ไฟล์รูปที่อัปโหลดจริง (อย่าลบทิ้ง)
```

ไฟล์ JavaScript/Style ชื่อเดียวกันที่อยู่ตรง `public/` ระดับบนเป็นไฟล์เก่า/placeholder; หน้าเว็บหลักอ้างอิงจาก `public/js/` และ `public/css/` เป็นหลัก

## ติดตั้งใหม่บน Windows

> **ใช้ส่วนนี้เฉพาะเมื่อยังไม่มีฐานข้อมูล JoyJourney ที่ต้องเก็บไว้** หากเคยสร้างทริปหรือมีข้อมูลใน MySQL แล้ว ให้ไปหัวข้อ [อัปเกรดฐานข้อมูลเดิม](#อัปเกรดฐานข้อมูลเดิมโดยไม่ลบข้อมูล) แทน **อย่าลบฐานข้อมูลเดิมเพื่ออัปเดตโค้ด**

### 1. เปิดโปรเจกต์

หากยังไม่มีโค้ดในเครื่อง:

```powershell
git clone https://github.com/Yin-Yew/project_Journey.git
cd project_Journey
code .
```

หากมีโฟลเดอร์ `project_Journey` อยู่แล้ว ให้เปิดโฟลเดอร์เดิมใน VS Code ไม่ต้อง Clone ซ้ำ หากได้รับ ZIP เวอร์ชันใหม่ ให้แตกไฟล์แล้ว **คัดลอกไฟล์ภายใน ZIP** ไปทับเฉพาะไฟล์โค้ดในโปรเจกต์เดิม **อย่าทับ** `server/.env`, โฟลเดอร์ `.git` หรือรูปเดิมใน `uploads/`

### 2. ติดตั้งและเปิด MySQL

ติดตั้ง **MySQL Community Server 8.x** และ **MySQL Workbench** ผ่านเว็บทางการ:

- MySQL Installer: https://dev.mysql.com/downloads/installer/
- MySQL Server: https://dev.mysql.com/downloads/mysql/
- MySQL Workbench: https://dev.mysql.com/downloads/workbench/

ระหว่างตั้งค่า MySQL ให้จดชื่อผู้ใช้ (`root` หากใช้ค่าเริ่มต้น), รหัสผ่านที่ตั้งเอง และพอร์ต (ปกติ `3306`) ไว้ในที่ปลอดภัย จากนั้นเปิด Workbench และเชื่อมต่อ Local instance ให้สำเร็จ

### 3. สร้างฐานข้อมูลด้วย `schema.sql`

ใน MySQL Workbench:

1. **File → Open SQL Script…** เลือก `database/schema.sql`
2. กดปุ่ม **สายฟ้า (Execute)** เพื่อรันทั้งไฟล์
3. ด้านซ้ายเปิด **SCHEMAS → Refresh → joyjourney → Tables**
4. ตรวจว่าเห็นตาราง เช่น `users`, `trips`, `trip_members`, `trip_activities`, `trip_checklist_items`, `destination_polls`, `destination_candidates`, `destination_votes`

ไฟล์ `schema.sql` ของ ZIP นี้มีตาราง **v6 สำหรับการติดตั้งใหม่ครบแล้ว** จึง **ไม่ต้องรัน `migrate_v2.sql` ถึง `migrate_v6.sql` ซ้ำ**

สามารถตรวจสอบผ่าน SQL ได้ด้วย:

```sql
USE joyjourney;
SHOW TABLES;
```

### 4. สร้าง `server/.env`

**สำคัญ:** ไฟล์ตัวอย่างอยู่ที่ `project_Journey/.env.example` แต่ไฟล์ที่ Backend ใช้ต้องอยู่ที่ **`project_Journey/server/.env`** เพราะ `npm start` รันจากโฟลเดอร์ `server`

ใน PowerShell ที่อยู่ภายในโฟลเดอร์ `project_Journey`:

```powershell
Copy-Item .env.example server\.env
```

เปิด `server/.env` แล้วแก้ค่าให้ตรงกับ MySQL บนเครื่องคุณ:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_ROOT_PASSWORD
DB_NAME=joyjourney
JWT_SECRET=replace_with_a_private_random_string
```

- แทนที่ `YOUR_MYSQL_ROOT_PASSWORD` ด้วยรหัส MySQL ที่คุณตั้งไว้จริง **โดยไม่ใส่เครื่องหมายคำพูดหากไม่จำเป็น**
- `DB_PORT` เพิ่มได้แม้ไฟล์ตัวอย่างเดิมไม่ระบุ (หากไม่ใส่ Backend ใช้ `3306`)
- `JWT_SECRET` อยู่ในไฟล์ตัวอย่างเดิม แต่การยืนยันตัวตนของโค้ดชุดนี้ใช้ **session token ใน MySQL** ไม่ใช่ JWT; ตัวแปรนี้ยังไม่ได้เป็นกลไกยืนยันตัวตน
- อย่าส่งไฟล์ `.env` พร้อมรหัสจริงให้คนอื่นหรืออัปโหลดขึ้น GitHub

ตรวจสอบกฎ Git ใน Terminal **จากโฟลเดอร์หลัก**:

```powershell
git check-ignore -v server/.env
git ls-files server/.env
```

คำสั่งแรกควรบอกกฎ `.gitignore` ที่ละเว้นไฟล์ และคำสั่งที่สองควร **ไม่แสดงชื่อไฟล์** หากมีการติดตาม `.env` ไปก่อนแล้ว ให้ใช้ `git rm --cached server/.env` เพื่อนำออกจาก Git index (ไม่ลบไฟล์บนเครื่อง) แล้วเปลี่ยนรหัสหากเคยเผยแพร่ไปแล้ว

### 5. ติดตั้ง Backend และเปิดเว็บ

เปิด **Terminal → New Terminal** ใน VS Code จากโฟลเดอร์หลัก แล้วรัน:

```powershell
cd server
npm install
npm test
npm start
```

`npm start` ต้องทำในโฟลเดอร์ **`server`** เพราะ `package.json` อยู่ที่ `server/package.json` ถ้ารันจากโฟลเดอร์หลักจะขึ้น `ENOENT ... package.json`

เมื่อเซิร์ฟเวอร์ทำงาน ให้เปิด:

| หน้า | URL |
| --- | --- |
| ตรวจการเชื่อม MySQL | http://localhost:3000/api/health |
| หน้าเว็บหลัก (Dashboard) | http://localhost:3000/index.html |
| สมัครสมาชิก | http://localhost:3000/register.html |
| เข้าสู่ระบบ | http://localhost:3000/login.html |
| My Trips | http://localhost:3000/trips.html |
| Next Trip Vote | http://localhost:3000/voting.html |

ผลที่คาดหวังจาก `/api/health`:

```json
{"app":"JoyJourney","status":"ok","database":"connected"}
```

หากเปิดไม่ได้ ให้ดูข้อผิดพลาดใน Terminal ที่รัน `npm start` ค้างไว้ **อย่าปิด Terminal ระหว่างใช้งาน** กด `Ctrl + C` เมื่อต้องการหยุดเซิร์ฟเวอร์

## อัปเกรดฐานข้อมูลเดิมโดยไม่ลบข้อมูล

> **สำรองฐานข้อมูลก่อนเสมอ** และตรวจว่าเครื่องใช้ schema เวอร์ชันใดจริง ขั้นตอนนี้มีไว้สำหรับผู้ที่ใช้งาน JoyJourney อยู่แล้ว เช่น ได้ทดสอบ Login, Create Trip หรือ Invite Code ด้วยข้อมูลจริงไปแล้ว

### 1. สำรองข้อมูล

ผ่าน MySQL Workbench: **Server → Data Export → เลือก `joyjourney` → Export to Self-Contained File → Start Export** ตรวจว่าไฟล์ `.sql` สำรองถูกสร้างเรียบร้อย และ **สำรองโฟลเดอร์ `uploads/memories/` แยกด้วย** เพราะรูปภาพไม่ได้เก็บเป็นไฟล์ใน MySQL

### 2. ใช้ Migration ให้ตรงกับฐานข้อมูลปัจจุบัน

| ฐานข้อมูลปัจจุบัน | ไฟล์/ขั้นตอนที่ต้องทำตามลำดับ |
| --- | --- |
| **ติดตั้งใหม่ ยังไม่มีข้อมูล** | ใช้ `database/schema.sql` ไฟล์เดียว |
| **v5** (มีระบบ Next Trip Vote แบบรหัสเชิญ) | รัน `database/migrate_v6.sql` |
| **v4** (มี Checklist แบบแยกรายการแล้ว) | รัน `database/migrate_v5.sql` → `database/migrate_v6.sql` |
| **v3** (มี Planner/Places แต่ Checklist ยังเป็น JSON) | รัน `migrate_v4.sql` → `npm run migrate:checklist` จาก `server` → `migrate_v5.sql` → `migrate_v6.sql` |
| **ก่อน v3** | ตรวจตารางจริงและลำดับ Migration ที่ยังขาดก่อน; โดยทั่วไปเพิ่ม v2/v3/v4/v5/v6 ตามลำดับ แต่ `migrate_existing.sql` อาจใช้กับ schema รุ่นเก่าเฉพาะชุด ห้ามรันแบบเดาสุ่ม |

**หมายเหตุเกี่ยวกับ Migration:**

- `migrate_v5.sql` สร้างโครงสร้างโพลแบบเดิมที่มีสมาชิก/รหัสเชิญ เพื่อรองรับเส้นทางอัปเกรด
- `migrate_v6.sql` ปรับ `invite_code` ให้ไม่จำเป็น ยกเลิกเงื่อนไข Foreign Key ที่บังคับให้ Join โพลก่อนโหวต และยืนยันความสัมพันธ์ของคะแนนกับผู้ใช้จริง
- รหัสเชิญโพลเก่า สมาชิกโพลเก่า และคะแนนเก่ายังถูกเก็บไว้ในฐานข้อมูลเพื่อรักษาประวัติ แต่ **หน้าเว็บ v6 ไม่ใช้ Invite Code ของโพลอีกต่อไป**
- **อย่าสั่ง `DROP DATABASE`**, อย่าลบข้อมูลใน `trips` และอย่ารัน Migration เดิมซ้ำโดยไม่ทราบสถานะ เพราะคำสั่ง `ALTER TABLE` บางอันไม่รองรับการรันซ้ำ
- `migrate:checklist` ใช้ย้ายรายการเก่าจาก `trip_modules` ไป `trip_checklist_items` โดยใช้ตาราง marker ป้องกันการย้ายซ้ำ; ใช้เฉพาะกรณีต้องย้าย JSON เก่า

ตัวอย่างสำหรับผู้ที่มีฐานข้อมูล **v4 อยู่แล้ว**:

1. สำรอง `joyjourney` ใน Workbench
2. **File → Open SQL Script** เลือก `database/migrate_v5.sql` และกด Execute
3. เปิด `database/migrate_v6.sql` และกด Execute ต่อ
4. รีสตาร์ตเซิร์ฟเวอร์ใน VS Code (`Ctrl + C` แล้ว `npm start`)
5. เปิด http://localhost:3000/voting.html ตรวจว่าเห็น **Public Voting Polls** โดยไม่ต้อง Join หรือกรอกรหัส

### 3. ตรวจสอบหลังอัปเกรด

```sql
USE joyjourney;

SHOW TABLES LIKE 'destination_%';

SELECT id, title, status FROM destination_polls ORDER BY id DESC;

SELECT poll_id, user_id, candidate_id
FROM destination_votes
ORDER BY poll_id, user_id;
```

## วิธีใช้งานและสิทธิ์ผู้ใช้

### A. Account และ Trip

1. เข้า `register.html` สมัครบัญชี → Login → `trips.html`
2. กด **Create Trip** กำหนดชื่อ ปลายทาง วันเริ่ม–สิ้นสุด งบ และรูปปก
3. เปิด **Trip Detail** เพื่อดูสมาชิก/สถิติ/รายละเอียด
4. ใช้ **Trip Invite Code** ให้เพื่อนที่มีบัญชี Join ที่หน้า My Trips หรือ Owner เพิ่มสมาชิกด้วยอีเมล
5. Owner แก้ไขทริป เปลี่ยน `Active/Finished` จัดการสมาชิก และลบทริปได้

### B. Planner และ Places

- **Planner:** เลือกทริป → เพิ่มกิจกรรมใน Day 1/Day 2/... ตามช่วงวันจริงของทริป → กรอกเวลา/สถานที่/รายละเอียด → แก้ไข ลบ หรือใช้ปุ่มขึ้น/ลงเพื่อจัดลำดับ จำนวน Activity ของ Trip Overview คำนวณจาก `trip_activities`
- **Places:** เลือกทริป → เพิ่มสถานที่ประเภท `Attraction`, `Restaurant`, `Cafe` พร้อมรูป ชื่อ รายละเอียด แก้ไข/ลบได้ตามสิทธิ์
- **Next Trip Vote ไม่ได้อยู่ในหน้า Places:** ใช้เมนูแยก `voting.html` เมื่ออยากให้ทุกบัญชีในเว็บเลือกจุดหมายทริปถัดไป

### C. Public Next Trip Vote (v6)

1. ล็อกอินบัญชี JoyJourney (ไม่ต้องเป็นสมาชิก Trip)
2. เปิดเมนู **Next Trip Vote** หรือ `voting.html` → เห็นโพลของผู้ใช้ทุกบัญชี
3. ผู้ใช้ที่ล็อกอินกด **Create Poll** และตั้งหัวข้อ เช่น “ปีหน้าไปเที่ยวที่ไหนดี?”
4. ทุกบัญชีเสนอจังหวัด/ประเทศได้ผ่าน **Suggest Destination** ใส่ชื่อ รายละเอียด และ **HTTPS Image URL** (โพลใช้ URL ของรูป ไม่ใช่อัปโหลดไฟล์)
5. ผู้ใช้แต่ละคนกด **Vote here** ได้ **หนึ่งตัวเลือกที่ใช้งานอยู่ต่อโพล** เปลี่ยนใจเป็นอีกตัวเลือกได้ (คะแนนเดิมถูกย้าย) หรือกดถอนโหวตได้
6. ทุกคนเห็น **คะแนนรวมและเปอร์เซ็นต์** จากฐานข้อมูลเมื่อโหลดข้อมูลใหม่
7. **เจ้าของโพล** เท่านั้นที่แก้ชื่อโพล ปิด/เปิดรับโหวต และลบโพลได้ เมื่อปิดแล้วจะโหวตหรือเสนอจุดหมายเพิ่มไม่ได้ แต่ยังดูผลได้ หากคะแนนสูงสุดเท่ากัน ระบบแสดงผลเสมอ

**สิทธิ์ตัวเลือก:** ผู้เสนอจุดหมายแก้/ลบตัวเลือกที่ตัวเองสร้างได้ และเจ้าของโพลแก้/ลบตัวเลือกในโพลของตนได้ (ระหว่างโพลเปิด) หากลบตัวเลือก คะแนนที่โหวตให้ตัวเลือกนั้นจะถูกลบด้วย

### D. Expenses / Payments / Checklist / Memories

- **Expenses:** บันทึกยอดและผู้จ่าย เลือกสมาชิกที่แชร์ค่าใช้จ่าย กำหนดวิธีแบ่ง (Equal / Percentage / Custom) ข้อมูลบันทึกใน MySQL
- **Payments:** ผู้จ่ายส่งรายการชำระ/สลิป แล้ว **ผู้รับเงินเป็นคนกดยืนยัน** ระบบไม่ได้โอนเงินผ่านธนาคารให้โดยอัตโนมัติ
- **Checklist:** เพิ่ม/แก้ไข/ลบ/ติ๊กอุปกรณ์แยกตามทริป อัปเดตรายการเป็นแถวใน MySQL ลดปัญหาเขียนทับเมื่อหลายสมาชิกใช้พร้อมกัน Packing % = `จำนวนที่ติ๊กแล้ว ÷ จำนวนรายการทั้งหมด × 100`; เมื่อยังไม่มีรายการจะแสดง 0%
- **Memories:** แยก All Photos กับอัลบั้มของแต่ละทริป อัปโหลด JPEG/PNG/WebP **ไม่เกิน 5 MB ต่อรูป** พร้อม Caption ดูเต็มจอและลบตามสิทธิ์ได้ ทริป `Finished` ยังเห็นและเก็บรูปอยู่ แต่ **Delete Trip เป็นการลบถาวรและลบรูปของทริปนั้นด้วย**

### ตารางสิทธิ์หลัก

| การกระทำ | Owner ของ Trip | Member ของ Trip | ผู้ใช้ที่ไม่อยู่ใน Trip |
| --- | :---: | :---: | :---: |
| ดูรายละเอียด/Planner/Expenses/Checklist/Memories ของทริป | ✅ | ✅ | ❌ |
| แก้ชื่อ/งบ/วันที่ และเปลี่ยนสถานะ Trip | ✅ | ❌ | ❌ |
| ลบทริป | ✅ | ❌ | ❌ |
| เพิ่ม/ลบสมาชิกคนอื่น | ✅ | ❌ | ❌ |
| ออกจากทริปเอง | เจ้าของออกไม่ได้ผ่านคำสั่ง Leave | ✅ | — |
| เพิ่ม/แก้ไขกิจกรรมและ Checklist ของ Active Trip | ✅ | ✅ | ❌ |
| สร้างและลงคะแนน **Public Next Trip Vote** | ✅ (เมื่อล็อกอิน) | ✅ (เมื่อล็อกอิน) | ✅ (เมื่อล็อกอิน) |

โพลมี **เจ้าของโพล (Poll Owner)** แยกจาก **เจ้าของทริป (Trip Owner)**: คนที่สร้างโพลจึงเป็นผู้ดูแลโพลนั้น ไม่เกี่ยวกับ Role ของทริป

## การตรวจสอบและทดสอบระบบ

### Automated Tests

จากโฟลเดอร์ `server`:

```powershell
npm test
```

ชุดทดสอบปัจจุบันอยู่ใน `tests/` เน้น API Checklist และ Public Destination Voting โดยใช้ข้อมูลจำลองในหน่วยทดสอบ **ไม่ได้เป็นการทดสอบ MySQL จริง หรือการทดสอบ End-to-End ครบทุกหน้า**

สามารถตรวจไวยากรณ์ JavaScript เพิ่มเติม:

```powershell
node --check app.js
node --check destination-votes.js
node --check checklist.js
```

### ทดสอบด้วยตัวเองบน MySQL จริง

- [ ] สมัครบัญชี 2 บัญชี แล้ว Login ได้
- [ ] สร้าง Trip จาก Owner แล้วตรวจ `trips`, `trip_members` ใน MySQL
- [ ] Member Join Trip ด้วย **Trip Invite Code**, เห็นทริปและกิจกรรมร่วมกัน
- [ ] Owner แก้ไขทริป → Member รีเฟรชแล้วเห็นค่าที่เปลี่ยน
- [ ] Member ไม่สามารถใช้การแก้ไข/ลบทริปที่สงวนไว้ให้ Owner
- [ ] Planner เพิ่ม/แก้ไข/ลบ/จัดลำดับกิจกรรม, Activity Count ใน Trip Detail ตรงกับข้อมูล
- [ ] Places เพิ่มสถานที่แต่ละประเภทได้ และไม่ปะปนระหว่างทริป
- [ ] Checklist ติ๊กจากบัญชีแรก แล้วบัญชีที่สองโหลดใหม่เห็นค่า Packing % ตรงกัน
- [ ] Expenses/Payments บันทึกและยืนยันโดยผู้รับเงินจริงในแอป (ไม่มีการโอนเงินจริง)
- [ ] Memories อัปโหลดรูป ดูรูปเต็มจอ และเห็นรูปแม้เปลี่ยน Trip เป็น Finished
- [ ] บัญชีแรกสร้าง **Public Poll**, บัญชีที่สองเห็นทันทีโดยไม่ Join และไม่มีรหัส
- [ ] ทั้งสองบัญชีโหวตจุดหมายเดียวกัน คะแนนเป็น 2; บัญชีแรกเปลี่ยนโหวต คะแนนรวมไม่เพิ่มเกินจำนวนคน
- [ ] Owner โพลปิดรับคะแนนได้ และทุกบัญชียังดูผลโหวตได้
- [ ] ทดลอง Delete Trip กับทริปทดสอบเท่านั้น ตรวจว่าไม่กระทบทริปหลัก

SQL สำหรับตรวจข้อมูลตัวอย่าง:

```sql
USE joyjourney;
SELECT id, name, status, invite_code FROM trips ORDER BY id DESC;
SELECT trip_id, user_id, role FROM trip_members ORDER BY trip_id, user_id;
SELECT id, trip_id, day_number, title FROM trip_activities ORDER BY trip_id, day_number, sort_order;
SELECT trip_id, COUNT(*) AS total_items, SUM(is_checked) AS packed_items
  FROM trip_checklist_items GROUP BY trip_id;
SELECT poll_id, candidate_id, COUNT(*) AS votes
  FROM destination_votes GROUP BY poll_id, candidate_id;
```

## API ที่สำคัญ

API ทั้งหมดใช้ JSON และส่วนใหญ่ต้องส่งเฮดเดอร์ **`Authorization: Bearer <session_token>`** ที่ได้รับจาก Login/Register (ยกเว้น Login/Register และ Health) โดยไม่ควรเผยแพร่ Token จริง

| Method | Endpoint | ความหมาย |
| --- | --- | --- |
| GET | `/api/health` | เช็กการเชื่อม MySQL |
| POST | `/api/auth/register`, `/api/auth/login` | สมัคร / เข้าสู่ระบบ |
| GET, PATCH | `/api/auth/me` | ดู/แก้ข้อมูลบัญชี |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET, POST | `/api/trips` | รายการทริป / สร้างทริป |
| POST | `/api/trips/join` | Join Trip ด้วยรหัส **ของทริป** |
| GET, PATCH, DELETE | `/api/trips/:id` | ดู/แก้/ลบทริป |
| PATCH | `/api/trips/:id/status` | เปลี่ยน Active / Finished |
| POST | `/api/trips/:id/members` | เพิ่มสมาชิกทริป |
| DELETE | `/api/trips/:id/members/:userId` | ลบสมาชิกทริปตามสิทธิ์ |
| GET, POST | `/api/trips/:id/activities` | ดู/เพิ่มกิจกรรม |
| PUT, DELETE | `/api/trips/:id/activities/:activityId` | แก้/ลบกิจกรรม |
| PUT | `/api/trips/:id/activities/reorder/day` | จัดลำดับกิจกรรมภายในวัน |
| GET, POST | `/api/trips/:id/places` | ดู/เพิ่มสถานที่ของทริป |
| PUT, DELETE | `/api/trips/:id/places/:placeId` | แก้/ลบสถานที่ |
| GET, POST | `/api/trips/:id/checklist` | ดู/เพิ่มรายการ Checklist |
| PATCH, DELETE | `/api/trips/:id/checklist/:itemId` | ติ๊ก/แก้/ลบ Checklist |
| GET | `/api/dashboard` | สถิติ Dashboard จากข้อมูลจริง |
| GET | `/api/trips/:id/finance` | Expenses และ Payments ของทริป |
| POST | `/api/trips/:id/expenses` | เพิ่มรายการรายจ่าย |
| PUT, DELETE | `/api/trips/:id/expenses/:expenseId` | แก้ / ลบรายจ่าย |
| POST | `/api/trips/:id/payments` | แจ้งการจ่ายเงิน |
| PATCH | `/api/trips/:id/payments/:paymentId/verify` | ผู้รับเงินยืนยันรายการ |
| GET | `/api/memories` | รายการความทรงจำของทริปที่มีสิทธิ์ |
| POST | `/api/trips/:id/memories` | อัปโหลดรูปเข้าทริป |
| GET | `/api/memories/:memoryId/image` | เปิดไฟล์ภาพ (ตรวจสิทธิ์) |
| DELETE | `/api/memories/:memoryId` | ลบภาพตามสิทธิ์ |
| GET, POST | `/api/destination-polls` | ดูทุกโพล / สร้างโพลสาธารณะ |
| GET, PATCH, DELETE | `/api/destination-polls/:id` | ดู/แก้/ลบโพล (การแก้/ลบเฉพาะ Owner) |
| POST | `/api/destination-polls/:id/options` | เพิ่มจุดหมายในโพล |
| PATCH, DELETE | `/api/destination-polls/:id/options/:optionId` | แก้/ลบจุดหมายตามสิทธิ์ |
| PUT, DELETE | `/api/destination-polls/:id/vote` | โหวต/เปลี่ยนโหวต และถอนโหวต |

ดูรายละเอียดรูปแบบ Request/Response ได้จากไฟล์ `server/app.js`, `server/trip-features.js`, `server/checklist.js`, `server/planner-places.js` และ `server/destination-votes.js`

## โครงสร้างฐานข้อมูล

ตารางหลักใน `database/schema.sql`:

| กลุ่ม | ตาราง |
| --- | --- |
| บัญชี | `users`, `auth_sessions` |
| ทริป/สมาชิก | `trips`, `trip_members`, `trip_modules` (รองรับข้อมูลเก่า) |
| กิจกรรม/สถานที่ | `trip_activities`, `trip_places`, `place_votes` (ข้อมูลการโหวต Places แบบเก่า) |
| ค่าใช้จ่าย | `expenses`, `expense_splits`, `payments` |
| Checklist | `trip_checklist_items`, `trip_checklist_migrations` |
| รูปความทรงจำ | `memories` (ไฟล์จริงอยู่ที่ `uploads/memories/`) |
| โพลเลือกทริปถัดไป | `destination_polls`, `destination_candidates`, `destination_votes` |

ในฐานข้อมูลที่อัปเกรดมาจาก v5 อาจยังมี `destination_poll_members` และ `invite_code` ใน `destination_polls` เนื่องจากเก็บไว้รองรับข้อมูลเก่า แต่ **v6 ไม่ต้องใช้สมาชิกโพลหรือ Invite Code เพื่อโหวต**

## แก้ปัญหาที่พบบ่อย

| อาการ | วิธีตรวจ/แก้ |
| --- | --- |
| `npm ERR! ENOENT ... project_Journey\package.json` | เข้าโฟลเดอร์ `server` ก่อน (`cd server`) แล้วค่อย `npm install` / `npm start` |
| `node` หรือ `npm` ไม่เป็นคำสั่งที่รู้จัก | ติดตั้ง Node.js LTS แล้วเปิด Terminal ใหม่; ตรวจ `node -v` และ `npm -v` |
| `database: disconnected` หรือ `/api/health` ตอบ Error | เปิด MySQL Service, ตรวจรหัส/พอร์ต/DB ใน `server/.env`, ดู Error ใน Terminal |
| `ER_ACCESS_DENIED_ERROR` / `Access denied for user` | ตรวจ `DB_USER` / `DB_PASSWORD` และสิทธิ์ผู้ใช้ MySQL |
| `ECONNREFUSED 127.0.0.1:3306` | ตรวจว่า MySQL Server รันอยู่และใช้พอร์ต 3306 จริง |
| `Unknown database 'joyjourney'` | นำเข้า `database/schema.sql` สำหรับฐานข้อมูลใหม่ หรือกำหนด `DB_NAME` ให้ถูกต้อง |
| `ER_NO_SUCH_TABLE` / Schema outdated | ตรวจว่าติดตั้ง/รัน Migration ครบตามเวอร์ชัน ไม่ใช้ `schema.sql` ทับฐานข้อมูลเก่าแบบไม่สำรอง |
| `Port 3000 already in use` | ปิดเซิร์ฟเวอร์เก่าด้วย `Ctrl+C` หรือแก้ `PORT` ใน `server/.env` |
| หน้า Login/เว็บไม่มีการเปลี่ยนแปลง | ตรวจว่า `npm start` รันอยู่, ใช้ URL `localhost:3000` และกด `Ctrl+F5` รีเฟรชแบบไม่ใช้แคช |
| เปิด Voting แล้วไม่มีโพล | ลอง Create Poll จากบัญชีแรก; ตรวจตาราง `destination_polls`; โพลเก่าต้องผ่าน v5→v6 migration |
| Voting ขึ้นข้อผิดพลาด Join/สิทธิ์ | ตรวจว่ารัน `migrate_v6.sql` แล้ว และรีสตาร์ต Backend ที่ใช้ไฟล์ v6 |
| อัปโหลดรูปแล้วรูปหาย | ตรวจว่า `uploads/memories/` ยังอยู่และมีสิทธิ์เขียน; รูปจริงไม่ได้อยู่ใน SQL backup |
| `git status` แสดงไฟล์ `.env` | ตรวจ `.gitignore`, `git check-ignore -v server/.env` และการเคย `git add` ไฟล์นั้น |

## ความปลอดภัย การสำรองข้อมูล และข้อจำกัด

**สิ่งที่โค้ดรองรับในปัจจุบัน**

- Backend ตรวจสิทธิ์สมาชิกทริปและ Owner สำหรับการดำเนินการหลัก
- รหัสผ่านบัญชีเว็บถูกแฮชด้วย bcrypt; Session Token สุ่มและเก็บเป็นค่าแฮชใน MySQL
- มีตัวจำกัดจำนวนความพยายาม Login/Register แบบอยู่ในหน่วยความจำของกระบวนการ Node.js
- รูป Memories เปิดผ่าน API ที่ตรวจสิทธิ์การเป็นสมาชิกทริป
- Checklist แก้ไขทีละรายการ ลดความเสี่ยงข้อมูลถูกเขียนทับเมื่อหลายคนใช้งาน

**ข้อจำกัดที่ต้องทราบก่อนเผยแพร่เว็บไซต์จริง**

1. **โค้ดปัจจุบันเก็บ Bearer Token ที่ฝั่ง Browser ใน `localStorage`** ยังไม่เปลี่ยนเป็น Secure HttpOnly Cookie; ไม่ควรถือว่าพร้อมใช้งานสาธารณะโดยไม่มีการตรวจด้านความปลอดภัยเพิ่ม
2. ต้องตั้งค่า **HTTPS**, ตรวจ XSS/CSRF ตามรูปแบบ Session ใหม่, เพิ่มการจำกัดคำขอระดับ Production และตรวจสิทธิ์ทุก API อย่างต่อเนื่อง
3. โค้ด Frontend บางไฟล์ยังมีฟังก์ชัน/ข้อมูลตัวอย่างจากต้นแบบเก่า แม้ข้อมูล Trip, Checklist, Expenses และ Next Trip Vote หลักจะถูกเชื่อม API แล้ว จึงควรตรวจ UX และส่วนที่ไม่ได้ใช้ก่อนเปิดเผยแพร่
4. ระบบ **Payments เป็นการบันทึกและยืนยันด้วยผู้รับเงิน** ไม่ใช่บริการรับจ่ายเงินหรือการยืนยันจากธนาคาร
5. คะแนนโหวตจำกัด **หนึ่งบัญชีต่อโพล** ด้วย `PRIMARY KEY (poll_id, user_id)` แต่ไม่ได้รับประกันหนึ่งคนจริงในกรณีผู้ใช้สร้างหลายบัญชี
6. การซิงก์ระหว่างผู้ใช้ในหลายหน้าทำงานเมื่อ **โหลด/รีเฟรชข้อมูล** ไม่ใช่ระบบอัปเดตแบบ Real-time ผ่าน WebSocket
7. รูปภาพ Memories เก็บในดิสก์เครื่อง Server หากเปลี่ยนเครื่องต้องย้ายโฟลเดอร์รูปควบคู่กับฐานข้อมูล
8. **Finished Trip** ยังเปิดดู Memories และข้อมูลเดิมได้ แต่บางรายการถูกตั้งค่าเป็นอ่านอย่างเดียว; **Delete Trip** เป็นการลบถาวรและมีข้อมูลเกี่ยวข้องที่ถูกลบตามความสัมพันธ์ฐานข้อมูล
9. ชุดทดสอบอัตโนมัติใช้ Mock/In-memory สำหรับ API บางส่วน ยังไม่ครอบคลุมระบบทั้งหมดบน MySQL จริงหรือการทดสอบ Browser แบบ End-to-End

### การสำรองข้อมูลก่อนแก้ไข/Push

- สำรองฐานข้อมูลผ่าน MySQL Workbench → **Data Export**
- สำรอง `uploads/memories/` เพิ่มต่างหาก
- ตรวจว่า `server/.env` ไม่อยู่ใน `git status` หรือ Commit และอย่าใส่รหัสผ่านจริงใน `.env.example`
- เมื่อตรวจสอบแล้วค่อยใช้:

```powershell
git status
git add .
git status
git commit -m "docs: complete JoyJourney v6 README"
git push origin main
```

> **คำแนะนำ:** ก่อน Push ให้เปิด `git status` อีกครั้ง และตรวจไม่มีไฟล์รหัสผ่านหรือภาพส่วนตัวที่ไม่ต้องการเผยแพร่ถูก Stage ไว้ การมี `.gitignore` ไม่สามารถลบความลับที่เคยถูก Commit ไปก่อนหน้าได้

---

**JoyJourney** — วางแผนทริป จัดงบ เตรียมของ เก็บความทรงจำ และให้ทุกบัญชีในเว็บไซต์ช่วยกันโหวตจุดหมายทริปถัดไป 🧳🌏
