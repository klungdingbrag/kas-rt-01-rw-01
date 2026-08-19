const KasApi=(()=>{
  function normalizeTransaction(t){if(!t)return t;return{id:t.id??t.ID??'',timestamp:t.timestamp??t.Timestamp??'',tanggal:t.tanggal??t.Tanggal??'',waktu:t.waktu??t.Waktu??'',jenis:t.jenis??t.Jenis??'',kategori:t.kategori??t.Kategori??'',nominal:Number(t.nominal??t.Nominal??0),keterangan:t.keterangan??t.Keterangan??'',catatan:t.catatan??t.Catatan??'',status:String(t.status??t.Status??'').trim().toUpperCase(),buktiUrl:t.buktiUrl??t.BuktiURL??'',updatedAt:t.updatedAt??t.UpdatedAt??''}}
  function normalizeData(d){if(Array.isArray(d?.transactions))d.transactions=d.transactions.map(normalizeTransaction);return d}
  async function get(action,query=''){const url=window.KASRT_CONFIG.apiUrl;if(!url)throw Error('URL database/API belum dikonfigurasi.');const target=`${url}?action=${encodeURIComponent(action)}${query||''}&_=${Date.now()}`;let r;try{r=await fetch(target,{method:'GET',redirect:'follow',cache:'no-store',credentials:'omit'})}catch(err){throw Error('Gagal membaca database Google Apps Script. Detail: '+(err?.message||'Failed to fetch'))}const text=await r.text();let d;try{d=JSON.parse(text)}catch(_){throw Error('Backend tidak mengembalikan JSON yang valid: '+text.slice(0,200))}if(!r.ok||d.success===false)throw Error(d.message||'Request gagal.');return normalizeData(d)}
  function post(action,body={}){return new Promise((resolve,reject)=>{const url=window.KASRT_CONFIG.apiUrl;if(!url)return reject(Error('URL database/API belum dikonfigurasi.'));const token='kasrt_'+Date.now()+'_'+Math.random().toString(36).slice(2);const iframe=document.createElement('iframe');iframe.name=token;iframe.style.display='none';const form=document.createElement('form');form.method='POST';form.action=url;form.target=token;form.style.display='none';const payload=JSON.stringify({...body,action});const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=payload;form.appendChild(input);document.body.appendChild(iframe);document.body.appendChild(form);let done=false;const cleanup=()=>{try{form.remove();iframe.remove()}catch(_) {}};const finish=async()=>{if(done)return;done=true;cleanup();try{const fresh=await get('initialData');resolve({...fresh,writeAcknowledged:true})}catch(e){reject(e)}};iframe.addEventListener('load',()=>setTimeout(finish,1200));form.submit();setTimeout(()=>{if(!done){done=true;cleanup();reject(Error('Server tidak memberikan konfirmasi dalam 15 detik. Jangan kirim ulang transaksi sebelum melakukan sinkronisasi.'))}},15000)})}
  async function createTransaction(body){
    const before=await get('initialData');
    const beforeIds=new Set((before.transactions||[]).map(t=>String(t.id)));
    const first=await post('createTransaction',body);
    const findNew=(data)=>{
      const candidates=(data.transactions||[]).map(normalizeTransaction).filter(t=>!beforeIds.has(String(t.id))&&t.status==='AKTIF'&&Number(t.nominal)===Number(body.nominal)&&t.jenis===body.jenis&&t.kategori===body.kategori&&t.keterangan===body.keterangan);
      candidates.sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
      return candidates[0]||null;
    };
    let tx=findNew(first),data=first;
    for(let i=0;i<10&&!tx;i++){
      await new Promise(r=>setTimeout(r,500));
      data=await get('initialData');
      tx=findNew(data);
    }
    if(!tx)throw Error('Server menerima permintaan, tetapi transaksi baru belum dapat ditemukan saat verifikasi. Jangan kirim ulang. Sinkronkan database terlebih dahulu.');
    return{...data,id:tx.id,transaction:tx,writeAcknowledged:true};
  }
  return{normalizeTransaction,getInitialData:()=>get('initialData'),getTransactions:(query='')=>get('transactions',query),getReportSummary:()=>get('reportSummary'),getDiagnostic:()=>get('diagnostic'),createTransaction,updateTransaction:b=>post('updateTransaction',b),cancelTransaction:b=>post('cancelTransaction',b),updateConfig:b=>post('updateConfig',b),changePassword:b=>post('changePassword',b),exportReport:b=>post('exportReport',b)};
})();
