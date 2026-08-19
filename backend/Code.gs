/*
 * KAS RT 01 / RW 01 - Google Apps Script backend
 * Copy this file into a Google Apps Script project.
 * Database: Google Sheets
 * Files/reports: Google Drive
 */

const DB_ID = '1bjH08HdZwb7de7tsFe_uZpBY5NvlR8UC8rBr1yVq-ng';
const DEFAULT_PASSWORD = 'RT01@2026';
const TZ = 'Asia/Jakarta';

const SHEETS = {
  TRANSAKSI: 'TRANSAKSI',
  CONFIG: 'CONFIG',
  KATEGORI: 'KATEGORI',
  AUDIT: 'AUDIT_LOG'
};

const TRANSACTION_HEADERS = ['ID','Timestamp','Tanggal','Waktu','Jenis','Kategori','Nominal','Keterangan','Catatan','Status','BuktiURL','UpdatedAt'];
const AUDIT_HEADERS = ['Timestamp','Action','TransactionID','Reason','Actor','BeforeJSON','AfterJSON'];
const DEFAULT_CATEGORIES = {
  Pemasukan: ['Iuran Warga','Sumbangan','Bantuan','Donasi','Pendapatan Kegiatan','Lainnya'],
  Pengeluaran: ['Kebersihan','Keamanan','Kegiatan Warga','Sosial','Perbaikan Fasilitas','Listrik','Administrasi','Konsumsi','Bantuan Warga','Lainnya']
};

function doGet(e) {
  try {
    ensureSetup_();
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    return json_(route_(action, e && e.parameter ? e.parameter : {}));
  } catch (err) {
    return json_({success:false,message:err.message});
  }
}

function doPost(e) {
  try {
    ensureSetup_();
    const body = parseBody_(e);
    const action = String(body.action || (e && e.parameter && e.parameter.action) || '');
    if (!action) throw new Error('Action tidak ditemukan.');
    return json_(route_(action, body));
  } catch (err) {
    return json_({success:false,message:err.message});
  }
}

function route_(action, p) {
  switch (action) {
    case 'health': return health_();
    case 'initialData': return initialData_();
    case 'transactions': return {success:true,transactions:getTransactions_()};
    case 'createTransaction': return createTransaction_(p);
    case 'updateTransaction': return updateTransaction_(p);
    case 'cancelTransaction': return cancelTransaction_(p);
    case 'updateConfig': return updateConfig_(p);
    case 'changePassword': return changePassword_(p);
    case 'exportReport': return exportReport_(p);
    default: throw new Error('Action tidak dikenali: ' + action);
  }
}

function setupApp() {
  const ss = SpreadsheetApp.openById(DB_ID);
  ensureSheet_(ss, SHEETS.TRANSAKSI, TRANSACTION_HEADERS);
  ensureSheet_(ss, SHEETS.CONFIG, ['Key','Value']);
  ensureSheet_(ss, SHEETS.KATEGORI, ['Jenis','Kategori']);
  ensureSheet_(ss, SHEETS.AUDIT, AUDIT_HEADERS);

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', DB_ID);
  if (!props.getProperty('ADMIN_PASSWORD_HASH')) props.setProperty('ADMIN_PASSWORD_HASH', hash_(DEFAULT_PASSWORD));

  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  const existing = readConfig_(configSheet);
  const defaults = {
    nama_rt:'RT 01', nama_rw:'RW 01', dukuh:'Dukuh Gudang', desa:'Desa Surorejan',
    kecamatan:'Kecamatan Puring', kabupaten:'Kabupaten Kebumen', ketua_rt:'', bendahara:'', saldo_awal:'0'
  };
  Object.keys(defaults).forEach(k => { if (!(k in existing)) upsertConfig_(configSheet,k,defaults[k]); });

  const catSheet = ss.getSheetByName(SHEETS.KATEGORI);
  if (catSheet.getLastRow() < 2) {
    const rows=[];
    Object.keys(DEFAULT_CATEGORIES).forEach(j => DEFAULT_CATEGORIES[j].forEach(c => rows.push([j,c])));
    catSheet.getRange(2,1,rows.length,2).setValues(rows);
  }
  Logger.log('SETUP SELESAI: ' + ss.getUrl());
  Logger.log('Password awal: ' + DEFAULT_PASSWORD + ' - segera ganti.');
}

function ensureSetup_() {
  const ss = SpreadsheetApp.openById(DB_ID);
  ensureSheet_(ss,SHEETS.TRANSAKSI,TRANSACTION_HEADERS);
  ensureSheet_(ss,SHEETS.CONFIG,['Key','Value']);
  ensureSheet_(ss,SHEETS.KATEGORI,['Jenis','Kategori']);
  ensureSheet_(ss,SHEETS.AUDIT,AUDIT_HEADERS);
  const props=PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) props.setProperty('SPREADSHEET_ID',DB_ID);
  if (!props.getProperty('ADMIN_PASSWORD_HASH')) props.setProperty('ADMIN_PASSWORD_HASH',hash_(DEFAULT_PASSWORD));
  const cs=ss.getSheetByName(SHEETS.CONFIG);
  const c=readConfig_(cs);
  const d={nama_rt:'RT 01',nama_rw:'RW 01',dukuh:'Dukuh Gudang',desa:'Desa Surorejan',kecamatan:'Kecamatan Puring',kabupaten:'Kabupaten Kebumen',ketua_rt:'',bendahara:'',saldo_awal:'0'};
  Object.keys(d).forEach(k=>{if(!(k in c))upsertConfig_(cs,k,d[k]);});
  const ks=ss.getSheetByName(SHEETS.KATEGORI);
  if(ks.getLastRow()<2){const rows=[];Object.keys(DEFAULT_CATEGORIES).forEach(j=>DEFAULT_CATEGORIES[j].forEach(x=>rows.push([j,x])));ks.getRange(2,1,rows.length,2).setValues(rows);}
}

function health_(){ return {success:true,status:'OK',app:'Kas RT 01 / RW 01',time:new Date().toISOString(),spreadsheetId:DB_ID}; }

function initialData_() {
  return {success:true,config:readConfig_(getSpreadsheet_().getSheetByName(SHEETS.CONFIG)),categories:readCategories_(),transactions:getTransactions_(),dashboard:getDashboard_()};
}

function getDashboard_() {
  const c=readConfig_(getSpreadsheet_().getSheetByName(SHEETS.CONFIG));
  const tx=getTransactions_().filter(x=>x.status==='AKTIF');
  let pemasukan=0,pengeluaran=0;
  tx.forEach(x=>x.jenis==='Pemasukan'?pemasukan+=Number(x.nominal):pengeluaran+=Number(x.nominal));
  const saldoAwal=Number(c.saldo_awal||0);
  return {saldoAwal,pemasukan,pengeluaran,saldo:saldoAwal+pemasukan-pengeluaran,jumlahTransaksi:tx.length};
}

function getTransactions_() {
  const s=getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI);
  if(s.getLastRow()<2)return [];
  const values=s.getRange(1,1,s.getLastRow(),s.getLastColumn()).getValues();
  const headers=values.shift().map(String);
  return values.map(r=>{const o={};headers.forEach((h,i)=>o[h]=serialize_(r[i],h));return o;}).filter(o=>o.ID).reverse();
}

function createTransaction_(p) {
  const jenis=String(p.jenis||'');
  if(!['Pemasukan','Pengeluaran'].includes(jenis)) throw new Error('Jenis transaksi tidak valid.');
  const nominal=Number(p.nominal);
  if(!Number.isFinite(nominal)||nominal<=0)throw new Error('Nominal harus lebih besar dari 0.');
  if(!p.tanggal||!p.waktu||!p.kategori||!p.keterangan)throw new Error('Tanggal, waktu, kategori, dan keterangan wajib diisi.');
  const id='TRX-'+Utilities.formatDate(new Date(),TZ,'yyyyMMdd-HHmmss')+'-'+Utilities.getUuid().slice(0,6).toUpperCase();
  const now=new Date();
  const row=[id,now,String(p.tanggal),String(p.waktu),jenis,String(p.kategori),nominal,String(p.keterangan),String(p.catatan||''),'AKTIF',String(p.buktiUrl||''),now];
  getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI).appendRow(row);
  audit_('CREATE',id,'',{},rowToObject_(row,TRANSACTION_HEADERS));
  return {success:true,message:'Transaksi berhasil disimpan.',id};
}

function updateTransaction_(p) {
  requirePassword_(p.password);
  if(!p.transactionId||!p.reason)throw new Error('ID transaksi dan alasan perubahan wajib diisi.');
  const found=findTransaction_(p.transactionId); if(!found)throw new Error('Transaksi tidak ditemukan.');
  const before=found.object;
  if(before.status!=='AKTIF')throw new Error('Transaksi yang sudah dibatalkan tidak dapat diedit.');
  const d=p.data||{};
  const nominal=Number(d.nominal); if(!Number.isFinite(nominal)||nominal<=0)throw new Error('Nominal tidak valid.');
  const after=Object.assign({},before,{Tanggal:String(d.tanggal||before.Tanggal),Waktu:String(d.waktu||before.Waktu),Jenis:String(d.jenis||before.Jenis),Kategori:String(d.kategori||before.Kategori),Nominal:nominal,Keterangan:String(d.keterangan||before.Keterangan),Catatan:String(d.catatan??before.Catatan),UpdatedAt:new Date()});
  const sheet=found.sheet; const row=found.row;
  const vals=TRANSACTION_HEADERS.map(h=>after[h]??'');
  sheet.getRange(row,1,1,TRANSACTION_HEADERS.length).setValues([vals]);
  audit_('UPDATE',p.transactionId,String(p.reason),before,after);
  return {success:true,message:'Transaksi berhasil diperbarui.'};
}

function cancelTransaction_(p) {
  requirePassword_(p.password);
  if(!p.transactionId||!p.reason)throw new Error('ID transaksi dan alasan pembatalan wajib diisi.');
  const found=findTransaction_(p.transactionId);if(!found)throw new Error('Transaksi tidak ditemukan.');
  const before=found.object;if(before.status!=='AKTIF')throw new Error('Transaksi sudah dibatalkan.');
  found.sheet.getRange(found.row,10).setValue('DIBATALKAN');
  found.sheet.getRange(found.row,12).setValue(new Date());
  const after=Object.assign({},before,{Status:'DIBATALKAN',UpdatedAt:new Date()});
  audit_('CANCEL',p.transactionId,String(p.reason),before,after);
  return {success:true,message:'Transaksi dibatalkan dan histori tetap tersimpan.'};
}

function updateConfig_(p) {
  requirePassword_(p.password); const c=p.config||{};
  const sheet=getSpreadsheet_().getSheetByName(SHEETS.CONFIG);
  Object.keys(c).forEach(k=>upsertConfig_(sheet,k,c[k]));
  audit_('CONFIG','','Perubahan pengaturan',{},c);
  return {success:true,message:'Pengaturan berhasil disimpan.'};
}

function changePassword_(p) {
  requirePassword_(p.currentPassword);
  const np=String(p.newPassword||''); if(np.length<8)throw new Error('Password baru minimal 8 karakter.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH',hash_(np));
  audit_('PASSWORD','','Ganti password',{},{});
  return {success:true,message:'Password berhasil diganti.'};
}

function exportReport_(p) {
  const start=String(p.startDate||''); const end=String(p.endDate||'');
  const tx=getTransactions_().filter(x=>x.status==='AKTIF'&&(!start||x.Tanggal>=start)&&(!end||x.Tanggal<=end));
  const c=readConfig_(getSpreadsheet_().getSheetByName(SHEETS.CONFIG));
  let income=0,expense=0;tx.forEach(x=>x.Jenis==='Pemasukan'?income+=Number(x.Nominal):expense+=Number(x.Nominal));
  const doc=DocumentApp.create('Laporan Kas RT - '+(start||'awal')+' s.d. '+(end||'sekarang'));
  const body=doc.getBody();
  body.appendParagraph(c.nama_rt+' / '+c.nama_rw).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph([c.dukuh,c.desa,c.kecamatan,c.kabupaten].filter(Boolean).join(' · '));
  body.appendParagraph('Laporan Kas Periode '+(start||'-')+' s.d. '+(end||'-')).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Saldo awal: Rp '+formatMoney_(Number(c.saldo_awal||0)));
  body.appendParagraph('Pemasukan: Rp '+formatMoney_(income));
  body.appendParagraph('Pengeluaran: Rp '+formatMoney_(expense));
  body.appendParagraph('Saldo periode: Rp '+formatMoney_(Number(c.saldo_awal||0)+income-expense));
  body.appendParagraph('');
  const table=[['Tanggal','Jenis','Kategori','Keterangan','Nominal']];
  tx.slice().reverse().forEach(x=>table.push([x.Tanggal,x.Jenis,x.Kategori,x.Keterangan,'Rp '+formatMoney_(Number(x.Nominal))]));
  if(table.length>1)body.appendTable(table);
  body.appendParagraph('');body.appendParagraph('Dibuat otomatis oleh Kas RT 01 / RW 01 pada '+Utilities.formatDate(new Date(),TZ,'dd/MM/yyyy HH:mm'));
  doc.saveAndClose();
  const pdf=DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF); const folder=getReportFolder_(); const file=folder.createFile(pdf).setName(doc.getName()+'.pdf');
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  return {success:true,url:file.getUrl(),fileId:file.getId(),name:file.getName()};
}

function getReportFolder_(){
  const props=PropertiesService.getScriptProperties();let id=props.getProperty('REPORT_FOLDER_ID');
  if(id){try{return DriveApp.getFolderById(id);}catch(e){}}
  const f=DriveApp.createFolder('Kas RT 01 - Laporan');props.setProperty('REPORT_FOLDER_ID',f.getId());return f;
}

function findTransaction_(id){
  const s=getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI);if(s.getLastRow()<2)return null;
  const vals=s.getRange(2,1,s.getLastRow()-1,TRANSACTION_HEADERS.length).getValues();
  for(let i=0;i<vals.length;i++){if(String(vals[i][0])===String(id))return {sheet:s,row:i+2,object:rowToObject_(vals[i],TRANSACTION_HEADERS)};}
  return null;
}

function readCategories_(){
  const s=getSpreadsheet_().getSheetByName(SHEETS.KATEGORI);const out={Pemasukan:[],Pengeluaran:[]};
  if(s.getLastRow()<2)return out;s.getRange(2,1,s.getLastRow()-1,2).getValues().forEach(r=>{if(out[r[0]])out[r[0]].push(String(r[1]));});return out;
}
function readConfig_(s){const o={};if(s.getLastRow()<2)return o;s.getRange(2,1,s.getLastRow()-1,2).getValues().forEach(r=>{if(r[0])o[String(r[0])]=r[1];});return o;}
function upsertConfig_(s,key,value){const last=s.getLastRow();if(last>=2){const vals=s.getRange(2,1,last-1,1).getValues();for(let i=0;i<vals.length;i++){if(String(vals[i][0])===String(key)){s.getRange(i+2,2).setValue(value);return;}}}s.appendRow([key,value]);}
function audit_(action,id,reason,before,after){getSpreadsheet_().getSheetByName(SHEETS.AUDIT).appendRow([new Date(),action,id,reason,'admin',JSON.stringify(before),JSON.stringify(after)]);}
function requirePassword_(p){if(!p||hash_(String(p))!==PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH'))throw new Error('Password admin salah.');}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');}
function parseBody_(e){if(!e||!e.postData||!e.postData.contents)return {};const raw=e.postData.contents;try{return JSON.parse(raw);}catch(err){const p={};raw.split('&').forEach(x=>{const a=x.split('=');if(a[0])p[decodeURIComponent(a[0])]=decodeURIComponent(a.slice(1).join('='));});return p;}}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function getSpreadsheet_(){return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')||DB_ID);}
function ensureSheet_(ss,name,headers){let s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);if(s.getLastRow()===0)s.getRange(1,1,1,headers.length).setValues([headers]);return s;}
function rowToObject_(row,headers){const o={};headers.forEach((h,i)=>o[h]=serialize_(row[i],h));return o;}
function serialize_(v,h){if(v instanceof Date)return Utilities.formatDate(v,TZ,h==='Tanggal'?'yyyy-MM-dd':h==='Waktu'?'HH:mm':'yyyy-MM-dd HH:mm:ss');return v;}
function formatMoney_(n){return Number(n||0).toLocaleString('id-ID');}
