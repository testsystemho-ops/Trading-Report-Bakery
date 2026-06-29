/* ═══════════════════════════════════════════════════
   app.js — Application Logic v5.0 (Monthly Edition)
   Trading Report · BAKERY GRP.68,78 · CP Axtra
   ═══════════════════════════════════════════════════
   
   Firebase structure:
   entries/{storeNo}/{YYYY-MM}/{itemCode}   ← monthly data
   monthControl/{YYYY-MM}/active            ← true/false (admin controls)
   ═══════════════════════════════════════════════════ */

/* ════ DATA GLOBALS ════ */
let ITEMS_DATA = [];
let STORES     = [];
let ADMIN      = {};

/* ════ LOAD DATA ════ */
async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    ITEMS_DATA = json.items  || [];
    STORES     = json.stores || [];
    ADMIN      = json.admin  || {};
    ALL_CLS = ['ALL', ...new Set(ITEMS_DATA.map(i => i.class).filter(Boolean))]
      .sort((a, b) => {
        if (a === 'ALL') return -1;
        if (b === 'ALL') return 1;
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
    console.log('[loadData] items:', ITEMS_DATA.length, 'stores:', STORES.length);
  } catch (e) {
    console.error('loadData failed:', e);
    const errEl = document.getElementById('loginErr');
    if(errEl){ errEl.textContent='⚠️ โหลดข้อมูลไม่สำเร็จ กรุณา Refresh ('+e.message+')'; errEl.style.display='block'; }
  }
}

/* ════ HELPERS ════ */
function p2(n){return String(n).padStart(2,'0');}
function todayStr(){const d=new Date();return`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;}
function currentYM(){const d=new Date();return`${d.getFullYear()}-${p2(d.getMonth()+1)}`;}
function ymToThai(ym){if(!ym)return'-';const[y,m]=ym.split('-');const months=['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];return`${months[parseInt(m)]} ${parseInt(y)+543}`;}
function ymToFull(ym){if(!ym)return'-';const[y,m]=ym.split('-');const months=['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];return`${months[parseInt(m)]} ${parseInt(y)+543}`;}
function fNum(n,dec=0){return(Number(n)||0).toLocaleString('th-TH',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function hlText(t,q){if(!q)return t;try{return t.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark class="hl">$1</mark>');}catch(e){return t;}}
let _tt=null;
function toast(msg,type=''){const el=document.getElementById('toast');el.textContent=msg;el.className='show'+(type?' '+type:'');clearTimeout(_tt);_tt=setTimeout(()=>el.className='',3400);}
function showModal(html,cb){const r=document.getElementById('modalRoot');r.innerHTML=`<div class="modal-bg" id="mbg"><div class="modal">${html}</div></div>`;document.getElementById('mbg').addEventListener('click',e=>{if(e.target.id==='mbg')closeModal();});if(cb)cb(r);}
function closeModal(){document.getElementById('modalRoot').innerHTML='';}
function setBtn(b,on,t='...'){if(!b)return;if(on){b._orig=b.innerHTML;b.innerHTML=t;b.disabled=true;}else{if(b._orig)b.innerHTML=b._orig;b.disabled=false;}}

/* ════ FIREBASE HELPERS ════ */
async function dbGet(path){if(!fbOk)return null;try{const s=await db.ref(path).once('value');return s.val();}catch(e){console.error('dbGet:',path,e.message);return null;}}
async function dbUpdate(obj){if(!fbOk)return;try{await db.ref().update(obj);}catch(e){console.error('dbUpdate:',e.message);throw e;}}
async function dbRemove(path){if(!fbOk)return;try{await db.ref(path).remove();}catch(e){throw e;}}
async function dbSet(path,val){if(!fbOk)return;try{await db.ref(path).set(val);}catch(e){throw e;}}

/* ════ SESSION ════ */
let SES=null;
const SK='bk_ses_v5';
function saveSes(s){sessionStorage.setItem(SK,JSON.stringify(s));}
function loadSes(){try{return JSON.parse(sessionStorage.getItem(SK));}catch(e){return null;}}
function clearSes(){sessionStorage.removeItem(SK);}

/* ════ NAV ════ */
const STORE_NAV=[
  {id:'dashboard', ico:'📊', lbl:'แดชบอร์ด'},
  {id:'entry',     ico:'📝', lbl:'บันทึกการตรวจนับ'},
  {id:'history',   ico:'🗂️', lbl:'ประวัติ / Export'}
];
const ADMIN_NAV=[
  {id:'dashboard',     ico:'📊', lbl:'แดชบอร์ด & ภาพรวม'},
  {id:'monthcontrol',  ico:'📅', lbl:'จัดการเดือน (Month Control)'},
  {id:'storedata',     ico:'🏪', lbl:'ดูข้อมูลรายสาขา'},
  {id:'manageitems',   ico:'📦', lbl:'จัดการรายการสินค้า'},
  {id:'managestores',  ico:'🏬', lbl:'จัดการสาขา'},
  {id:'clearall',      ico:'🗑️', lbl:'ล้างข้อมูล'}
];

/* ════ ENTRY STATE ════ */
let ENTRY_DATA={}, DIRTY=false, SEARCH_Q='', CLS_FILTER='ALL';
let ENTRY_YM = currentYM(); // current month YYYY-MM
let ALL_CLS = [];
function fItems(){let it=ITEMS_DATA;if(CLS_FILTER!=='ALL')it=it.filter(i=>i.class===CLS_FILTER);if(SEARCH_Q){const q=SEARCH_Q.toLowerCase();it=it.filter(i=>i.code.toLowerCase().includes(q)||i.name.toLowerCase().includes(q));}return it;}

/* ════ SIDEBAR ════ */
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sbBd').classList.remove('show');}
function setTB(t,s=''){document.getElementById('tbTitle').textContent=t;document.getElementById('tbSub').textContent=s;}
function buildNav(){
  const nav=SES.role==='store'?STORE_NAV:ADMIN_NAV;
  document.getElementById('sbNav').innerHTML=nav.map(n=>`<div class="nav-item" data-id="${n.id}"><span class="ico">${n.ico}</span>${n.lbl}</div>`).join('');
  document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',()=>{go(el.dataset.id);closeSB();}));
}
function setActive(id){document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));}
let CURVIEW='';
function go(id){CURVIEW=id;setActive(id);({dashboard:renderDashboard,entry:renderEntry,history:renderHistory,storedata:renderStoreData,monthcontrol:renderMonthControl,clearall:renderClearAll,manageitems:renderManageItems,managestores:renderManageStores}[id]||function(){})();}

/* ════ AUTH ════ */
function initLogin(){
  document.getElementById('loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    const u=document.getElementById('fUser').value.trim().toLowerCase();
    const p=document.getElementById('fPass').value;
    if(u===ADMIN.u&&p===ADMIN.p){SES={role:'admin',name:ADMIN.name};saveSes(SES);startApp();return;}
    const st=STORES.find(s=>s.u===u&&s.p===p);
    if(st){SES={role:'store',no:st.n,name:st.name,u:st.u};saveSes(SES);startApp();return;}
    const err=document.getElementById('loginErr');err.style.display='block';setTimeout(()=>err.style.display='none',3000);
  });
  document.getElementById('logoutBtn').addEventListener('click',()=>{
    clearSes();SES=null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('fUser').value='';document.getElementById('fPass').value='';
  });
}
function startApp(){
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if(typeof LOGO_URI!=='undefined'){document.getElementById('loginLogo').src=LOGO_URI;document.getElementById('sbLogo').src=LOGO_URI;}
  const isAdmin=SES.role==='admin';
  document.getElementById('sbName').textContent=isAdmin?SES.name:`สาขา ${SES.no} — ${SES.name}`;
  document.getElementById('sbRole').textContent=isAdmin?'ผู้ดูแลระบบ (Admin)':'บัญชีสาขา (Store)';
  const av=document.getElementById('sbAvatar');
  if(isAdmin){av.textContent='👑';av.classList.add('admin');}else{av.textContent='🏪';}
  buildNav();go('dashboard');
}

/* ════════════════════════════════════════════
   MONTH CONTROL HELPERS
   Firebase: monthControl/{YYYY-MM}/active = true/false
════════════════════════════════════════════ */
async function getMonthControl(){
  return await dbGet('monthControl') || {};
}
async function isMonthActive(ym){
  const mc = await dbGet(`monthControl/${ym}`);
  return mc && mc.active === true;
}
async function setMonthActive(ym, active){
  await dbSet(`monthControl/${ym}`, { active, updatedBy:'admin', updatedAt: Date.now() });
}

/* สร้างรายการเดือน ตั้งแต่เดือนปัจจุบัน → ธ.ค. 2030 (เรียงจากน้อยไปมาก) */
function generateMonthList(){
  const list=[];
  const now=new Date();
  const startY=now.getFullYear(), startM=now.getMonth(); // 0-indexed
  const endY=2030, endM=11; // ธ.ค. 2030
  let y=startY, m=startM;
  while(y<endY||(y===endY&&m<=endM)){
    list.push(`${y}-${p2(m+1)}`);
    m++;
    if(m>11){m=0;y++;}
  }
  return list; // ascending: ปัจจุบัน → ธ.ค. 2030
}

/* ════════════════════════════════════════════
   STORE DASHBOARD — กราฟรายเดือน
════════════════════════════════════════════ */
async function renderDashboard(){
  const C=document.getElementById('content');
  if(SES.role==='store'){
    await renderStoreDashboard(C);
  } else {
    await renderAdminDashboard(C);
  }
}

async function renderStoreDashboard(C){
  setTB('แดชบอร์ด',`สาขา ${SES.no} — ${SES.name}`);
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';

  const curYM = currentYM();
  const mc = await getMonthControl();
  const curActive = mc[curYM] && mc[curYM].active === true;
  const total = ITEMS_DATA.length;

  // โหลดข้อมูลเดือนปัจจุบัน
  const curData = await dbGet(`entries/${SES.no}/${curYM}`) || {};
  const filledCount = Object.keys(curData).filter(k => curData[k] !== null && curData[k] !== undefined && curData[k] !== '').length;
  const totalQty = Object.values(curData).reduce((s,v) => s + (parseFloat(v)||0), 0);
  const pct = total>0 ? Math.round(filledCount/total*100) : 0;

  // นับเดือนที่เคยบันทึก
  const allD = await dbGet(`entries/${SES.no}`) || {};
  const savedMonths = Object.keys(allD).filter(k=>/^\d{4}-\d{2}$/.test(k));
  const totalMonths = savedMonths.length;

  const lockBanner = !curActive ? `
    <div class="month-lock-banner">
      <div class="lock-icon">🔒</div>
      <div class="lock-text">
        <div class="lock-title">ยังไม่เปิดให้บันทึกข้อมูลเดือนนี้</div>
        <div class="lock-sub">เดือน ${ymToFull(curYM)} — กรุณารอ Admin เปิดใช้งาน หรือติดต่อผู้ดูแลระบบ</div>
      </div>
    </div>` : '';

  C.innerHTML=`
    ${lockBanner}
    <div class="hero-card" style="margin-bottom:16px">
      <div class="hero-blob"></div>
      <div class="hero-icon">🥐</div>
      <div class="hero-content">
        <div class="hero-lbl">รายการที่บันทึกแล้วเดือนนี้</div>
        <div class="hero-val num">${fNum(filledCount)}<span style="font-size:22px;opacity:.65"> / ${fNum(total)}</span></div>
        <div class="hero-hint">${ymToFull(curYM)} · BAKERY GRP.68,78 · ${curActive?'<span style="color:#7DFFD0">✅ เปิดบันทึก</span>':'<span style="color:#FFCDD2">🔒 ยังไม่เปิด</span>'}</div>
      </div>
      <div class="hero-badge">BAKERY</div>
    </div>

    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card amber">
        <div class="kpi-lbl">✅ กรอกแล้วเดือนนี้</div>
        <div class="kpi-val">${fNum(filledCount)}</div>
        <div class="kpi-hint">/ ${fNum(total)} รายการ</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">📦 QTY รวมเดือนนี้</div>
        <div class="kpi-val">${fNum(totalQty,2)}</div>
        <div class="kpi-hint">รวมทุกรายการ</div>
      </div>
      <div class="kpi-card ${curActive?'green':'red'}">
        <div class="kpi-lbl">📅 สถานะเดือนนี้</div>
        <div class="kpi-val" style="font-size:20px">${curActive?'✅':'🔒'}</div>
        <div class="kpi-hint">${curActive?'เปิดบันทึกแล้ว':'ยังไม่เปิด'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">🗂️ เดือนที่บันทึกแล้ว</div>
        <div class="kpi-val">${totalMonths}</div>
        <div class="kpi-hint">เดือน (ทั้งหมด)</div>
      </div>
    </div>

    <div class="prog-card" style="margin-bottom:16px">
      <div class="prog-head">
        <div><div class="prog-title">ความครบถ้วนเดือนนี้</div><div class="prog-sub">สาขา ${SES.no} — ${esc(SES.name)}</div></div>
        <div class="prog-pct">${pct}%</div>
      </div>
      <div class="prog-track"><div class="prog-fill" style="width:${Math.min(100,pct)}%"></div></div>
      <div class="prog-labels"><span>0 รายการ</span><span>${fNum(total)} รายการ</span></div>
    </div>

    <button class="btn btn-primary" onclick="go('entry')" ${!curActive?'disabled title="Admin ยังไม่เปิดเดือนนี้"':''} style="${!curActive?'opacity:.55;cursor:not-allowed':''}">
      📝 ${curActive?'เริ่มบันทึกการตรวจนับ':'รอ Admin เปิดเดือนก่อนบันทึก'}
    </button>
    <button class="btn btn-secondary" onclick="exportStoreTemplate()" style="margin-top:10px">
      📋 Export Template รายการสินค้า (สำหรับตรวจสอบล่วงหน้า)
    </button>`;
}

/* ════════════════════════════════════════════
   MONTH CONTROL (Admin)
════════════════════════════════════════════ */
async function renderMonthControl(){
  setTB('จัดการเดือน','Month Control — Admin');
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const mc = await getMonthControl();
  const curYM = currentYM();
  const months = generateMonthList(); // ปัจจุบัน → ธ.ค. 2030

  // นับ Active ทั้งหมด
  const activeCount = months.filter(ym=>mc[ym]&&mc[ym].active===true).length;

  // Dropdown options
  const ymOpts = months.map(ym=>{
    const isActive = mc[ym]&&mc[ym].active===true;
    const isCur = ym===curYM;
    return `<option value="${ym}">${ym} — ${ymToFull(ym)}${isCur?' ⭐':''} ${isActive?'✅':'🔒'}</option>`;
  }).join('');

  C.innerHTML=`
    <div class="card" style="margin-bottom:14px;border-left:4px solid var(--blue)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:36px">📅</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--txt)">Month Control — จัดการเดือนที่เปิดรับบันทึก</div>
          <div style="font-size:13px;color:var(--txt3);margin-top:4px">
            กำหนดว่าเดือนไหน <b style="color:var(--green)">Active</b> (User สาขาบันทึกได้) หรือ <b style="color:var(--red)">Inactive</b> (ดูได้แต่บันทึกไม่ได้)
          </div>
          <div style="font-size:12px;color:var(--txt4);margin-top:4px">เปิดอยู่ปัจจุบัน ${activeCount} เดือน · ช่วง ${ymToThai(curYM)} — ธ.ค. ${2030+543}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">🔧 เลือกเดือนที่ต้องการจัดการ</div>
        <button class="btn btn-blue btn-sm" onclick="renderMonthControl()">🔄 รีเฟรช</button>
      </div>

      <!-- Dropdown เลือกเดือน -->
      <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:240px">
          <label class="flabel">📅 เลือกเดือน (${ymToThai(curYM)} — ธ.ค. ${2030+543})</label>
          <select class="ctrl w100" id="mcYMSel" style="font-size:13.5px">
            ${ymOpts}
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-blue" onclick="mcToggleSelected(true)">✅ เปิด Active</button>
          <button class="btn btn-sm" style="background:var(--red-bg);color:var(--red);border:1px solid rgba(224,50,68,.2);padding:9px 16px;border-radius:var(--r8);font-weight:600;cursor:pointer" onclick="mcToggleSelected(false)">🔒 ปิด Inactive</button>
        </div>
      </div>

      <!-- สถานะเดือนที่เลือก (แสดงแบบ realtime) -->
      <div id="mcStatusBox" style="padding:14px 18px;border-radius:var(--r12);background:var(--surface2);border:1px solid var(--border2)">
        <div style="font-size:12px;color:var(--txt3)">← เลือกเดือนด้านบน แล้วกดเปิด หรือปิด</div>
      </div>

      <div style="margin-top:14px;padding:12px 16px;background:var(--warn-bg);border-radius:var(--r12);border:1px solid rgba(212,139,10,.20);font-size:13px;color:var(--warn)">
        ⚠️ <b>หมายเหตุ:</b> เมื่อปิดเดือน (Inactive) User สาขาจะยังดูข้อมูลและ Export ได้ตามปกติ แต่บันทึกหรือแก้ไขข้อมูลไม่ได้
      </div>
    </div>

    <!-- รายการเดือนที่ Active ทั้งหมด -->
    <div class="card" style="margin-top:14px">
      <div class="card-head"><div class="card-title">✅ เดือนที่เปิด Active <span class="sub">${activeCount} เดือน</span></div></div>
      <div id="activeMonthList">
        ${buildActiveMonthList(months, mc)}
      </div>
    </div>`;

  // ผูก event บน select เพื่อแสดงสถานะ realtime
  document.getElementById('mcYMSel').addEventListener('change', function(){
    const ym=this.value;
    const isActive=mc[ym]&&mc[ym].active===true;
    const isCur=ym===curYM;
    document.getElementById('mcStatusBox').innerHTML=`
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">${isActive?'✅':'🔒'}</span>
        <div>
          <div style="font-weight:800;font-size:14px;color:var(--txt)">${ymToFull(ym)} ${isCur?'<span style="font-size:11px;background:var(--blue-xl);color:var(--blue);border-radius:999px;padding:2px 8px;margin-left:4px">เดือนปัจจุบัน</span>':''}</div>
          <div style="font-size:13px;color:${isActive?'var(--green)':'var(--red)'};font-weight:700;margin-top:2px">${isActive?'Active — เปิดให้บันทึก':'Inactive — ปิดการบันทึก'}</div>
        </div>
      </div>`;
  });
  // trigger ครั้งแรก
  document.getElementById('mcYMSel').dispatchEvent(new Event('change'));
}

function buildActiveMonthList(months, mc){
  const actives=months.filter(ym=>mc[ym]&&mc[ym].active===true);
  if(!actives.length) return '<div style="padding:16px;text-align:center;color:var(--txt3);font-size:13px">ยังไม่มีเดือนที่เปิด Active</div>';
  const curYM=currentYM();
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0">
    ${actives.map(ym=>`
      <div style="display:inline-flex;align-items:center;gap:8px;background:var(--green-bg);border:1px solid rgba(13,159,110,.20);border-radius:var(--r8);padding:7px 13px">
        <span style="font-size:12.5px;font-weight:700;color:var(--green)">${ymToFull(ym)}</span>
        ${ym===curYM?'<span style="font-size:10px;background:var(--blue-xl);color:var(--blue);border-radius:999px;padding:1px 7px">ปัจจุบัน</span>':''}
        <button onclick="toggleMonth('${ym}',false)" style="background:none;border:none;cursor:pointer;color:var(--txt4);font-size:13px;padding:0;line-height:1" title="ปิดเดือนนี้">✕</button>
      </div>`).join('')}
  </div>`;
}

async function mcToggleSelected(active){
  const sel=document.getElementById('mcYMSel');
  if(!sel)return;
  const ym=sel.value;
  await toggleMonth(ym, active);
}

async function toggleMonth(ym, active){
  const label = active ? 'เปิด (Active)' : 'ปิด (Inactive)';
  const icon = active ? '✅' : '🔒';
  showModal(`
    <h3>${icon} ยืนยันการ${label}</h3>
    <p style="color:var(--txt2);margin-top:10px">
      ต้องการ <b>${label}</b> เดือน <b>${ymToFull(ym)}</b> ใช่หรือไม่?<br><br>
      ${active
        ? '<span style="color:var(--green)">→ User สาขาทุกสาขา จะสามารถบันทึกข้อมูลเดือนนี้ได้</span>'
        : '<span style="color:var(--red)">→ User สาขาทุกสาขา จะไม่สามารถบันทึกข้อมูลเดือนนี้ได้ (ดูข้อมูลได้ปกติ)</span>'
      }
    </p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn ${active?'btn-blue':'btn-danger'}" onclick="doToggleMonth('${ym}',${active})">${icon} ยืนยัน</button>
    </div>`);
}

async function doToggleMonth(ym, active){
  closeModal();
  try{
    await setMonthActive(ym, active);
    toast(`${active?'✅ เปิด':'🔒 ปิด'} เดือน ${ymToFull(ym)} แล้ว`,'ok');
    // refresh view ที่กำลังแสดงอยู่
    if(CURVIEW==='monthcontrol') renderMonthControl();
    else if(CURVIEW==='dashboard') go('dashboard');
  }catch(e){
    toast('เกิดข้อผิดพลาด: '+e.message,'err');
  }
}

/* ════════════════════════════════════════════
   ENTRY (Monthly)
════════════════════════════════════════════ */
async function renderEntry(){
  setTB('บันทึกการตรวจนับ',`สาขา ${SES.no}`);
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';

  // โหลดข้อมูลเดือน + ตรวจสอบสถานะ
  const mc = await getMonthControl();

  // หาเดือนที่ Active ทั้งหมด
  const activeMonths = generateMonthList().filter(ym => mc[ym] && mc[ym].active === true);
  // เดือนที่เคยมีข้อมูลแล้ว
  const allStoreData = await dbGet(`entries/${SES.no}`) || {};
  const savedMonths = Object.keys(allStoreData).filter(ym => /^\d{4}-\d{2}$/.test(ym));

  // รวม: Active + ที่เคยบันทึก (edit ได้แม้ inactive)
  const editableMonths = [...new Set([...activeMonths, ...savedMonths])].sort().reverse();

  // ถ้าไม่มีเดือนไหนเลย
  if(!editableMonths.length){
    ENTRY_YM = currentYM();
    const curActive = mc[currentYM()] && mc[currentYM()].active === true;
    C.innerHTML=`
      <div class="month-lock-banner">
        <div class="lock-icon">🔒</div>
        <div class="lock-text">
          <div class="lock-title">ยังไม่เปิดให้บันทึกข้อมูล</div>
          <div class="lock-sub">ยังไม่มีเดือนไหนที่ Admin เปิด Active ไว้ กรุณารอ Admin เปิดเดือนที่ต้องการก่อน</div>
        </div>
      </div>
      <div class="card tc" style="padding:32px;color:var(--txt3)">
        <div style="font-size:48px;margin-bottom:12px">📅</div>
        <div style="font-size:15px;font-weight:700;color:var(--txt);margin-bottom:8px">ยังไม่มีเดือนที่เปิดให้บันทึก</div>
        <div style="font-size:13px">กรุณาติดต่อ Admin เพื่อเปิด Active เดือนที่ต้องการบันทึกข้อมูล</div>
      </div>`;
    return;
  }

  // ใช้เดือนล่าสุดที่ active หรือเดือนที่ select อยู่ก่อนหน้า
  if(!editableMonths.includes(ENTRY_YM)) ENTRY_YM = editableMonths[0];

  await loadEntryForMonth(ENTRY_YM, editableMonths, mc, C);
}

async function loadEntryForMonth(ym, editableMonths, mc, C){
  ENTRY_YM = ym;
  const isActive = mc[ym] && mc[ym].active === true;
  const data = await dbGet(`entries/${SES.no}/${ym}`) || {};
  ENTRY_DATA = {...data};
  DIRTY = false;
  buildEntryView(C, editableMonths, mc, isActive);
}

function buildEntryView(C, editableMonths, mc, isActive){
  const items=fItems();
  const fAll=ITEMS_DATA.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const fView=items.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const tQty=items.reduce((s,i)=>s+(parseFloat(ENTRY_DATA[i.code])||0),0);
  const clsOpts=ALL_CLS.map(c=>`<option value="${c}" ${CLS_FILTER===c?'selected':''}>${c==='ALL'?`ทั้งหมด (${ITEMS_DATA.length})`:`Class ${c} (${ITEMS_DATA.filter(i=>i.class===c).length})`}</option>`).join('');

  // Month selector options
  const ymOpts = editableMonths.map(ym=>`<option value="${ym}" ${ENTRY_YM===ym?'selected':''}>${ymToFull(ym)}${mc[ym]&&mc[ym].active?'' :' 🔒'}</option>`).join('');

  const lockWarning = !isActive ? `
    <div style="background:var(--warn-bg);border:1px solid rgba(212,139,10,.25);border-radius:var(--r12);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">⚠️</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--warn)">เดือนนี้อยู่ในโหมดแก้ไขเท่านั้น (Inactive)</div>
        <div style="font-size:12px;color:var(--txt3)">เดือน ${ymToFull(ENTRY_YM)} Admin ยังไม่ได้เปิด Active แต่คุณสามารถดูข้อมูลที่บันทึกไว้ได้</div>
      </div>
    </div>` : '';

  C.innerHTML=`
    ${lockWarning}
    <div class="card">
      <div class="card-head">
        <div class="card-title">📝 บันทึกจำนวนสินค้า <span class="sub">GRP.68,78</span></div>
        <div class="flex gap8 items-c" style="flex-wrap:wrap">
          <div class="dirty-badge ${DIRTY?'show':''}" id="dirtyBadge">⚠️ มีการแก้ไข</div>
          ${isActive?`<button class="btn btn-secondary btn-sm" onclick="clearAllQty()">🗑️ ล้าง</button>`:''}
          ${isActive?`<button class="btn btn-primary" id="saveBtn" onclick="saveEntry()">💾 บันทึก</button>`:''}
        </div>
      </div>
      <div class="filter-bar">
        <div>
          <label class="flabel">📅 เดือนที่บันทึก</label>
          <select class="ctrl" id="entryYMSel" onchange="onYMChange(this.value)" style="min-width:180px">
            ${ymOpts}
          </select>
        </div>
        <div><label class="flabel">🏷️ Class</label><select class="ctrl" id="clsSel" onchange="onClsChange(this.value)">${clsOpts}</select></div>
        <div class="flex-1"><label class="flabel">🔍 ค้นหา</label><div class="search-wrap"><span class="search-ico">🔍</span><input type="text" class="ctrl" id="searchInp" placeholder="ชื่อสินค้า หรือ รหัส..." value="${esc(SEARCH_Q)}" oninput="onSearch(this.value)"></div></div>
      </div>
      <div class="info-bar">
        <span id="infoTxt">เดือน <strong>${ymToFull(ENTRY_YM)}</strong> · กรอกแล้ว <strong>${fView}</strong> / ${items.length} · ทั้งหมด <strong>${fAll}</strong> / ${ITEMS_DATA.length}</span>
        <span style="font-size:12px;color:${isActive?'var(--green)':'var(--warn)'};font-weight:700">${isActive?'✅ Active':'🔒 Inactive'}</span>
      </div>
      <div class="tbl-wrap entry-tbl-wrap">
        <table class="dtbl">
          <thead><tr><th style="width:44px">No.</th><th style="width:68px">Class</th><th style="width:104px">รหัส</th><th>ชื่อสินค้า</th><th style="width:104px;text-align:right">QTY</th></tr></thead>
          <tbody id="entryBody">${buildEntryRows(items, isActive)}</tbody>
          <tfoot><tr><td colspan="4">รวม ${fView} / ${items.length} รายการ</td><td class="tr num" id="tQty">${fNum(tQty,2)}</td></tr></tfoot>
        </table>
      </div>
    </div>`;
}

function buildEntryRows(items, isActive=true){
  if(!items.length)return`<tr><td colspan="5" class="tc muted" style="padding:28px">ไม่พบรายการ</td></tr>`;
  return items.map((it,idx)=>{
    const v=ENTRY_DATA[it.code]!==undefined&&ENTRY_DATA[it.code]!==null?ENTRY_DATA[it.code]:'';
    if(!isActive){
      // readonly mode
      return`<tr><td class="code-cell">${it.no}</td><td><span class="cls-badge">${esc(it.class)}</span></td><td class="code-cell">${esc(it.code)}</td><td style="max-width:340px;white-space:normal;line-height:1.35">${SEARCH_Q?hlText(esc(it.name),SEARCH_Q):esc(it.name)}</td><td class="tr num ${v!==''?'':'muted'}" style="font-family:var(--mono)">${v!==''?fNum(Number(v),2):'—'}</td></tr>`;
    }
    return`<tr><td class="code-cell">${it.no}</td><td><span class="cls-badge">${esc(it.class)}</span></td><td class="code-cell">${esc(it.code)}</td><td style="max-width:340px;white-space:normal;line-height:1.35">${SEARCH_Q?hlText(esc(it.name),SEARCH_Q):esc(it.name)}</td><td class="tr"><input class="qty-inp${v!==''?' filled':''}" type="number" min="0" step="0.01" id="q_${esc(it.code)}" value="${esc(String(v))}" onchange="onQty('${esc(it.code)}',this.value)" onkeydown="navRow(event,${idx})"></td></tr>`;
  }).join('');
}

function refreshEntryBody(){
  // ต้องรู้ว่า isActive ไหม — อ่านจาก UI state
  const activeLabel = document.querySelector('.info-bar span[style]');
  const isActive = activeLabel ? activeLabel.textContent.includes('Active') && !activeLabel.textContent.includes('Inactive') : true;
  const items=fItems();
  const tbody=document.getElementById('entryBody');if(tbody)tbody.innerHTML=buildEntryRows(items, isActive);
  const fAll=ITEMS_DATA.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const fView=items.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const it2=document.getElementById('infoTxt');if(it2)it2.innerHTML=`เดือน <strong>${ymToFull(ENTRY_YM)}</strong> · กรอกแล้ว <strong>${fView}</strong> / ${items.length} · ทั้งหมด <strong>${fAll}</strong> / ${ITEMS_DATA.length}`;
  const tq=document.getElementById('tQty');if(tq)tq.textContent=fNum(items.reduce((s,i)=>s+(parseFloat(ENTRY_DATA[i.code])||0),0),2);
}

async function onYMChange(ym){
  ENTRY_YM=ym;
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const mc = await getMonthControl();
  const allStoreData = await dbGet(`entries/${SES.no}`) || {};
  const savedMonths = Object.keys(allStoreData).filter(ym2 => /^\d{4}-\d{2}$/.test(ym2));
  const activeMonths = generateMonthList().filter(ym2 => mc[ym2] && mc[ym2].active === true);
  const editableMonths = [...new Set([...activeMonths, ...savedMonths])].sort().reverse();
  await loadEntryForMonth(ym, editableMonths, mc, C);
}

function onClsChange(v){CLS_FILTER=v;refreshEntryBody();}
function onSearch(v){SEARCH_Q=v.trim();refreshEntryBody();}
function onQty(code,val){ENTRY_DATA[code]=val===''?'':parseFloat(val)||0;DIRTY=true;const inp=document.getElementById(`q_${code}`);if(inp)inp.classList.toggle('filled',val!=='');const db2=document.getElementById('dirtyBadge');if(db2)db2.className='dirty-badge show';const tq=document.getElementById('tQty');if(tq)tq.textContent=fNum(fItems().reduce((s,i)=>s+(parseFloat(ENTRY_DATA[i.code])||0),0),2);}
function navRow(e,idx){const items=fItems();if(e.key==='Enter'||e.key==='ArrowDown'){e.preventDefault();const n=document.getElementById(`q_${items[idx+1]?.code}`);if(n)n.focus();}else if(e.key==='ArrowUp'){e.preventDefault();const p=document.getElementById(`q_${items[idx-1]?.code}`);if(p)p.focus();}}
function clearAllQty(){showModal(`<h3>🗑️ ล้างข้อมูลเดือน ${ymToFull(ENTRY_YM)}</h3><p style="color:var(--txt2);margin-top:8px">ต้องการล้าง QTY ทั้งหมดใช่หรือไม่?</p><div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button><button class="btn btn-danger" onclick="confirmClear()">ล้างข้อมูล</button></div>`);}
function confirmClear(){ITEMS_DATA.forEach(i=>{ENTRY_DATA[i.code]='';});DIRTY=true;closeModal();refreshEntryBody();toast('ล้างข้อมูลแล้ว');}

async function saveEntry(){
  const btn=document.getElementById('saveBtn');setBtn(btn,true,'💾 กำลังบันทึก...');
  // ตรวจสอบ active อีกครั้งก่อน save
  const isActive = await isMonthActive(ENTRY_YM);
  if(!isActive){ toast('เดือนนี้ Admin ยังไม่เปิด Active — ไม่สามารถบันทึกได้','err'); setBtn(btn,false); return; }
  const upd={};
  ITEMS_DATA.forEach(i=>{const v=ENTRY_DATA[i.code];upd[`entries/${SES.no}/${ENTRY_YM}/${i.code}`]=(v===''||v===undefined||v===null)?null:parseFloat(v)||0;});
  upd[`logs/${Date.now()}`]={no:SES.no,name:SES.name,ym:ENTRY_YM,ts:Date.now(),action:'save'};
  try{
    await dbUpdate(upd);
    DIRTY=false;
    const db2=document.getElementById('dirtyBadge');if(db2)db2.className='dirty-badge';
    toast('บันทึกสำเร็จ ✅','ok');
  }catch(e){toast('เกิดข้อผิดพลาด: '+e.message,'err');}
  setBtn(btn,false);
}

/* ════════════════════════════════════════════
   HISTORY (Store) — รายเดือน
════════════════════════════════════════════ */
async function renderHistory(){
  setTB('ประวัติ / Export',`สาขา ${SES.no}`);
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const all = await dbGet(`entries/${SES.no}`) || {};
  const months = Object.keys(all).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().reverse();
  if(!months.length){C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">ยังไม่มีประวัติ</div>';return;}
  const rows = months.map(ym=>{
    const mData=all[ym]||{};
    const f=Object.keys(mData).filter(k=>mData[k]!==null&&mData[k]!=='').length;
    const q=Object.values(mData).reduce((s,v)=>s+(parseFloat(v)||0),0);
    const pct=ITEMS_DATA.length>0?Math.round(f/ITEMS_DATA.length*100):0;
    return`<tr>
      <td><b>${ym}</b></td>
      <td style="color:var(--txt2)">${ymToFull(ym)}</td>
      <td class="tr num">${f} / ${ITEMS_DATA.length}</td>
      <td class="tr num">${fNum(q,2)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;border-radius:3px;background:var(--surface3);overflow:hidden;min-width:60px">
            <div style="height:100%;border-radius:3px;background:${pct>=100?'var(--green)':pct>50?'var(--amber)':'var(--blue)'};width:${pct}%"></div>
          </div>
          <span style="font-size:11px;color:var(--txt3);min-width:28px">${pct}%</span>
        </div>
      </td>
      <td class="tr"><button class="btn btn-secondary btn-xs" onclick="exportStoreMonth('${ym}')">📥 Export</button></td>
    </tr>`;
  }).join('');

  C.innerHTML=`
    <div class="card">
      <div class="card-head">
        <div class="card-title">🗂️ ประวัติการบันทึก <span class="sub">${months.length} เดือน</span></div>
        <div class="flex gap8 items-c">
          <button class="btn btn-secondary" onclick="exportStoreTemplate()" title="Export รายการสินค้าทั้งหมด (ไม่มี QTY) เพื่อกรอกก่อนบันทึก">📋 Export Template</button>
          <button class="btn btn-primary" onclick="exportStoreAll()">📥 Export ทั้งหมด</button>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead><tr><th>เดือน</th><th>ชื่อเดือน</th><th class="tr">รายการที่กรอก</th><th class="tr">รวม QTY</th><th>ความครบถ้วน</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

async function exportStoreMonth(ym){
  toast('กำลังสร้าง Excel...');
  const dd=await dbGet(`entries/${SES.no}/${ym}`)||{};
  const wb=XLSX.utils.book_new();
  const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า','QTY']];
  ITEMS_DATA.forEach(i=>{const v=dd[i.code];rows.push([i.no,i.class,i.code,i.name,v!=null&&v!==''?Number(v):'']);});
  const ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,ym);
  XLSX.writeFile(wb,`BakeryStock_${SES.no}_${ym}.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

async function exportStoreAll(){
  toast('กำลังสร้าง Excel...');
  const all=await dbGet(`entries/${SES.no}`)||{};
  const months=Object.keys(all).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort();
  const wb=XLSX.utils.book_new();
  // Summary sheet
  const sumRows=[['เดือน','ชื่อเดือน','รายการที่กรอก','QTY รวม']];
  months.forEach(ym=>{
    const mData=all[ym]||{};
    const f=Object.keys(mData).filter(k=>mData[k]!==null&&mData[k]!=='').length;
    const q=Object.values(mData).reduce((s,v)=>s+(parseFloat(v)||0),0);
    sumRows.push([ym, ymToFull(ym), f, q]);
  });
  const wsSummary=XLSX.utils.aoa_to_sheet(sumRows);
  XLSX.utils.book_append_sheet(wb,wsSummary,'สรุปรายเดือน');
  // Detail per month
  months.forEach(ym=>{
    const mData=all[ym]||{};
    const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า','QTY']];
    ITEMS_DATA.forEach(i=>{const v=mData[i.code];rows.push([i.no,i.class,i.code,i.name,v!=null&&v!==''?Number(v):'']);});
    const ws=XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb,ws,ym.replace('-','_'));
  });
  XLSX.writeFile(wb,`BakeryStock_${SES.no}_All.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

/* ════════════════════════════════════════════
   ADMIN DASHBOARD
════════════════════════════════════════════ */
async function renderAdminDashboard(C){
  setTB('แดชบอร์ด & ภาพรวม','Admin');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';

  const mc = await getMonthControl();
  const curYM = currentYM();
  const curActive = mc[curYM] && mc[curYM].active === true;
  const allE = await dbGet('entries') || {};

  // คำนวณสถิติเดือนปัจจุบัน
  const totalStoresAll = STORES.length;
  let curStores=0, curItems=0, curQty=0;
  Object.keys(allE).forEach(sNo=>{
    const mData=(allE[sNo]||{})[curYM]||{};
    const f=Object.keys(mData).filter(k=>mData[k]!==null&&mData[k]!=='').length;
    if(f>0){ curStores++; curItems+=f; curQty+=Object.values(mData).reduce((s,v)=>s+(parseFloat(v)||0),0); }
  });
  const sentPct=totalStoresAll>0?Math.round(curStores/totalStoresAll*100):0;

  // Active months count
  const months=generateMonthList();
  const activeCount=months.filter(ym=>mc[ym]&&mc[ym].active===true).length;

  // สาขาที่ยังไม่บันทึกเดือนนี้
  const notSentStores=STORES.filter(s=>{
    const mData=(allE[String(s.n)]||{})[curYM]||{};
    return Object.keys(mData).filter(k=>mData[k]!==null&&mData[k]!=='').length===0;
  });

  C.innerHTML=`
    <div class="hero-card" style="margin-bottom:16px">
      <div class="hero-blob"></div>
      <div class="hero-icon">🏪</div>
      <div class="hero-content">
        <div class="hero-lbl">สาขาที่บันทึกแล้วเดือนนี้ — ${ymToFull(curYM)}</div>
        <div class="hero-val num">${curStores}<span style="font-size:22px;opacity:.65"> / ${totalStoresAll}</span></div>
        <div class="hero-hint">${sentPct}% · ${curActive?'<span style="color:#7DFFD0">✅ เปิดบันทึก</span>':'<span style="color:#FFCDD2">🔒 ยังไม่เปิด</span>'}</div>
      </div>
      <div class="hero-badge">ADMIN</div>
    </div>

    <!-- KPI Row -->
    <div class="kpi-grid" style="margin-bottom:14px">
      <div class="kpi-card ${curActive?'green':'red'}">
        <div class="kpi-lbl">📅 สถานะเดือนนี้</div>
        <div class="kpi-val" style="font-size:20px;color:${curActive?'var(--green)':'var(--red)'}">${curActive?'✅ Active':'🔒 Inactive'}</div>
        <div class="kpi-hint">${ymToFull(curYM)}</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-lbl">🏪 บันทึกแล้ว</div>
        <div class="kpi-val">${curStores}</div>
        <div class="kpi-hint">/ ${totalStoresAll} สาขา</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">📦 รายการรวม</div>
        <div class="kpi-val">${fNum(curItems)}</div>
        <div class="kpi-hint">QTY ${fNum(curQty,2)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">✅ เดือนที่เปิดอยู่</div>
        <div class="kpi-val">${activeCount}</div>
        <div class="kpi-hint">เดือน (Active)</div>
      </div>
    </div>

    <!-- Quick Action -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">⚡ Quick Action — เดือนปัจจุบัน</div>
        <button class="btn btn-blue btn-sm" onclick="go('monthcontrol')">📅 จัดการเดือน</button>
      </div>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:3px">${ymToFull(curYM)}</div>
          <div style="font-size:13px;color:${curActive?'var(--green)':'var(--red)'};">${curActive?'✅ เปิดให้สาขาบันทึกอยู่':'🔒 ปิด — สาขาบันทึกไม่ได้'}</div>
          <div style="height:6px;border-radius:3px;background:var(--surface3);margin-top:10px;overflow:hidden;max-width:240px">
            <div style="height:100%;border-radius:3px;background:var(--blue);width:${sentPct}%;transition:width .6s"></div>
          </div>
          <div style="font-size:11px;color:var(--txt4);margin-top:3px">${sentPct}% ของสาขาบันทึกแล้ว</div>
        </div>
        <button class="btn" style="${curActive?'background:var(--red-bg);color:var(--red);border:1px solid rgba(224,50,68,.2)':'background:var(--green-bg);color:var(--green);border:1px solid rgba(13,159,110,.2)'};padding:11px 20px;font-weight:700;border-radius:var(--r8);cursor:pointer;font-size:13.5px" onclick="toggleMonth('${curYM}',${!curActive})">
          ${curActive?'🔒 ปิดเดือนนี้':'✅ เปิดเดือนนี้'}
        </button>
      </div>
    </div>

    <!-- สาขาที่ยังไม่บันทึก -->
    ${notSentStores.length>0?`
    <div class="card">
      <div class="card-head">
        <div class="card-title" style="color:var(--red)">⏳ ยังไม่บันทึก <span class="sub">${notSentStores.length} สาขา</span></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${notSentStores.slice(0,40).map(s=>`<span style="background:var(--red-bg);color:var(--red);border:1px solid rgba(224,50,68,.15);border-radius:var(--r8);padding:4px 11px;font-size:12px;font-weight:600">${s.n} ${esc(s.name)}</span>`).join('')}
        ${notSentStores.length>40?`<span style="color:var(--txt3);font-size:12px;padding:4px">...และอีก ${notSentStores.length-40} สาขา</span>`:''}
      </div>
    </div>`:'<div class="card tc" style="padding:20px;color:var(--green)"><b>✅ ทุกสาขาบันทึกข้อมูลแล้วเดือนนี้!</b></div>'}`;
}

/* ════════════════════════════════════════════
   ADMIN STORE DATA (monthly)
════════════════════════════════════════════ */
let ASTORE=null, AMONTH=currentYM();

async function renderStoreData(){
  setTB('ดูข้อมูลรายสาขา','Admin');
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  if(!fbKeys.length){
    C.innerHTML=`<div class="card"><div class="card-title" style="margin-bottom:12px">🏪 ดูข้อมูลรายสาขา</div><p style="color:var(--txt3)">ยังไม่มีข้อมูลใน Firebase</p></div>`;
    return;
  }

  // รวบรวมเดือนที่มีข้อมูล
  const allMonths=new Set();
  fbKeys.forEach(k=>Object.keys(allE[k]||{}).filter(m=>/^\d{4}-\d{2}$/.test(m)).forEach(m=>allMonths.add(m)));
  const monthList=[...allMonths].sort().reverse();
  if(!monthList.includes(AMONTH)) AMONTH=monthList[0]||currentYM();

  const storeList=fbKeys.map(k=>{
    const f=STORES.find(s=>String(s.n)===String(k));
    return{key:k,name:f?f.name:`สาขา ${k}`};
  }).sort((a,b)=>Number(a.key)-Number(b.key));

  const allOpt=`<option value="ALL" ${ASTORE==='ALL'?'selected':''}>🏪 ทุกสาขา (${fbKeys.length} สาขา)</option>`;
  const stOpts=storeList.map(s=>`<option value="${s.key}" ${ASTORE===s.key?'selected':''}>${s.key} — ${esc(s.name)}</option>`).join('');
  const mOpts=monthList.map(m=>`<option value="${m}" ${AMONTH===m?'selected':''}>${m} — ${ymToFull(m)}</option>`).join('');

  C.innerHTML=`
    <div class="card" style="margin-bottom:14px">
      <div class="card-head"><div class="card-title">🏪 ข้อมูลรายสาขา <span class="sub">${fbKeys.length} สาขาใน Firebase</span></div></div>
      <div class="filter-bar" style="align-items:flex-end;gap:12px">
        <div style="flex:1;min-width:200px">
          <label class="flabel">🏪 เลือกสาขา</label>
          <select class="ctrl w100" id="aStoreSel" onchange="ASTORE=this.value">
            ${allOpt}${stOpts}
          </select>
        </div>
        <div style="min-width:200px">
          <label class="flabel">📅 เดือน</label>
          <select class="ctrl w100" id="aMonthSel" onchange="AMONTH=this.value">
            ${mOpts}
          </select>
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn btn-blue" onclick="loadStoreDet()">🔍 ดูข้อมูล</button>
        </div>
      </div>
    </div>
    <div id="aDet"><div class="card tc" style="padding:28px;color:var(--txt3)">เลือกสาขาและเดือน แล้วกด "ดูข้อมูล"</div></div>`;

  if(!ASTORE) ASTORE='ALL';
  loadStoreDet();
}

async function loadStoreDet(){
  const sNo=(document.getElementById('aStoreSel')?.value||ASTORE)||'ALL';
  const ym=document.getElementById('aMonthSel')?.value||AMONTH;
  ASTORE=sNo; AMONTH=ym;
  const det=document.getElementById('aDet');
  if(!det) return;
  det.innerHTML='<div class="card tc" style="padding:32px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  if(sNo==='ALL'){ await loadAllStoresDet(ym,det); }
  else { await loadSingleStoreDet(sNo,ym,det); }
}

async function loadAllStoresDet(ym, det){
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  const storeSummary=[];
  fbKeys.forEach(k=>{
    const mData=(allE[k]||{})[ym]||{};
    const found=STORES.find(s=>String(s.n)===String(k));
    const sName=found?found.name:`สาขา ${k}`;
    const f=Object.keys(mData).filter(key=>mData[key]!==null&&mData[key]!=='').length;
    const q=Object.values(mData).reduce((s,v)=>s+(parseFloat(v)||0),0);
    storeSummary.push({n:k,name:sName,filledCount:f,totalQty:q,hasData:f>0});
  });
  storeSummary.sort((a,b)=>Number(a.n)-Number(b.n));
  const withData=storeSummary.filter(s=>s.hasData);
  const totalItems=withData.reduce((s,st)=>s+st.filledCount,0);
  const totalQty=withData.reduce((s,st)=>s+st.totalQty,0);

  det.innerHTML=`
    <div class="sd-summary" style="margin-bottom:14px">
      <div class="sd-stat"><div class="sd-sv">${withData.length}</div><div class="sd-sl">สาขาที่มีข้อมูล</div></div>
      <div class="sd-stat"><div class="sd-sv">${fNum(totalItems)}</div><div class="sd-sl">รายการรวม</div></div>
      <div class="sd-stat"><div class="sd-sv" style="color:var(--amber)">${fNum(totalQty,2)}</div><div class="sd-sl">QTY รวม</div></div>
      <div class="sd-stat"><div class="sd-sv" style="font-size:16px">${ymToFull(ym)}</div><div class="sd-sl">เดือนที่ดู</div></div>
    </div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">📊 สรุปรายสาขา <span class="sub">${ymToFull(ym)}</span></div>
        <button class="btn btn-primary" onclick="exportAllStoresMonth('${ym}')">📥 Export Excel</button>
      </div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead><tr><th>สาขา</th><th>ชื่อ</th><th class="tr">รายการที่กรอก</th><th class="tr">%</th><th class="tr">QTY รวม</th></tr></thead>
          <tbody>
            ${storeSummary.map(s=>`
              <tr>
                <td class="bold num">${s.n}</td>
                <td style="font-size:12.5px">${esc(s.name)}</td>
                <td class="tr num">${s.hasData?s.filledCount:'—'}</td>
                <td class="tr">
                  ${s.hasData?`<span class="pill ${s.filledCount>=ITEMS_DATA.length?'pill-ok':s.filledCount>0?'pill-amber':'pill-no'}">${ITEMS_DATA.length>0?Math.round(s.filledCount/ITEMS_DATA.length*100):0}%</span>`:'<span class="pill pill-no">ไม่มีข้อมูล</span>'}
                </td>
                <td class="tr num">${s.hasData?fNum(s.totalQty,2):'—'}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="2" class="bold">รวม ${withData.length} สาขาที่มีข้อมูล</td>
            <td class="tr num bold">${fNum(totalItems)}</td>
            <td></td>
            <td class="tr num bold">${fNum(totalQty,2)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
}

async function loadSingleStoreDet(sNo, ym, det){
  const stData=await dbGet(`entries/${sNo}`)||{};
  const found=STORES.find(s=>String(s.n)===String(sNo));
  const sName=found?found.name:`สาขา ${sNo}`;
  const mData=stData[ym]||{};
  const filledItems=[];
  let totalFilled=0, totalQty=0;
  ITEMS_DATA.forEach(item=>{
    const v=mData[item.code];
    if(v!==null&&v!==undefined&&v!==''){
      filledItems.push({code:item.code,name:item.name,cls:item.class,no:item.no,qty:parseFloat(v)||0});
      totalFilled++;
      totalQty+=parseFloat(v)||0;
    }
  });
  const pct=ITEMS_DATA.length>0?Math.round(totalFilled/ITEMS_DATA.length*100):0;

  det.innerHTML=`
    <div class="sd-summary" style="margin-bottom:14px">
      <div class="sd-stat"><div class="sd-sv">${fNum(totalFilled)}</div><div class="sd-sl">รายการที่กรอก</div></div>
      <div class="sd-stat"><div class="sd-sv">${pct}%</div><div class="sd-sl">ความครบถ้วน</div></div>
      <div class="sd-stat"><div class="sd-sv" style="color:var(--amber)">${fNum(totalQty,2)}</div><div class="sd-sl">QTY รวม</div></div>
      <div class="sd-stat"><div class="sd-sv" style="font-size:16px">${ymToFull(ym)}</div><div class="sd-sl">เดือนที่ดู</div></div>
    </div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">📋 รายละเอียด <span class="sub">สาขา ${sNo} ${esc(sName)} · ${ymToFull(ym)}</span></div>
        <button class="btn btn-primary btn-sm" onclick="exportAdminSingleMonth('${sNo}','${ym}')">📥 Export Excel</button>
      </div>
      <div class="tbl-wrap" style="max-height:60vh">
        <table class="dtbl">
          <thead><tr><th style="width:44px">No.</th><th style="width:64px">Class</th><th style="width:96px">รหัส</th><th>ชื่อสินค้า</th><th class="tr" style="width:90px">QTY</th></tr></thead>
          <tbody>
            ${filledItems.length>0
              ? filledItems.map(r=>`<tr><td class="code-cell">${r.no}</td><td><span class="cls-badge">${esc(r.cls)}</span></td><td class="code-cell">${esc(r.code)}</td><td style="white-space:normal;line-height:1.3">${esc(r.name)}</td><td class="tr num bold">${fNum(r.qty,2)}</td></tr>`).join('')
              : '<tr><td colspan="5" class="tc muted" style="padding:20px">ไม่มีข้อมูลในเดือนนี้</td></tr>'
            }
          </tbody>
          ${filledItems.length>0?`<tfoot><tr><td colspan="4" class="bold">รวม ${totalFilled} รายการ</td><td class="tr num bold">${fNum(totalQty,2)}</td></tr></tfoot>`:''}
        </table>
      </div>
    </div>`;
}

/* ════ ADMIN EXPORTS ════ */
async function exportAllStoresMonth(ym){
  toast('กำลังสร้าง Excel...');
  const allE=await dbGet('entries')||{};
  const wb=XLSX.utils.book_new();
  const sumRows=[['สาขา','ชื่อสาขา','รายการที่กรอก','QTY รวม']];
  const detRows=[['สาขา','ชื่อสาขา','Class','รหัสสินค้า','ชื่อสินค้า','QTY']];
  Object.keys(allE).sort((a,b)=>Number(a)-Number(b)).forEach(k=>{
    const mData=(allE[k]||{})[ym]||{};
    const found=STORES.find(s=>String(s.n)===String(k));
    const sName=found?found.name:`สาขา ${k}`;
    let f=0,q=0;
    ITEMS_DATA.forEach(item=>{
      const v=mData[item.code];
      if(v!==null&&v!==undefined&&v!==''){
        detRows.push([k,sName,item.class,item.code,item.name,parseFloat(v)||0]);
        f++;q+=parseFloat(v)||0;
      }
    });
    if(f>0) sumRows.push([k,sName,f,q]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(sumRows),'Summary');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(detRows),'Detail');
  XLSX.writeFile(wb,`BakeryStock_AllStores_${ym}.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

async function exportAdminSingleMonth(sNo,ym){
  toast('กำลังสร้าง Excel...');
  const mData=await dbGet(`entries/${sNo}/${ym}`)||{};
  const found=STORES.find(s=>String(s.n)===String(sNo));
  const sName=found?found.name:`สาขา ${sNo}`;
  const wb=XLSX.utils.book_new();
  const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า','QTY']];
  ITEMS_DATA.forEach(i=>{const v=mData[i.code];rows.push([i.no,i.class,i.code,i.name,v!=null&&v!==''?Number(v):'']);});
  const ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,ym);
  XLSX.writeFile(wb,`BakeryStock_ST${sNo}_${ym}.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

/* ════ CLEAR ALL ════ */
function renderClearAll(){
  setTB('ล้างข้อมูล','⚠️ อันตราย');
  document.getElementById('content').innerHTML=`
    <div class="card" style="border-color:rgba(224,50,68,.25)">
      <div class="card-head"><div class="card-title" style="color:var(--red)">🗑️ ล้างข้อมูลทั้งหมด</div></div>
      <p style="color:var(--txt2);margin-bottom:16px">การดำเนินการนี้จะลบข้อมูลการตรวจนับ <b>ทั้งหมด</b> รวมถึง Month Control ออกจาก Firebase อย่างถาวร</p>
      <button class="btn btn-danger" onclick="confirmClearAll()">🗑️ ล้างข้อมูลทั้งหมด</button>
    </div>`;
}
function confirmClearAll(){showModal(`<h3 style="color:var(--red)">⚠️ ยืนยันการล้างข้อมูล</h3><p style="color:var(--txt2);margin-top:8px">กรุณาพิมพ์ <b>DELETE</b> เพื่อยืนยัน</p><input type="text" id="cInp" style="width:100%;margin-top:12px;padding:11px 13px;border-radius:var(--r8);border:1.5px solid var(--border);font-size:14px" placeholder="พิมพ์ DELETE"><div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button><button class="btn btn-danger" onclick="doClear()">ลบทั้งหมด</button></div>`);}
async function doClear(){
  if(document.getElementById('cInp').value.trim()!=='DELETE'){toast('พิมพ์ DELETE ให้ถูกต้อง','err');return;}
  try{
    await dbRemove('entries');
    await dbRemove('logs');
    await dbRemove('monthControl');
    closeModal();toast('ล้างข้อมูลแล้ว','ok');
  }catch(e){toast('Error: '+e.message,'err');}
}

/* ════ BOOTSTRAP ════ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  await loadMasterDataFromFB(); // [NEW] override items/stores from Firebase if admin has updated
  if(typeof LOGO_URI!=='undefined'){
    document.getElementById('loginLogo').src=LOGO_URI;
    document.getElementById('sbLogo').src=LOGO_URI;
  }
  initLogin();
  document.getElementById('menuBtn').addEventListener('click',()=>{
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sbBd').classList.add('show');
  });
  document.getElementById('sbBd').addEventListener('click',closeSB);
  const ses=loadSes();
  if(ses){SES=ses;startApp();}
});

/* ════════════════════════════════════════════
   [NEW v5.1] MASTER DATA — Firebase path:
   masterData/items/{index}  (Array)
   masterData/stores/{index} (Array)
   ════════════════════════════════════════════ */

/* ── โหลด masterData จาก Firebase (ถ้ามี override data.json) ── */
async function loadMasterDataFromFB() {
  try {
    const md = await dbGet('masterData');
    if (md) {
      if (md.items && Array.isArray(md.items) && md.items.length > 0) {
        ITEMS_DATA = md.items;
        ALL_CLS = ['ALL', ...new Set(ITEMS_DATA.map(i => i.class).filter(Boolean))]
          .sort((a, b) => {
            if (a === 'ALL') return -1; if (b === 'ALL') return 1;
            const na = Number(a), nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          });
        console.log('[FB masterData] items overridden:', ITEMS_DATA.length);
      }
      if (md.stores && Array.isArray(md.stores) && md.stores.length > 0) {
        STORES = md.stores;
        console.log('[FB masterData] stores overridden:', STORES.length);
      }
    }
  } catch (e) {
    console.warn('loadMasterDataFromFB error:', e.message);
  }
}

/* ════════════════════════════════════════════
   [NEW] STORE: Export Template Excel (ก่อนบันทึก)
   — Export รายการสินค้าทั้งหมด โดยไม่มีข้อมูล QTY
   ════════════════════════════════════════════ */
function exportStoreTemplate() {
  toast('กำลังสร้าง Excel Template...');
  const wb = XLSX.utils.book_new();
  const rows = [
    ['ลำดับ', 'Class', 'รหัสสินค้า', 'ชื่อสินค้า', 'QTY (กรอกเอง)']
  ];
  ITEMS_DATA.forEach(i => {
    rows.push([i.no, i.class, i.code, i.name, '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // กำหนดความกว้างคอลัมน์
  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 48 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'รายการสินค้า');
  XLSX.writeFile(wb, `BakeryTemplate_ST${SES.no}_${currentYM()}.xlsx`);
  toast('Export Template สำเร็จ ✅', 'ok');
}

/* ════════════════════════════════════════════
   [NEW] ADMIN: จัดการ Items (เพิ่ม / แก้ไข / ลบ)
   ════════════════════════════════════════════ */
let ITEM_SEARCH_Q = '';

function renderManageItems() {
  setTB('จัดการรายการสินค้า', 'Admin — Items');
  const C = document.getElementById('content');
  buildManageItemsView(C);
}

function buildManageItemsView(C) {
  const filtered = ITEM_SEARCH_Q
    ? ITEMS_DATA.filter(i =>
        i.code.toLowerCase().includes(ITEM_SEARCH_Q.toLowerCase()) ||
        i.name.toLowerCase().includes(ITEM_SEARCH_Q.toLowerCase()) ||
        String(i.class).includes(ITEM_SEARCH_Q))
    : ITEMS_DATA;

  const rows = filtered.map((it, idx) => `
    <tr>
      <td class="code-cell">${it.no}</td>
      <td><span class="cls-badge">${esc(String(it.class))}</span></td>
      <td class="code-cell">${esc(it.code)}</td>
      <td style="white-space:normal;line-height:1.35;max-width:320px">${esc(it.name)}</td>
      <td class="tr" style="white-space:nowrap">
        <button class="btn btn-secondary btn-xs" onclick="showEditItemModal(${ITEMS_DATA.indexOf(it)})">✏️ แก้ไข</button>
        <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:1px solid rgba(224,50,68,.2);cursor:pointer;padding:3px 8px;border-radius:var(--r8);font-size:11px;font-weight:600" onclick="confirmDeleteItem(${ITEMS_DATA.indexOf(it)})">🗑️ ลบ</button>
      </td>
    </tr>`).join('');

  C.innerHTML = `
    <div class="card" style="margin-bottom:14px;border-left:4px solid var(--blue)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:36px">📦</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--txt)">จัดการรายการสินค้า</div>
          <div style="font-size:13px;color:var(--txt3);margin-top:4px">เพิ่ม แก้ไข หรือลบรายการสินค้าที่แสดงในทุกสาขา · <b style="color:var(--blue)">${ITEMS_DATA.length} รายการ</b></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">📦 รายการสินค้าทั้งหมด <span class="sub">${ITEMS_DATA.length} รายการ</span></div>
        <div class="flex gap8 items-c">
          <button class="btn btn-blue" onclick="showAddItemModal()">➕ เพิ่มสินค้า</button>
          <button class="btn btn-secondary btn-sm" onclick="renderManageItems()">🔄 รีเฟรช</button>
        </div>
      </div>

      <div class="filter-bar" style="margin-bottom:12px">
        <div class="flex-1">
          <label class="flabel">🔍 ค้นหาสินค้า</label>
          <div class="search-wrap">
            <span class="search-ico">🔍</span>
            <input type="text" class="ctrl" id="itemSearchInp" placeholder="ชื่อสินค้า, รหัส, Class..." value="${esc(ITEM_SEARCH_Q)}"
              oninput="ITEM_SEARCH_Q=this.value;buildManageItemsView(document.getElementById('content'))">
          </div>
        </div>
      </div>

      <div style="margin-bottom:10px;padding:10px 14px;background:var(--warn-bg);border-radius:var(--r8);border:1px solid rgba(212,139,10,.2);font-size:12.5px;color:var(--warn)">
        ⚠️ <b>การเปลี่ยนแปลงจะมีผลทันทีกับทุกสาขา</b> — ข้อมูลจะถูกบันทึกลง Firebase และโหลดใหม่อัตโนมัติเมื่อ Login ครั้งถัดไป
      </div>

      <div class="tbl-wrap" style="max-height:65vh">
        <table class="dtbl">
          <thead>
            <tr>
              <th style="width:44px">No.</th>
              <th style="width:68px">Class</th>
              <th style="width:104px">รหัส</th>
              <th>ชื่อสินค้า</th>
              <th style="width:120px;text-align:right">จัดการ</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" class="tc muted" style="padding:28px">ไม่พบรายการ</td></tr>'}</tbody>
          <tfoot>
            <tr><td colspan="5" class="tr" style="font-size:12px;color:var(--txt3)">แสดง ${filtered.length} / ${ITEMS_DATA.length} รายการ</td></tr>
          </tfoot>
        </table>
      </div>
    </div>`;
}

function showAddItemModal() {
  const clsOptions = [...new Set(ITEMS_DATA.map(i => i.class).filter(Boolean))]
    .sort((a, b) => { const na = Number(a), nb = Number(b); return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b); })
    .map(c => `<option value="${c}">Class ${c}</option>`).join('');
  const nextNo = ITEMS_DATA.length > 0 ? Math.max(...ITEMS_DATA.map(i => Number(i.no) || 0)) + 1 : 1;

  showModal(`
    <h3>➕ เพิ่มรายการสินค้าใหม่</h3>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <div>
        <label class="flabel">Class <span style="color:var(--red)">*</span></label>
        <div style="display:flex;gap:8px">
          <select class="ctrl" id="mi_cls" style="flex:1">${clsOptions}</select>
          <input type="text" class="ctrl" id="mi_cls_new" placeholder="หรือพิมพ์ Class ใหม่" style="flex:1">
        </div>
        <div style="font-size:11px;color:var(--txt3);margin-top:3px">เลือก Class ที่มีอยู่ หรือพิมพ์ Class ใหม่ในช่องขวา</div>
      </div>
      <div>
        <label class="flabel">รหัสสินค้า <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="mi_code" placeholder="เช่น 123456">
      </div>
      <div>
        <label class="flabel">ชื่อสินค้า <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="mi_name" placeholder="ชื่อสินค้า">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-blue" onclick="doAddItem(${nextNo})">➕ เพิ่มสินค้า</button>
    </div>`);
}

async function doAddItem(nextNo) {
  const clsSel = document.getElementById('mi_cls').value.trim();
  const clsNew = document.getElementById('mi_cls_new').value.trim();
  const cls = clsNew || clsSel;
  const code = document.getElementById('mi_code').value.trim();
  const name = document.getElementById('mi_name').value.trim();
  if (!cls || !code || !name) { toast('กรุณากรอกข้อมูลให้ครบถ้วน', 'err'); return; }
  if (ITEMS_DATA.find(i => i.code === code)) { toast('รหัสสินค้านี้มีอยู่แล้ว', 'err'); return; }
  const newItem = { no: nextNo, class: cls, code, name };
  const newItems = [...ITEMS_DATA, newItem];
  closeModal();
  await saveMasterItems(newItems, `เพิ่มสินค้า ${code} — ${name} แล้ว ✅`);
}

function showEditItemModal(idx) {
  const it = ITEMS_DATA[idx];
  if (!it) return;
  const clsOptions = [...new Set(ITEMS_DATA.map(i => i.class).filter(Boolean))]
    .sort((a, b) => { const na = Number(a), nb = Number(b); return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b); })
    .map(c => `<option value="${c}" ${c === String(it.class) ? 'selected' : ''}>Class ${c}</option>`).join('');

  showModal(`
    <h3>✏️ แก้ไขสินค้า</h3>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <div>
        <label class="flabel">Class <span style="color:var(--red)">*</span></label>
        <div style="display:flex;gap:8px">
          <select class="ctrl" id="ei_cls" style="flex:1">${clsOptions}</select>
          <input type="text" class="ctrl" id="ei_cls_new" placeholder="พิมพ์ Class ใหม่" style="flex:1">
        </div>
      </div>
      <div>
        <label class="flabel">รหัสสินค้า</label>
        <input type="text" class="ctrl w100" id="ei_code" value="${esc(it.code)}" readonly style="background:var(--surface2);color:var(--txt3)">
      </div>
      <div>
        <label class="flabel">ชื่อสินค้า <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="ei_name" value="${esc(it.name)}">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-blue" onclick="doEditItem(${idx})">💾 บันทึกการแก้ไข</button>
    </div>`);
}

async function doEditItem(idx) {
  const clsSel = document.getElementById('ei_cls').value.trim();
  const clsNew = document.getElementById('ei_cls_new').value.trim();
  const cls = clsNew || clsSel;
  const name = document.getElementById('ei_name').value.trim();
  if (!cls || !name) { toast('กรุณากรอกข้อมูลให้ครบถ้วน', 'err'); return; }
  const newItems = ITEMS_DATA.map((it, i) => i === idx ? { ...it, class: cls, name } : it);
  closeModal();
  await saveMasterItems(newItems, `แก้ไขสินค้า ${ITEMS_DATA[idx].code} แล้ว ✅`);
}

function confirmDeleteItem(idx) {
  const it = ITEMS_DATA[idx];
  showModal(`
    <h3 style="color:var(--red)">🗑️ ยืนยันการลบสินค้า</h3>
    <p style="color:var(--txt2);margin-top:10px">
      ต้องการลบสินค้า <b>${esc(it.code)} — ${esc(it.name)}</b> ใช่หรือไม่?<br>
      <span style="color:var(--txt3);font-size:12px">⚠️ ข้อมูลที่สาขาบันทึกไว้จะยังคงอยู่ แต่จะไม่แสดงในรายการอีกต่อไป</span>
    </p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-danger" onclick="doDeleteItem(${idx})">🗑️ ลบสินค้า</button>
    </div>`);
}

async function doDeleteItem(idx) {
  const it = ITEMS_DATA[idx];
  const newItems = ITEMS_DATA.filter((_, i) => i !== idx)
    .map((item, i) => ({ ...item, no: i + 1 }));
  closeModal();
  await saveMasterItems(newItems, `ลบสินค้า ${it.code} แล้ว`);
}

async function saveMasterItems(newItems, successMsg) {
  try {
    await dbSet('masterData/items', newItems);
    ITEMS_DATA = newItems;
    ALL_CLS = ['ALL', ...new Set(ITEMS_DATA.map(i => i.class).filter(Boolean))]
      .sort((a, b) => {
        if (a === 'ALL') return -1; if (b === 'ALL') return 1;
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
    toast(successMsg || 'บันทึกแล้ว ✅', 'ok');
    buildManageItemsView(document.getElementById('content'));
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'err');
  }
}

/* ════════════════════════════════════════════
   [NEW] ADMIN: จัดการ Stores (เพิ่มสาขาใหม่)
   ════════════════════════════════════════════ */
let STORE_SEARCH_Q = '';

function renderManageStores() {
  setTB('จัดการสาขา', 'Admin — Stores');
  const C = document.getElementById('content');
  buildManageStoresView(C);
}

function buildManageStoresView(C) {
  const filtered = STORE_SEARCH_Q
    ? STORES.filter(s =>
        String(s.n).includes(STORE_SEARCH_Q) ||
        s.name.toLowerCase().includes(STORE_SEARCH_Q.toLowerCase()) ||
        (s.u || '').toLowerCase().includes(STORE_SEARCH_Q.toLowerCase()))
    : STORES;

  const rows = filtered.map((s) => `
    <tr>
      <td class="bold num">${s.n}</td>
      <td>${esc(s.name)}</td>
      <td class="code-cell">${esc(s.u)}</td>
      <td class="code-cell">${esc(s.p)}</td>
      <td class="tr" style="white-space:nowrap">
        <button class="btn btn-secondary btn-xs" onclick="showEditStoreModal('${s.n}')">✏️ แก้ไข</button>
        <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:1px solid rgba(224,50,68,.2);cursor:pointer;padding:3px 8px;border-radius:var(--r8);font-size:11px;font-weight:600" onclick="confirmDeleteStore('${s.n}')">🗑️ ลบ</button>
      </td>
    </tr>`).join('');

  C.innerHTML = `
    <div class="card" style="margin-bottom:14px;border-left:4px solid var(--amber)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:36px">🏪</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--txt)">จัดการสาขา</div>
          <div style="font-size:13px;color:var(--txt3);margin-top:4px">เพิ่ม แก้ไข หรือลบสาขา · <b style="color:var(--amber)">${STORES.length} สาขา</b></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">🏪 รายการสาขาทั้งหมด <span class="sub">${STORES.length} สาขา</span></div>
        <div class="flex gap8 items-c">
          <button class="btn btn-blue" onclick="showAddStoreModal()">➕ เพิ่มสาขาใหม่</button>
          <button class="btn btn-secondary btn-sm" onclick="renderManageStores()">🔄 รีเฟรช</button>
        </div>
      </div>

      <div class="filter-bar" style="margin-bottom:12px">
        <div class="flex-1">
          <label class="flabel">🔍 ค้นหาสาขา</label>
          <div class="search-wrap">
            <span class="search-ico">🔍</span>
            <input type="text" class="ctrl" id="storeSearchInp" placeholder="เลขสาขา, ชื่อสาขา, Username..."
              value="${esc(STORE_SEARCH_Q)}"
              oninput="STORE_SEARCH_Q=this.value;buildManageStoresView(document.getElementById('content'))">
          </div>
        </div>
      </div>

      <div style="margin-bottom:10px;padding:10px 14px;background:var(--warn-bg);border-radius:var(--r8);border:1px solid rgba(212,139,10,.2);font-size:12.5px;color:var(--warn)">
        ⚠️ <b>สาขาที่เพิ่มใหม่จาก Firebase จะ Login และใช้งานได้เหมือนสาขาเดิมทุกประการ</b>
      </div>

      <div class="tbl-wrap" style="max-height:65vh">
        <table class="dtbl">
          <thead>
            <tr>
              <th style="width:60px">เลขสาขา</th>
              <th>ชื่อสาขา</th>
              <th style="width:110px">Username</th>
              <th style="width:100px">Password</th>
              <th style="width:120px;text-align:right">จัดการ</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" class="tc muted" style="padding:28px">ไม่พบสาขา</td></tr>'}</tbody>
          <tfoot>
            <tr><td colspan="5" class="tr" style="font-size:12px;color:var(--txt3)">แสดง ${filtered.length} / ${STORES.length} สาขา</td></tr>
          </tfoot>
        </table>
      </div>
    </div>`;
}

function showAddStoreModal() {
  showModal(`
    <h3>➕ เพิ่มสาขาใหม่</h3>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <div>
        <label class="flabel">เลขสาขา <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="as_n" placeholder="เช่น 999" oninput="autoFillStoreUser()">
        <div style="font-size:11px;color:var(--txt3);margin-top:3px">ตัวเลข เช่น 11, 999 — จะใช้เป็น store011, store999</div>
      </div>
      <div>
        <label class="flabel">ชื่อสาขา <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="as_name" placeholder="เช่น พิษณุโลก">
      </div>
      <div>
        <label class="flabel">Username <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="as_u" placeholder="store011">
        <div style="font-size:11px;color:var(--txt3);margin-top:3px">กรอกเลขสาขาแล้ว Username จะถูกสร้างอัตโนมัติ</div>
      </div>
      <div>
        <label class="flabel">Password <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="as_p" value="welcome1" placeholder="welcome1">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-blue" onclick="doAddStore()">➕ เพิ่มสาขา</button>
    </div>`);
}

function autoFillStoreUser() {
  const nVal = document.getElementById('as_n')?.value.trim();
  const uInp = document.getElementById('as_u');
  if (nVal && uInp) {
    uInp.value = 'store' + String(nVal).padStart(3, '0');
  }
}

async function doAddStore() {
  const n = document.getElementById('as_n').value.trim();
  const name = document.getElementById('as_name').value.trim();
  const u = document.getElementById('as_u').value.trim().toLowerCase();
  const p = document.getElementById('as_p').value.trim();
  if (!n || !name || !u || !p) { toast('กรุณากรอกข้อมูลให้ครบถ้วน', 'err'); return; }
  if (STORES.find(s => String(s.n) === String(n))) { toast('เลขสาขา ' + n + ' มีอยู่แล้ว', 'err'); return; }
  if (STORES.find(s => s.u === u)) { toast('Username "' + u + '" มีอยู่แล้ว', 'err'); return; }
  const newStore = { n, name, u, p };
  const newStores = [...STORES, newStore].sort((a, b) => Number(a.n) - Number(b.n));
  closeModal();
  await saveMasterStores(newStores, `เพิ่มสาขา ${n} ${name} แล้ว ✅`);
}

function showEditStoreModal(storeN) {
  const s = STORES.find(st => String(st.n) === String(storeN));
  if (!s) return;
  showModal(`
    <h3>✏️ แก้ไขสาขา ${s.n}</h3>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <div>
        <label class="flabel">เลขสาขา</label>
        <input type="text" class="ctrl w100" value="${esc(String(s.n))}" readonly style="background:var(--surface2);color:var(--txt3)">
      </div>
      <div>
        <label class="flabel">ชื่อสาขา <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="es_name" value="${esc(s.name)}">
      </div>
      <div>
        <label class="flabel">Username</label>
        <input type="text" class="ctrl w100" value="${esc(s.u)}" readonly style="background:var(--surface2);color:var(--txt3)">
      </div>
      <div>
        <label class="flabel">Password <span style="color:var(--red)">*</span></label>
        <input type="text" class="ctrl w100" id="es_p" value="${esc(s.p)}">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-blue" onclick="doEditStore('${s.n}')">💾 บันทึก</button>
    </div>`);
}

async function doEditStore(storeN) {
  const name = document.getElementById('es_name').value.trim();
  const p = document.getElementById('es_p').value.trim();
  if (!name || !p) { toast('กรุณากรอกข้อมูลให้ครบถ้วน', 'err'); return; }
  const newStores = STORES.map(s => String(s.n) === String(storeN) ? { ...s, name, p } : s);
  closeModal();
  await saveMasterStores(newStores, `แก้ไขสาขา ${storeN} แล้ว ✅`);
}

function confirmDeleteStore(storeN) {
  const s = STORES.find(st => String(st.n) === String(storeN));
  showModal(`
    <h3 style="color:var(--red)">🗑️ ยืนยันการลบสาขา</h3>
    <p style="color:var(--txt2);margin-top:10px">
      ต้องการลบสาขา <b>${s.n} — ${esc(s.name)}</b> ใช่หรือไม่?<br>
      <span style="color:var(--txt3);font-size:12px">⚠️ ข้อมูลการบันทึกของสาขานี้ใน Firebase จะยังคงอยู่</span>
    </p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-danger" onclick="doDeleteStore('${storeN}')">🗑️ ลบสาขา</button>
    </div>`);
}

async function doDeleteStore(storeN) {
  const s = STORES.find(st => String(st.n) === String(storeN));
  const newStores = STORES.filter(st => String(st.n) !== String(storeN));
  closeModal();
  await saveMasterStores(newStores, `ลบสาขา ${storeN} ${s ? s.name : ''} แล้ว`);
}

async function saveMasterStores(newStores, successMsg) {
  try {
    await dbSet('masterData/stores', newStores);
    STORES = newStores;
    toast(successMsg || 'บันทึกแล้ว ✅', 'ok');
    buildManageStoresView(document.getElementById('content'));
  } catch (e) {
    toast('เกิดข้อผิดพลาด: ' + e.message, 'err');
  }
}
