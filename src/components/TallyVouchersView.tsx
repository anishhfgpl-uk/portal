import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, BookOpen, RefreshCw } from 'lucide-react';
import { Party, TallyVoucher } from '../types';

interface Props {
  vouchers: TallyVoucher[];
  parties: Party[];
  onImport: () => void;
  isImporting: boolean;
}

export const TallyVouchersView: React.FC<Props> = ({ vouchers, parties, onImport, isImporting }) => {
  const [selectedParty, setSelectedParty] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'vouchers'|'ledger'>('vouchers');

  const partyNames = useMemo(() => {
    const names = new Set<string>();
    parties.forEach(p => names.add(p.name));
    vouchers.forEach(v => v.partyName && names.add(v.partyName));
    return Array.from(names).sort();
  }, [parties, vouchers]);

  const filtered = vouchers.filter(v => {
    const t = v.voucherType.toLowerCase();
    const relevant = t.includes('receipt') || t.includes('credit note') || t.includes('creditnote') || t.includes('payment') || t.includes('journal') || t.includes('sales');
    const partyOk = !selectedParty || v.partyName.toLowerCase() === selectedParty.toLowerCase();
    const searchOk = !search || [v.partyName, v.voucherNumber, v.reference || '', v.voucherType].join(' ').toLowerCase().includes(search.toLowerCase());
    return relevant && partyOk && searchOk;
  });

  const ledger = [...filtered].sort((a,b) => a.date.localeCompare(b.date));
  let running = selectedParty
    ? (parties.find(p => p.name.toLowerCase() === selectedParty.toLowerCase())?.opening_balance || 0)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600"/>Tally Vouchers & Party Ledger</h2>
          <p className="text-xs text-slate-500 mt-1">Receipt, Credit Note aur party-wise running ledger directly from Tally Prime.</p>
        </div>
        <button onClick={onImport} disabled={isImporting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
          {isImporting ? <RefreshCw className="w-4 h-4 animate-spin"/> : <ArrowDownToLine className="w-4 h-4"/>}
          {isImporting ? 'Importing...' : 'Import Receipt / Credit Note'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 grid md:grid-cols-3 gap-3">
        <select value={selectedParty} onChange={e=>setSelectedParty(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Parties</option>
          {partyNames.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search party / voucher / reference" className="border rounded-lg px-3 py-2 text-sm"/>
        <div className="flex gap-2">
          <button onClick={()=>setTab('vouchers')} className={'px-3 py-2 rounded-lg text-xs font-bold '+(tab==='vouchers'?'bg-slate-900 text-white':'bg-slate-100')}>Vouchers</button>
          <button onClick={()=>setTab('ledger')} className={'px-3 py-2 rounded-lg text-xs font-bold '+(tab==='ledger'?'bg-slate-900 text-white':'bg-slate-100')}>Party Ledger</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {tab === 'vouchers' ? (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Voucher No.</th><th className="p-3 text-left">Party</th><th className="p-3 text-right">Amount</th><th className="p-3 text-left">Narration</th></tr></thead><tbody className="divide-y">
          {filtered.map(v=><tr key={v.id} className="hover:bg-slate-50"><td className="p-3">{v.date}</td><td className="p-3 font-semibold">{v.voucherType}</td><td className="p-3 font-mono">{v.voucherNumber}</td><td className="p-3">{v.partyName || '-'}</td><td className="p-3 text-right font-bold">₹{v.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td className="p-3 text-slate-500">{v.narration || '-'}</td></tr>)}
          {filtered.length===0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">No imported Receipt / Credit Note vouchers. Click Import.</td></tr>}
          </tbody></table></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Voucher</th><th className="p-3 text-left">Type</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3 text-right">Running Balance</th></tr></thead><tbody className="divide-y">
          {ledger.map(v=>{ running += v.partyEffect; return <tr key={v.id}><td className="p-3">{v.date}</td><td className="p-3 font-mono">{v.voucherNumber}</td><td className="p-3">{v.voucherType}</td><td className="p-3 text-right">{v.partyEffect>0?'₹'+v.partyEffect.toLocaleString('en-IN',{minimumFractionDigits:2}):'-'}</td><td className="p-3 text-right">{v.partyEffect<0?'₹'+Math.abs(v.partyEffect).toLocaleString('en-IN',{minimumFractionDigits:2}):'-'}</td><td className="p-3 text-right font-bold">₹{running.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>})}
          {ledger.length===0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Party select karke ledger dekhein.</td></tr>}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
};
