import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Download, FileText, Loader2, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Invoice, SellerInfo } from '../types';
import {
  validateInvoicesForGstr1,
  autoFixInvoicesForGstr1,
  calculateGstr1Summary,
  downloadGstr1JsonFile,
  downloadGstr1CsvFile,
} from '../services/gstr1Service';
import { importGstr1SalesFromTally } from '../services/gstr1TallyImportService';

interface Gstr1ReportViewProps {
  invoices: Invoice[];
  sellerInfo: SellerInfo;
  companies?: SellerInfo[];
  onSelectCompany?: (company: SellerInfo) => void;
  onUpdateInvoices: (updatedInvoices: Invoice[]) => void;
  onNewInvoiceClick: () => void;
}

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad = (n: number) => String(n).padStart(2, '0');
const periodCode = (year: number, month: number) => `${pad(month)}${year}`;
const parsePeriod = (value: string) => ({ month: Number(value.slice(0, 2)), year: Number(value.slice(2)) });

function isoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [d, m, y] = value.split('-');
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  return new Date(value);
}

export const Gstr1ReportView: React.FC<Gstr1ReportViewProps> = ({
  invoices,
  sellerInfo,
  companies = [],
  onSelectCompany,
  onUpdateInvoices,
  onNewInvoiceClick,
}) => {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const [selectedPeriod, setSelectedPeriod] = useState(periodCode(defaultYear, now.getMonth() + 1));
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { month, year } = parsePeriod(selectedPeriod);

  const visibleInvoices = useMemo(() => invoices.filter(inv => {
    if (scope === 'active') {
      const sameFirm = sellerInfo.gstin && inv.sellerGstin
        ? inv.sellerGstin.toUpperCase() === sellerInfo.gstin.toUpperCase()
        : (inv.sellerName || '').toLowerCase() === (sellerInfo.name || '').toLowerCase();
      if (!sameFirm) return false;
    }
    const d = isoDate(inv.invoiceDate);
    return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === month && d.getFullYear() === year;
  }), [invoices, sellerInfo, scope, month, year]);

  const summary = useMemo(() => calculateGstr1Summary(visibleInvoices, sellerInfo, selectedPeriod), [visibleInvoices, sellerInfo, selectedPeriod]);
  const validation = useMemo(() => validateInvoicesForGstr1(visibleInvoices, sellerInfo, selectedPeriod), [visibleInvoices, sellerInfo, selectedPeriod]);

  const handleImport = async () => {
    setImporting(true);
    setError('');
    setMessage(`Tally se ${monthNames[month - 1]} ${year} ke Sales bills read ho rahe hain...`);
    try {
      const result = await importGstr1SalesFromTally(selectedPeriod, sellerInfo);
      if (!result.invoices.length) {
        setMessage('Tally ne is period ke liye koi Sales invoice return nahi kiya.');
        return;
      }

      const importedKeys = new Set(result.invoices.map(i => `${i.invoiceNo.trim().toLowerCase()}|${i.invoiceDate}|${(i.sellerGstin || sellerInfo.gstin).toUpperCase()}`));
      const importedByKey = new Map(result.invoices.map(i => [`${i.invoiceNo.trim().toLowerCase()}|${i.invoiceDate}|${(i.sellerGstin || sellerInfo.gstin).toUpperCase()}`, i]));
      const existing = [...invoices];
      const existingKeys = new Set(existing.map(i => `${i.invoiceNo.trim().toLowerCase()}|${i.invoiceDate}|${(i.sellerGstin || '').toUpperCase()}`));
      const merged = existing.map(i => {
        const key = `${i.invoiceNo.trim().toLowerCase()}|${i.invoiceDate}|${(i.sellerGstin || '').toUpperCase()}`;
        return importedByKey.get(key) || i;
      });
      result.invoices.forEach(i => {
        const key = `${i.invoiceNo.trim().toLowerCase()}|${i.invoiceDate}|${(i.sellerGstin || sellerInfo.gstin).toUpperCase()}`;
        if (!existingKeys.has(key)) merged.unshift(i);
      });
      onUpdateInvoices(merged);
      setMessage(`✅ Tally se ${result.invoices.length} Sales bills import/update ho gaye. Ab ye isi GSTR-1 period me show honge.`);
      void importedKeys;
    } catch (e: any) {
      setError(e?.name === 'AbortError' ? 'Tally response time-out hua. Ab full company data nahi kheench raha; sirf selected month ke Sales bills request honge.' : (e?.message || 'Tally import failed.'));
      setMessage('');
    } finally {
      setImporting(false);
    }
  };

  const handleAutoFix = () => {
    const fixed = autoFixInvoicesForGstr1(invoices, sellerInfo);
    onUpdateInvoices(fixed);
    setMessage('Invoice format, POS, UQC aur tax calculations normalize kar diye gaye hain.');
    setError('');
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen p-5 md:p-6 space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1"><ShieldCheck className="w-5 h-5"/>GSTR-1</div>
            <h1 className="text-2xl font-bold text-white">GSTR-1 Sales Return</h1>
            <p className="text-sm text-slate-400 mt-1">Current Tally company se selected month ke Sales bills import karke GSTR-1 JSON banaye.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleImport} disabled={importing} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
              {importing ? 'Tally Reading...' : 'Import Bills from Tally'}
            </button>
            <button onClick={handleAutoFix} disabled={!visibleInvoices.length} className="px-4 py-2.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 disabled:opacity-50 border border-indigo-500/40 text-indigo-200 font-semibold text-sm">Auto-Fix</button>
            <button onClick={() => downloadGstr1CsvFile(summary)} disabled={!visibleInvoices.length} className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm flex items-center gap-2"><FileText className="w-4 h-4"/>CSV</button>
            <button onClick={() => downloadGstr1JsonFile(summary)} disabled={!visibleInvoices.length} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2"><Download className="w-4 h-4"/>Download GST JSON</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] uppercase text-slate-500">Company</div>
            {companies.length > 1 && onSelectCompany ? (
              <select value={sellerInfo.name} onChange={e => { const c = companies.find(x => x.name === e.target.value); if (c) onSelectCompany(c); }} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white">
                {companies.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
              </select>
            ) : <div className="font-semibold text-white mt-1">{sellerInfo.name}</div>}
            <div className="text-xs text-blue-300 font-mono mt-1">{sellerInfo.gstin || 'GSTIN not set'}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] uppercase text-slate-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Return Period</div>
            <div className="flex gap-2 mt-1">
              <select value={month} onChange={e => setSelectedPeriod(periodCode(year, Number(e.target.value)))} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white">{monthNames.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
              <select value={year} onChange={e => setSelectedPeriod(periodCode(Number(e.target.value), month))} className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white">{Array.from({length: 6}, (_, i) => now.getFullYear() - 3 + i).map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] uppercase text-slate-500">Invoice Scope</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setScope('active')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${scope === 'active' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Active Firm</button>
              <button onClick={() => setScope('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${scope === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>All</button>
            </div>
          </div>
        </div>

        {(message || error) && <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${error ? 'border-rose-500/40 bg-rose-950/30 text-rose-300' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'}`}>{error ? <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</span> : <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{message}</span>}</div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Bills" value={visibleInvoices.length}/>
        <Stat label="B2B" value={summary.b2bInvoiceCount}/>
        <Stat label="B2C" value={summary.b2csCount + summary.b2clInvoiceCount}/>
        <Stat label="Taxable" value={`₹${summary.grandTaxable.toFixed(2)}`}/>
        <Stat label="Total Tax" value={`₹${summary.grandTotalTax.toFixed(2)}`}/>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div><h2 className="font-bold text-white">Sales Bills</h2><p className="text-xs text-slate-500 mt-0.5">{monthNames[month - 1]} {year} · {visibleInvoices.length} bills</p></div>
          <div className={`text-xs font-semibold ${validation.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>{validation.isValid ? '✓ Ready' : `${validation.errorCount} errors · ${validation.warningCount} warnings`}</div>
        </div>
        {visibleInvoices.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Is period me bill nahi mila. <button onClick={handleImport} disabled={importing} className="text-blue-400 hover:text-blue-300 underline">Tally se Import Bills</button> karein.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase"><tr><th className="text-left px-4 py-3">Invoice</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Party</th><th className="text-left px-4 py-3">GSTIN</th><th className="text-right px-4 py-3">Taxable</th><th className="text-right px-4 py-3">Tax</th><th className="text-right px-4 py-3">Total</th></tr></thead>
              <tbody>{visibleInvoices.map(inv => <tr key={inv.id} className="border-t border-slate-800 hover:bg-slate-800/40"><td className="px-4 py-3 font-semibold text-white">{inv.invoiceNo}</td><td className="px-4 py-3 text-slate-300">{inv.invoiceDate}</td><td className="px-4 py-3 text-slate-200">{inv.partyName}</td><td className="px-4 py-3 font-mono text-xs text-blue-300">{inv.gstin || 'B2C'}</td><td className="px-4 py-3 text-right">₹{inv.subtotalTaxable.toFixed(2)}</td><td className="px-4 py-3 text-right">₹{inv.totalTax.toFixed(2)}</td><td className="px-4 py-3 text-right font-semibold text-emerald-300">₹{inv.grandTotal.toFixed(2)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><div className="text-xs text-slate-500 uppercase">{label}</div><div className="text-lg font-bold text-white mt-1">{value}</div></div>;
}
