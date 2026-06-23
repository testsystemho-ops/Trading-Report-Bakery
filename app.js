/* ═══════════════════════════════════════════════════
   app.js — Application Logic
   Trading Report · BAKERY GRP.68,78 · CP Axtra
   ═══════════════════════════════════════════════════ */

/* ════ DATA GLOBALS (loaded from data.json) ════ */
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
    // Re-build ALL_CLS after data is loaded
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
    // Show visible error on login card
    const errEl = document.getElementById('loginErr');
    if(errEl) {
      errEl.textContent = '⚠️ โหลดข้อมูลไม่สำเร็จ กรุณา Refresh หน้านี้ (' + e.message + ')';
      errEl.style.display = 'block';
    }
  }
}

/* ════ HELPERS ════ */
function p2(n){return String(n).padStart(2,'0');}
function todayStr(){const d=new Date();return`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;}
function thDate(s){if(!s)return'-';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;}
function fNum(n,dec=0){return(Number(n)||0).toLocaleString('th-TH',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function hlText(t,q){if(!q)return t;try{return t.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark class="hl">$1</mark>');}catch(e){return t;}}
let _tt=null;
function toast(msg,type=''){const el=document.getElementById('toast');el.textContent=msg;el.className='show'+(type?' '+type:'');clearTimeout(_tt);_tt=setTimeout(()=>el.className='',3400);}
function showModal(html,cb){const r=document.getElementById('modalRoot');r.innerHTML=`<div class="modal-bg" id="mbg"><div class="modal">${html}</div></div>`;document.getElementById('mbg').addEventListener('click',e=>{if(e.target.id==='mbg')closeModal();});if(cb)cb(r);}
function closeModal(){document.getElementById('modalRoot').innerHTML='';}
function setBtn(b,on,t='...'){if(!b)return;if(on){b._orig=b.innerHTML;b.innerHTML=t;b.disabled=true;}else{if(b._orig)b.innerHTML=b._orig;b.disabled=false;}}
async function dbGet(path){if(!fbOk)return null;try{const s=await db.ref(path).once('value');return s.val();}catch(e){console.error('dbGet:',path,e.message);return null;}}
async function dbUpdate(obj){if(!fbOk)return;try{await db.ref().update(obj);}catch(e){console.error('dbUpdate:',e.message);throw e;}}
async function dbRemove(path){if(!fbOk)return;try{await db.ref(path).remove();}catch(e){throw e;}}

/* ════ SESSION ════ */
let SES=null;
const SK='bk_ses_v4';
function saveSes(s){sessionStorage.setItem(SK,JSON.stringify(s));}
function loadSes(){try{return JSON.parse(sessionStorage.getItem(SK));}catch(e){return null;}}
function clearSes(){sessionStorage.removeItem(SK);}

/* ════ NAV ════ */
const STORE_NAV=[{id:'dashboard',ico:'📊',lbl:'แดชบอร์ด'},{id:'entry',ico:'📝',lbl:'บันทึกการตรวจนับ'},{id:'history',ico:'🗂️',lbl:'ประวัติ / Export'}];
const ADMIN_NAV=[{id:'dashboard',ico:'📊',lbl:'แดชบอร์ด & ภาพรวม'},{id:'storedata',ico:'🏪',lbl:'ดูข้อมูลรายสาขา'},{id:'clearall',ico:'🗑️',lbl:'ล้างข้อมูล'}];

/* ════ ENTRY STATE ════ */
let ENTRY_DATA={},DIRTY=false,SEARCH_Q='',CLS_FILTER='ALL',ENTRY_DATE=todayStr();
let ALL_CLS = []; // populated by loadData()
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
function go(id){CURVIEW=id;setActive(id);({dashboard:renderDashboard,entry:renderEntry,history:renderHistory,storedata:renderStoreData,clearall:renderClearAll}[id]||function(){})();}

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
  // Set logo images
  if(typeof LOGO_URI !== 'undefined') {
    document.getElementById('loginLogo').src = LOGO_URI;
    document.getElementById('sbLogo').src = LOGO_URI;
  }
  const isAdmin=SES.role==='admin';
  document.getElementById('sbName').textContent=isAdmin?SES.name:`สาขา ${SES.no} — ${SES.name}`;
  document.getElementById('sbRole').textContent=isAdmin?'ผู้ดูแลระบบ (Admin)':'บัญชีสาขา (Store)';
  const av=document.getElementById('sbAvatar');
  if(isAdmin){av.textContent='👑';av.classList.add('admin');}else{av.textContent='🏪';}
  buildNav();go('dashboard');
}

/* ════ DASHBOARD ════ */
async function renderDashboard(){
  const C=document.getElementById('content');
  if(SES.role==='store'){
    await renderStoreDashboard(C);
  } else {
    await renderAdminDashboard(C);
  }
}

/* ═══ STORE DASHBOARD ═══ */
async function renderStoreDashboard(C){
  setTB('แดชบอร์ด',`สาขา ${SES.no} — ${SES.name}`);
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const today=todayStr();
  const allD=await dbGet(`entries/${SES.no}`)||{};
  const todayData=allD[today]||{};
  const filledToday=Object.keys(todayData).filter(k=>todayData[k]!==null&&todayData[k]!==undefined&&todayData[k]!=='').length;
  const total=ITEMS_DATA.length;
  // เดือนนี้
  const ym=today.substring(0,7);
  const daysThisMonth=Object.keys(allD).filter(d=>d.startsWith(ym));
  const daysWithData=daysThisMonth.filter(d=>Object.values(allD[d]||{}).some(v=>v!==null&&v!==''));
  const monthItems=daysWithData.reduce((s,d)=>s+Object.values(allD[d]||{}).filter(v=>v!==null&&v!=='').length,0);
  const monthQty=daysWithData.reduce((s,d)=>s+Object.values(allD[d]||{}).reduce((q,v)=>q+(parseFloat(v)||0),0),0);
  C.innerHTML=`
    <div class="hero-card">
      <div class="hero-blob"></div>
      <div class="hero-icon">🥐</div>
      <div class="hero-content">
        <div class="hero-lbl">รายการที่กรอกแล้ววันนี้</div>
        <div class="hero-val num">${fNum(filledToday)}<span style="font-size:22px;opacity:.65"> / ${fNum(total)}</span></div>
        <div class="hero-hint">วันที่ ${thDate(today)} · BAKERY GRP.68,78</div>
      </div>
      <div class="hero-badge">BAKERY</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card amber"><div class="kpi-lbl">✅ กรอกแล้ววันนี้</div><div class="kpi-val">${fNum(filledToday)}</div><div class="kpi-hint">/ ${fNum(total)} รายการ</div></div>
      <div class="kpi-card"><div class="kpi-lbl">📅 วันที่บันทึกเดือนนี้</div><div class="kpi-val">${daysWithData.length}</div><div class="kpi-hint">/ ${daysThisMonth.length} วัน</div></div>
      <div class="kpi-card"><div class="kpi-lbl">📦 รายการสินค้า (เดือน)</div><div class="kpi-val">${fNum(monthItems)}</div><div class="kpi-hint">QTY รวม ${fNum(monthQty,2)}</div></div>
      <div class="kpi-card"><div class="kpi-lbl">🏪 สาขา</div><div class="kpi-val" style="font-size:20px">${SES.no}</div><div class="kpi-hint">${esc(SES.name)}</div></div>
    </div>
    <div class="prog-card">
      <div class="prog-head"><div><div class="prog-title">ความครบถ้วนวันนี้</div><div class="prog-sub">สาขา ${SES.no} — ${esc(SES.name)}</div></div><div class="prog-pct">${total>0?Math.round(filledToday/total*100):0}%</div></div>
      <div class="prog-track"><div class="prog-fill" style="width:${total>0?Math.min(100,Math.round(filledToday/total*100)):0}%"></div></div>
      <div class="prog-labels"><span>0 รายการ</span><span>${fNum(total)} รายการ</span></div>
    </div>
    <button class="btn btn-primary" onclick="go('entry')">📝 เริ่มบันทึกการตรวจนับ</button>`;
}

/* ═══ ADMIN DASHBOARD + OVERVIEW REWORKED ═══ */
let DASH_FROM = '', DASH_TO = '';
(function initDashDates(){ const today=todayStr(); const y=today.substring(0,4), m=today.substring(5,7); DASH_FROM=`${y}-${m}-01`; DASH_TO=today; })();

async function renderAdminDashboard(C){
  setTB('แดชบอร์ด & ภาพรวม', 'Admin');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';

  // Filter bar
  const filterHtml=`
    <div class="card" style="margin-bottom:14px">
      <div class="filter-bar" style="align-items:flex-end">
        <div><label class="flabel">📅 ตั้งแต่วันที่</label><input type="date" class="ctrl" id="dashFrom" value="${DASH_FROM}" onchange="DASH_FROM=this.value"></div>
        <div><label class="flabel">📅 ถึงวันที่</label><input type="date" class="ctrl" id="dashTo" value="${DASH_TO}" onchange="DASH_TO=this.value"></div>
        <div style="display:flex;align-items:flex-end"><button class="btn btn-blue" onclick="refreshAdminDashboard()">🔍 ดูข้อมูล</button></div>
        <div style="display:flex;align-items:flex-end">
          <span style="font-size:12px;color:var(--txt3)">ช่วง: <b>${thDate(DASH_FROM)}</b> — <b>${thDate(DASH_TO)}</b></span>
        </div>
      </div>
    </div>`;

  C.innerHTML = filterHtml + '<div id="dashBody"><div class="card tc" style="padding:32px;color:var(--txt3)">⏳ กำลังโหลดข้อมูล...</div></div>';
  await loadAdminDashBody();
}

async function refreshAdminDashboard(){
  const from=document.getElementById('dashFrom')?.value||DASH_FROM;
  const to=document.getElementById('dashTo')?.value||DASH_TO;
  if(from>to){ toast('วันที่เริ่มต้นต้องน้อยกว่าหรือเท่ากับวันที่สิ้นสุด','err'); return; }
  DASH_FROM=from; DASH_TO=to;
  const body=document.getElementById('dashBody');
  if(body) body.innerHTML='<div class="card tc" style="padding:32px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  await loadAdminDashBody();
}

async function loadAdminDashBody(){
  const body=document.getElementById('dashBody');
  if(!body) return;

  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  const from=DASH_FROM, to=DASH_TO;
  const today=todayStr();

  // คำนวณสาขาที่บันทึกในช่วง
  // สาขาที่บันทึก = มีข้อมูลอย่างน้อย 1 วัน ในช่วง from–to
  const storeStats = STORES.map(s=>{
    const k=fbKeys.find(k2=>String(k2)===String(s.n));
    const stData=k?allE[k]:{};
    const datesInRange=Object.keys(stData).filter(d=>d>=from&&d<=to);
    const activeDays=datesInRange.filter(d=>Object.values(stData[d]||{}).some(v=>v!==null&&v!==''));
    const totalItems=activeDays.reduce((s,d)=>s+Object.values(stData[d]||{}).filter(v=>v!==null&&v!=='').length,0);
    const totalQty=activeDays.reduce((s,d)=>s+Object.values(stData[d]||{}).reduce((q,v)=>q+(parseFloat(v)||0),0),0);
    // วันล่าสุดที่บันทึก
    const lastDate=activeDays.length>0?activeDays.sort().reverse()[0]:'';
    return{...s,activeDays:activeDays.length,totalItems,totalQty,lastDate,hasData:!!k&&activeDays.length>0};
  });

  const storesSent=storeStats.filter(s=>s.hasData);
  const storesNot=storeStats.filter(s=>!s.hasData);
  const totalStores=STORES.length;
  const sentPct=totalStores>0?Math.round(storesSent.length/totalStores*100):0;

  // overall stats
  const totalItems=storesSent.reduce((s,st)=>s+st.totalItems,0);
  const totalQty=storesSent.reduce((s,st)=>s+st.totalQty,0);

  // วันที่มีข้อมูลในช่วง (ทุกสาขา)
  const allDatesInRange=new Set();
  fbKeys.forEach(k=>{Object.keys(allE[k]||{}).filter(d=>d>=from&&d<=to&&Object.values(allE[k][d]||{}).some(v=>v!==null&&v!=='')).forEach(d=>allDatesInRange.add(d));});

  body.innerHTML=`
    <!-- HERO -->
    <div class="hero-card" style="margin-bottom:14px">
      <div class="hero-blob"></div>
      <div class="hero-icon">🏪</div>
      <div class="hero-content">
        <div class="hero-lbl">สาขาที่บันทึกข้อมูลในช่วง ${thDate(from)} — ${thDate(to)}</div>
        <div class="hero-val num">${storesSent.length}<span style="font-size:22px;opacity:.65"> / ${totalStores}</span></div>
        <div class="hero-hint">${sentPct}% ของสาขาทั้งหมด · ${allDatesInRange.size} วันที่มีข้อมูล</div>
      </div>
      <div class="hero-badge">ADMIN</div>
    </div>

    <!-- KPI -->
    <div class="kpi-grid" style="margin-bottom:14px">
      <div class="kpi-card green"><div class="kpi-lbl">✅ บันทึกแล้ว</div><div class="kpi-val" style="color:var(--green)">${storesSent.length}</div><div class="kpi-hint">/ ${totalStores} สาขา</div></div>
      <div class="kpi-card red"><div class="kpi-lbl">⏳ ยังไม่บันทึก</div><div class="kpi-val" style="color:var(--red)">${storesNot.length}</div><div class="kpi-hint">สาขาที่เหลือ</div></div>
      <div class="kpi-card amber"><div class="kpi-lbl">📦 รายการรวม</div><div class="kpi-val">${fNum(totalItems)}</div><div class="kpi-hint">QTY รวม ${fNum(totalQty,2)}</div></div>
      <div class="kpi-card"><div class="kpi-lbl">📅 วันที่มีข้อมูล</div><div class="kpi-val">${allDatesInRange.size}</div><div class="kpi-hint">วัน (ทุกสาขา)</div></div>
    </div>

    <!-- PROGRESS -->
    <div class="prog-card" style="margin-bottom:14px">
      <div class="prog-head">
        <div><div class="prog-title">% สาขาที่บันทึกข้อมูลแล้ว</div><div class="prog-sub">ช่วง ${thDate(from)} — ${thDate(to)}</div></div>
        <div class="prog-pct">${sentPct}%</div>
      </div>
      <div class="prog-track"><div class="prog-fill" style="width:${sentPct}%"></div></div>
      <div class="prog-labels"><span>0 สาขา</span><span>${storesSent.length} / ${totalStores} สาขา</span></div>
    </div>

    <!-- TWO COLUMN: บันทึกแล้ว vs ยังไม่บันทึก -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">

      <!-- สาขาที่บันทึกแล้ว -->
      <div class="card">
        <div class="card-head" style="margin-bottom:10px">
          <div class="card-title" style="color:var(--green)">✅ บันทึกแล้ว <span class="sub">${storesSent.length} สาขา</span></div>
          <button class="btn btn-secondary btn-xs" onclick="exportSentStores('${from}','${to}')">📥 Export</button>
        </div>
        <div class="tbl-wrap" style="max-height:44vh">
          <table class="dtbl">
            <thead><tr><th>สาขา</th><th>ชื่อ</th><th class="tr">วันที่บันทึก</th><th class="tr">รายการ</th></tr></thead>
            <tbody>
              ${storesSent.length>0 ? storesSent.sort((a,b)=>Number(a.n)-Number(b.n)).map(s=>`
                <tr>
                  <td class="bold num">${s.n}</td>
                  <td style="font-size:12.5px">${esc(s.name)}</td>
                  <td class="tr num">${s.activeDays} <span style="color:var(--txt4);font-size:11px">วัน</span></td>
                  <td class="tr num">${fNum(s.totalItems)}</td>
                </tr>`).join('') :
                '<tr><td colspan="4" class="tc muted" style="padding:16px">ยังไม่มีสาขาบันทึก</td></tr>'
              }
            </tbody>
            ${storesSent.length>0?`<tfoot><tr><td colspan="2" class="bold">รวม ${storesSent.length} สาขา</td><td class="tr num bold">${storesSent.reduce((s,st)=>s+st.activeDays,0)} วัน</td><td class="tr num bold">${fNum(totalItems)}</td></tr></tfoot>`:''}
          </table>
        </div>
      </div>

      <!-- สาขาที่ยังไม่บันทึก -->
      <div class="card">
        <div class="card-head" style="margin-bottom:10px">
          <div class="card-title" style="color:var(--red)">⏳ ยังไม่บันทึก <span class="sub">${storesNot.length} สาขา</span></div>
        </div>
        <div class="tbl-wrap" style="max-height:44vh">
          <table class="dtbl">
            <thead><tr><th>สาขา</th><th>ชื่อ</th><th>มีข้อมูลใน DB</th></tr></thead>
            <tbody>
              ${storesNot.length>0 ? storesNot.sort((a,b)=>Number(a.n)-Number(b.n)).map(s=>`
                <tr>
                  <td class="bold num">${s.n}</td>
                  <td style="font-size:12.5px">${esc(s.name)}</td>
                  <td><span class="pill ${s.hasData||fbKeys.includes(String(s.n))?'pill-amber':'pill-no'}">${fbKeys.includes(String(s.n))?'🔥 มีข้อมูลช่วงอื่น':'ไม่มีเลย'}</span></td>
                </tr>`).join('') :
                '<tr><td colspan="3" class="tc" style="padding:16px;color:var(--green)">✅ ทุกสาขาบันทึกแล้ว!</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* Export สาขาที่บันทึก ช่วงวันที่ */
async function exportSentStores(from, to){
  toast('กำลังสร้าง Excel...');
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  const wb=XLSX.utils.book_new();
  const rows=[['สาขา','ชื่อสาขา','วันที่','รายการที่กรอก','QTY รวม']];
  STORES.forEach(s=>{
    const k=fbKeys.find(k2=>String(k2)===String(s.n));
    if(!k) return;
    const stData=allE[k]||{};
    Object.keys(stData).filter(d=>d>=from&&d<=to).sort().forEach(d=>{
      const dd=stData[d]||{};
      const f=Object.values(dd).filter(v=>v!==null&&v!=='').length;
      const q=Object.values(dd).reduce((s2,v)=>s2+(parseFloat(v)||0),0);
      if(f>0) rows.push([s.n,s.name,thDate(d),f,q]);
    });
  });
  const ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,'Summary');
  XLSX.writeFile(wb,`BakeryStock_Summary_${from}_${to}.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

/* ════ ADMIN OVERVIEW (legacy - now merged into dashboard) ════ */
async function renderAdminOverview(){ go('dashboard'); }


/* ════ ENTRY ════ */
async function renderEntry(){
  setTB('บันทึกการตรวจนับ',`สาขา ${SES.no}`);
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลดข้อมูล...</div>';
  const data=await dbGet(`entries/${SES.no}/${ENTRY_DATE}`)||{};
  ENTRY_DATA={...data};DIRTY=false;buildEntryView(C);
}
function buildEntryView(C){
  const items=fItems();
  const fAll=ITEMS_DATA.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const fView=items.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const tQty=items.reduce((s,i)=>s+(parseFloat(ENTRY_DATA[i.code])||0),0);
  const clsOpts=ALL_CLS.map(c=>`<option value="${c}" ${CLS_FILTER===c?'selected':''}>${c==='ALL'?`ทั้งหมด (${ITEMS_DATA.length})`:`Class ${c} (${ITEMS_DATA.filter(i=>i.class===c).length})`}</option>`).join('');
  C.innerHTML=`
    <div class="card">
      <div class="card-head">
        <div class="card-title">📝 บันทึกจำนวนสินค้า <span class="sub">GRP.68,78</span></div>
        <div class="flex gap8 items-c" style="flex-wrap:wrap">
          <div class="dirty-badge ${DIRTY?'show':''}" id="dirtyBadge">⚠️ มีการแก้ไข</div>
          <button class="btn btn-secondary btn-sm" onclick="clearAllQty()">🗑️ ล้าง</button>
          <button class="btn btn-primary" id="saveBtn" onclick="saveEntry()">💾 บันทึก</button>
        </div>
      </div>
      <div class="filter-bar">
        <div><label class="flabel">📅 วันที่บันทึก</label><input type="date" class="ctrl" id="entryDate" value="${ENTRY_DATE}" onchange="onDateChange(this.value)"></div>
        <div><label class="flabel">🏷️ Class</label><select class="ctrl" id="clsSel" onchange="onClsChange(this.value)">${clsOpts}</select></div>
        <div class="flex-1"><label class="flabel">🔍 ค้นหา</label><div class="search-wrap"><span class="search-ico">🔍</span><input type="text" class="ctrl" id="searchInp" placeholder="ชื่อสินค้า หรือ รหัส..." value="${esc(SEARCH_Q)}" oninput="onSearch(this.value)"></div></div>
      </div>
      <div class="info-bar">
        <span id="infoTxt">วันที่ <strong>${thDate(ENTRY_DATE)}</strong> · กรอกแล้ว <strong>${fView}</strong> / ${items.length} · ทั้งหมด <strong>${fAll}</strong> / ${ITEMS_DATA.length}</span>
      </div>
      <div class="tbl-wrap entry-tbl-wrap">
        <table class="dtbl">
          <thead><tr><th style="width:44px">No.</th><th style="width:68px">Class</th><th style="width:104px">รหัส</th><th>ชื่อสินค้า</th><th style="width:104px;text-align:right">QTY</th></tr></thead>
          <tbody id="entryBody">${buildEntryRows(items)}</tbody>
          <tfoot><tr><td colspan="4">รวม ${fView} / ${items.length} รายการ</td><td class="tr num" id="tQty">${fNum(tQty,2)}</td></tr></tfoot>
        </table>
      </div>
    </div>`;
}
function buildEntryRows(items){
  if(!items.length)return`<tr><td colspan="5" class="tc muted" style="padding:28px">ไม่พบรายการ</td></tr>`;
  return items.map((it,idx)=>{
    const v=ENTRY_DATA[it.code]!==undefined&&ENTRY_DATA[it.code]!==null?ENTRY_DATA[it.code]:'';
    return`<tr><td class="code-cell">${it.no}</td><td><span class="cls-badge">${esc(it.class)}</span></td><td class="code-cell">${esc(it.code)}</td><td style="max-width:340px;white-space:normal;line-height:1.35">${SEARCH_Q?hlText(esc(it.name),SEARCH_Q):esc(it.name)}</td><td class="tr"><input class="qty-inp${v!==''?' filled':''}" type="number" min="0" step="0.01" id="q_${esc(it.code)}" value="${esc(String(v))}" onchange="onQty('${esc(it.code)}',this.value)" onkeydown="navRow(event,${idx})"></td></tr>`;
  }).join('');
}
function refreshEntryBody(){
  const items=fItems();
  const tbody=document.getElementById('entryBody');if(tbody)tbody.innerHTML=buildEntryRows(items);
  const fAll=ITEMS_DATA.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const fView=items.filter(i=>ENTRY_DATA[i.code]!==null&&ENTRY_DATA[i.code]!==undefined&&ENTRY_DATA[i.code]!=='').length;
  const it2=document.getElementById('infoTxt');if(it2)it2.innerHTML=`วันที่ <strong>${thDate(ENTRY_DATE)}</strong> · กรอกแล้ว <strong>${fView}</strong> / ${items.length} · ทั้งหมด <strong>${fAll}</strong> / ${ITEMS_DATA.length}`;
  const tq=document.getElementById('tQty');if(tq)tq.textContent=fNum(items.reduce((s,i)=>s+(parseFloat(ENTRY_DATA[i.code])||0),0),2);
}
async function onDateChange(v){ENTRY_DATE=v;const C=document.getElementById('content');C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';const data=await dbGet(`entries/${SES.no}/${ENTRY_DATE}`)||{};ENTRY_DATA={...data};DIRTY=false;buildEntryView(C);}
function onClsChange(v){CLS_FILTER=v;refreshEntryBody();}
function onSearch(v){SEARCH_Q=v.trim();refreshEntryBody();}
function onQty(code,val){ENTRY_DATA[code]=val===''?'':parseFloat(val)||0;DIRTY=true;const inp=document.getElementById(`q_${code}`);if(inp)inp.classList.toggle('filled',val!=='');const db2=document.getElementById('dirtyBadge');if(db2)db2.className='dirty-badge show';const tq=document.getElementById('tQty');if(tq)tq.textContent=fNum(fItems().reduce((s,i)=>s+(parseFloat(ENTRY_DATA[i.code])||0),0),2);}
function navRow(e,idx){const items=fItems();if(e.key==='Enter'||e.key==='ArrowDown'){e.preventDefault();const n=document.getElementById(`q_${items[idx+1]?.code}`);if(n)n.focus();}else if(e.key==='ArrowUp'){e.preventDefault();const p=document.getElementById(`q_${items[idx-1]?.code}`);if(p)p.focus();}}
function clearAllQty(){showModal(`<h3>🗑️ ล้างข้อมูลวันที่ ${thDate(ENTRY_DATE)}</h3><p style="color:var(--txt2);margin-top:8px">ต้องการล้าง QTY ทั้งหมดใช่หรือไม่?</p><div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button><button class="btn btn-danger" onclick="confirmClear()">ล้างข้อมูล</button></div>`);}
function confirmClear(){ITEMS_DATA.forEach(i=>{ENTRY_DATA[i.code]='';});DIRTY=true;closeModal();refreshEntryBody();toast('ล้างข้อมูลแล้ว');}
async function saveEntry(){
  const btn=document.getElementById('saveBtn');setBtn(btn,true,'💾 กำลังบันทึก...');
  const upd={};
  ITEMS_DATA.forEach(i=>{const v=ENTRY_DATA[i.code];upd[`entries/${SES.no}/${ENTRY_DATE}/${i.code}`]=(v===''||v===undefined||v===null)?null:parseFloat(v)||0;});
  upd[`logs/${Date.now()}`]={no:SES.no,name:SES.name,date:ENTRY_DATE,ts:Date.now(),action:'save'};
  try{await dbUpdate(upd);DIRTY=false;const db2=document.getElementById('dirtyBadge');if(db2)db2.className='dirty-badge';toast('บันทึกสำเร็จ ✅','ok');}
  catch(e){toast('เกิดข้อผิดพลาด: '+e.message,'err');}
  setBtn(btn,false);
}

/* ════ HISTORY ════ */
async function renderHistory(){
  setTB('ประวัติ / Export',`สาขา ${SES.no}`);
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const all=await dbGet(`entries/${SES.no}`)||{};
  const dates=Object.keys(all).sort().reverse();
  if(!dates.length){C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">ยังไม่มีประวัติ</div>';return;}
  C.innerHTML=`
    <div class="card">
      <div class="card-head">
        <div class="card-title">🗂️ ประวัติการบันทึก <span class="sub">${dates.length} วัน</span></div>
        <button class="btn btn-primary" onclick="exportStoreAll()">📥 Export ทั้งหมด</button>
      </div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead><tr><th>วันที่</th><th class="tr">รายการที่กรอก</th><th class="tr">รวม QTY</th><th></th></tr></thead>
          <tbody>${dates.map(d=>{const dd=all[d]||{};const f=Object.values(dd).filter(v=>v!==null&&v!=='').length;const q=Object.values(dd).reduce((s,v)=>s+(parseFloat(v)||0),0);return`<tr><td><b>${thDate(d)}</b></td><td class="tr num">${f} / ${ITEMS_DATA.length}</td><td class="tr num">${fNum(q,2)}</td><td class="tr"><button class="btn btn-secondary btn-xs" onclick="exportStoreDay('${d}')">📥 Export</button></td></tr>`;}).join('')}</tbody>
        </table>
      </div>
    </div>`;
}
async function exportStoreAll(){toast('กำลังสร้าง Excel...');const all=await dbGet(`entries/${SES.no}`)||{};const dates=Object.keys(all).sort();const wb=XLSX.utils.book_new();const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า',...dates.map(d=>thDate(d))]];ITEMS_DATA.forEach(i=>rows.push([i.no,i.class,i.code,i.name,...dates.map(d=>{const v=(all[d]||{})[i.code];return v!=null&&v!==''?Number(v):'';})]));const ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Stock Count');XLSX.writeFile(wb,`BakeryStock_${SES.no}_All.xlsx`);toast('Export สำเร็จ ✅','ok');}
async function exportStoreDay(date){const dd=await dbGet(`entries/${SES.no}/${date}`)||{};const wb=XLSX.utils.book_new();const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า','QTY']];ITEMS_DATA.forEach(i=>{const v=dd[i.code];rows.push([i.no,i.class,i.code,i.name,v!=null&&v!==''?Number(v):'']);});const ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,thDate(date));XLSX.writeFile(wb,`BakeryStock_${SES.no}_${date}.xlsx`);toast('Export สำเร็จ ✅','ok');}

/* ════ ADMIN OVERVIEW ════ */
async function renderAdminOverview(){
  setTB('ภาพรวมทุกสาขา','');
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const today=todayStr();
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  const stats=STORES.map(s=>{
    const k=fbKeys.find(k=>String(k)===String(s.n));
    const d=k?((allE[k]||{})[today]||{}):{};
    const filled=Object.values(d).filter(v=>v!==null&&v!=='').length;
    const pct=ITEMS_DATA.length>0?Math.round(filled/ITEMS_DATA.length*100):0;
    return{...s,filled,pct,hasData:!!k};
  });
  const done=stats.filter(s=>s.pct>=100).length,partial=stats.filter(s=>s.pct>0&&s.pct<100).length,none=stats.filter(s=>s.pct===0).length;
  C.innerHTML=`
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card green"><div class="kpi-lbl">✅ ครบแล้ว</div><div class="kpi-val" style="color:var(--green)">${done}</div><div class="kpi-hint">สาขา</div></div>
      <div class="kpi-card"><div class="kpi-lbl">🔄 บางส่วน</div><div class="kpi-val" style="color:var(--warn)">${partial}</div><div class="kpi-hint">สาขา</div></div>
      <div class="kpi-card red"><div class="kpi-lbl">❌ ยังไม่กรอก</div><div class="kpi-val" style="color:var(--red)">${none}</div><div class="kpi-hint">สาขา</div></div>
      <div class="kpi-card amber"><div class="kpi-lbl">🔥 มีข้อมูลใน DB</div><div class="kpi-val">${fbKeys.length}</div><div class="kpi-hint">สาขา (ทุกวัน)</div></div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">สถานะทุกสาขา <span class="sub">วันที่ ${thDate(today)}</span></div></div>
      <div class="tbl-wrap" style="max-height:58vh">
        <table class="dtbl">
          <thead><tr><th>สาขา</th><th>ชื่อ</th><th class="tr">กรอกแล้ว</th><th class="tr">%</th><th>สถานะ</th><th>DB</th></tr></thead>
          <tbody>${stats.map(s=>`<tr><td class="bold num">${s.n}</td><td>${esc(s.name)}</td><td class="tr num">${s.filled} / ${ITEMS_DATA.length}</td><td class="tr num">${s.pct}%</td><td><span class="pill ${s.pct>=100?'pill-ok':s.pct>0?'pill-warn':'pill-no'}">${s.pct>=100?'✅ ครบ':s.pct>0?'🔄 บางส่วน':'— ยังไม่กรอก'}</span></td><td>${s.hasData?'🔥':''}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

/* ════ ADMIN STORE DATA ════ */
let ASTORE=null, ADATE_FROM=todayStr(), ADATE_TO=todayStr();

async function renderStoreData(){
  setTB('ดูข้อมูลรายสาขา','Admin');
  const C=document.getElementById('content');
  C.innerHTML='<div class="card tc" style="padding:40px;color:var(--txt3)">⏳ กำลังโหลด...</div>';
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  if(!fbKeys.length){
    C.innerHTML=`<div class="card"><div class="card-title" style="margin-bottom:12px">🏪 ดูข้อมูลรายสาขา</div><p style="color:var(--txt3)">ยังไม่มีข้อมูลใน Firebase<br><br><b>💡 ตรวจสอบ Firebase Rules</b><br>Realtime Database → Rules → ตั้งค่า read/write: true</p></div>`;
    return;
  }
  const storeList=fbKeys.map(k=>{
    const f=STORES.find(s=>String(s.n)===String(k));
    const dates=Object.keys(allE[k]||{}).sort().reverse();
    return{key:k,name:f?f.name:`สาขา ${k}`,dates};
  }).sort((a,b)=>Number(a.key)-Number(b.key)||a.key.localeCompare(b.key));

  if(!ASTORE) ASTORE=storeList[0].key;

  // Options: ทั้งหมด + รายสาขา
  const allOpt=`<option value="ALL" ${ASTORE==='ALL'?'selected':''}>🏪 ทุกสาขา (${fbKeys.length} สาขา)</option>`;
  const stOpts=storeList.map(s=>`<option value="${s.key}" ${ASTORE===s.key?'selected':''}>${s.key} — ${esc(s.name)} (${s.dates.length} วัน)</option>`).join('');

  C.innerHTML=`
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">🏪 ข้อมูลรายสาขา <span class="sub">${fbKeys.length} สาขาใน Firebase</span></div>
      </div>
      <div class="filter-bar" style="align-items:flex-end;gap:12px">
        <!-- เลือกสาขา -->
        <div style="flex:1;min-width:200px">
          <label class="flabel">🏪 เลือกสาขา</label>
          <select class="ctrl w100" id="aStoreSel" onchange="ASTORE=this.value;toggleDateMode()">
            ${allOpt}${stOpts}
          </select>
        </div>
        <!-- ช่วงวันที่ -->
        <div>
          <label class="flabel">📅 วันที่เริ่มต้น</label>
          <input type="date" class="ctrl" id="aDateFrom" value="${ADATE_FROM}" onchange="ADATE_FROM=this.value">
        </div>
        <div>
          <label class="flabel">📅 วันที่สิ้นสุด</label>
          <input type="date" class="ctrl" id="aDateTo" value="${ADATE_TO}" onchange="ADATE_TO=this.value">
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn btn-blue" onclick="loadStoreDet()">🔍 ดูข้อมูล</button>
        </div>
      </div>
      <!-- hint -->
      <div id="modeHint" style="margin-top:10px;font-size:12.5px;color:var(--txt3)"></div>
    </div>
    <div id="aDet">
      <div class="card tc" style="padding:28px;color:var(--txt3)">เลือกสาขาและช่วงวันที่ แล้วกด "ดูข้อมูล"</div>
    </div>`;

  toggleDateMode();
  // Auto-load
  loadStoreDet();
}

function toggleDateMode(){
  const sel=document.getElementById('aStoreSel');
  const hint=document.getElementById('modeHint');
  if(!sel||!hint) return;
  if(sel.value==='ALL'){
    hint.innerHTML='<span style="color:var(--blue);font-weight:600">💡 โหมดทุกสาขา:</span> จะแสดงข้อมูลทุกสาขาในช่วงวันที่ที่เลือก รวมทุกรายการพร้อมระบุชื่อสาขา';
  } else {
    hint.innerHTML='<span style="color:var(--amber2);font-weight:600">💡 โหมดรายสาขา:</span> ดูประวัติ, สถิติ และรายละเอียดสินค้าของสาขาที่เลือกในช่วงวันที่';
  }
}

async function loadStoreDet(){
  const sNo = (document.getElementById('aStoreSel')?.value || ASTORE) || 'ALL';
  const from = (document.getElementById('aDateFrom')?.value || ADATE_FROM);
  const to   = (document.getElementById('aDateTo')?.value   || ADATE_TO);
  ASTORE=sNo; ADATE_FROM=from; ADATE_TO=to;

  // Validate date range
  if(from > to){
    toast('วันที่เริ่มต้นต้องน้อยกว่าหรือเท่ากับวันที่สิ้นสุด','err');
    return;
  }

  const det=document.getElementById('aDet');
  if(!det) return;
  det.innerHTML='<div class="card tc" style="padding:32px;color:var(--txt3)">⏳ กำลังโหลดข้อมูล...</div>';

  if(sNo==='ALL'){
    await loadAllStoresDet(from, to, det);
  } else {
    await loadSingleStoreDet(sNo, from, to, det);
  }
}

/* ── โหมด: ทุกสาขา ── */
async function loadAllStoresDet(from, to, det){
  det.innerHTML='<div class="card tc" style="padding:32px;color:var(--txt3)">⏳ กำลังดึงข้อมูลทุกสาขา...</div>';
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);

  // รวม rows ทุกสาขา ทุกวัน ในช่วงวันที่
  const summaryRows=[];   // {storeNo, storeName, date, itemCode, itemName, itemClass, qty}
  const storeSummary=[];  // {storeNo, storeName, dates:[], totalItems, totalQty}

  fbKeys.forEach(k=>{
    const stData=allE[k]||{};
    const found=STORES.find(s=>String(s.n)===String(k));
    const sName=found?found.name:`สาขา ${k}`;
    const datesInRange=Object.keys(stData).filter(d=>d>=from&&d<=to).sort();
    let storeQty=0, storeFilled=0, storeDays=0;
    datesInRange.forEach(d=>{
      const dayData=stData[d]||{};
      const dayFilled=Object.values(dayData).filter(v=>v!==null&&v!=='').length;
      if(dayFilled===0) return;
      storeDays++;
      ITEMS_DATA.forEach(item=>{
        const v=dayData[item.code];
        if(v!==null&&v!==undefined&&v!==''){
          summaryRows.push({storeNo:k,storeName:sName,date:d,code:item.code,name:item.name,cls:item.class,qty:parseFloat(v)||0});
          storeQty+=parseFloat(v)||0;
          storeFilled++;
        }
      });
    });
    if(storeDays>0||datesInRange.length>0){
      storeSummary.push({n:k,name:sName,days:datesInRange.length,activeDays:storeDays,totalItems:storeFilled,totalQty:storeQty});
    }
  });

  const totalItems=summaryRows.length;
  const totalQty=summaryRows.reduce((s,r)=>s+r.qty,0);
  const storesWithData=storeSummary.filter(s=>s.activeDays>0).length;

  // Summary KPI
  const kpiHtml=`
    <div class="sd-summary" style="margin-bottom:14px">
      <div class="sd-stat"><div class="sd-sv">${storesWithData}</div><div class="sd-sl">สาขาที่มีข้อมูล</div></div>
      <div class="sd-stat"><div class="sd-sv">${totalItems.toLocaleString('th-TH')}</div><div class="sd-sl">รายการ (rows) ทั้งหมด</div></div>
      <div class="sd-stat"><div class="sd-sv" style="color:var(--amber)">${fNum(totalQty,2)}</div><div class="sd-sl">รวม QTY ทั้งหมด</div></div>
      <div class="sd-stat"><div class="sd-sv">${thDate(from)} <span style="font-size:14px;color:var(--txt3)">→</span> ${thDate(to)}</div><div class="sd-sl">ช่วงวันที่</div></div>
    </div>`;

  // สรุปรายสาขา
  const storeSumRows=storeSummary.map(s=>`
    <tr>
      <td class="bold num">${s.n}</td>
      <td>${esc(s.name)}</td>
      <td class="tr num">${s.days}</td>
      <td class="tr num">${s.activeDays}</td>
      <td class="tr num">${fNum(s.totalItems)}</td>
      <td class="tr num bold">${fNum(s.totalQty,2)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="tc muted" style="padding:16px">ไม่มีข้อมูลในช่วงวันที่นี้</td></tr>';

  // รายการทั้งหมด (จำกัดแสดง 200 rows)
  const displayRows=summaryRows.slice(0,200);
  const detailRows=displayRows.map(r=>`
    <tr>
      <td><span class="cls-badge" style="background:var(--amber-xl);color:var(--amber2)">${esc(r.storeNo)}</span></td>
      <td style="font-size:12px;color:var(--txt2)">${esc(r.storeName)}</td>
      <td style="font-size:12px;color:var(--txt3)">${thDate(r.date)}</td>
      <td><span class="cls-badge">${esc(r.cls)}</span></td>
      <td class="code-cell">${esc(r.code)}</td>
      <td style="max-width:260px;white-space:normal;line-height:1.3;font-size:12.5px">${esc(r.name)}</td>
      <td class="tr num bold">${fNum(r.qty,2)}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="tc muted" style="padding:16px">ไม่มีข้อมูล</td></tr>';

  det.innerHTML=`
    ${kpiHtml}
    <!-- สรุปรายสาขา -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">📊 สรุปรายสาขา <span class="sub">ช่วง ${thDate(from)} — ${thDate(to)}</span></div>
        <button class="btn btn-primary" onclick="exportAllStoresRange('${from}','${to}')">📥 Export Excel ทั้งหมด</button>
      </div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead><tr><th>สาขา</th><th>ชื่อ</th><th class="tr">วันที่มีข้อมูล</th><th class="tr">วันที่มีการกรอก</th><th class="tr">รายการรวม</th><th class="tr">QTY รวม</th></tr></thead>
          <tbody>${storeSumRows}</tbody>
          <tfoot><tr>
            <td colspan="4" class="bold">รวมทั้งหมด</td>
            <td class="tr num bold">${fNum(totalItems)}</td>
            <td class="tr num bold">${fNum(totalQty,2)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
    <!-- รายการสินค้าทั้งหมด -->
    <div class="card">
      <div class="card-head">
        <div class="card-title">📋 รายการสินค้าทั้งหมด
          <span class="sub">${totalItems.toLocaleString('th-TH')} รายการ${totalItems>200?' (แสดง 200 แรก — กด Export เพื่อดูครบ)':''}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="exportAllStoresRange('${from}','${to}')">📥 Export Excel</button>
      </div>
      <div class="tbl-wrap" style="max-height:52vh">
        <table class="dtbl">
          <thead><tr>
            <th style="width:64px">สาขา</th>
            <th style="min-width:110px">ชื่อสาขา</th>
            <th style="width:90px">วันที่</th>
            <th style="width:64px">Class</th>
            <th style="width:96px">รหัส</th>
            <th>ชื่อสินค้า</th>
            <th style="width:90px" class="tr">QTY</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
          <tfoot><tr><td colspan="6" class="bold">รวม QTY (${displayRows.length} รายการที่แสดง)</td><td class="tr num bold">${fNum(displayRows.reduce((s,r)=>s+r.qty,0),2)}</td></tr></tfoot>
        </table>
      </div>
    </div>`;
}

/* ── โหมด: สาขาเดียว ── */
async function loadSingleStoreDet(sNo, from, to, det){
  det.innerHTML='<div class="card tc" style="padding:28px;color:var(--txt3)">⏳ กำลังโหลดข้อมูล...</div>';
  const stData=await dbGet(`entries/${sNo}`)||{};
  const found=STORES.find(s=>String(s.n)===String(sNo));
  const sName=found?found.name:`สาขา ${sNo}`;

  // กรองเฉพาะวันที่อยู่ในช่วง
  const allDates=Object.keys(stData).sort().reverse();
  const datesInRange=Object.keys(stData).filter(d=>d>=from&&d<=to).sort().reverse();

  // รวม QTY ทุกรายการในช่วง
  let totalFilled=0, totalQty=0;
  const rangeItems=[];  // {date, code, name, cls, qty}
  datesInRange.forEach(d=>{
    const dd=stData[d]||{};
    ITEMS_DATA.forEach(item=>{
      const v=dd[item.code];
      if(v!==null&&v!==undefined&&v!==''){
        rangeItems.push({date:d,code:item.code,name:item.name,cls:item.class,qty:parseFloat(v)||0});
        totalFilled++;
        totalQty+=parseFloat(v)||0;
      }
    });
  });

  const pct=datesInRange.length>0&&ITEMS_DATA.length>0
    ? Math.round((totalFilled/(datesInRange.length*ITEMS_DATA.length))*100) : 0;

  // ตาราง history ในช่วงวันที่
  const histRows=datesInRange.map(d=>{
    const dd=stData[d]||{};
    const f=Object.values(dd).filter(v=>v!==null&&v!=='').length;
    const q=Object.values(dd).reduce((s,v)=>s+(parseFloat(v)||0),0);
    return`<tr>
      <td><b>${thDate(d)}</b></td>
      <td class="tr num">${f} / ${ITEMS_DATA.length}</td>
      <td class="tr num">${fNum(q,2)}</td>
      <td class="tr">
        <button class="btn btn-secondary btn-xs" onclick="exportADay('${sNo}','${d}')">📥</button>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="4" class="tc muted" style="padding:12px">ไม่มีข้อมูลในช่วงนี้</td></tr>';

  // รายการสินค้าในช่วง (แสดงทั้งหมด)
  const detailRows=rangeItems.slice(0,300).map(r=>`
    <tr>
      <td style="font-size:12.5px;color:var(--txt3)">${thDate(r.date)}</td>
      <td><span class="cls-badge">${esc(r.cls)}</span></td>
      <td class="code-cell">${esc(r.code)}</td>
      <td style="max-width:320px;white-space:normal;line-height:1.3">${esc(r.name)}</td>
      <td class="tr num bold">${fNum(r.qty,2)}</td>
    </tr>`).join('')||'<tr><td colspan="5" class="tc muted" style="padding:12px">ไม่มีข้อมูลในช่วงวันที่นี้</td></tr>';

  det.innerHTML=`
    <div class="sd-summary" style="margin-bottom:14px">
      <div class="sd-stat"><div class="sd-sv">${datesInRange.length}</div><div class="sd-sl">วันที่มีข้อมูล (ในช่วง)</div></div>
      <div class="sd-stat"><div class="sd-sv">${fNum(totalFilled)}</div><div class="sd-sl">รายการรวม (ในช่วง)</div></div>
      <div class="sd-stat"><div class="sd-sv" style="color:var(--amber)">${fNum(totalQty,2)}</div><div class="sd-sl">QTY รวม (ในช่วง)</div></div>
      <div class="sd-stat"><div class="sd-sv">${allDates.length}</div><div class="sd-sl">วันที่มีข้อมูลทั้งหมด</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">📅 ประวัติการบันทึก
          <span class="sub">สาขา ${sNo} ${esc(sName)} · ${thDate(from)} — ${thDate(to)} · ${datesInRange.length} วัน</span>
        </div>
        <div class="flex gap8">
          <button class="btn btn-secondary btn-sm" onclick="exportSingleRange('${sNo}','${from}','${to}')">📥 Export ช่วงนี้</button>
          <button class="btn btn-primary btn-sm" onclick="exportAAll('${sNo}')">📥 Export ทั้งหมด</button>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="dtbl">
          <thead><tr><th>วันที่</th><th class="tr">รายการ</th><th class="tr">รวม QTY</th><th></th></tr></thead>
          <tbody>${histRows}</tbody>
          <tfoot><tr>
            <td class="bold">รวม ${datesInRange.length} วัน</td>
            <td class="tr num bold">${fNum(totalFilled)}</td>
            <td class="tr num bold">${fNum(totalQty,2)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    ${rangeItems.length>0?`
    <div class="card">
      <div class="card-head">
        <div class="card-title">📋 รายละเอียดสินค้า
          <span class="sub">${fNum(rangeItems.length)} รายการ${rangeItems.length>300?' (แสดง 300 แรก)':''}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="exportSingleRange('${sNo}','${from}','${to}')">📥 Export</button>
      </div>
      <div class="tbl-wrap" style="max-height:52vh">
        <table class="dtbl">
          <thead><tr>
            <th style="width:88px">วันที่</th>
            <th style="width:64px">Class</th>
            <th style="width:96px">รหัส</th>
            <th>ชื่อสินค้า</th>
            <th style="width:90px" class="tr">QTY</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
          <tfoot><tr>
            <td colspan="4" class="bold">รวม QTY (${Math.min(rangeItems.length,300)} รายการที่แสดง)</td>
            <td class="tr num bold">${fNum(rangeItems.slice(0,300).reduce((s,r)=>s+r.qty,0),2)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>` : `<div class="card tc" style="padding:28px;color:var(--txt3)">ไม่มีข้อมูลในช่วงวันที่ ${thDate(from)} — ${thDate(to)}</div>`}`;
}

/* ── Export: ทุกสาขา ช่วงวันที่ ── */
async function exportAllStoresRange(from, to){
  toast('กำลังสร้าง Excel... อาจใช้เวลาสักครู่');
  const allE=await dbGet('entries')||{};
  const fbKeys=Object.keys(allE);
  const wb=XLSX.utils.book_new();

  // Sheet 1: Summary per store
  const sumRows=[['สาขา','ชื่อสาขา','วันที่มีข้อมูล','รายการรวม','QTY รวม']];
  // Sheet 2: Detail all rows
  const detRows=[['สาขา','ชื่อสาขา','วันที่','Class','รหัสสินค้า','ชื่อสินค้า','QTY']];

  fbKeys.sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b)).forEach(k=>{
    const stData=allE[k]||{};
    const found=STORES.find(s=>String(s.n)===String(k));
    const sName=found?found.name:`สาขา ${k}`;
    const datesInRange=Object.keys(stData).filter(d=>d>=from&&d<=to).sort();
    let stFilled=0,stQty=0;
    datesInRange.forEach(d=>{
      const dd=stData[d]||{};
      ITEMS_DATA.forEach(item=>{
        const v=dd[item.code];
        if(v!==null&&v!==undefined&&v!==''){
          detRows.push([k, sName, thDate(d), item.class, item.code, item.name, parseFloat(v)||0]);
          stFilled++;
          stQty+=parseFloat(v)||0;
        }
      });
    });
    if(datesInRange.length>0||stFilled>0){
      sumRows.push([k, sName, datesInRange.length, stFilled, stQty]);
    }
  });

  const wsSummary=XLSX.utils.aoa_to_sheet(sumRows);
  XLSX.utils.book_append_sheet(wb,wsSummary,'Summary');
  const wsDetail=XLSX.utils.aoa_to_sheet(detRows);
  XLSX.utils.book_append_sheet(wb,wsDetail,'Detail_AllStores');

  XLSX.writeFile(wb,`BakeryStock_AllStores_${from}_${to}.xlsx`);
  toast(`Export สำเร็จ ✅ ${detRows.length-1} รายการ`,'ok');
}

/* ── Export: สาขาเดียว ช่วงวันที่ ── */
async function exportSingleRange(sNo, from, to){
  toast('กำลังสร้าง Excel...');
  const stData=await dbGet(`entries/${sNo}`)||{};
  const found=STORES.find(s=>String(s.n)===String(sNo));
  const sName=found?found.name:`สาขา ${sNo}`;
  const datesInRange=Object.keys(stData).filter(d=>d>=from&&d<=to).sort();
  const wb=XLSX.utils.book_new();

  // Sheet: สรุปรายวัน (แนวนอน)
  const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า',...datesInRange.map(d=>thDate(d))]];
  ITEMS_DATA.forEach(i=>{
    const vals=datesInRange.map(d=>{const v=(stData[d]||{})[i.code];return v!=null&&v!==''?Number(v):'';});
    if(vals.some(v=>v!=='')){
      rows.push([i.no,i.class,i.code,i.name,...vals]);
    }
  });
  const ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,`สาขา${sNo}`);

  // Sheet: รายการแนวตั้ง
  const rows2=[['สาขา','ชื่อสาขา','วันที่','Class','รหัส','ชื่อสินค้า','QTY']];
  datesInRange.forEach(d=>{
    const dd=stData[d]||{};
    ITEMS_DATA.forEach(item=>{
      const v=dd[item.code];
      if(v!=null&&v!=='') rows2.push([sNo,sName,thDate(d),item.class,item.code,item.name,Number(v)]);
    });
  });
  const ws2=XLSX.utils.aoa_to_sheet(rows2);
  XLSX.utils.book_append_sheet(wb,ws2,'Detail');

  XLSX.writeFile(wb,`BakeryStock_ST${sNo}_${from}_${to}.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

async function exportADay(sNo,date){
  const dd=await dbGet(`entries/${sNo}/${date}`)||{};
  const wb=XLSX.utils.book_new();
  const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า','QTY']];
  ITEMS_DATA.forEach(i=>{const v=dd[i.code];rows.push([i.no,i.class,i.code,i.name,v!=null&&v!==''?Number(v):'']);});
  const ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,thDate(date));
  XLSX.writeFile(wb,`BakeryStock_ST${sNo}_${date}.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

async function exportAAll(sNo){
  toast('กำลังสร้าง Excel...');
  const all=await dbGet(`entries/${sNo}`)||{};
  const dates=Object.keys(all).sort();
  const wb=XLSX.utils.book_new();
  const rows=[['ลำดับ','Class','รหัส','ชื่อสินค้า',...dates.map(d=>thDate(d))]];
  ITEMS_DATA.forEach(i=>rows.push([i.no,i.class,i.code,i.name,...dates.map(d=>{const v=(all[d]||{})[i.code];return v!=null&&v!==''?Number(v):'';})]));;
  const ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,`ST${sNo}`);
  XLSX.writeFile(wb,`BakeryStock_ST${sNo}_All.xlsx`);
  toast('Export สำเร็จ ✅','ok');
}

/* ════ ADMIN EXPORT ════ */
function renderAdminExport(){
  setTB('Export ทุกสาขา','');
  document.getElementById('content').innerHTML=`
    <div class="card">
      <div class="card-head"><div class="card-title">📤 Export ข้อมูลช่วงวันที่</div></div>
      <div class="filter-bar">
        <div><label class="flabel">วันที่เริ่มต้น</label><input type="date" class="ctrl" id="expFrom" value="${todayStr()}"></div>
        <div><label class="flabel">วันที่สิ้นสุด</label><input type="date" class="ctrl" id="expTo" value="${todayStr()}"></div>
        <div style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="doRangeExport()">📥 Export Excel</button></div>
      </div>
      <p style="font-size:12.5px;color:var(--txt3);margin-top:8px">Export ข้อมูลทุกสาขาในช่วงวันที่กำหนด สรุปรวมใน 1 Sheet</p>
    </div>`;
}
async function doRangeExport(){
  const from=document.getElementById('expFrom').value,to=document.getElementById('expTo').value;
  if(!from||!to){toast('กรุณาเลือกช่วงวันที่','err');return;}
  toast('กำลังสร้าง Excel...');
  const allE=await dbGet('entries')||{};
  const wb=XLSX.utils.book_new();
  const rows=[['สาขา','ชื่อ','วันที่','รายการที่กรอก','รวม QTY']];
  Object.keys(allE).sort().forEach(k=>{const sd=allE[k]||{};const f2=STORES.find(s=>String(s.n)===String(k));const sn=f2?f2.name:`สาขา ${k}`;Object.keys(sd).filter(d=>d>=from&&d<=to).sort().forEach(d=>{const dd=sd[d]||{};const f=Object.values(dd).filter(v=>v!==null&&v!=='').length;const q=Object.values(dd).reduce((s,v)=>s+(parseFloat(v)||0),0);rows.push([k,sn,thDate(d),f,q]);});});
  const ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Summary');
  XLSX.writeFile(wb,`BakeryStock_${from}_${to}.xlsx`);toast('Export สำเร็จ ✅','ok');
}

/* ════ INSTALL ════ */
function renderInstall(){
  setTB('วิธีติดตั้ง','GitHub Pages + Firebase');
  document.getElementById('content').innerHTML=`
    <div class="card">
      <div class="card-head"><div class="card-title">🚀 ขั้นตอนติดตั้ง</div></div>
      <div style="background:var(--blue-xxl);border:1px solid var(--blue-xl);border-radius:var(--r12);padding:14px 18px;margin-bottom:22px">
        <b style="color:var(--blue)">✅ Firebase Config ใส่ไว้แล้ว</b><br><span style="font-size:13px;color:var(--txt2)">ไฟล์นี้ใช้งานได้ทันที ไม่ต้องแก้โค้ดใดๆ</span>
      </div>
      <div class="install-step"><div class="install-num">1</div><div class="install-body"><div class="install-title">ตั้งค่า Firebase Realtime Database Rules</div><div class="install-desc">ไปที่ <a href="https://console.firebase.google.com" target="_blank">console.firebase.google.com</a> → Project <b>trading-report-bakery</b> → Realtime Database → Rules<pre class="code-block">{"rules":{".read":true,".write":true}}</pre>กด <b>Publish</b></div></div></div>
      <div class="install-step"><div class="install-num">2</div><div class="install-body"><div class="install-title">อัปโหลดขึ้น GitHub</div><div class="install-desc">1. github.com → New Repository → ชื่อ <code class="inline">trading-report-bakery</code> → Public<br>2. อัปโหลดไฟล์นี้ชื่อ <code class="inline">index.html</code><br>3. Settings → Pages → Branch: main / root → Save<br>4. URL: <code class="inline">https://[username].github.io/trading-report-bakery/</code></div></div></div>
      <div class="install-step"><div class="install-num">3</div><div class="install-body"><div class="install-title">เพิ่ม Authorized Domain</div><div class="install-desc">Firebase → Authentication → Settings → Authorized domains → เพิ่ม <code class="inline">[username].github.io</code></div></div></div>
      <div class="divider"></div>
      <b style="font-size:14px;color:var(--txt)">🔑 บัญชีทดสอบ</b><br><br>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;color:var(--txt2)">
        <span>สาขา: <code class="inline">store068</code> / <code class="inline">welcome1</code></span>
        <span>Admin: <code class="inline">admin</code> / <code class="inline">BakeryAdmin#2026</code></span>
      </div>
    </div>`;
}

/* ════ CLEAR ════ */
function renderClearAll(){
  setTB('ล้างข้อมูล','⚠️ อันตราย');
  document.getElementById('content').innerHTML=`
    <div class="card" style="border-color:rgba(224,50,68,.25)">
      <div class="card-head"><div class="card-title" style="color:var(--red)">🗑️ ล้างข้อมูลทั้งหมด</div></div>
      <p style="color:var(--txt2);margin-bottom:16px">การดำเนินการนี้จะลบข้อมูลการตรวจนับทั้งหมดออกจาก Firebase อย่างถาวร ไม่สามารถกู้คืนได้</p>
      <button class="btn btn-danger" onclick="confirmClearAll()">🗑️ ล้างข้อมูลทั้งหมด</button>
    </div>`;
}
function confirmClearAll(){showModal(`<h3 style="color:var(--red)">⚠️ ยืนยันการล้างข้อมูล</h3><p style="color:var(--txt2);margin-top:8px">กรุณาพิมพ์ <b>DELETE</b> เพื่อยืนยัน</p><input type="text" id="cInp" style="width:100%;margin-top:12px;padding:11px 13px;border-radius:var(--r8);border:1.5px solid var(--border);font-size:14px" placeholder="พิมพ์ DELETE"><div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button><button class="btn btn-danger" onclick="doClear()">ลบทั้งหมด</button></div>`);}
async function doClear(){if(document.getElementById('cInp').value.trim()!=='DELETE'){toast('พิมพ์ DELETE ให้ถูกต้อง','err');return;}try{await dbRemove('entries');await dbRemove('logs');closeModal();toast('ล้างข้อมูลแล้ว','ok');}catch(e){toast('Error: '+e.message,'err');}}

/* ════ BOOTSTRAP ════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Load data.json first, then boot the app
  await loadData();
  // Set login screen logo
  if(typeof LOGO_URI !== 'undefined') {
    document.getElementById('loginLogo').src = LOGO_URI;
    document.getElementById('sbLogo').src = LOGO_URI;
  }
  initLogin();
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sbBd').classList.add('show');
  });
  document.getElementById('sbBd').addEventListener('click', closeSB);
  const ses = loadSes();
  if (ses) { SES = ses; startApp(); }
});
