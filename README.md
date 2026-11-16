

#  JoyJourney


### วางแผนทริปกับเพื่อนให้ง่ายขึ้น ตั้งแต่เลือกจุดหมายจนถึงเก็บความทรงจำ


**JoyJourney** เป็นเว็บแอปพลิเคชันสำหรับวางแผนการเดินทางร่วมกัน ช่วยให้สมาชิกในกลุ่มจัดการทริป ตารางกิจกรรม สถานที่ท่องเที่ยว ค่าใช้จ่าย รายการของที่ต้องเตรียม และอัลบั้มภาพได้ในที่เดียว นอกจากนี้ยังมี **Next Trip Vote** สำหรับโหวตเลือกจุดหมายของทริปถัดไป โดยผู้ใช้ที่สมัครสมาชิกและเข้าสู่ระบบแล้วสามารถร่วมโหวตได้โดยไม่ต้องใช้รหัสเชิญ


**ประเภทโปรเจกต์:** Full-Stack Web Application  
**เทคโนโลยีหลัก:** HTML · CSS · JavaScript · Node.js · Express.js · MySQL  
**Source Code:** [github.com/Yin-Yew/project_Journey](https://github.com/Yin-Yew/project_Journey)


---


## เริ่มใช้งานฉบับ Clean (ไม่มี Demo)

ไฟล์นี้เป็น Source Code ของ JoyJourney v11 ที่ไม่มีผู้ใช้ตัวอย่าง ทริปตัวอย่าง ภาพเดโม หรือปุ่ม Try Demo และจะ **ไม่เพิ่มข้อมูลจำลองลง MySQL** เมื่อเปิดเซิร์ฟเวอร์

**บน Windows:** เปิด MySQL Server แล้วดับเบิลคลิก `server/tools/SETUP-AND-START.bat` ระบบจะติดตั้ง npm packages และสร้างตารางเปล่าที่จำเป็นให้โดยไม่เพิ่มผู้ใช้หรือทริป เมื่อรันสำเร็จ เปิด `http://localhost:3000/register.html` เพื่อสมัครบัญชีจริง จากนั้นสร้างทริปเองและเชิญเพื่อน

**ฐานข้อมูลเริ่มต้น:** `.env.example` ตั้ง `DB_NAME=joyjourney_clean` เพื่อให้ชุด Clean ไม่ไปแสดงข้อมูลเดโมที่เคยอยู่ในฐานข้อมูล `joyjourney` หาก MySQL มีรหัสผ่านให้กรอก `DB_PASSWORD` ใน `server/.env` ก่อนเปิด ถ้าคุณมีข้อมูลจริงในฐานข้อมูลเก่า ให้ใช้ชื่อ DB เดิมและตรวจสอบการอัปเกรด schema ก่อน

> โค้ด Clean ไม่ลบแถวข้อมูลจาก MySQL ที่เคยใช้มาก่อน ถ้าตั้งค่า `DB_NAME` ให้ชี้ไปฐานเก่าที่เคยมีตัวอย่าง ข้อมูลในฐานเก่ายังแสดงตามจริง ใช้ฐานชื่อใหม่เพื่อเริ่มต้นว่างโดยไม่ลบข้อมูลเก่า

**Next Trip Vote:** ผู้ใช้ที่ล็อกอินเพิ่มสถานที่และโหวตได้โดยไม่แสดงชื่อคนโหวต มีวันเวลาเปิด–ปิด และเจ้าของบอร์ดเริ่มรอบใหม่พร้อมเก็บผลรอบเก่าได้

---


## อัปเดต v11: Planner + Checklist (ไม่ต้องสร้างทริปใหม่)

- **Planner:** เอาปุ่มขึ้น/ลงออกแล้ว เวลา `09:00` จะแสดงก่อน `11:00` เสมอ ทั้งหลังเพิ่มและหลังแก้เวลา รายการเวลาเท่ากันเรียงตามรหัสกิจกรรม
- **Checklist:** รายการของแต่ละทริปถูกแบ่งตามสมาชิก แต่ละคนเห็นการ์ดแยกของตนเอง กด `Everyone` หรือ `Mine` ได้
- **Add Item:** เปิดหน้าต่างสั้น ๆ กรอก Item และเลือก For (ชื่อสมาชิก) รายการจะอยู่ในส่วนของคนที่เลือก
- **สิทธิ์:** ผู้รับผิดชอบหรือเจ้าของทริปจึงแก้ไข/ติ๊ก/ลบรายการนั้นได้ สมาชิกทั่วไปยังดูรายการของเพื่อนร่วมทริปได้
- **ข้อมูลเดิม:** ไม่มีการลบ Checklist เก่า ระบบมอบหมายรายการเก่าให้ผู้สร้าง หากยังอยู่ในทริป รายการที่ระบุผู้รับผิดชอบไม่ได้จะอยู่ใน Unassigned

### อัปเกรด MySQL ที่ใช้อยู่แล้ว

1. **สำรองฐานข้อมูล** ก่อนเสมอ หากมีทริปจริงอยู่แล้ว ใช้ `server/tools/BACKUP-DATABASE.bat`
2. เก็บไฟล์ `server/.env` ของคุณไว้ ไม่คัดลอกทับ และตรวจ `DB_NAME` ให้ชี้ฐานที่ใช้อยู่
3. หลังวางไฟล์ v11 ทับโปรเจกต์ ให้หยุดเซิร์ฟเวอร์เก่าด้วย `Ctrl+C` แล้วเปิด `server/tools/SETUP-AND-START.bat`
4. โปรแกรมจะตรวจและเพิ่มคอลัมน์ `assigned_to` เฉพาะเมื่อยังไม่มี จากนั้นเชื่อมรายการเดิมกับบัญชีผู้สร้าง **โดยไม่ลบข้อมูลเดิม**
5. เปิด `http://localhost:3000/checklist.html` แล้วลองเพิ่ม Item ให้สมาชิกแต่ละคน

สำหรับผู้ที่นำ SQL เข้าเอง: `database/migrate_v10.sql` เป็นสคริปต์ **รันครั้งเดียว** หลังเลือกฐานข้อมูลที่ถูกต้อง; ไม่ต้องรันซ้ำเมื่อเปิดด้วยไฟล์ .bat

##  สารบัญ


- [เกี่ยวกับเว็บไซต์](#-เกี่ยวกับเว็บไซต์)
- [ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [โครงสร้างและการทำงานของระบบ](#-โครงสร้างและการทำงานของระบบ)
- [โครงสร้างโฟลเดอร์](#-โครงสร้างโฟลเดอร์)
- [วิธีติดตั้งและรันโปรเจกต์](#-วิธีติดตั้งและรันโปรเจกต์)
- [วิธีใช้งานเว็บไซต์](#-วิธีใช้งานเว็บไซต์)
- [การจัดเก็บข้อมูล](#-การจัดเก็บข้อมูล)
- [API หลักของระบบ](#-api-หลักของระบบ)
- [การทดสอบ](#-การทดสอบ)
- [การอัปเกรดฐานข้อมูลเดิม](#-การอัปเกรดฐานข้อมูลเดิม)
- [ปัญหาที่พบบ่อย](#-ปัญหาที่พบบ่อย)
- [ข้อควรระวังและความปลอดภัย](#-ข้อควรระวังและความปลอดภัย)


---


##  เกี่ยวกับเว็บไซต์


การเดินทางเป็นกลุ่มมักต้องใช้หลายช่องทางในการประสานงาน เช่น แชตสำหรับนัดหมาย โน้ตสำหรับตารางเที่ยว และตารางคำนวณเงินสำหรับหารค่าใช้จ่าย ทำให้ข้อมูลกระจัดกระจายและติดตามความคืบหน้าได้ยาก


JoyJourney จึงพัฒนาขึ้นเพื่อรวมการจัดการทริปไว้ในเว็บไซต์เดียว โดยมีจุดประสงค์เพื่อ:


1. ช่วยให้สร้างและวางแผนทริปได้สะดวก พร้อมจัดการสมาชิกที่เดินทางร่วมกัน
2. แสดงข้อมูลทริป งบประมาณ ค่าใช้จ่าย และความพร้อมก่อนเดินทางจากข้อมูลที่บันทึกจริง
3. ช่วยจัดกิจกรรมรายวัน เก็บสถานที่ที่สนใจ และติดตามรายการสิ่งของที่ต้องเตรียม
4. ให้สมาชิกช่วยกันตัดสินใจเลือกจุดหมายทริปถัดไปผ่านระบบโหวต
5. เก็บภาพและเรื่องราวของทริปไว้ย้อนดูได้หลังการเดินทางสิ้นสุด


---


## ฟีเจอร์หลัก


| ระบบ | รายละเอียด |
| --- | --- |
| **Authentication** | สมัครสมาชิก เข้าสู่ระบบ ออกจากระบบ และแก้ไขโปรไฟล์ |
| **Dashboard** | แสดงทริปที่กำลังจะถึง Countdown จำนวนสมาชิก Budget ค่าใช้จ่ายรวม Packing % และสถานะการชำระเงิน |
| **My Trips** | สร้าง แก้ไข ลบทริป ค้นหาทริป ระบุวันเดินทาง สถานที่ งบประมาณ และจัดการสถานะ `Active` / `Finished` |
| **Trip Members** | เชิญสมาชิกด้วย Trip Invite Code หรือเพิ่มสมาชิกที่มีบัญชีแล้ว และจัดสิทธิ์ **Owner / Member** |
| **Trip Detail** | ดูภาพรวม รายชื่อสมาชิก และสถิติของทริป รวมทั้งจำนวนกิจกรรมจาก Planner |
| **Planner** | เพิ่ม แก้ไข ลบ และจัดลำดับกิจกรรมตามวัน พร้อมปุ่มเปลี่ยนสถานะ Active / Finished สำหรับเจ้าของทริป |
| **Places** | บันทึกสถานที่เที่ยว ร้านอาหาร และคาเฟ่ พร้อมรูป ชื่อ ประเภท และรายละเอียด แยกตามทริป |
| **Expenses & Payments** | บันทึกค่าใช้จ่าย หารเท่ากันโดยค่าเริ่มต้น รองรับเปอร์เซ็นต์/กำหนดเองในเมนูขั้นสูง แสดงยอดที่ต้องจ่าย/รับและแจ้ง/ยืนยันการชำระเงิน |
| **Checklist** | เพิ่มและแก้รายการผ่านแบบฟอร์ม เลือกสมาชิกที่รับผิดชอบ แยก Packing List ตามคน พร้อมคำนวณความคืบหน้า |
| **Memories** | ดู All Photos หรืออัลบั้มรายทริป เพิ่มรูปพร้อม Caption เปิดดูรูปใหญ่ และลบรูปที่มีสิทธิ์จัดการ |
| **Next Trip Vote** | หน้ากระดานโหวตกลางเพียงหน้าเดียว กรอกแค่ชื่อสถานที่แล้วเพิ่ม ให้เพื่อนที่ล็อกอินโหวต เปลี่ยน/ถอนโหวต และดูคะแนนรวมโดยไม่เปิดเผยชื่อผู้โหวตได้ |


###  ความแตกต่างระหว่าง Trip และ Next Trip Vote


- **Trip:** เป็นพื้นที่ทำงานของสมาชิกในทริปเดียวกัน ผู้ที่จะเข้าร่วมด้วยตัวเองต้องใช้ **Trip Invite Code** โดย Owner สามารถจัดการสมาชิกและข้อมูลหลักของทริปได้
- **Next Trip Vote:** มี **กระดานโหวตเดียวสำหรับทุกคนที่ล็อกอิน** ไม่ผูกกับทริป ไม่ต้องสร้าง Poll ไม่ต้องกรอกชื่อ/รูป/รายละเอียด ไม่ต้องใช้รหัสเชิญ
- กรอกชื่อสถานที่แล้วกด **เพิ่มสถานที่** เพื่อนจะเห็นตัวเลือกเดียวกัน เลือกโหวตได้ **1 จุดหมายต่อบัญชี** และเปลี่ยนหรือยกเลิกได้ทุกเมื่อ
- แสดงเฉพาะคะแนนรวมของแต่ละสถานที่ ไม่เปิดเผยชื่อผู้โหวต อัปเดตเองทุก 15 วินาทีเมื่อเปิดหน้านี้อยู่
- สามารถตั้งเวลาเริ่ม–สิ้นสุด เปิดรอบโหวตใหม่ และดูประวัติผลโหวตรอบเก่าได้ โดยไม่เปิดเผยชื่อผู้ลงคะแนน
- ระบบโหวต **ไม่ได้สร้าง Trip อัตโนมัติ** ให้เจ้าของทริปสร้างทริปเมื่อกลุ่มตกลงกันแล้ว


---


##  เทคโนโลยีที่ใช้


| ส่วน | เทคโนโลยี | หน้าที่ |
| --- | --- | --- |
| Frontend | HTML5, CSS3, JavaScript (Vanilla JS) | โครงสร้างหน้าเว็บ การออกแบบ และการโต้ตอบกับผู้ใช้ |
| Backend | Node.js, Express.js 4 | ให้บริการ REST API และจัดการตรรกะการทำงาน |
| Database | MySQL 8, `mysql2` | จัดเก็บและอ่านข้อมูลแบบสัมพันธ์กัน |
| Authentication | `bcryptjs`, Session Token | แฮชรหัสผ่านและตรวจสอบการเข้าสู่ระบบ |
| Configuration | `dotenv` | อ่านค่าการเชื่อมต่อฐานข้อมูลจากไฟล์ `.env` |
| Testing | Node.js Test Runner | ทดสอบฟังก์ชันและ API บางส่วนแบบอัตโนมัติ |
| UI Resources | Google Fonts, Phosphor Icons | ตัวอักษรและไอคอนประกอบเว็บไซต์ |
| Version Control | Git, GitHub | จัดการเวอร์ชันและเผยแพร่ซอร์สโค้ด |


---


##  โครงสร้างและการทำงานของระบบ


```text
ผู้ใช้งาน (Browser)
       │
       ▼
Frontend (HTML / CSS / JavaScript)
       │  HTTP Request / REST API
       ▼
Backend (Node.js / Express)
       │
       ├── ตรวจสอบ Session และสิทธิ์ Owner / Member
       ├── ประมวลผล Trip, Planner, Expenses, Checklist, Voting ฯลฯ
       │
       ▼
Database (MySQL)
       └── ข้อมูลบัญชีผู้ใช้ ทริป สมาชิก กิจกรรม รายจ่าย และคะแนนโหวต


ไฟล์ภาพ Memories → เก็บใน uploads/memories/
ข้อมูลภาพและความสัมพันธ์กับ Trip → เก็บใน MySQL
```


ข้อมูลแต่ละทริปผูกด้วย `trip_id` เพื่อให้ผู้ใช้เห็นเฉพาะทริปที่ตัวเองเป็นสมาชิก ส่วนข้อมูล **Next Trip Vote** อยู่ในตารางแยกต่างหาก ไม่ต้องเป็นสมาชิกทริปใดก่อนโหวต


---


##  โครงสร้างโฟลเดอร์


```text
project_Journey/
├── README.md
├── .env.example               # ตัวอย่างการตั้งค่า (ไม่ใส่รหัสจริง)
├── .gitignore
├── database/
│   ├── schema.sql             # สร้างฐานข้อมูลใหม่
│   ├── migrate_existing.sql   # รองรับฐานข้อมูลรุ่นเก่าบางชุด
│   └── migrate_v2.sql ... migrate_v10.sql
├── public/                    # Frontend
│   ├── index.html             # Dashboard
│   ├── login.html             # เข้าสู่ระบบ
│   ├── register.html          # สมัครสมาชิก
│   ├── trips.html             # รายการทริป
│   ├── trip-detail.html       # รายละเอียดทริป
│   ├── planner.html           # ตารางกิจกรรม
│   ├── places.html            # สถานที่ของแต่ละทริป
│   ├── voting.html            # โหวตจุดหมายทริปถัดไป
│   ├── expenses.html          # ค่าใช้จ่ายและการชำระเงิน
│   ├── checklist.html         # รายการของที่ต้องเตรียม
│   ├── memories.html          # รูปภาพและอัลบั้ม
│   ├── profile.html
│   ├── settings.html
│   ├── css/style.css
│   └── js/                    # สคริปต์เชื่อม API และการแสดงผล
├── server/                    # Backend
│   ├── app.js                 # เริ่มเซิร์ฟเวอร์, Auth และ Trip API
│   ├── database.js            # MySQL Connection Pool
│   ├── trip-features.js       # Dashboard, Expenses, Payments, Memories
│   ├── planner-places.js      # Planner และ Places API
│   ├── checklist.js           # Checklist API
│   ├── destination-votes.js   # Next Trip Vote API
│   ├── migrate-checklist.js   # ย้าย Checklist แบบเก่า (เมื่อจำเป็น)
│   ├── package.json
│   ├── tools/                 # ตัวเปิดโปรเจกต์และสำรอง/กู้คืนฐานข้อมูล
│   └── .env                   # สร้างเองบนเครื่อง ไม่อัปโหลดขึ้น Git
├── tests/                     # Automated Tests
└── uploads/                   # เก็บไฟล์ภาพที่อัปโหลด
    └── .gitkeep
```

บน Windows สามารถรัน `server/tools/SETUP-AND-START.bat` จาก File Explorer ได้โดยตรง ไฟล์นี้จะปรับ working directory กลับไปยังโฟลเดอร์หลักก่อนเริ่มทำงาน


---


##  วิธีติดตั้งและรันโปรเจกต์


### 1. โปรแกรมที่ต้องมี


- [Node.js](https://nodejs.org/) **เวอร์ชัน 20 ขึ้นไป** พร้อม npm
- [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) **เวอร์ชัน 8.x**
- [MySQL Workbench](https://dev.mysql.com/downloads/workbench/) สำหรับนำเข้าไฟล์ SQL และจัดการฐานข้อมูล
- Git และ Visual Studio Code (แนะนำ)


### 2. ดาวน์โหลดโปรเจกต์


เปิด Terminal หรือ PowerShell แล้วรัน:


```bash
git clone https://github.com/Yin-Yew/project_Journey.git
cd project_Journey
```


### 3. ตั้งค่า MySQL แบบ Clean

บน Windows ใช้ `server/tools/SETUP-AND-START.bat` แทนการรัน SQL ทีละไฟล์ได้เลย ตัวเปิดจะคัดลอก `.env.example` ไป `server/.env` หากยังไม่มี และรัน `server/setup-db.js` เพื่อสร้างตารางเปล่าจาก `database/schema.sql` **โดยไม่เพิ่มข้อมูลเดโม**

เปิด MySQL Server ไว้ก่อน หาก MySQL มีรหัสผ่าน ให้สร้างหรือเปิด `server/.env` แล้วตั้งค่า:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=joyjourney_clean
```

`joyjourney_clean` เป็นชื่อฐานข้อมูลใหม่เพื่อไม่แตะข้อมูลในฐานเดิม `joyjourney` หากต้องการใช้ฐานเดิมที่มีข้อมูลจริง ให้ตั้งชื่อเดิมและอัปเกรด schema ตามหัวข้อด้านล่าง ไม่ต้องสร้างทริปหรือบัญชีตัวอย่าง

**อย่าคัดลอก `server/.env` ขึ้น GitHub**

### 5. ติดตั้ง Dependencies และเริ่มต้นเซิร์ฟเวอร์


```bash
cd server
npm install
npm start
```


เมื่อเริ่มทำงาน จะเห็นข้อความลักษณะนี้:


```text
JoyJourney running at http://localhost:3000
```


เปิดเว็บไซต์ที่ **http://localhost:3000** หรือเริ่มที่ **http://localhost:3000/register.html** เพื่อสมัครสมาชิก


ตรวจสอบการเชื่อมต่อฐานข้อมูลได้ที่ **http://localhost:3000/api/health** โดยผลลัพธ์เมื่อเชื่อมต่อสำเร็จจะเป็น:


```json
{
  "app": "JoyJourney",
  "status": "ok",
  "database": "connected"
}
```


> **ข้อควรจำ:** ต้องสั่ง `npm install` และ `npm start` **ภายในโฟลเดอร์ `server`** เพราะ `package.json` อยู่ที่ `server/package.json` ไม่ได้อยู่ในโฟลเดอร์หลัก และต้องเปิด Terminal ที่รันเซิร์ฟเวอร์ไว้ระหว่างใช้งาน


---


##  วิธีใช้งานเว็บไซต์


1. **Register / Login:** สมัครบัญชี แล้วเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
2. **My Trips:** กด Create Trip ระบุชื่อ จุดหมาย วันที่ และงบประมาณ จากนั้นเปิดหน้า Trip Detail
3. **Invite Members:** แชร์ Trip Invite Code ให้เพื่อนที่มีบัญชีใช้ Join Trip หรือให้ Owner เพิ่มสมาชิก
4. **Planner / Places:** เพิ่มตารางกิจกรรมตามวันเดินทางและสถานที่ที่สนใจภายในแต่ละทริป
5. **Expenses:** เพิ่มรายจ่าย เลือกผู้จ่ายและสมาชิกที่ต้องหาร โดยระบบหารเท่ากันอัตโนมัติ หรือเปิด Advanced split options เพื่อหารเปอร์เซ็นต์/กำหนดเอง แล้วติดตามการชำระเงิน (ไม่ใช่ระบบโอนเงินจริง)
6. **Checklist:** เพิ่มรายการของที่ต้องเตรียม แล้วติ๊กเมื่อจัดเตรียมเรียบร้อย ค่า Packing % จะคำนวณจากรายการจริง
7. **Next Trip Vote:** กรอกชื่อสถานที่ กดเพิ่ม แล้วให้เพื่อนที่ล็อกอินกดโหวตได้เลย ไม่ต้องสร้างโพล
8. **Memories:** อัปโหลดรูปและ Caption เก็บเป็นอัลบั้มตามทริป แม้ทริปเปลี่ยนเป็น Finished ก็ยังดูรูปเดิมได้
9. **Dashboard:** กลับมาดูภาพรวมทริป กำหนดการ งบประมาณ และความคืบหน้าการเตรียมตัว


### สิทธิ์ผู้ใช้งาน


| การดำเนินการ | Owner | Member |
| --- | :---: | :---: |
| ดูข้อมูลทริปที่เป็นสมาชิก | ✅ | ✅ |
| แก้ไขข้อมูลหลัก / ลบทริป | ✅ | ❌ |
| จัดการสมาชิกคนอื่น | ✅ | ❌ |
| เพิ่มกิจกรรม จัดการ Checklist และบันทึกค่าใช้จ่ายในทริป Active | ✅ | ✅ |
| เปิดดูทริป Finished | ✅ | ✅ |
| สร้าง / เสนอจุดหมาย / โหวตใน Public Voting | ✅ | ✅ |


> สิทธิ์ Owner/Member ใช้กับ **แต่ละทริป** ส่วนกระดาน Next Trip Vote ใช้บัญชีผู้ใช้ JoyJourney ที่เข้าสู่ระบบ และแต่ละบัญชีมี 1 คะแนน


---


## การจัดเก็บข้อมูล


ข้อมูลหลักอยู่ใน MySQL โดยแบ่งเป็นกลุ่มตารางดังนี้:


| ตาราง | ใช้เก็บ |
| --- | --- |
| `users`, `auth_sessions` | บัญชีผู้ใช้และเซสชันเข้าสู่ระบบ |
| `trips`, `trip_members` | ทริป รายละเอียดทริป สมาชิก และสิทธิ์ |
| `trip_activities` | กิจกรรม Planner รายวัน |
| `trip_places` | สถานที่ที่บันทึกไว้ภายในทริป |
| `expenses`, `expense_splits`, `payments` | รายจ่าย การแบ่งยอด และสถานะการชำระเงิน |
| `trip_checklist_items` | รายการของที่ต้องเตรียมและสถานะที่ติ๊กแล้ว |
| `memories` | ข้อมูลรูปภาพ Caption และทริปที่เกี่ยวข้อง |
| `destination_polls`, `destination_candidates`, `destination_votes`, `next_trip_board` | ข้อมูลโพลและสถานที่ร่วม คะแนนโหวตแบบไม่แสดงชื่อ และช่วงเวลาเปิด–ปิด |


ไฟล์ภาพใน Memories เก็บไว้ใน `uploads/memories/` โดยฐานข้อมูลเก็บข้อมูลอ้างอิงและตรวจสิทธิ์ก่อนแสดงรูป ส่วน **Trip Finished** จะคงข้อมูลทริปและ Memories ไว้ แต่ **Delete Trip** เป็นการลบข้อมูลที่เกี่ยวข้องกับทริปนั้น


---


## API หลักของระบบ


Backend ให้บริการ REST API ภายใต้ `/api` ตัวอย่าง Endpoint สำคัญ:


| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/api/health` | ตรวจการทำงานของ Backend และ MySQL |
| `POST` | `/api/auth/register` | สมัครสมาชิก |
| `POST` | `/api/auth/login` | เข้าสู่ระบบ |
| `GET` | `/api/auth/me` | ดึงข้อมูลบัญชีที่ล็อกอิน |
| `GET / POST` | `/api/trips` | ดึงรายการทริป / สร้างทริป |
| `POST` | `/api/trips/join` | เข้าร่วมทริปด้วย Invite Code |
| `GET / PATCH / DELETE` | `/api/trips/:id` | ดู / แก้ไข / ลบทริป |
| `GET` | `/api/dashboard` | ข้อมูลสรุป Dashboard |
| `GET / POST` | `/api/trips/:id/activities` | ดู / เพิ่มกิจกรรม |
| `GET / POST` | `/api/trips/:id/places` | ดู / เพิ่มสถานที่ |
| `GET / POST` | `/api/trips/:id/checklist` | ดู / เพิ่ม Checklist |
| `POST` | `/api/trips/:id/expenses` | เพิ่มรายจ่าย |
| `GET` | `/api/trips/:id/finance` | ดูข้อมูลรายจ่ายและสถานะชำระเงิน |
| `GET` | `/api/memories` | ดูรายการรูปความทรงจำ |
| `GET` | `/api/next-trip` | ดูสถานที่ คะแนนรวม สถานะ/เวลาปิดรับ และคะแนนที่บัญชีตนเองเลือกเท่านั้น |
| `POST` | `/api/next-trip/destinations` | เพิ่มสถานที่จากชื่ออย่างเดียว (ก่อนโหวตปิด) |
| `PUT` | `/api/next-trip/schedule` | เจ้าของกำหนดวันเวลาเริ่ม–สิ้นสุด (บันทึก UTC ในฐานข้อมูล) |
| `PUT / DELETE` | `/api/next-trip/vote` | โหวต/เปลี่ยนโหวต และถอนโหวต (เฉพาะช่วงเปิดโหวต) |
| `GET / POST` | `/api/destination-polls` | API โพลรุ่นเดิม ยังคงไว้เพื่อความเข้ากันได้ |


**หมายเหตุ:** Endpoint ที่ต้องเข้าสู่ระบบใช้ Session Token ผ่าน `Authorization: Bearer <token>` และมีการตรวจสิทธิ์การเข้าถึงฝั่งเซิร์ฟเวอร์


---


## การทดสอบ


### Automated Tests


ภายในโฟลเดอร์ `server` รันคำสั่ง:


```bash
npm test
```


ชุดทดสอบครอบคลุม Checklist, กฎการโหวต 1 คะแนนต่อบัญชีต่อโพล, การไม่ต้อง Join โพล, การเปลี่ยนคะแนน และการจัดการสิทธิ์โพล โดยการรันทดสอบกับโค้ดที่จัดทำ README ฉบับนี้ **ผ่าน 26 จาก 26 ชุด**


### การทดสอบการใช้งานจริง


มีการทดลองขั้นตอนสมัครสมาชิก เข้าสู่ระบบ สร้างและแก้ไขทริป บันทึกข้อมูลใน MySQL เข้าร่วมทริปผ่าน Invite Code และใช้งานสองบัญชีเพื่อตรวจสอบ Owner / Member รวมถึงการจัดการสมาชิกและลบทริป ตามการทดสอบบนเครื่องผู้พัฒนา


สำหรับการตรวจสอบหลังติดตั้ง สามารถเริ่มจาก `GET /api/health` แล้วทดลองใช้เว็บไซต์ผ่าน Browser ได้ทันที


---


## การอัปเกรดฐานข้อมูลเดิม


**ผู้ติดตั้งใหม่ไม่ต้องใช้หัวข้อนี้** ให้รัน `database/schema.sql` เพียงไฟล์เดียว


ถ้าเคยใช้ JoyJourney รุ่นก่อนและต้องการเก็บข้อมูลเดิม ให้สำรองฐานข้อมูลก่อน จากนั้นเลือก Migration ให้ตรงกับรุ่นปัจจุบัน:


| รุ่นฐานข้อมูลเดิม | ขั้นตอน |
| --- | --- |
| v5 | รัน `database/migrate_v6.sql` |
| v4 | รัน `database/migrate_v5.sql` แล้วตามด้วย `database/migrate_v6.sql` |
| v3 | รัน `database/migrate_v4.sql` → `npm run migrate:checklist` (จาก `server`) → `migrate_v5.sql` → `migrate_v6.sql` |
| รุ่นก่อน v3 | ตรวจตารางและ Migration ที่ยังไม่ได้ใช้ก่อนอัปเกรด ไม่ควรรันแบบข้ามรุ่นโดยไม่สำรองข้อมูล |


MySQL Workbench สามารถสำรองฐานข้อมูลได้ที่ **Server → Data Export** โดยเลือก `joyjourney` และบันทึกเป็นไฟล์ `.sql` อย่าลืมสำรอง `uploads/memories/` แยกต่างหากด้วย


---


##  ปัญหาที่พบบ่อย


| ปัญหา | วิธีแก้ไข |
| --- | --- |
| `npm ERR! ENOENT ... package.json` | ใช้ `cd server` ก่อน `npm install` และ `npm start` |
| `node` / `npm` ใช้งานไม่ได้ | ติดตั้ง Node.js และเปิด Terminal ใหม่ |
| เข้า `localhost:3000` ไม่ได้ | ตรวจว่าเปิด `npm start` ค้างอยู่และพอร์ต 3000 ไม่ถูกใช้งานโดยโปรแกรมอื่น |
| เชื่อมฐานข้อมูลไม่ได้ | ตรวจ MySQL Server, รหัสผ่านใน `server/.env` และฐานข้อมูล `joyjourney` |
| ตาราง MySQL ไม่ครบ | สำหรับติดตั้งใหม่ให้รัน `database/schema.sql` ให้ครบทั้งไฟล์ |
| หน้าเว็บยังแสดงข้อมูลเก่า | รีเฟรชด้วย `Ctrl + F5` และตรวจว่ากำลังเปิดผ่าน `localhost:3000` |
| โหวตไม่ได้ | ตรวจว่าเข้าสู่ระบบด้วยบัญชี JoyJourney แล้ว MySQL ทำงานอยู่ และฐานข้อมูลมีตาราง `next_trip_board` |


---


##  ข้อควรระวังและความปลอดภัย


- เก็บ `server/.env` และรหัสผ่าน MySQL ไว้บนเครื่องเท่านั้น **ห้าม Push ขึ้น GitHub**
- รหัสผ่านสมาชิกถูกจัดเก็บในรูปแบบแฮชด้วย `bcryptjs` ไม่เก็บเป็นข้อความธรรมดา
- API ตรวจสอบ Session Token และสิทธิ์ก่อนอ่านหรือเปลี่ยนแปลงข้อมูลส่วนที่ต้องป้องกัน
- การยืนยันการชำระเงินในระบบเป็นการ **แจ้งชำระและให้ผู้รับเงินยืนยันด้วยตนเอง** ไม่ได้เชื่อมต่อธนาคารเพื่อโอนเงินอัตโนมัติ
- การใช้บริการบนอินเทอร์เน็ตสาธารณะควรเพิ่ม HTTPS, Secure HttpOnly Cookies, การป้องกัน CSRF และมาตรการรักษาความปลอดภัยสำหรับ Production
- รูปภาพอัปโหลดและฐานข้อมูลควรสำรองก่อนอัปเกรดหรือย้ายเครื่อง


---


##  JoyJourney — Make Every Journey Memorable


วางแผนง่าย ไปด้วยกัน สนุกด้วยกัน และเก็บทุกความทรงจำไว้ในทริปเดียว


**GitHub Repository:** [Yin-Yew/project_Journey](https://github.com/Yin-Yew/project_Journey)




### การปรับหน้าจอ Planner / Profile / Expenses (พฤศจิกายน 2026)

- **Planner:** เจ้าของทริปสามารถกด `Mark as Finished` และ `Set Active` ในหน้า Planner โดยตรงได้ ส่วนสมาชิกทั่วไปเห็นสถานะ แต่ไม่สามารถเปลี่ยนสถานะทริป
- **Profile:** กรอกชื่อที่แสดงเพียงช่องเดียว ไม่มีช่องนามสกุล/ชื่อผู้ใช้ให้แก้ไข และไม่มีช่องบัญชีธนาคาร ชื่อผู้ใช้เดิมยังถูกเก็บไว้เพื่อความเข้ากันได้กับข้อมูลเก่า ข้อมูลธนาคารเก่าจะไม่แสดงผ่าน UI/API แต่ไม่ได้ลบคอลัมน์ฐานข้อมูลเพื่อป้องกันผลกระทบกับฐานข้อมูลเดิม
- **Expenses:** กรอกชื่อรายการ จำนวนเงิน ผู้จ่าย และคนที่ต้องหาร; ระบบเลือกหารเท่ากันเป็นค่าเริ่มต้น คำนวณยอดและแสดงสถานะชำระเงิน ชำระเงินภายนอก JoyJourney ผ่านข้อมูล PromptPay ของผู้รับ (ถ้าระบุไว้) จากนั้นกดแจ้งชำระและรอผู้รับยืนยัน สลิปเป็นทางเลือก ไม่มีคิวอาร์โค้ดสาธิตหรือระบบโอนเงิน


## v9 — Additional features

- Finance: confirmed partial payments reduce balances; pending transfers are tracked separately.
- Next Trip Vote: scheduled anonymous voting and archived voting rounds.
- My Trips: filter by Active / Finished; invitations via codes and shareable links.
- Memories: upload and edit captions.
- Database backups: `server/tools/BACKUP-DATABASE.bat` and `server/tools/RESTORE-DATABASE.bat`. A restore overwrites the selected database and requires confirmation.
- Clean setup: `server/tools/SETUP-AND-START.bat` (Windows) creates an empty schema, not mock trips.

## v12 — Personal packing notes (private Checklist)

Checklist is now a small personal notes list per trip and per signed-in account:
- Choose a trip, type an item, and press **Add** (or Enter).
- Tick prepared items, edit them inline, or delete them. No group tabs, assignee selection, or modal.
- **Other members and even the trip owner cannot read, edit, or delete another person's notes.** Permissions are enforced by the MySQL-backed API, not simply CSS or browser filtering.
- Dashboard packing counts and `/api/trips/:id/modules` are also scoped to the logged-in account.
- Finished trips keep their lists visible but read-only.

**Updating an existing v11 database:** Back up your data, replace the source, keep `server/.env`, and run `server/tools/SETUP-AND-START.bat`. The automatic setup updates existing checklist ownership to the account that *created* each row (formerly, v11 allowed assignment to a different member); the labels and checked status are preserved. Or manually run `database/migrate_v11.sql` against the selected JoyJourney database. No sample data is added. Always verify migrations against a backup before using live trip data.

### วิธีใช้งาน Checklist (ฉบับปรับปรุงล่าสุด)

1. เข้าสู่ระบบด้วยบัญชีของตนเอง แล้วเลือกเมนู **Checklist**
2. เลือกทริป พิมพ์รายการของที่ต้องเตรียมในช่องโน้ต แล้วกด **Add** หรือ Enter
3. ติ๊กช่องหน้ารายการเมื่อเตรียมเสร็จ หากต้องแก้ข้อความให้กดไอคอนดินสอ หรือกดถังขยะเพื่อลบ
4. บัญชีอื่นในทริปเดียวกันจะไม่เห็นชื่อรายการหรือจำนวนรายการของคุณ เจ้าของทริปก็ไม่เห็นเช่นกัน
5. เมื่อทริปมีสถานะ **Finished** ระบบจะให้ดูรายการเดิมได้แต่ไม่อนุญาตให้แก้ไข

**หมายเหตุการอัปเกรด:** หากเคยใช้ v11 ซึ่งอนุญาตให้สร้างรายการให้เพื่อน การอัปเกรดเป็น v12 จะจัดรายการเก่ากลับเป็นของบัญชีที่สร้างรายการนั้น (ไม่ใช่ผู้รับมอบหมายเดิม) เพื่อรักษากติกา “แต่ละคนสร้างและเห็นโน้ตของตนเอง” ทั้งนี้ไม่มีการลบรายการหรือรีเซ็ตสถานะที่ติ๊กไว้ ควรสำรองฐานข้อมูลก่อนอัปเกรด
