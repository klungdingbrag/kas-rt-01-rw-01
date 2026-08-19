const KasApi = (() => {
  const demo = {
    config: {nama_rt:'RT 01',nama_rw:'RW 01',dukuh:'Dukuh Gudang',desa:'Desa Surorejan',kecamatan:'Kecamatan Puring',kabupaten:'Kabupaten Kebumen',ketua_rt:'',bendahara:'',saldo_awal:0},
    transactions: []
  };

  async function request(action, options = {}) {
    const url = window.KASRT_CONFIG.apiUrl;
    if (!url || window.KASRT_CONFIG.demoMode) return mock(action, options);

    const method = options.method || 'GET';
    const target = method === 'GET'
      ? `${url}?action=${encodeURIComponent(action)}${options.query || ''}`
      : url;

    const fetchOptions = { method, redirect: 'follow' };
    if (method !== 'GET') {
      // text/plain avoids the browser's JSON CORS preflight.
      fetchOptions.headers = {'Content-Type':'text/plain;charset=utf-8'};
      fetchOptions.body = JSON.stringify({...options.body, action});
    }

    const response = await fetch(target, fetchOptions);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error('Backend tidak mengembalikan JSON yang valid.'); }
    if (!response.ok || data.success === false) throw new Error(data.message || 'Request gagal.');
    return data;
  }

  function mock(action, options = {}) {
    if (action === 'initialData') {
      const tx = demo.transactions.filter(t => t.status === 'AKTIF');
      const income = tx.filter(t => t.jenis === 'Pemasukan').reduce((s,t) => s + Number(t.nominal), 0);
      const expense = tx.filter(t => t.jenis === 'Pengeluaran').reduce((s,t) => s + Number(t.nominal), 0);
      return {success:true, config:demo.config, categories:{Pemasukan:['Iuran Warga','Sumbangan','Bantuan','Donasi','Pendapatan Kegiatan','Lainnya'],Pengeluaran:['Kebersihan','Keamanan','Kegiatan Warga','Sosial','Perbaikan Fasilitas','Listrik','Administrasi','Konsumsi','Bantuan Warga','Lainnya']}, transactions:[...demo.transactions].reverse(), dashboard:{saldoAwal:Number(demo.config.saldo_awal),pemasukan:income,pengeluaran:expense,saldo:Number(demo.config.saldo_awal)+income-expense,jumlahTransaksi:tx.length}};
    }
    if (action === 'transactions') return {success:true,transactions:[...demo.transactions].reverse()};
    if (action === 'createTransaction') {
      const d = options.body || {};
      const item = {id:`TRX-DEMO-${Date.now()}`,timestamp:new Date().toISOString(),...d,nominal:Number(d.nominal),status:'AKTIF'};
      demo.transactions.push(item);
      return {success:true,message:'Transaksi berhasil disimpan.',id:item.id};
    }
    return {success:true,message:'Mode demo: backend belum dikonfigurasi.'};
  }

  return {
    getInitialData: () => request('initialData'),
    getTransactions: (query='') => request('transactions',{query}),
    createTransaction: body => request('createTransaction',{method:'POST',body}),
    updateTransaction: body => request('updateTransaction',{method:'POST',body}),
    cancelTransaction: body => request('cancelTransaction',{method:'POST',body}),
    updateConfig: body => request('updateConfig',{method:'POST',body}),
    changePassword: body => request('changePassword',{method:'POST',body}),
    exportReport: body => request('exportReport',{method:'POST',body})
  };
})();
