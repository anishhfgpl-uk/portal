import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Printer, RefreshCw, Save, Search, Trash2, X, Wifi, WifiOff } from 'lucide-react';
import { sendTallyRequest } from '../services/tallyService';

type ChallanStatus = 'draft' | 'ready' | 'synced' | 'sync_failed';

type ChallanItem = {
  id: string;
  name: string;
  hsn: string;
  unit: string;
  qty: number;
  rate: number;
};

type Challan = {
  id: string;
  challanNo: string;
  date: string;
  partyName: string;
  partyGstin: string;
  partyAddress: string;
  partyState: string;
  placeOfSupply: string;
  vehicleNo: string;
  ewayBillNo: string;
  reference: string;
  notes: string;
  items: ChallanItem[];
  status: ChallanStatus;
  createdAt: string;
  syncedAt?: string;
  syncMessage?: string;
};

const KEY = 'tally_challans_v1';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nextNumber = (list: Challan[]) => {
  const max = list.reduce((m, c) => {
    const match = c.challanNo.match(/(\d+)$/);
    return Math.max(m, match ? Number(match[1]) : 0);
  }, 0);
  return `DC-${String(max + 1).padStart(4, '0')}`;
};

const emptyChallan = (list: Challan[]): Challan => ({
  id: `challan-${Date.now()}`,
  challanNo: nextNumber(list),
  date: new Date().toISOString().slice(0, 10),
  partyName: '',
  partyGstin: '',
  partyAddress: '',
  partyState: '',
  placeOfSupply: '',
  vehicleNo: '',
  ewayBillNo: '',
  reference: '',
  notes: '',
  items: [{ id: `ci-${Date.now()}`, name: '', hsn: '', unit: 'Nos', qty: 1, rate: 0 }],
  status: 'draft',
  createdAt: new Date().toISOString(),
});

export const ChallanManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [challans, setChallans] = useState<Challan[]>(() => readJson(KEY, []));
  const [current, setCurrent] = useState<Challan>(() => emptyChallan(readJson(KEY, [])));
  const [showSaved, setShowSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [tallyOnline, setTallyOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('Offline-ready: challan browser mein save ho sakta hai.');

  const parties = useMemo(() => readJson<any[]>('tally_parties', []), []);
  const items = useMemo(() => readJson<any[]>('tally_stock_items', []), []);
  const seller = useMemo(() => readJson<any>('tally_seller_info', {}), []);
  const config = useMemo(() => readJson<any>('tally_config', { tallyUrl: 'http://localhost:9000', proxyMode: true, companyName: seller?.name || '' }), [seller]);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(challans));
  }, [challans]);

  const totals = current.items.reduce((sum, row) => sum + (Number(row.qty) || 0) * (Number(row.rate) || 0), 0);

  const saveCurrent = () => {
    if (!current.partyName.trim()) {
      setMessage('Party select/enter karna zaroori hai.');
      return;
    }
    const saved = { ...current, status: 'ready' as ChallanStatus };
    setChallans(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
    setCurrent(saved);
    setMessage(`✅ ${saved.challanNo} offline save ho gaya. Tally baad mein sync kar sakte hain.`);
  };

  const updateCurrent = (patch: Partial<Challan>) => setCurrent(prev => ({ ...prev, ...patch }));

  const selectParty = (name: string) => {
    const p = parties.find(x => x.name === name);
    updateCurrent({
      partyName: name,
      partyGstin: p?.gstin || '',
      partyAddress: p?.address || '',
      partyState: p?.state || '',
      placeOfSupply: p?.state || '',
    });
  };

  const addItem = () => updateCurrent({ items: [...current.items, { id: `ci-${Date.now()}`, name: '', hsn: '', unit: 'Nos', qty: 1, rate: 0 }] });
  const removeItem = (id: string) => updateCurrent({ items: current.items.length === 1 ? current.items : current.items.filter(i => i.id !== id) });
  const updateItem = (id: string, patch: Partial<ChallanItem>) => updateCurrent({ items: current.items.map(i => i.id === id ? { ...i, ...patch } : i) });

  const selectItem = (id: string, name: string) => {
    const stock = items.find(x => x.name === name);
    updateItem(id, { name, hsn: stock?.hsn || '', unit: stock?.unit || 'Nos', rate: Number(stock?.rate || 0) });
  };

  const checkTally = async () => {
    try {
      const result = await sendTallyRequest('<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>CompanyInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>', config);
      const ok = Boolean(result.text?.includes('<ENVELOPE>'));
      setTallyOnline(ok);
      setMessage(ok ? '🟢 Tally Online' : '🔴 Tally Offline');
      return ok;
    } catch (e: any) {
      setTallyOnline(false);
      setMessage(`🔴 Tally Offline: ${e?.message || 'connection failed'}`);
      return false;
    }
  };

  const buildDeliveryNoteXml = (c: Challan) => {
    const inventory = c.items.map(row => {
      const amount = (Number(row.qty) || 0) * (Number(row.rate) || 0);
      return `<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>${esc(row.name)}</STOCKITEMNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><RATE>${esc(row.rate)}</RATE><AMOUNT>-${amount.toFixed(2)}</AMOUNT><ACTUALQTY>${esc(row.qty)} ${esc(row.unit)}</ACTUALQTY><BILLEDQTY>${esc(row.qty)} ${esc(row.unit)}</BILLEDQTY></ALLINVENTORYENTRIES.LIST>`;
    }).join('');
    return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY>${esc(config.companyName || seller?.name || '')}</SVCURRENTCOMPANY></STATICVARIABLES></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER ACTION="Create" VCHTYPE="Delivery Note"><DATE>${c.date.replace(/-/g, '')}</DATE><VOUCHERTYPENAME>Delivery Note</VOUCHERTYPENAME><VOUCHERNUMBER>${esc(c.challanNo)}</VOUCHERNUMBER><REFERENCE>${esc(c.reference)}</REFERENCE><PARTYLEDGERNAME>${esc(c.partyName)}</PARTYLEDGERNAME><PARTYNAME>${esc(c.partyName)}</PARTYNAME><PLACEOFSUPPLY>${esc(c.placeOfSupply)}</PLACEOFSUPPLY><NARRATION>${esc(c.notes)}</NARRATION>${inventory}</VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
  };

  const syncCurrent = async () => {
    if (!current.partyName || !current.items.some(i => i.name)) {
      setMessage('Party aur kam se kam ek item required hai.');
      return;
    }
    setSyncing(true);
    try {
      const online = tallyOnline || await checkTally();
      if (!online) throw new Error('Tally Prime offline hai. Challan local queue mein safe hai.');
      const result = await sendTallyRequest(buildDeliveryNoteXml(current), config);
      if (!result.text.includes('<ENVELOPE>')) throw new Error('Tally ne valid response nahi diya.');
      const updated = { ...current, status: 'synced' as ChallanStatus, syncedAt: new Date().toISOString(), syncMessage: 'Delivery Note sent to Tally Prime' };
      setCurrent(updated);
      setChallans(prev => [updated, ...prev.filter(c => c.id !== updated.id)]);
      setMessage(`✅ ${current.challanNo} Tally mein sync request bhej di gayi.`);
    } catch (e: any) {
      const updated = { ...current, status: 'sync_failed' as ChallanStatus, syncMessage: e?.message || 'Sync failed' };
      setCurrent(updated);
      setChallans(prev => [updated, ...prev.filter(c => c.id !== updated.id)]);
      setMessage(`⚠️ Sync failed, lekin challan local mein safe hai.`);
    } finally {
      setSyncing(false);
    }
  };

  const printCurrent = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${esc(current.challanNo)}</title><style>body{font-family:Arial;padding:28px;color:#111}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #999;padding:8px;text-align:left}.right{text-align:right}.muted{color:#555}</style></head><body><h1>DELIVERY CHALLAN</h1><p><b>Challan No:</b> ${esc(current.challanNo)} &nbsp; <b>Date:</b> ${esc(current.date)}</p><hr/><p><b>From:</b> ${esc(seller?.name || 'Company')}<br/>${esc(seller?.address || '')}<br/>GSTIN: ${esc(seller?.gstin || '')}</p><p><b>To:</b> ${esc(current.partyName)}<br/>${esc(current.partyAddress)}<br/>GSTIN: ${esc(current.partyGstin || 'N/A')}</p><p><b>Vehicle:</b> ${esc(current.vehicleNo || '-')} &nbsp; <b>Reference:</b> ${esc(current.reference || '-')}</p><table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${current.items.map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.name)}</td><td>${esc(i.hsn)}</td><td>${esc(i.qty)} ${esc(i.unit)}</td><td class="right">₹${money(i.rate)}</td><td class="right">₹${money((i.qty||0)*(i.rate||0))}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="5" class="right">Total</th><th class="right">₹${money(totals)}</th></tr></tfoot></table><p><b>Notes:</b> ${esc(current.notes || '')}</p><p class="muted">Computer generated delivery challan.</p><script>window.print()</script></body></html>`);
    win.document.close();
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${current.challanNo}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const filtered = challans.filter(c => `${c.challanNo} ${c.partyName}`.toLowerCase().includes(query.toLowerCase()));

  const loadSaved = (c: Challan) => { setCurrent(c); setShowSaved(false); setMessage(`${c.challanNo} loaded.`); };
  const deleteSaved = (id: string) => { setChallans(prev => prev.filter(c => c.id !== id)); if (current.id === id) setCurrent(emptyChallan(challans.filter(c => c.id !== id))); };
  const newChallan = () => { setCurrent(emptyChallan(challans)); setShowSaved(false); setMessage('New challan ready.'); };

  return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
    <div className="bg-white w-full max-w-7xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <div className="px-5 py-3 bg-slate-950 text-white flex items-center justify-between">
        <div><h2 className="font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5"/> Delivery Challan Manager</h2><p className="text-xs text-slate-400">Offline save → later Tally Prime sync</p></div>
        <div className="flex items-center gap-2"><button onClick={checkTally} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tallyOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{tallyOnline ? <Wifi className="inline w-3 h-3 mr-1"/> : <WifiOff className="inline w-3 h-3 mr-1"/>}{tallyOnline ? 'Tally Online' : 'Check Tally'}</button><button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5"/></button></div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          <div className="flex items-center justify-between mb-4"><div><h3 className="text-xl font-bold text-slate-800">{current.challanNo}</h3><p className="text-xs text-slate-500">Status: <b>{current.status}</b></p></div><button onClick={newChallan} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4"/> New</button></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-semibold">Challan No<input value={current.challanNo} onChange={e=>updateCurrent({challanNo:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
            <label className="text-xs font-semibold">Date<input type="date" value={current.date} onChange={e=>updateCurrent({date:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
            <label className="text-xs font-semibold">Vehicle No<input value={current.vehicleNo} onChange={e=>updateCurrent({vehicleNo:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="UP/XX/XXXX"/></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs font-semibold">Party<select value={current.partyName} onChange={e=>selectParty(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"><option value="">Select party...</option>{parties.map(p=><option key={p.id||p.name}>{p.name}</option>)}</select></label>
            <label className="text-xs font-semibold">Place of Supply<input value={current.placeOfSupply} onChange={e=>updateCurrent({placeOfSupply:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs font-semibold">Reference / Order No<input value={current.reference} onChange={e=>updateCurrent({reference:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
            <label className="text-xs font-semibold">E-Way Bill No<input value={current.ewayBillNo} onChange={e=>updateCurrent({ewayBillNo:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
          </div>
          {current.partyName && <div className="mt-3 p-3 bg-white border rounded-lg text-xs text-slate-600"><b>{current.partyName}</b><br/>{current.partyAddress || 'Address not available'}<br/>GSTIN: {current.partyGstin || 'Unregistered'} | State: {current.partyState || '-'}</div>}

          <div className="mt-5 bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between"><b>Items</b><button onClick={addItem} className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">+ Add Item</button></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-100"><tr><th className="p-2 text-left">Item</th><th className="p-2">HSN</th><th className="p-2">Qty</th><th className="p-2">Unit</th><th className="p-2">Rate</th><th className="p-2">Amount</th><th></th></tr></thead><tbody>{current.items.map(row=><tr key={row.id} className="border-t"><td className="p-2 min-w-[260px]"><select value={row.name} onChange={e=>selectItem(row.id,e.target.value)} className="w-full border rounded px-2 py-1.5"><option value="">Select item...</option>{items.map(i=><option key={i.id||i.name}>{i.name}</option>)}</select>{!row.name && <input value={row.name} onChange={e=>updateItem(row.id,{name:e.target.value})} className="mt-1 w-full border rounded px-2 py-1" placeholder="Or type item name"/>}</td><td className="p-2"><input value={row.hsn} onChange={e=>updateItem(row.id,{hsn:e.target.value})} className="w-24 border rounded px-2 py-1.5"/></td><td className="p-2"><input type="number" min="0" value={row.qty} onChange={e=>updateItem(row.id,{qty:Number(e.target.value)})} className="w-20 border rounded px-2 py-1.5"/></td><td className="p-2"><input value={row.unit} onChange={e=>updateItem(row.id,{unit:e.target.value})} className="w-20 border rounded px-2 py-1.5"/></td><td className="p-2"><input type="number" min="0" value={row.rate} onChange={e=>updateItem(row.id,{rate:Number(e.target.value)})} className="w-28 border rounded px-2 py-1.5"/></td><td className="p-2 text-right font-semibold">₹{money(row.qty*row.rate)}</td><td className="p-2"><button onClick={()=>removeItem(row.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody></table></div>
            <div className="px-4 py-3 border-t flex justify-end"><div className="text-right"><div className="text-xs text-slate-500">Total Goods Value</div><div className="text-2xl font-bold">₹{money(totals)}</div></div></div>
          </div>
          <label className="block mt-3 text-xs font-semibold">Notes<textarea value={current.notes} onChange={e=>updateCurrent({notes:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2}/></label>
          <div className="mt-4 flex flex-wrap gap-2"><button onClick={saveCurrent} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold flex items-center gap-2"><Save className="w-4 h-4"/> Save Offline</button><button onClick={syncCurrent} disabled={syncing} className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">{syncing?<RefreshCw className="w-4 h-4 animate-spin"/>:<Wifi className="w-4 h-4"/>} Sync to Tally</button><button onClick={printCurrent} className="px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold flex items-center gap-2"><Printer className="w-4 h-4"/> Print</button><button onClick={downloadJson} className="px-4 py-2.5 rounded-lg border bg-white text-slate-700 text-sm font-semibold flex items-center gap-2"><Download className="w-4 h-4"/> Backup JSON</button></div>
          <div className="mt-3 text-xs p-3 rounded-lg bg-white border text-slate-600">{message}</div>
        </div>

        <aside className="w-full lg:w-80 border-l bg-white p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3"><h3 className="font-bold">Saved Challans</h3><span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{challans.length}</span></div>
          <div className="relative mb-3"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search challan / party" className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"/></div>
          <div className="space-y-2">{filtered.map(c=><div key={c.id} className="border rounded-lg p-3 hover:bg-slate-50"><div className="flex justify-between gap-2"><button onClick={()=>loadSaved(c)} className="text-left font-semibold text-sm text-blue-700">{c.challanNo}</button><button onClick={()=>deleteSaved(c.id)} className="text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button></div><div className="text-xs mt-1 text-slate-600">{c.partyName}</div><div className="text-[11px] mt-2 flex justify-between"><span>{c.date}</span><span className={c.status==='synced'?'text-emerald-600':c.status==='sync_failed'?'text-rose-600':'text-amber-600'}>{c.status}</span></div></div>)}{filtered.length===0&&<div className="text-xs text-slate-400 text-center py-8">No saved challans</div>}</div>
        </aside>
      </div>
    </div>
  </div>;
};
