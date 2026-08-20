/* ============================================================
 * KAS RT 01 / RW 01 - PRODUCTION BACKEND
 * Version 2026.08.20.11
 * Sections: Config | Web App | Public API | Database |
 * Dashboard | Transactions | Warga | Admin | Reports |
 * Attachments | Diagnostic | Normalization | Utilities
 * ============================================================ */

/* ======================== 01 CONFIG ========================= */
const APP = {
  NAME: 'Kas RT 01 / RW 01',
  VERSION: '2026.08.20.11',
  TZ: 'Asia/Jakarta',
  DB_ID: '1bjH08HdZwb7de7tsFe_uZpBY5NvlR8UC8rBr1yVq-ng',
  ATTACHMENT_FOLDER: 'Kas RT 01 - Lampiran'
};

const SHEETS = {
  TRANSAKSI: 'TRANSAKSI',
  CONFIG: 'CONFIG',
  KATEGORI: 'KATEGORI',
  AUDIT: 'AUDIT_LOG',
  WARGA: 'WARGA'
};

const TRANSACTION_HEADERS = ['ID','Timestamp','Tanggal','Waktu','Jenis','Kategori','Nominal','Keterangan','Catatan','BuktiURL','Status','CreatedBy','UpdatedAt','UpdatedBy'];
const WARGA_HEADERS = ['IDKK','NIK','Nama','Hubungan','JenisKelamin','TanggalLahir','Alamat','NoHP','Status','UpdatedAt','UpdatedBy'];

/* ==================== 02 WEB APP ============================= */
function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || '');
    if (!action) {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle(APP.NAME)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    return jsonResponse_(routeApi_(action, e.parameter || {}));
  } catch (err) {
    return jsonResponse_(errorResponse_(err));
  }
}

function doPost(e) {
  try {
    const payload = parsePost_(e);
    return jsonResponse_(routeApi_(payload.action || '', payload));
  } catch (err) {
    return jsonResponse_(errorResponse_(err));
  }
}

/* ==================== 03 PUBLIC API ========================= */
function initialData() { setupApp(); return initialData_(); }
function createTransaction(data) { setupApp(); return createTransaction_(data || {}); }
function updateTransaction(data) { setupApp(); return updateTransaction_(data || {}); }
function cancelTransaction(data) { setupApp(); return cancelTransaction_(data || {}); }
function updateConfig(data) { setupApp(); return updateConfig_(data || {}); }
function changePassword(data) { setupApp(); return changePassword_(data || {}); }
function getWarga(data) { setupApp(); return getWarga_(data || {}); }
function saveWarga(data) { setupApp(); return saveWarga_(data || {}); }
function deleteWarga(data) { setupApp(); return deleteWarga_(data || {}); }
function uploadAttachment(data) { setupApp(); return uploadAttachment_(data || {}); }
function reportSummary() { setupApp(); return reportSummary_(); }
function createReportPdf(data) { setupApp(); return createReportPdf_(data || {}); }
function diagnostic() { setupApp(); return diagnostic_(); }
function testBackend() {
  setupApp();
  return {success:true,status:'OK',app:APP.NAME,version:APP.VERSION,time:Utilities.formatDate(new Date(),APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"),spreadsheetId:APP.DB_ID,transactionSheet:!!getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI),wargaSheet:!!getSpreadsheet_().getSheetByName(SHEETS.WARGA)};
}

function routeApi_(action, data) {
  switch (action) {
    case 'initialData': return initialData();
    case 'testBackend': return testBackend();
    case 'diagnostic': return diagnostic();
    case 'createTransaction': return createTransaction(data);
    case 'updateTransaction': return updateTransaction(data);
    case 'cancelTransaction': return cancelTransaction(data);
    case 'updateConfig': return updateConfig(data);
    case 'changePassword': return changePassword(data);
    case 'getWarga': return getWarga(data);
    case 'saveWarga': return saveWarga(data);
    case 'deleteWarga': return deleteWarga(data);
    case 'uploadAttachment': return uploadAttachment(data);
    case 'reportSummary': return reportSummary();
    case 'createReportPdf': return createReportPdf(data);
    default: throw new Error('Action tidak dikenali: ' + action);
  }
}

/* ==================== 04 DATABASE =========================== */
function setupApp() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss,SHEETS.TRANSAKSI,TRANSACTION_HEADERS);
  ensureSheet_(ss,SHEETS.CONFIG,['Key','Value']);
  ensureSheet_(ss,SHEETS.KATEGORI,['Jenis','Kategori']);
  ensureSheet_(ss,SHEETS.AUDIT,['Timestamp','Action','TransactionID','Reason','Actor','BeforeJSON','AfterJSON']);
  ensureSheet_(ss,SHEETS.WARGA,WARGA_HEADERS);
  const config = readConfig_();
  const defaults = {saldo_awal:'0',nama_rt:'RT 01',nama_rw:'RW 01',dukuh:'Dukuh Gudang',desa:'Surorejan',kecamatan:'Puring',kabupaten:'Kebumen',next_transaction_no:'1'};
  Object.keys(defaults).forEach(function(key){ if(config[key] === undefined || config[key] === '') setConfig_(key,defaults[key]); });
}
function getSpreadsheet_(){ return SpreadsheetApp.openById(APP.DB_ID); }
function ensureSheet_(ss,name,headers){ let sheet=ss.getSheetByName(name); if(!sheet) sheet=ss.insertSheet(name); if(sheet.getLastRow()===0){sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);} return sheet; }

/* ==================== 05 DASHBOARD ========================== */
function initialData_(){ return {success:true,version:APP.VERSION,config:readConfig_(),categories:readCategories_(),dashboard:calculateDashboard_(),transactions:getTransactions_(),warga:getWarga_({limit:1000}).warga}; }
function calculateDashboard_(){
  const transactions=getTransactions_(); let pemasukan=0,pengeluaran=0,jumlah=0;
  transactions.forEach(function(tx){if(tx.status!=='AKTIF')return;jumlah++;if(tx.jenis==='Pemasukan')pemasukan+=tx.nominal;if(tx.jenis==='Pengeluaran')pengeluaran+=tx.nominal;});
  const saldoAwal=money_(readConfig_().saldo_awal);
  return {saldoAwal:saldoAwal,pemasukan:pemasukan,pengeluaran:pengeluaran,saldo:saldoAwal+pemasukan-pengeluaran,jumlahTransaksi:jumlah};
}
function getTransactions_(){
  const sheet=getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI); if(!sheet||sheet.getLastRow()<2)return[];
  const values=sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getValues(),headers=values.shift().map(String);
  return values.map(function(row){const item={};headers.forEach(function(h,i){item[h]=row[i];});return normalizeTransaction_(item);}).filter(function(tx){return tx.id;}).reverse();
}

/* ==================== 06 TRANSACTIONS ======================== */
function createTransaction_(data){
  const jenis=normalizeType_(data.jenis),nominal=money_(data.nominal);
  if(!['Pemasukan','Pengeluaran'].includes(jenis))throw new Error('Jenis transaksi tidak valid.');
  if(nominal<=0)throw new Error('Nominal harus lebih besar dari 0.');
  if(!data.tanggal||!data.waktu)throw new Error('Tanggal dan waktu wajib diisi.');
  if(!data.kategori)throw new Error('Jenis/kategori transaksi wajib dipilih.');
  if(!data.keterangan)throw new Error('Keterangan wajib diisi.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const id=generateTransactionId_(),sheet=getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI),map=headerMap_(sheet),row=new Array(Math.max(sheet.getLastColumn(),TRANSACTION_HEADERS.length)).fill(''),now=new Date();
    const put=function(h,v){if(map[h])row[map[h]-1]=v;};
    put('ID',id);put('Timestamp',now);put('Tanggal',data.tanggal);put('Waktu',data.waktu);put('Jenis',jenis);put('Kategori',data.kategori);put('Nominal',nominal);put('Keterangan',data.keterangan);put('Catatan',data.catatan||'');put('BuktiURL',data.buktiUrl||'');put('Status','AKTIF');put('CreatedBy','admin');put('UpdatedAt',now);put('UpdatedBy','admin');
    sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);SpreadsheetApp.flush();
    const saved=findTransaction_(id);if(!saved||saved.status!=='AKTIF')throw new Error('Server gagal memverifikasi transaksi '+id);
    return {success:true,version:APP.VERSION,id:id,transaction:saved,dashboard:calculateDashboard_()};
  }finally{lock.releaseLock();}
}
function generateTransactionId_(){const config=readConfig_();let number=parseInt(config.next_transaction_no||'1',10);if(!Number.isFinite(number)||number<1)number=1;setConfig_('next_transaction_no',String(number+1));return'TRX-'+String(number).padStart(5,'0');}
function updateTransaction_(data){
  requireAdmin_(data.password);if(!data.transactionId)throw new Error('ID transaksi wajib diisi.');if(!data.reason)throw new Error('Alasan perubahan wajib diisi.');
  const found=findTransactionRow_(data.transactionId);if(!found)throw new Error('Transaksi tidak ditemukan.');if(found.data.status!=='AKTIF')throw new Error('Transaksi sudah dibatalkan.');
  const before=found.data,newData=data.data||{},map=headerMap_(found.sheet),row=found.sheet.getRange(found.row,1,1,found.sheet.getLastColumn()).getValues()[0],set=function(h,v){if(map[h])row[map[h]-1]=v;};
  set('Tanggal',newData.tanggal);set('Waktu',newData.waktu);set('Jenis',normalizeType_(newData.jenis));set('Kategori',newData.kategori);set('Nominal',money_(newData.nominal));set('Keterangan',newData.keterangan);set('Catatan',newData.catatan||'');if(newData.buktiUrl!==undefined)set('BuktiURL',newData.buktiUrl);set('UpdatedAt',new Date());set('UpdatedBy','admin');
  found.sheet.getRange(found.row,1,1,row.length).setValues([row]);SpreadsheetApp.flush();const after=findTransaction_(data.transactionId);audit_('UPDATE',data.transactionId,data.reason,before,after);return{success:true,transaction:after,dashboard:calculateDashboard_()};
}
function cancelTransaction_(data){
  requireAdmin_(data.password);if(!data.transactionId)throw new Error('ID transaksi wajib diisi.');if(!data.reason)throw new Error('Alasan pembatalan wajib diisi.');
  const found=findTransactionRow_(data.transactionId);if(!found)throw new Error('Transaksi tidak ditemukan.');if(found.data.status!=='AKTIF')throw new Error('Transaksi sudah dibatalkan.');
  const before=found.data,map=headerMap_(found.sheet);found.sheet.getRange(found.row,map.Status).setValue('DIBATALKAN');found.sheet.getRange(found.row,map.UpdatedAt).setValue(new Date());found.sheet.getRange(found.row,map.UpdatedBy).setValue('admin');SpreadsheetApp.flush();const after=findTransaction_(data.transactionId);audit_('CANCEL',data.transactionId,data.reason,before,after);return{success:true,transaction:after,dashboard:calculateDashboard_()};
}

/* ==================== 07 WARGA / KK ========================= */
function getWarga_(data){
  const sheet=getSpreadsheet_().getSheetByName(SHEETS.WARGA);if(!sheet||sheet.getLastRow()<2)return{success:true,warga:[]};
  const values=sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getValues(),headers=values.shift().map(String);
  let warga=values.map(function(row){const item={};headers.forEach(function(h,i){item[h]=row[i];});return normalizeWarga_(item);}).filter(function(item){return item.idkk||item.nik||item.nama;});
  const query=String(data.query||'').trim().toLowerCase();if(query)warga=warga.filter(function(item){return[item.idkk,item.nik,item.nama,item.alamat,item.noHp].join(' ').toLowerCase().includes(query);});
  return{success:true,warga:warga.slice(0,Number(data.limit||1000))};
}
function saveWarga_(data){
  requireAdmin_(data.password);const w=data.warga||{};if(!w.idkk)throw new Error('Nomor KK wajib diisi.');if(!w.nama)throw new Error('Nama warga wajib diisi.');
  const sheet=getSpreadsheet_().getSheetByName(SHEETS.WARGA),map=headerMap_(sheet);let rowNumber=Number(w.rowNumber||0);if(!rowNumber&&w.nik)rowNumber=findWargaByNik_(sheet,w.nik);
  const row=rowNumber?sheet.getRange(rowNumber,1,1,sheet.getLastColumn()).getValues()[0]:new Array(Math.max(sheet.getLastColumn(),WARGA_HEADERS.length)).fill('');const put=function(h,v){if(map[h])row[map[h]-1]=v;};
  put('IDKK',String(w.idkk));put('NIK',String(w.nik||''));put('Nama',String(w.nama));put('Hubungan',String(w.hubungan||'Kepala Keluarga'));put('JenisKelamin',String(w.jenisKelamin||''));put('TanggalLahir',String(w.tanggalLahir||''));put('Alamat',String(w.alamat||''));put('NoHP',String(w.noHp||''));put('Status',String(w.status||'AKTIF'));put('UpdatedAt',new Date());put('UpdatedBy','admin');
  if(rowNumber)sheet.getRange(rowNumber,1,1,row.length).setValues([row]);else sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);SpreadsheetApp.flush();return{success:true,warga:getWarga_({limit:1000}).warga};
}
function deleteWarga_(data){requireAdmin_(data.password);const sheet=getSpreadsheet_().getSheetByName(SHEETS.WARGA),row=Number(data.rowNumber||0);if(!row||row<2||row>sheet.getLastRow())throw new Error('Data warga tidak ditemukan.');const map=headerMap_(sheet);sheet.getRange(row,map.Status).setValue('NONAKTIF');sheet.getRange(row,map.UpdatedAt).setValue(new Date());sheet.getRange(row,map.UpdatedBy).setValue('admin');SpreadsheetApp.flush();return{success:true};}
function findWargaByNik_(sheet,nik){const map=headerMap_(sheet);if(!map.NIK||sheet.getLastRow()<2)return 0;const values=sheet.getRange(2,map.NIK,sheet.getLastRow()-1,1).getValues();for(let i=0;i<values.length;i++)if(String(values[i][0])===String(nik))return i+2;return 0;}

/* ==================== 08 ADMIN / CONFIG ==================== */
function updateConfig_(data){requireAdmin_(data.password);Object.keys(data.config||{}).forEach(function(key){setConfig_(key,data.config[key]);});SpreadsheetApp.flush();return{success:true,config:readConfig_(),dashboard:calculateDashboard_()};}
function changePassword_(data){requireAdmin_(data.currentPassword);const next=String(data.newPassword||'');if(next.length<8)throw new Error('Password minimal 8 karakter.');PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD',next);return{success:true};}
function requireAdmin_(password){const saved=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD')||'RT01@2026';if(String(password||'')!==saved)throw new Error('Password admin salah.');}
function audit_(action,id,reason,before,after){getSpreadsheet_().getSheetByName(SHEETS.AUDIT).appendRow([new Date(),action,id,reason,'admin',JSON.stringify(before),JSON.stringify(after)]);}

/* ==================== 09 REPORTS ============================= */
function reportSummary_(){const config=readConfig_(),dashboard=calculateDashboard_();return{success:true,date:Utilities.formatDate(new Date(),APP.TZ,'dd/MM/yyyy'),namaRt:String(config.nama_rt||'RT 01'),namaRw:String(config.nama_rw||'RW 01'),dukuh:String(config.dukuh||''),desa:String(config.desa||''),saldoAwal:dashboard.saldoAwal,pemasukan:dashboard.pemasukan,pengeluaran:dashboard.pengeluaran,saldo:dashboard.saldo,transactions:getTransactions_()};}
function createReportPdf_(data){
  const report=reportSummary_(),title='Laporan Kas '+report.namaRt+' '+report.namaRw,doc=DocumentApp.create(title+' - '+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd-HHmmss')),body=doc.getBody();
  body.appendParagraph('LAPORAN KAS '+report.namaRt+' / '+report.namaRw).setHeading(DocumentApp.ParagraphHeading.TITLE);body.appendParagraph(report.dukuh+', Desa '+report.desa);body.appendParagraph('Per Tanggal: '+report.date);body.appendHorizontalRule();body.appendParagraph('Saldo Awal: Rp '+formatMoney_(report.saldoAwal));body.appendParagraph('Total Pemasukan: Rp '+formatMoney_(report.pemasukan));body.appendParagraph('Total Pengeluaran: Rp '+formatMoney_(report.pengeluaran));body.appendParagraph('SISA SALDO SEKARANG: Rp '+formatMoney_(report.saldo)).setBold(true);body.appendParagraph('Catatan: Transaksi dicatat secara otomatis via Aplikasi Kas RT.');
  const rows=[['ID','Tanggal','Jenis','Kategori','Keterangan','Nominal']];report.transactions.filter(function(tx){return tx.status==='AKTIF';}).forEach(function(tx){rows.push([tx.id,tx.tanggal,tx.jenis,tx.kategori,tx.keterangan,(tx.jenis==='Pemasukan'?'+ ':'- ')+'Rp '+formatMoney_(tx.nominal)]);});body.appendTable(rows);doc.saveAndClose();
  const source=DriveApp.getFileById(doc.getId()),pdf=DriveApp.createFile(source.getAs(MimeType.PDF)).setName(doc.getName()+'.pdf');source.setTrashed(true);return{success:true,fileId:pdf.getId(),fileName:pdf.getName(),url:pdf.getUrl(),downloadUrl:'https://drive.google.com/uc?export=download&id='+pdf.getId()};
}

/* ==================== 10 ATTACHMENTS ======================== */
function uploadAttachment_(data){
  requireAdmin_(data.password||data.adminPassword);if(!data.base64||!data.fileName)throw new Error('File lampiran tidak lengkap.');
  const folders=DriveApp.getFoldersByName(APP.ATTACHMENT_FOLDER),folder=folders.hasNext()?folders.next():DriveApp.createFolder(APP.ATTACHMENT_FOLDER),bytes=Utilities.base64Decode(String(data.base64).replace(/^data:[^;]+;base64,/,'')),blob=Utilities.newBlob(bytes,data.mimeType||'application/octet-stream',data.fileName),file=folder.createFile(blob);
  return{success:true,fileId:file.getId(),fileName:file.getName(),url:file.getUrl()};
}

/* ==================== 11 DIAGNOSTIC ========================= */
function diagnostic_(){const transactions=getTransactions_(),dashboard=calculateDashboard_();return{success:true,version:APP.VERSION,spreadsheetId:APP.DB_ID,sheets:{transaksi:!!getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI),warga:!!getSpreadsheet_().getSheetByName(SHEETS.WARGA),config:!!getSpreadsheet_().getSheetByName(SHEETS.CONFIG),audit:!!getSpreadsheet_().getSheetByName(SHEETS.AUDIT)},rows:transactions.length,active:transactions.filter(function(tx){return tx.status==='AKTIF';}).length,pemasukan:dashboard.pemasukan,pengeluaran:dashboard.pengeluaran,saldoAwal:dashboard.saldoAwal,saldo:dashboard.saldo,sample:transactions.slice(0,10)};}

/* ==================== 12 NORMALIZATION ===================== */
function normalizeTransaction_(raw){let status=String(raw.Status||'').trim().toUpperCase(),bukti=String(raw.BuktiURL||'');if(!status&&bukti.toUpperCase()==='AKTIF'){status='AKTIF';bukti='';}return{id:String(raw.ID||''),timestamp:dateTime_(raw.Timestamp),tanggal:dateOnly_(raw.Tanggal),waktu:timeOnly_(raw.Waktu),jenis:normalizeType_(raw.Jenis),kategori:String(raw.Kategori||''),nominal:money_(raw.Nominal),keterangan:String(raw.Keterangan||''),catatan:String(raw.Catatan||''),buktiUrl:bukti,status:status,createdBy:String(raw.CreatedBy||''),updatedAt:dateTime_(raw.UpdatedAt),updatedBy:String(raw.UpdatedBy||'')};}
function normalizeWarga_(raw){return{idkk:String(raw.IDKK||''),nik:String(raw.NIK||''),nama:String(raw.Nama||''),hubungan:String(raw.Hubungan||''),jenisKelamin:String(raw.JenisKelamin||''),tanggalLahir:dateOnly_(raw.TanggalLahir),alamat:String(raw.Alamat||''),noHp:String(raw.NoHP||''),status:String(raw.Status||'AKTIF'),updatedAt:dateTime_(raw.UpdatedAt),updatedBy:String(raw.UpdatedBy||'')};}
function findTransaction_(id){const found=findTransactionRow_(id);return found?found.data:null;}
function findTransactionRow_(id){const sheet=getSpreadsheet_().getSheetByName(SHEETS.TRANSAKSI);if(!sheet||sheet.getLastRow()<2)return null;const map=headerMap_(sheet),ids=sheet.getRange(2,map.ID,sheet.getLastRow()-1,1).getValues();for(let i=0;i<ids.length;i++){if(String(ids[i][0])===String(id)){const row=i+2,values=sheet.getRange(row,1,1,sheet.getLastColumn()).getValues()[0],raw={};Object.keys(map).forEach(function(h){raw[h]=values[map[h]-1];});return{sheet:sheet,row:row,data:normalizeTransaction_(raw)};}}return null;}

/* ==================== 13 UTILITIES ========================== */
function readConfig_(){const sheet=getSpreadsheet_().getSheetByName(SHEETS.CONFIG),result={};if(!sheet||sheet.getLastRow()<2)return result;sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().forEach(function(row){if(row[0]!=='')result[String(row[0])]=safeValue_(row[1]);});return result;}
function setConfig_(key,value){const sheet=getSpreadsheet_().getSheetByName(SHEETS.CONFIG);if(sheet.getLastRow()>=2){const values=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();for(let i=0;i<values.length;i++)if(String(values[i][0])===key){sheet.getRange(i+2,2).setValue(value);return;}}sheet.appendRow([key,value]);}
function readCategories_(){const sheet=getSpreadsheet_().getSheetByName(SHEETS.KATEGORI),result={Pemasukan:[],Pengeluaran:[]};if(!sheet||sheet.getLastRow()<2)return result;sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().forEach(function(row){const type=String(row[0]||'');if(result[type]&&row[1])result[type].push(String(row[1]));});return result;}
function headerMap_(sheet){const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),map={};headers.forEach(function(header,index){map[header]=index+1;});return map;}
function normalizeType_(value){const type=String(value||'').trim().toLowerCase();if(type==='pemasukan')return'Pemasukan';if(type==='pengeluaran')return'Pengeluaran';return String(value||'').trim();}
function money_(value){if(typeof value==='number')return value;let text=String(value||'').replace(/[^0-9,.-]/g,'');if(text.includes(',')&&text.includes('.'))text=text.replace(/\./g,'').replace(',','.');else if(text.includes('.'))text=text.replace(/\./g,'');else if(text.includes(','))text=text.replace(',','.');const number=Number(text);return Number.isFinite(number)?number:0;}
function formatMoney_(value){return Number(value||0).toLocaleString('id-ID');}
function dateOnly_(value){return value instanceof Date?Utilities.formatDate(value,APP.TZ,'yyyy-MM-dd'):String(value||'');}
function timeOnly_(value){return value instanceof Date?Utilities.formatDate(value,APP.TZ,'HH:mm'):String(value||'');}
function dateTime_(value){return value instanceof Date?Utilities.formatDate(value,APP.TZ,'yyyy-MM-dd HH:mm:ss'):String(value||'');}
function safeValue_(value){return value instanceof Date?dateTime_(value):value;}
function parsePost_(e){if(!e||!e.postData||!e.postData.contents)return{};try{const payload=JSON.parse(e.postData.contents);return payload.payload?JSON.parse(payload.payload):payload;}catch(err){return{};}}
function jsonResponse_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function errorResponse_(err){return{success:false,message:String(err&&err.message||err),stack:String(err&&err.stack||'')};}
