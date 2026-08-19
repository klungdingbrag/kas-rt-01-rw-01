const KasApi = (() => {
  function normalizeTransaction(t) {
    if (!t) return t;
    return {
      id: t.id ?? t.ID ?? '',
      timestamp: t.timestamp ?? t.Timestamp ?? '',
      tanggal: t.tanggal ?? t.Tanggal ?? '',
      waktu: t.waktu ?? t.Waktu ?? '',
      jenis: t.jenis ?? t.Jenis ?? '',
      kategori: t.kategori ?? t.Kategori ?? '',
      nominal: Number(t.nominal ?? t.Nominal ?? 0),
      keterangan: t.keterangan ?? t.Keterangan ?? '',
      catatan: t.catatan ?? t.Catatan ?? '',
      status: t.status ?? t.Status ?? '',
      buktiUrl: t.buktiUrl ?? t.BuktiURL ?? '',
      updatedAt: t.updatedAt ?? t.UpdatedAt ?? ''
    };
  }

  function normalizeData(data) {
    if (Array.isArray(data?.transactions)) {
      data.transactions = data.transactions.map(normalizeTransaction);
    }
    return data;
  }

  async function request(action, options = {}) {
    const url = window.KASRT_CONFIG.apiUrl;
    if (!url) throw new Error('URL database/API belum dikonfigurasi.');

    const method = options.method || 'GET';
    const query = options.query || '';
    const target = method === 'GET'
      ? `${url}?action=${encodeURIComponent(action)}${query}&_=${Date.now()}`
      : url;

    const fetchOptions = {
      method,
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit'
    };

    if (method !== 'GET') {
      fetchOptions.headers = {
        'Content-Type': 'text/plain;charset=utf-8',
        'Cache-Control': 'no-cache'
      };
      fetchOptions.body = JSON.stringify({...options.body, action});
    }

    const response = await fetch(target, fetchOptions);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error('Backend tidak mengembalikan JSON yang valid.');
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || 'Request gagal.');
    }

    return normalizeData(data);
  }

  return {
    getInitialData: () => request('initialData'),
    getTransactions: (query='') => request('transactions', {query}),
    createTransaction: body => request('createTransaction', {method:'POST', body}),
    updateTransaction: body => request('updateTransaction', {method:'POST', body}),
    cancelTransaction: body => request('cancelTransaction', {method:'POST', body}),
    updateConfig: body => request('updateConfig', {method:'POST', body}),
    changePassword: body => request('changePassword', {method:'POST', body}),
    exportReport: body => request('exportReport', {method:'POST', body})
  };
})();
