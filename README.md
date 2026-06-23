# Trading Report · BAKERY GRP.68,78
> CP Axtra / Makro Thailand — ระบบบันทึกการตรวจนับสต็อก Bakery Group Class 68, 78

## 📁 โครงสร้างไฟล์

```
trading-report-bakery/
├── index.html      ← HTML shell (ไม่มี logic อยู่)
├── style.css       ← Design System v4 (Light Professional + Blue/Amber)
├── firebase.js     ← Firebase config + LOGO base64
├── app.js          ← Logic ทั้งหมด (โหลด data.json → auth → views → export)
├── data.json       ← ข้อมูลสินค้า 330 รายการ + สาขา 185 สาขา + admin
└── README.md       ← คู่มือนี้
```

## 🚀 ติดตั้งบน GitHub Pages (3 ขั้นตอน)

### 1. สร้าง Repository
```
github.com → New repository
ชื่อ: trading-report-bakery
Visibility: Public
```

### 2. อัปโหลดไฟล์ทั้งหมด
อัปโหลดไฟล์ทั้ง 6 ไฟล์ขึ้น repository (ไม่ต้องมี subfolder)

### 3. เปิด GitHub Pages
```
Settings → Pages
Source: Deploy from a branch
Branch: main / (root)
→ Save
```
URL: `https://[username].github.io/trading-report-bakery/`

---

## 🔥 Firebase Setup

### Rules (Realtime Database)
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### Authorized Domains
Firebase Console → Authentication → Settings → Authorized domains  
เพิ่ม: `[username].github.io`

---

## 🔑 บัญชีผู้ใช้

| Role  | Username      | Password          |
|-------|---------------|-------------------|
| Admin | `admin`       | `BakeryAdmin#2026` |
| สาขา  | `store001` … `store806` | `welcome1` |

ตัวอย่าง: สาขา 11 พิษณุโลก → `store011` / `welcome1`

---

## 📦 แก้ไขข้อมูล

### เพิ่ม/แก้ไขสินค้า
แก้ไฟล์ `data.json` → ส่วน `"items"` (array ของ object `{no, class, code, name}`)

### เพิ่ม/แก้ไขสาขา
แก้ไฟล์ `data.json` → ส่วน `"stores"` (array ของ object `{n, name, u, p}`)
- `n` = เลขสาขา
- `name` = ชื่อสาขา  
- `u` = username (store + เลข 3 หลัก)
- `p` = password (ปกติ `welcome1`)

### เปลี่ยน Firebase Project
แก้ไฟล์ `firebase.js` → ส่วน `const firebaseConfig = { ... }`

---

## 🛠️ Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | Vanilla HTML/CSS/JS (ไม่มี framework) |
| Database | Firebase Realtime Database (asia-southeast1) |
| Auth | Client-side (ตรวจสอบจาก data.json) |
| Export | SheetJS XLSX (client-side) |
| Host | GitHub Pages (static) |

---

## 📝 เพิ่มสาขาใหม่

แก้ไขไฟล์ `data.json` เพิ่ม object ใน array `"stores"`:
```json
{
  "n": "999",
  "name": "ชื่อสาขาใหม่",
  "u": "store999",
  "p": "welcome1"
}
```
จากนั้น commit และ push — ไม่ต้อง deploy ใหม่

---

*CP Axtra — Store Operations · v4.1 Multi-file Edition*
