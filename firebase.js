/* ════════════════════════════════════════════════
   FIREBASE — Config, Init, Database Helpers
   Trading Report · BAKERY GRP.68,78
   ════════════════════════════════════════════════ */

/* ── Firebase Project Config ──
   ถ้าต้องการใช้ Firebase Project ของตัวเอง
   ให้แก้ค่าด้านล่างนี้ แล้ว deploy ใหม่ */
const firebaseConfig = {
  apiKey: "AIzaSyAVGpzuZhTjmDISZDuqX1E80_Drtfu8wJE",
  authDomain: "trading-report-bakery.firebaseapp.com",
  databaseURL: "https://trading-report-bakery-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "trading-report-bakery",
  storageBucket: "trading-report-bakery.firebasestorage.app",
  messagingSenderId: "19682775516",
  appId: "1:19682775516:web:d2846030ee764177177f19"
};

let db = null, fbOk = false;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  fbOk = true;
} catch (e) {
  console.warn('FB:', e.message);
}

/* ── Database Helpers ── */
async function dbGet(path) {
  if (!fbOk) return null;
  try {
    const s = await db.ref(path).once('value');
    return s.val();
  } catch (e) {
    console.error('dbGet:', path, e.message);
    return null;
  }
}

async function dbUpdate(obj) {
  if (!fbOk) return;
  try {
    await db.ref().update(obj);
  } catch (e) {
    console.error('dbUpdate:', e.message);
    throw e;
  }
}

async function dbRemove(path) {
  if (!fbOk) return;
  try {
    await db.ref(path).remove();
  } catch (e) {
    throw e;
  }
}
