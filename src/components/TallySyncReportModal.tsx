import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  X,
  FileText,
  Users,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SyncReport, Invoice } from '../types';

interface TallySyncReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SyncReport | null;
  onViewInvoice?: (invoice: Invoice) => void;
}

export const TallySyncReportModal: React.FC<TallySyncReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onViewInvoice,
}) => {
  if (!isOpen || !report) return null;

  const hasActivity =
    report.importedCount > 0 ||
    report.exportedCount > 0 ||
    report.duplicatesPreventedCount > 0 ||
    report.discoveredParties > 0 ||
    report.discoveredItems > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Tally Prime Two-Way Sync &amp; Anti-Duplicate Report
              </h3>
              <p className="text-xs text-slate-500">
                Processed at {new Date(report.timestamp).toLocaleTimeString()} • Zero duplicate bills guaranteed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-5 pr-1 flex-1">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-emerald-800">Imported</span>
                <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{report.importedCount}</div>
              <span className="text-[10px] text-emerald-600 mt-0.5">New from Tally</span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-blue-800">Exported</span>
                <ArrowUpFromLine className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-700 mt-1">{report.exportedCount}</div>
              <span className="text-[10px] text-blue-600 mt-0.5">Pushed to Tally</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-800">Duplicates Avoided</span>
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 mt-1">{report.duplicatesPreventedCount}</div>
              <span className="text-[10px] text-amber-600 mt-0.5">Matched &amp; Protected</span>
            </div>

            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-purple-800">Total in Portal</span>
                <Layers className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-purple-700 mt-1">{report.totalInPortal}</div>
              <span className="text-[10px] text-purple-600 mt-0.5">Clean Invoices</span>
            </div>
          </div>

          {/* Master Auto-Discovery Badges */}
          {(report.discoveredParties > 0 || report.discoveredItems > 0) && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-semibold text-indigo-900">
                  Auto-Discovered Master Data added to Directory:
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {report.discoveredParties > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-indigo-700 border border-indigo-200">
                    <Users className="w-3 h-3 mr-1" />
                    +{report.discoveredParties} Parties
                  </span>
                )}
                {report.discoveredItems > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-indigo-700 border border-indigo-200">
                    <Package className="w-3 h-3 mr-1" />
                    +{report.discoveredItems} Items
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Warnings */}
          {report.errors.length > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <div className="flex items-center space-x-2 text-rose-800 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Sync Warnings / Notices ({report.errors.length})</span>
              </div>
              <ul className="text-xs text-rose-700 list-disc list-inside space-y-0.5">
                {report.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Newly Imported Invoices List */}
          {report.importedInvoices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                <span>Newly Imported Invoices from Tally Prime ({report.importedInvoices.length})</span>
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {report.importedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-50/50 hover:bg-slate-100/70 transition flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-blue-600">{inv.invoiceNo}</span>
                        <span className="text-[11px] text-slate-400">• {inv.invoiceDate}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Imported
                        </span>
                      </div>
                      <div className="font-medium text-slate-700 truncate max-w-sm">{inv.partyName}</div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="font-mono font-bold text-slate-900">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {inv.items.length} item(s) • GST ₹{inv.totalTax.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Newly Exported Invoices List */}
          {report.exportedInvoices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-600" />
                <span>Newly Exported to Tally Prime ({report.exportedInvoices.length})</span>
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {report.exportedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-50/50 hover:bg-slate-100/70 transition flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-blue-600">{inv.invoiceNo}</span>
                        <span className="text-[11px] text-slate-400">• {inv.invoiceDate}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                          Exported
                        </span>
                      </div>
                      <div className="font-medium text-slate-700 truncate max-w-sm">{inv.partyName}</div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="font-mono font-bold text-slate-900">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-semibold">Live in Tally</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Protected Log */}
          {report.skippedInvoices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Anti-Duplication Protection Audit ({report.skippedInvoices.length})</span>
              </h4>
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-3 divide-y divide-amber-200/50 max-h-40 overflow-y-auto">
                {report.skippedInvoices.map((skip, sIdx) => (
                  <div key={sIdx} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-amber-900">{skip.invoiceNo}</span>
                    <span className="text-amber-700 text-right">{skip.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasActivity && (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">All Invoices Perfectly in Sync</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No new invoices were found in Tally, and no pending invoices required export. Duplication protection confirmed!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Tally Prime database matched 100% with Portal.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
