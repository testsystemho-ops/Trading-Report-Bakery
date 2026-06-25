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
  {id:'dashboard',   ico:'📊', lbl:'แดชบอร์ด & ภาพรวม'},
  {id:'monthcontrol',ico:'📅', lbl:'จัดการเดือน (Month Control)'},
  {id:'storedata',   ico:'🏪', lbl:'ดูข้อมูลรายสาขา'},
  {id:'clearall',    ico:'🗑️', lbl:'ล้างข้อมูล'}
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
function go(id){CURVIEW=id;setActive(id);({dashboard:renderDashboard,entry:renderEntry,history:renderHistory,storedata:renderStoreData,monthcontrol:renderMonthControl,clearall:renderClearAll}[id]||function(){})();}

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

/* สร้างรายการ 12 เดือนย้อนหลัง + 3 เดือนล่วงหน้า */
function generateMonthList(){
  const list=[];
  const now=new Date();
  for(let i=12; i>=-3; i--){
    const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym=`${d.getFullYear()}-${p2(d.getMonth()+1)}`;
    list.push(ym);
  }
  return list;
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

  const allD = await dbGet(`entries/${SES.no}`) || {};
  const monthList = generateMonthList().reverse(); // เรียงใหม่สุดก่อน

  // คำนวณสถิติแต่ละเดือน
  const monthStats = monthList.map(ym => {
    const mData = allD[ym] || {};
    const filledCount = Object.keys(mData).filter(k => mData[k] !== null && mData[k] !== undefined && mData[k] !== '').length;
    const totalQty = Object.values(mData).reduce((s,v) => s + (parseFloat(v)||0), 0);
    return { ym, filledCount, totalQty, hasData: filledCount > 0 };
  });

  // เดือนปัจจุบัน
  const curYM = currentYM();
  const curStat = monthStats.find(m => m.ym === curYM) || { filledCount:0, totalQty:0 };
  const total = ITEMS_DATA.length;

  // check month active status
  const mc = await getMonthControl();
  const curActive = mc[curYM] && mc[curYM].active === true;

  // สร้างกราฟ SVG bar chart (12 เดือนล่าสุด)
  const chartMonths = monthStats.slice(0, 12).reverse();
  const maxQty = Math.max(...chartMonths.map(m => m.totalQty), 1);
  const maxItems = Math.max(...chartMonths.map(m => m.filledCount), 1);
  const barChart = buildBarChart(chartMonths, maxQty, maxItems, curYM);

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
        <div class="hero-val num">${fNum(curStat.filledCount)}<span style="font-size:22px;opacity:.65"> / ${fNum(total)}</span></div>
        <div class="hero-hint">${ymToFull(curYM)} · BAKERY GRP.68,78 · ${curActive?'<span style="color:#7DFFD0">✅ เปิดบันทึก</span>':'<span style="color:#FFCDD2">🔒 ยังไม่เปิด</span>'}</div>
      </div>
      <div class="hero-badge">BAKERY</div>
    </div>

    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card amber">
        <div class="kpi-lbl">✅ กรอกแล้วเดือนนี้</div>
        <div class="kpi-val">${fNum(curStat.filledCount)}</div>
        <div class="kpi-hint">/ ${fNum(total)} รายการ</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">📦 QTY รวมเดือนนี้</div>
        <div class="kpi-val">${fNum(curStat.totalQty,2)}</div>
        <div class="kpi-hint">รวมทุกรายการ</div>
      </div>
      <div class="kpi-card ${curActive?'green':'red'}">
        <div class="kpi-lbl">📅 สถานะเดือนนี้</div>
        <div class="kpi-val" style="font-size:20px">${curActive?'✅':'🔒'}</div>
        <div class="kpi-hint">${curActive?'เปิดบันทึกแล้ว':'ยังไม่เปิด'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">🏪 สาขา</div>
        <div class="kpi-val" style="font-size:20px">${SES.no}</div>
        <div class="kpi-hint">${esc(SES.name)}</div>
      </div>
    </div>

    <div class="prog-card" style="margin-bottom:16px">
      <div class="prog-head">
        <div><div class="prog-title">ความครบถ้วนเดือนนี้</div><div class="prog-sub">สาขา ${SES.no} — ${esc(SES.name)}</div></div>
        <div class="prog-pct">${total>0?Math.round(curStat.filledCount/total*100):0}%</div>
      </div>
      <div class="prog-track"><div class="prog-fill" style="width:${total>0?Math.min(100,Math.round(curStat.filledCount/total*100)):0}%"></div></div>
      <div class="prog-labels"><span>0 รายการ</span><span>${fNum(total)} รายการ</span></div>
    </div>

    <!-- กราฟรายเดือน -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div class="card-title">📊 สถิติรายเดือน <span class="sub">12 เดือนล่าสุด</span></div>
      </div>
      ${barChart}
    </div>

    <button class="btn btn-primary" onclick="go('entry')" ${!curActive?'disabled title="Admin ยังไม่เปิดเดือนนี้"':''} style="${!curActive?'opacity:.55;cursor:not-allowed':''}">
      📝 ${curActive?'เริ่มบันทึกการตรวจนับ':'รอ Admin เปิดเดือนก่อนบันทึก'}
    </button>`;
}

/* ════ BAR CHART SVG ════ */
function buildBarChart(months, maxQty, maxItems, curYM){
  if(!months.length) return '<p style="color:var(--txt3);text-align:center;padding:20px">ยังไม่มีข้อมูล</p>';
  const W=600, H=220, PAD_L=40, PAD_B=50, PAD_T=20, PAD_R=10;
  const chartW=W-PAD_L-PAD_R, chartH=H-PAD_B-PAD_T;
  const n=months.length;
  const bGroup=chartW/n;
  const bW=Math.min(bGroup*0.38,24);
  const gap=bGroup*0.06;

  let bars='', labels='', legend='';
  months.forEach((m,i)=>{
    const x=PAD_L+i*bGroup+bGroup/2;
    const hItems=maxItems>0?Math.round((m.filledCount/maxItems)*chartH):0;
    const hQty=maxQty>0?Math.round((m.totalQty/maxQty)*chartH):0;
    const isCur=m.ym===curYM;

    // bar items (blue)
    const bx1=x-bW-gap/2;
    const by1=PAD_T+chartH-hItems;
    bars+=`<rect x="${bx1}" y="${by1}" width="${bW}" height="${hItems}" rx="3"
      fill="${isCur?'#0B5FB4':'#3B83D4'}" opacity="${isCur?1:0.75}">
      <title>${ymToThai(m.ym)}: ${fNum(m.filledCount)} รายการ</title></rect>`;

    // bar qty (amber)
    const bx2=x+gap/2;
    const by2=PAD_T+chartH-hQty;
    bars+=`<rect x="${bx2}" y="${by2}" width="${bW}" height="${hQty}" rx="3"
      fill="${isCur?'#E07B2A':'#F09550'}" opacity="${isCur?1:0.75}">
      <title>${ymToThai(m.ym)}: QTY ${fNum(m.totalQty,0)}</title></rect>`;

    // label
    const labelY=PAD_T+chartH+16;
    labels+=`<text x="${x}" y="${labelY}" text-anchor="middle" font-size="9.5" fill="${isCur?'#0B5FB4':'#6B7A90'}" font-weight="${isCur?'700':'400'}">${ymToThai(m.ym)}</text>`;

    // value on top of bar (only if has data & not too small)
    if(m.filledCount>0&&hItems>18){
      bars+=`<text x="${bx1+bW/2}" y="${by1-4}" text-anchor="middle" font-size="9" fill="#0B5FB4" font-weight="700">${fNum(m.filledCount)}</text>`;
    }
  });

  // Y axis gridlines
  let grid='';
  for(let g=0;g<=4;g++){
    const gy=PAD_T+chartH*(1-g/4);
    grid+=`<line x1="${PAD_L}" y1="${gy}" x2="${W-PAD_R}" y2="${gy}" stroke="#DDE3EC" stroke-width="1"/>`;
    if(g>0){
      const val=Math.round(maxItems*g/4);
      grid+=`<text x="${PAD_L-4}" y="${gy+4}" text-anchor="end" font-size="9" fill="#9AABBE">${fNum(val)}</text>`;
    }
  }

  legend=`
    <div style="display:flex;gap:18px;margin-top:10px;justify-content:center;font-size:12px;color:var(--txt3)">
      <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#0B5FB4"></span>จำนวนรายการ (SKU)</span>
      <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#E07B2A"></span>QTY รวม (สัดส่วน)</span>
      <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#0B5FB4;opacity:.4"></span>เดือนปัจจุบัน = สีเข้ม</span>
    </div>`;

  return `
    <div style="overflow-x:auto">
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:360px;max-width:100%;display:block">
        <defs>
          <linearGradient id="bgGrid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F7F9FC"/>
            <stop offset="100%" stop-color="#FFFFFF"/>
          </linearGradient>
        </defs>
        <rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="url(#bgGrid)" rx="4"/>
        ${grid}
        ${bars}
        ${labels}
        <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+chartH}" stroke="#DDE3EC" stroke-width="1"/>
        <line x1="${PAD_L}" y1="${PAD_T+chartH}" x2="${W-PAD_R}" y2="${PAD_T+chartH}" stroke="#DDE3EC" stroke-width="1"/>
      </svg>
    </div>
    ${legend}`;
}

/* ════════════════════════════════════════════
   MONTH CONTROL (Admin)
════════════════════════════════════════════ */
async function renderMonthControl(){
  setTB('จัดการเดือน','Month Control — Admin');
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const mc = await getMonthControl();
  const months = generateMonthList();
  const curYM = currentYM();

  const rows = months.map(ym => {
    const isActive = mc[ym] && mc[ym].active === true;
    const isCur = ym === curYM;
    return `
      <tr ${isCur?'style="background:var(--blue-xxl)"':''}>
        <td>
          <span class="num" style="font-weight:${isCur?'800':'500'};color:${isCur?'var(--blue)':'var(--txt)'}">${ym}</span>
          ${isCur?'<span class="pill pill-info" style="margin-left:6px;font-size:10px">เดือนปัจจุบัน</span>':''}
        </td>
        <td><b style="color:var(--txt2)">${ymToFull(ym)}</b></td>
        <td>
          <span class="pill ${isActive?'pill-ok':'pill-no'}">
            ${isActive?'✅ Active (เปิดบันทึก)':'🔒 Inactive (ปิดบันทึก)'}
          </span>
        </td>
        <td class="tr">
          ${isActive
            ? `<button class="btn btn-sm" style="background:var(--red-bg);color:var(--red);border-color:rgba(224,50,68,.2)" onclick="toggleMonth('${ym}',false)">🔒 ปิด (Inactive)</button>`
            : `<button class="btn btn-blue btn-sm" onclick="toggleMonth('${ym}',true)">✅ เปิด (Active)</button>`
          }
        </td>
      </tr>`;
  }).join('');

  C.innerHTML=`
    <div class="card" style="margin-bottom:14px;border-left:4px solid var(--blue)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:36px">📅</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--txt)">Month Control — จัดการเดือนที่เปิดรับบันทึก</div>
          <div style="font-size:13px;color:var(--txt3);margin-top:4px">
            Admin สามารถกำหนดได้ว่าเดือนไหน <b style="color:var(--green)">Active</b> (User สาขาบันทึกได้) หรือ <b style="color:var(--red)">Inactive</b> (ปิด — สาขาดูได้แต่บันทึกไม่ได้)
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">📋 รายการเดือน <span class="sub">15 เดือน (ย้อนหลัง 12 + ล่วงหน้า 3)</span></div>
        <button class="btn btn-blue btn-sm" onclick="renderMonthControl()">🔄 รีเฟรช</button>
      </div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead>
            <tr>
              <th>เดือน (YYYY-MM)</th>
              <th>ชื่อเดือน</th>
              <th>สถานะ</th>
              <th class="tr">Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:14px;padding:12px 16px;background:var(--warn-bg);border-radius:var(--r12);border:1px solid rgba(212,139,10,.20);font-size:13px;color:var(--warn)">
        ⚠️ <b>หมายเหตุ:</b> เมื่อปิดเดือน (Inactive) User สาขาจะยังคงดูข้อมูลและ Export ได้ตามปกติ แต่จะไม่สามารถบันทึกหรือแก้ไขข้อมูลในเดือนนั้นได้
      </div>
    </div>`;
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
    renderMonthControl();
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
        <button class="btn btn-primary" onclick="exportStoreAll()">📥 Export ทั้งหมด</button>
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
  const months = generateMonthList().reverse(); // newest first

  // สร้างสถิติรายเดือน
  const monthStats = months.slice(0,12).map(ym=>{
    let totalStores=0, totalItems=0, totalQty=0;
    Object.keys(allE).forEach(sNo=>{
      const mData=allE[sNo][ym]||{};
      const f=Object.keys(mData).filter(k=>mData[k]!==null&&mData[k]!=='').length;
      if(f>0){
        totalStores++;
        totalItems+=f;
        totalQty+=Object.values(mData).reduce((s,v)=>s+(parseFloat(v)||0),0);
      }
    });
    return{ym,totalStores,totalItems,totalQty,active:mc[ym]&&mc[ym].active===true};
  });

  // เดือนปัจจุบัน
  const curStat=monthStats.find(m=>m.ym===curYM)||{totalStores:0,totalItems:0,totalQty:0};
  const totalStores=STORES.length;
  const sentPct=totalStores>0?Math.round(curStat.totalStores/totalStores*100):0;

  // กราฟ admin
  const adminChart = buildAdminBarChart(monthStats.slice(0,12).reverse(), curYM);

  C.innerHTML=`
    <!-- Status เดือนปัจจุบัน -->
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:220px;border-left:4px solid ${curActive?'var(--green)':'var(--red)'}">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:32px">${curActive?'✅':'🔒'}</div>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--txt)">เดือนปัจจุบัน: ${ymToFull(curYM)}</div>
            <div style="font-size:12px;color:${curActive?'var(--green)':'var(--red)'};font-weight:700;margin-top:3px">${curActive?'Active — สาขาบันทึกได้':'Inactive — สาขายังบันทึกไม่ได้'}</div>
            <button class="btn btn-sm" style="margin-top:8px;${curActive?'background:var(--red-bg);color:var(--red);border-color:rgba(224,50,68,.2)':'background:var(--green-bg);color:var(--green);border-color:rgba(13,159,110,.2)'}" onclick="toggleMonth('${curYM}',${!curActive})">
              ${curActive?'🔒 ปิดเดือนนี้':'✅ เปิดเดือนนี้'}
            </button>
          </div>
        </div>
      </div>
      <div class="card" style="flex:1;min-width:220px">
        <div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">สาขาที่บันทึกแล้วเดือนนี้</div>
        <div style="font-size:36px;font-weight:900;font-family:var(--mono);color:var(--blue)">${curStat.totalStores}<span style="font-size:18px;color:var(--txt3)"> / ${totalStores}</span></div>
        <div style="height:6px;border-radius:3px;background:var(--surface3);margin-top:8px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:var(--blue);width:${sentPct}%;transition:width .6s"></div>
        </div>
        <div style="font-size:11px;color:var(--txt4);margin-top:4px">${sentPct}% ของทั้งหมด</div>
      </div>
      <div class="card" style="flex:1;min-width:180px">
        <div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">รายการรวมเดือนนี้</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--mono);color:var(--amber)">${fNum(curStat.totalItems)}</div>
        <div style="font-size:12px;color:var(--txt3);margin-top:4px">QTY รวม ${fNum(curStat.totalQty,2)}</div>
      </div>
    </div>

    <!-- กราฟ Admin -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">📊 สถิติรายเดือน (ทุกสาขา) <span class="sub">12 เดือนล่าสุด</span></div>
        <button class="btn btn-blue btn-sm" onclick="go('monthcontrol')">📅 จัดการเดือน</button>
      </div>
      ${adminChart}
    </div>

    <!-- สถานะเดือนล่าสุด -->
    <div class="card">
      <div class="card-head"><div class="card-title">📋 สรุปสถานะรายเดือน</div></div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead><tr><th>เดือน</th><th>ชื่อเดือน</th><th>สถานะ</th><th class="tr">สาขาบันทึก</th><th class="tr">รายการรวม</th><th class="tr">QTY รวม</th></tr></thead>
          <tbody>
            ${monthStats.slice(0,12).map(m=>`
              <tr ${m.ym===curYM?'style="background:var(--blue-xxl)"':''}>
                <td class="num" style="font-weight:${m.ym===curYM?'800':'400'}">${m.ym}</td>
                <td>${ymToFull(m.ym)}</td>
                <td><span class="pill ${m.active?'pill-ok':'pill-no'}">${m.active?'✅ Active':'🔒 Inactive'}</span></td>
                <td class="tr num">${m.totalStores} / ${totalStores}</td>
                <td class="tr num">${fNum(m.totalItems)}</td>
                <td class="tr num">${fNum(m.totalQty,2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function buildAdminBarChart(months, curYM){
  if(!months.length) return '<p style="color:var(--txt3);text-align:center;padding:20px">ยังไม่มีข้อมูล</p>';
  const W=600, H=220, PAD_L=40, PAD_B=50, PAD_T=20, PAD_R=10;
  const chartW=W-PAD_L-PAD_R, chartH=H-PAD_B-PAD_T;
  const n=months.length;
  const bGroup=chartW/n;
  const bW=Math.min(bGroup*0.5,28);
  const maxStores=Math.max(...months.map(m=>m.totalStores),1);
  const totalAll=STORES.length||1;

  let bars='', labels='', grid='';
  months.forEach((m,i)=>{
    const x=PAD_L+i*bGroup+bGroup/2;
    const h=Math.round((m.totalStores/totalAll)*chartH);
    const isCur=m.ym===curYM;
    bars+=`<rect x="${x-bW/2}" y="${PAD_T+chartH-h}" width="${bW}" height="${h}" rx="3"
      fill="${m.active?(isCur?'#0B5FB4':'#3B83D4'):'#DDE3EC'}" opacity="${isCur?1:0.8}">
      <title>${ymToThai(m.ym)}: ${m.totalStores}/${totalAll} สาขา</title></rect>`;
    if(h>18&&m.totalStores>0){
      bars+=`<text x="${x}" y="${PAD_T+chartH-h-4}" text-anchor="middle" font-size="9" fill="${m.active?'#0B5FB4':'#9AABBE'}" font-weight="700">${m.totalStores}</text>`;
    }
    labels+=`<text x="${x}" y="${PAD_T+chartH+16}" text-anchor="middle" font-size="9.5" fill="${isCur?'#0B5FB4':'#6B7A90'}" font-weight="${isCur?'700':'400'}">${ymToThai(m.ym)}</text>`;
  });
  for(let g=0;g<=4;g++){
    const gy=PAD_T+chartH*(1-g/4);
    grid+=`<line x1="${PAD_L}" y1="${gy}" x2="${W-PAD_R}" y2="${gy}" stroke="#DDE3EC" stroke-width="1"/>`;
    if(g>0){const val=Math.round(totalAll*g/4);grid+=`<text x="${PAD_L-4}" y="${gy+4}" text-anchor="end" font-size="9" fill="#9AABBE">${val}</text>`;}
  }
  return `
    <div style="overflow-x:auto">
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:360px;max-width:100%;display:block">
        <rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="#F7F9FC" rx="4"/>
        ${grid}${bars}${labels}
        <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+chartH}" stroke="#DDE3EC" stroke-width="1"/>
        <line x1="${PAD_L}" y1="${PAD_T+chartH}" x2="${W-PAD_R}" y2="${PAD_T+chartH}" stroke="#DDE3EC" stroke-width="1"/>
      </svg>
    </div>
    <div style="display:flex;gap:18px;margin-top:10px;justify-content:center;font-size:12px;color:var(--txt3)">
      <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#3B83D4"></span>สาขาที่บันทึก (Active)</span>
      <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#DDE3EC"></span>เดือน Inactive</span>
    </div>`;
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
