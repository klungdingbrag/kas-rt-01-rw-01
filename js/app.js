let state = { config:{}, dashboard:{}, categories:{}, transactions:[], selectedType:'Pemasukan' };

const $ = id => document.getElementById(id);
const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3200); }
function errorToast(err){ console.error(err); toast('❌ ' + (err?.message || err)); }

function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  $('page-'+page).classList.add('active');
  $('sidebar').classList.remove('open');
  if(page==='transactions') renderTransactions();
}

function setNow(){
  const d=new Date(); const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString();
  $('tanggal').value=local.slice(0,10); $('waktu').value=local.slice(11,16);
}

function renderDashboard(){
  const d=state.dashboard||{};
  $('saldo').textContent=rupiah(d.saldo); $('pemasukan').textContent=rupiah(d.pemasukan); $('pengeluaran').textContent=rupiah(d.pengeluaran); $('jumlahTransaksi').textContent=d.jumlahTransaksi||0;
  $('saldoMeta').textContent='Saldo awal ' + rupiah(d.saldoAwal);
  const c=state.config||{};
  $('connectionStatus').textContent=[c.dukuh,c.desa,c.kecamatan,c.kabupaten].filter(Boolean).join(' · ') || 'Database terhubung';
  const rows=state.transactions.filter(t=>t.status==='AKTIF').slice(0,8);
  $('recentTable').innerHTML=tableHtml(rows,false);
}

function typeBadge(t){ return `<span class="badge ${t==='Pemasukan'?'in':'out'}">${esc(t)}</span>`; }
function tableHtml(rows, actions=true){
  if(!rows.length) return '<div class="empty">Belum ada transaksi.</div>';
  return `<table><thead><tr><th>ID</th><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th><th>Status</th>${actions?'<th>Aksi</th>':''}</tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.id)}</td><td>${esc(t.tanggal)}</td><td>${typeBadge(t.jenis)}</td><td>${esc(t.kategori)}</td><td>${esc(t.keterangan)}</td><td class="${t.jenis==='Pemasukan'?'income':'expense'}">${t.jenis==='Pemasukan'?'+':'-'} ${rupiah(t.nominal)}</td><td>${t.status==='AKTIF'?'<span class="badge in">AKTIF</span>':'<span class="badge cancel">DIBATALKAN</span>'}</td>${actions?`<td>${t.status==='AKTIF'?`<button class="btn ghost" data-edit="${esc(t.id)}">Edit</button> <button class="btn danger" data-cancel="${esc(t.id)}">Batal</button>`:'-'}</td>`:''}</tr>`).join('')}</tbody></table>`;
}

function renderCategories(){
  const list=state.categories?.[state.selectedType]||[]; $('kategori').innerHTML='<option value="">Pilih kategori</option>'+list.map(x=>`<option>${esc(x)}</option>`).join('');
}
function renderTransactions(){
  let rows=[...state.transactions]; const q=$('search').value.trim().toLowerCase(); const jenis=$('filterJenis').value; const start=$('filterStart').value; const end=$('filterEnd').value;
  rows=rows.filter(t=>(!q || [t.id,t.kategori,t.keterangan,t.catatan].join(' ').toLowerCase().includes(q)) && (!jenis||t.jenis===jenis) && (!start||t.tanggal>=start) && (!end||t.tanggal<=end));
  $('transactionTable').innerHTML=tableHtml(rows,true);
}

function openEdit(id){
  const t=state.transactions.find(x=>String(x.id)===String(id)); if(!t)return;
  $('editId').value=t.id; $('editPassword').value=''; $('editReason').value='';
  $('editFields').innerHTML=`<div class="form-grid"><label>Tanggal<input id="eTanggal" type="date" value="${esc(t.tanggal)}" required></label><label>Waktu<input id="eWaktu" type="time" value="${esc(t.waktu)}" required></label><label>Nominal<input id="eNominal" type="number" value="${Number(t.nominal)}" min="1" required></label><label>Kategori<select id="eKategori">${(state.categories?.[t.jenis]||[]).map(x=>`<option ${x===t.kategori?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="full">Keterangan<input id="eKeterangan" value="${esc(t.keterangan)}" required></label><label class="full">Catatan<textarea id="eCatatan">${esc(t.catatan)}</textarea></label></div>`;
  $('editModal').classList.add('show'); $('editModal').setAttribute('aria-hidden','false');
}
function openCancel(id){ $('cancelId').value=id; $('cancelPassword').value=''; $('cancelReason').value=''; $('cancelModal').classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); $(id).setAttribute('aria-hidden','true'); }

async function load(){
  try{ const data=await KasApi.getInitialData(); state={...state,...data}; renderConfig(); renderCategories(); renderDashboard(); renderTransactions(); $('connectionStatus').textContent='Database terhubung ✓'; }
  catch(e){ $('connectionStatus').textContent='Gagal memuat: '+(e.message||e); errorToast(e); }
}
function renderConfig(){ const c=state.config||{}; [['admin_rt','nama_rt'],['admin_rw','nama_rw'],['admin_dukuh','dukuh'],['admin_desa','desa'],['admin_kecamatan','kecamatan'],['admin_kabupaten','kabupaten'],['admin_ketua','ketua_rt'],['admin_bendahara','bendahara'],['admin_saldo','saldo_awal']].forEach(([a,b])=>$(a).value=c[b]??''); }
async function reload(){ await load(); toast('Data diperbarui.'); }

$('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
document.querySelectorAll('.segment').forEach(b=>b.addEventListener('click',()=>{state.selectedType=b.dataset.type;document.querySelectorAll('.segment').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderCategories();}));
['search','filterJenis','filterStart','filterEnd'].forEach(id=>$(id).addEventListener('input',renderTransactions));

document.addEventListener('click',e=>{ if(e.target.dataset.edit)openEdit(e.target.dataset.edit); if(e.target.dataset.cancel)openCancel(e.target.dataset.cancel); });

$('transactionForm').addEventListener('reset',()=>setTimeout(()=>{state.selectedType='Pemasukan';document.querySelectorAll('.segment').forEach((x,i)=>x.classList.toggle('active',i===0));renderCategories();setNow();},0));
$('transactionForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('saveBtn');btn.disabled=true;try{const data={tanggal:$('tanggal').value,waktu:$('waktu').value,jenis:state.selectedType,kategori:$('kategori').value,nominal:Number($('nominal').value),keterangan:$('keterangan').value.trim(),catatan:$('catatan').value.trim()};await KasApi.createTransaction(data);toast('Transaksi berhasil disimpan.');e.target.reset();await reload();}catch(err){errorToast(err)}finally{btn.disabled=false;}});

$('editForm').addEventListener('submit',async e=>{e.preventDefault();try{await KasApi.updateTransaction({password:$('editPassword').value,transactionId:$('editId').value,reason:$('editReason').value.trim(),data:{tanggal:$('eTanggal').value,waktu:$('eWaktu').value,jenis:state.transactions.find(t=>String(t.id)===String($('editId').value)).jenis,kategori:$('eKategori').value,nominal:Number($('eNominal').value),keterangan:$('eKeterangan').value.trim(),catatan:$('eCatatan').value}});closeModal('editModal');toast('Transaksi berhasil diperbarui.');await reload();}catch(err){errorToast(err)}});
$('cancelForm').addEventListener('submit',async e=>{e.preventDefault();try{await KasApi.cancelTransaction({password:$('cancelPassword').value,transactionId:$('cancelId').value,reason:$('cancelReason').value.trim()});closeModal('cancelModal');toast('Transaksi dibatalkan dan dicatat.');await reload();}catch(err){errorToast(err)}});

$('configForm').addEventListener('submit',async e=>{e.preventDefault();const password=prompt('Masukkan password admin:');if(!password)return;try{await KasApi.updateConfig({password,config:{nama_rt:$('admin_rt').value,nama_rw:$('admin_rw').value,dukuh:$('admin_dukuh').value,desa:$('admin_desa').value,kecamatan:$('admin_kecamatan').value,kabupaten:$('admin_kabupaten').value,ketua_rt:$('admin_ketua').value,bendahara:$('admin_bendahara').value,saldo_awal:Number($('admin_saldo').value||0)}});toast('Pengaturan berhasil disimpan.');await reload();}catch(err){errorToast(err)}});
$('passwordForm').addEventListener('submit',async e=>{e.preventDefault();if($('newPassword').value!==$('confirmPassword').value)return toast('Password baru tidak sama.');try{await KasApi.changePassword({currentPassword:$('oldPassword').value,newPassword:$('newPassword').value});toast('Password berhasil diganti.');e.target.reset();}catch(err){errorToast(err)}});

$('pdfBtn').addEventListener('click',async()=>{try{const r=await KasApi.exportReport({startDate:$('reportStart').value,endDate:$('reportEnd').value});$('reportResult').innerHTML=`Laporan siap: <a href="${esc(r.url||'#')}" target="_blank">Buka PDF</a>`;}catch(e){errorToast(e)}});
$('waBtn').addEventListener('click',async()=>{try{const r=await KasApi.exportReport({startDate:$('reportStart').value,endDate:$('reportEnd').value});const text=`*LAPORAN KAS RT 01 / RW 01*\nPeriode: ${$('reportStart').value} s.d. ${$('reportEnd').value}\n\n📄 ${r.url||'Laporan tersedia di sistem'}`;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');}catch(e){errorToast(e)}});

setNow();load();
