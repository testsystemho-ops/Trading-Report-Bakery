# Trading Report · BAKERY GRP.68,78

ระบบบันทึกการตรวจนับสต็อกเบเกอรี่ — CP Axtra / Makro Thailand
แยกไฟล์จากต้นฉบับ (ไฟล์เดียว 1,962 บรรทัด) ให้เป็น 5 ไฟล์ เพื่อให้ดูแล แก้ไข และอัปโหลดขึ้น GitHub ได้ง่ายขึ้น

## โครงสร้างไฟล์

```
├── index.html     โครงหน้าเว็บ (HTML markup) — หน้า Login + หน้า App
├── style.css      ดีไซน์ทั้งหมด (Design System, สี, Layout, Responsive)
├── data.json      ข้อมูลคงที่: โลโก้ (base64), รายการสินค้า 330 รายการ, รายชื่อสาขา 152 สาขา, บัญชี Admin
├── firebase.js    ตั้งค่า Firebase + ฟังก์ชันอ่าน/เขียนฐานข้อมูล (dbGet, dbUpdate, dbRemove)
└── app.js         Logic ทั้งหมดของแอป (Login, Dashboard, บันทึกการนับ, ประวัติ, Export Excel, Admin)
```

### ทำไมต้องแยกแบบนี้

| ไฟล์ | หน้าที่ | แก้ไขเมื่อไหร่ |
|---|---|---|
| `style.css` | หน้าตา สี ธีม | อยากเปลี่ยนดีไซน์ |
| `data.json` | รายการสินค้า / สาขา / โลโก้ | เพิ่ม-ลบสินค้า, เพิ่มสาขาใหม่ |
| `firebase.js` | การเชื่อมต่อฐานข้อมูล | ย้าย Firebase Project |
| `app.js` | ฟังก์ชันการทำงานทั้งหมด | แก้ฟีเจอร์ / เพิ่มหน้าใหม่ |
| `index.html` | โครงหน้าเว็บ | แก้ข้อความ/โครงสร้างหน้า |

ลำดับการโหลดสคริปต์ใน `index.html` สำคัญ:
`firebase.js` → `app.js` (app.js เรียกใช้ `dbGet/dbUpdate/dbRemove` ที่ประกาศไว้ใน firebase.js)
เมื่อหน้าเว็บโหลดเสร็จ `app.js` จะ `fetch('data.json')` เพื่อดึงโลโก้ รายการสินค้า และรายชื่อสาขา ก่อนเปิดให้ใช้งานหน้า Login

## วิธีติดตั้งขึ้น GitHub Pages

### ขั้นตอนที่ 1 — ตั้งค่า Firebase Realtime Database Rules
Firebase Config ใส่มาให้พร้อมใช้งานแล้วใน `firebase.js` (ใช้ Project เดิม: `trading-report-bakery`)
ไปที่ [console.firebase.google.com](https://console.firebase.google.com) → Project **trading-report-bakery** → Realtime Database → Rules
```json
{"rules": {".read": true, ".write": true}}
```
กด **Publish**

### ขั้นตอนที่ 2 — อัปโหลดขึ้น GitHub
1. ไปที่ [github.com](https://github.com) → **New Repository** → ตั้งชื่อ เช่น `trading-report-bakery` → เลือก **Public**
2. อัปโหลดไฟล์ทั้ง 5 ไฟล์ (`index.html`, `style.css`, `app.js`, `firebase.js`, `data.json`) ไว้ที่ root ของ repo (ลาก-วางได้เลยผ่านหน้าเว็บ GitHub "Add file → Upload files")
3. ไปที่ **Settings → Pages** → Source: Branch `main` / Folder `/ (root)` → **Save**
4. รอ 1-2 นาที จะได้ URL: `https://[username].github.io/trading-report-bakery/`

### ขั้นตอนที่ 3 — เพิ่ม Authorized Domain ใน Firebase
Firebase Console → **Authentication → Settings → Authorized domains** → เพิ่ม `[username].github.io`

✅ เสร็จแล้ว — เปิดลิงก์ GitHub Pages ใช้งานได้ทันที ไม่ต้องแก้โค้ดใดๆ เพิ่มเติม

## บัญชีทดสอบ

| บัญชี | Username | Password |
|---|---|---|
| สาขา (ตัวอย่าง) | `store001` | `welcome1` |
| Admin | `admin` | `BakeryAdmin#2026` |

## แก้ไขข้อมูลในอนาคต

- **เพิ่ม/ลบรายการสินค้า** → แก้ array `ITEMS_DATA` ใน `data.json`
- **เพิ่ม/ลบสาขา** → แก้ array `STORES` ใน `data.json` (ฟิลด์: `n`=เลขสาขา, `name`=ชื่อสาขา, `u`=username, `p`=password)
- **เปลี่ยนรหัสผ่าน Admin** → แก้ `ADMIN.p` ใน `data.json`
- **เปลี่ยนโลโก้** → แทนค่า `LOGO_URI` ใน `data.json` ด้วย base64 string ของรูปใหม่ (`data:image/png;base64,...`)
- **ย้าย Firebase Project** → แก้ `firebaseConfig` ใน `firebase.js`

ไม่ต้องแตะ `app.js` หรือ `index.html` เลยสำหรับการแก้ไขข้อมูลทั่วไปข้างต้น
