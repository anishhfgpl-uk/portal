import React, { useState } from 'react';
import {
  Search,
  Printer,
  FileCode,
  UploadCloud,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Copy,
  ExternalLink,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Download,
  Layers,
  Check,
  FileCode2,
} from 'lucide-react';
import { Invoice, SellerInfo, TallyConfig, SyncReport, Party, StockItem } from '../types';
import {
  generateTallySalesVoucherXML,
  generateTallyBatchSalesVouchersXML,
  sendTallyRequest,
  exportInvoiceToTally,
  fetchSalesVouchersFromTally,
  performTwoWaySync,
} from '../services/tallyService';
import { TallySyncReportModal } from './TallySyncReportModal';
import { Building2 } from 'lucide-react';

interface SavedInvoicesViewProps {
  invoices: Invoice[];
  onPrintInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onBulkUpdateInvoices: (invoices: Invoice[]) => void;
  onNewInvoiceClick: () => void;
  onOpenXmlPaste?: () => void;
  onAddParties?: (parties: Party[]) => void;
  onAddItems?: (items: StockItem[]) => void;
  sellerInfo: SellerInfo;
  companies?: SellerInfo[];
  onSelectCompany?: (company: SellerInfo) => void;
  tallyConfig: TallyConfig;
  tallyStatus: 'online' | 'offline' | 'checking';
  onTestConnection: () => void;
}

export const SavedInvoicesView: React.FC<SavedInvoicesViewProps> = ({
  invoices,
  onPrintInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
  onBulkUpdateInvoices,
  onNewInvoiceClick,
  onOpenXmlPaste,
  onAddParties,
  onAddItems,
  sellerInfo,
  companies = [],
  onSelectCompany,
  tallyConfig,
  tallyStatus,
  onTestConnection,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'synced' | 'pending' | 'imported'>('all');
  const [companyFilterMode, setCompanyFilterMode] = useState<'active' | 'all'>('active');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isTwoWaySyncing, setIsTwoWaySyncing] = useState<boolean>(false);
  const [isImportingFromTally, setIsImportingFromTally] = useState<boolean>(false);
  const [isExportingPending, setIsExportingPending] = useState<boolean>(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Invoices filtered by company
  const companyScopedInvoices = invoices.filter((inv) => {
    if (companyFilterMode === 'all') return true;
    if (inv.sellerGstin && sellerInfo.gstin) {
      return inv.sellerGstin.trim().toLowerCase() === sellerInfo.gstin.trim().toLowerCase();
    }
    if (inv.sellerName && sellerInfo.name) {
      return inv.sellerName.trim().toLowerCase() === sellerInfo.name.trim().toLowerCase();
    }
    return true;
  });

  // Filter logic
  const filteredInvoices = companyScopedInvoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(term) ||
      inv.partyName.toLowerCase().includes(term) ||
      (inv.gstin && inv.gstin.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (statusFilter === 'synced') return inv.tallySyncStatus === 'synced';
    if (statusFilter === 'pending') return inv.tallySyncStatus !== 'synced';
    if (statusFilter === 'imported') return inv.source === 'tally_import';
    return true;
  });

  const pendingInvoices = companyScopedInvoices.filter((i) => i.tallySyncStatus !== 'synced');
  const syncedInvoices = companyScopedInvoices.filter((i) => i.tallySyncStatus === 'synced');
  const importedInvoices = companyScopedInvoices.filter((i) => i.source === 'tally_import');

  // 1. Two-Way Smart Sync (Import new from Tally, de-duplicate, and export pending to Tally)
  const handleTwoWaySmartSync = async () => {
    setIsTwoWaySyncing(true);
    setActionMessage(null);

    try {
      const result = await performTwoWaySync({
        portalInvoices: invoices,
        sellerInfo,
        tallyConfig,
      });

      onBulkUpdateInvoices(result.updatedInvoices);

      if (result.newParties.length > 0 && onAddParties) {
        onAddParties(result.newParties);
      }
      if (result.newItems.length > 0 && onAddItems) {
        onAddItems(result.newItems);
      }

      setSyncReport(result.report);
      setIsReportModalOpen(true);

      const msg = `✅ Two-Way Sync Complete! ${result.report.importedCount} Imported, ${result.report.exportedCount} Exported, ${result.report.duplicatesPreventedCount} Duplicates Prevented.`;
      setActionMessage({ text: msg, type: 'success' });
    } catch (err: any) {
      setActionMessage({
        text: `❌ Two-Way Sync Failed: ${err.message}. Ensure Tally Prime is running on Port 9000.`,
        type: 'error',
      });
    } finally {
      setIsTwoWaySyncing(false);
    }
  };

  // 2. Direct Import from Tally Prime (Fetch Sales Vouchers)
  const handleImportFromTally = async () => {
    setIsImportingFromTally(true);
    setActionMessage(null);

    try {
      const result = await fetchSalesVouchersFromTally(tallyConfig, sellerInfo);

      if (result.invoices.length === 0) {
        setActionMessage({
          text: 'No Sales Vouchers found in the currently active Tally Prime company.',
          type: 'info',
        });
        return;
      }

      // De-duplicate against existing invoices
      const existingMap = new Map<string, Invoice>();
      invoices.forEach((inv) => {
        existingMap.set(inv.invoiceNo.trim().toLowerCase(), inv);
      });

      const newInvoices: Invoice[] = [];
      let duplicateCount = 0;

      result.invoices.forEach((tallyInv) => {
        const key = tallyInv.invoiceNo.trim().toLowerCase();
        if (existingMap.has(key)) {
          duplicateCount++;
        } else {
          newInvoices.push(tallyInv);
          existingMap.set(key, tallyInv);
        }
      });

      const updated = [...newInvoices, ...invoices];
      onBulkUpdateInvoices(updated);

      if (result.extractedParties.length > 0 && onAddParties) {
        onAddParties(result.extractedParties);
      }
      if (result.extractedItems.length > 0 && onAddItems) {
        onAddItems(result.extractedItems);
      }

      const report: SyncReport = {
        timestamp: new Date().toISOString(),
        importedCount: newInvoices.length,
        exportedCount: 0,
        updatedCount: duplicateCount,
        duplicatesPreventedCount: duplicateCount,
        totalInPortal: updated.length,
        totalInTally: result.invoices.length,
        importedInvoices: newInvoices,
        exportedInvoices: [],
        skippedInvoices: duplicateCount > 0 ? [{ invoiceNo: 'Matched Invoices', reason: `${duplicateCount} invoices already existed and were protected from duplication` }] : [],
        discoveredParties: result.extractedParties.length,
        discoveredItems: result.extractedItems.length,
        errors: [],
      };

      setSyncReport(report);
      setIsReportModalOpen(true);

      setActionMessage({
        text: `✅ Imported ${newInvoices.length} new invoices from Tally (${duplicateCount} duplicates prevented).`,
        type: 'success',
      });
    } catch (err: any) {
      setActionMessage({
        text: `❌ Import Failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsImportingFromTally(false);
    }
  };

  // 3. Export all pending portal invoices to Tally Prime
  const handleExportAllPending = async () => {
    if (pendingInvoices.length === 0) {
      setActionMessage({
        text: 'All invoices are already synchronized with Tally Prime. Nothing to export!',
        type: 'info',
      });
      return;
    }

    setIsExportingPending(true);
    setActionMessage(null);

    const exportedList: Invoice[] = [];
    const errors: string[] = [];
    let updatedInvoices = [...invoices];

    for (const inv of pendingInvoices) {
      try {
        const res = await exportInvoiceToTally(inv, tallyConfig, sellerInfo.name);
        if (res.success) {
          const syncedInv: Invoice = {
            ...inv,
            tallySyncStatus: 'synced',
            tallySyncDate: new Date().toISOString(),
            isDuplicateProtected: true,
          };
          exportedList.push(syncedInv);
          updatedInvoices = updatedInvoices.map((i) => (i.id === inv.id ? syncedInv : i));
        } else {
          errors.push(`${inv.invoiceNo}: ${res.message}`);
        }
      } catch (err: any) {
        errors.push(`${inv.invoiceNo}: ${err.message}`);
      }
    }

    onBulkUpdateInvoices(updatedInvoices);

    const report: SyncReport = {
      timestamp: new Date().toISOString(),
      importedCount: 0,
      exportedCount: exportedList.length,
      updatedCount: 0,
      duplicatesPreventedCount: 0,
      totalInPortal: updatedInvoices.length,
      totalInTally: 0,
      importedInvoices: [],
      exportedInvoices: exportedList,
      skippedInvoices: [],
      discoveredParties: 0,
      discoveredItems: 0,
      errors,
    };

    setSyncReport(report);
    setIsReportModalOpen(true);

    if (exportedList.length > 0) {
      setActionMessage({
        text: `✅ Successfully exported ${exportedList.length} pending invoices to Tally Prime!`,
        type: 'success',
      });
    } else {
      setActionMessage({
        text: `❌ Export Failed: ${errors.join(', ')}`,
        type: 'error',
      });
    }

    setIsExportingPending(false);
  };

  // 4. Download Batch XML for Pending Invoices
  const handleDownloadBatchXml = () => {
    const toExport = pendingInvoices.length > 0 ? pendingInvoices : invoices;
    if (toExport.length === 0) {
      setActionMessage({ text: 'No invoices available to download XML.', type: 'info' });
      return;
    }

    const xml = generateTallyBatchSalesVouchersXML(toExport, sellerInfo.name);
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tally_Batch_Sales_Vouchers_${new Date().toISOString().slice(0, 10)}.xml`;
    link.click();
    URL.revokeObjectURL(url);

    setActionMessage({
      text: `✅ Batch XML file with ${toExport.length} invoices downloaded for Tally Prime.`,
      type: 'success',
    });
  };

  // 5. Individual Push
  const handlePushToTally = async (inv: Invoice) => {
    setSyncingId(inv.id);
    setActionMessage(null);

    try {
      const res = await exportInvoiceToTally(inv, tallyConfig, sellerInfo.name);
      if (res.success) {
        const updated: Invoice = {
          ...inv,
          tallySyncStatus: 'synced',
          tallySyncDate: new Date().toISOString(),
          isDuplicateProtected: true,
        };
        onUpdateInvoice(updated);

        setActionMessage({
          text: `✅ Invoice ${inv.invoiceNo} successfully exported to Tally Prime!`,
          type: 'success',
        });
      } else {
        setActionMessage({
          text: `❌ Tally Error for ${inv.invoiceNo}: ${res.message}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setActionMessage({
        text: `❌ Tally Push Failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setSyncingId(null);
    }
  };

  // 6. Individual Download XML
  const handleDownloadXml = (inv: Invoice) => {
    const xml = generateTallySalesVoucherXML(inv, sellerInfo.name);
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tally_Sales_${inv.invoiceNo}.xml`;
    link.click();
    URL.revokeObjectURL(url);

    setActionMessage({
      text: `XML file for ${inv.invoiceNo} downloaded for Tally Prime.`,
      type: 'success',
    });
  };

  const totalSalesValue = companyScopedInvoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const totalTaxValue = companyScopedInvoices.reduce((acc, i) => acc + i.totalTax, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border shadow-xs animate-in fade-in duration-150 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : actionMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Multi-Company Data Refresh & Filter Strip */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3.5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Firm / Dataset</span>
              {companies.length > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {companies.length} Firms Configured
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {companies.length > 0 && onSelectCompany ? (
                <select
                  value={sellerInfo.name}
                  onChange={(e) => {
                    const target = companies.find((c) => c.name === e.target.value);
                    if (target) {
                      onSelectCompany(target);
                      setActionMessage({
                        text: `🏢 Switched to ${target.name}. Invoices and Tally metrics refreshed!`,
                        type: 'info',
                      });
                    }
                  }}
                  className="text-sm font-extrabold text-slate-800 bg-transparent border border-slate-300 rounded-md px-2 py-1 focus:border-blue-500 outline-none cursor-pointer"
                >
                  {companies.map((comp) => {
                    const count = invoices.filter(
                      (inv) =>
                        inv.sellerGstin === comp.gstin ||
                        inv.sellerName === comp.name
                    ).length;
                    return (
                      <option key={comp.id || comp.name} value={comp.name}>
                        {comp.name} ({count} Invoices) — GSTIN: {comp.gstin || 'Unregistered'}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="text-sm font-bold text-slate-800">{sellerInfo.name}</span>
              )}
              <span className="text-xs text-slate-500">
                GSTIN: <strong className="text-slate-700">{sellerInfo.gstin || 'N/A'}</strong> • State:{' '}
                <strong className="text-slate-700">{sellerInfo.state} ({sellerInfo.stateCode})</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter Scope Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setCompanyFilterMode('active')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                companyFilterMode === 'active'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Firm ({invoices.filter((i) => i.sellerGstin === sellerInfo.gstin || i.sellerName === sellerInfo.name).length})
            </button>
            <button
              onClick={() => setCompanyFilterMode('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                companyFilterMode === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Firms ({invoices.length})
            </button>
          </div>

          <button
            onClick={() => {
              onTestConnection();
              setActionMessage({
                text: `🔄 Data and Tally sync refreshed for ${sellerInfo.name}!`,
                type: 'success',
              });
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
            title="Refresh current firm data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Two-Way Sync Command Center Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Anti-Duplication Engine Active
              </span>
              <span className="text-xs text-slate-400">
                Connected to: <strong className="text-white">{sellerInfo.name}</strong>
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Tally Prime Invoice Synchronization &amp; Repository
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Tally me bane huye invoices import karein aur portal par bane huye bills Tally me export karein. Hamara smart deduplication engine ensure karta hai ki koi bhi invoice duplicate na bane.
            </p>
          </div>

          {/* Sync Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* 2-Way Smart Sync */}
            <button
              onClick={handleTwoWaySmartSync}
              disabled={isTwoWaySyncing}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
              title="Pull latest Tally invoices, deduplicate, and push pending portal invoices"
            >
              <RefreshCw className={`w-4 h-4 ${isTwoWaySyncing ? 'animate-spin' : ''}`} />
              <span>{isTwoWaySyncing ? 'Syncing...' : '2-Way Smart Sync'}</span>
            </button>

            {/* Import from Tally */}
            <button
              onClick={handleImportFromTally}
              disabled={isImportingFromTally}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/30 transition cursor-pointer disabled:opacity-50"
              title="Import all sales vouchers from active Tally Prime company"
            >
              <ArrowDownToLine className={`w-4 h-4 ${isImportingFromTally ? 'animate-bounce' : ''}`} />
              <span>Import from Tally</span>
            </button>

            {/* Export Pending to Tally */}
            <button
              onClick={handleExportAllPending}
              disabled={isExportingPending || pendingInvoices.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/30 transition cursor-pointer disabled:opacity-50"
              title={`Push ${pendingInvoices.length} un-synced invoices to Tally Prime`}
            >
              <ArrowUpFromLine className={`w-4 h-4 ${isExportingPending ? 'animate-bounce' : ''}`} />
              <span>Sync Pending ({pendingInvoices.length})</span>
            </button>

            {/* Paste XML Button */}
            {onOpenXmlPaste && (
              <button
                onClick={onOpenXmlPaste}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-600 transition cursor-pointer"
                title="Paste XML from Tally Daybook or Sales Register"
              >
                <FileCode2 className="w-4 h-4 text-amber-400" />
                <span>Paste XML</span>
              </button>
            )}

            {/* Batch XML Download */}
            <button
              onClick={handleDownloadBatchXml}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-600 transition cursor-pointer"
              title="Download batch XML file of all vouchers for Tally Prime"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Batch XML</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Invoices</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{invoices.length}</div>
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-1">
            <span className="text-emerald-600 font-semibold">{syncedInvoices.length} synced</span>
            <span>•</span>
            <span className="text-amber-600 font-semibold">{pendingInvoices.length} pending</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Imported from Tally</span>
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{importedInvoices.length}</div>
          <span className="text-[11px] text-slate-500 mt-1">Direct from Tally Prime</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Sales Value</span>
            <span className="text-xs font-bold text-blue-600">INR</span>
          </div>
          <div className="text-2xl font-extrabold text-blue-600 mt-2">
            ₹{totalSalesValue.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Gross revenue generated</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total GST Liability</span>
            <span className="text-xs font-bold text-emerald-600">GST</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            ₹{totalTaxValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">CGST + SGST + IGST</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center space-x-3 min-w-[280px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by invoice no, customer name or GSTIN..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('synced')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                statusFilter === 'synced' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Synced ({syncedInvoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pending ({pendingInvoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('imported')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                statusFilter === 'imported' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tally ({importedInvoices.length})
            </button>
          </div>
        </div>

        <button
          onClick={onNewInvoiceClick}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Invoice</span>
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-700">No Invoices Found</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tally Prime se invoices import karne ke liye <strong>"Import from Tally"</strong> par click karein ya naya invoice generate karein.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleImportFromTally}
                className="px-4 py-2 bg-slate-800 text-emerald-400 rounded-lg text-xs font-bold hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Import from Tally</span>
              </button>
              <button
                onClick={onNewInvoiceClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                Generate Invoice Now
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4">Customer / Party Name</th>
                  <th className="py-3 px-3">State / GSTIN</th>
                  <th className="py-3 px-3 text-right">Taxable (₹)</th>
                  <th className="py-3 px-3 text-right">Total Amount (₹)</th>
                  <th className="py-3 px-3 text-center">Tally Status</th>
                  <th className="py-3 px-3 text-center">Deduplication</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-blue-600 font-mono">
                      <div>{inv.invoiceNo}</div>
                      {companyFilterMode === 'all' && inv.sellerName && (
                        <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 border border-slate-200">
                          {inv.sellerName}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {inv.invoiceDate}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{inv.partyName}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{inv.completeAddress || inv.city}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-700 font-medium">{inv.partyState}</div>
                      <div className="font-mono text-[11px] text-slate-400">{inv.gstin || 'Unregistered'}</div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      ₹{inv.subtotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{inv.grandTotal.toLocaleString('en-IN')}
                    </td>

                    {/* Tally Sync Status */}
                    <td className="py-3 px-3 text-center">
                      {inv.tallySyncStatus === 'synced' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 mr-1 text-amber-600" />
                          Pending Export
                        </span>
                      )}
                    </td>

                    {/* Deduplication & Source */}
                    <td className="py-3 px-3 text-center">
                      {inv.source === 'tally_import' ? (
                        <span
                          title="Imported directly from Tally Prime"
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          <ArrowDownToLine className="w-3 h-3 mr-1 text-blue-600" />
                          Tally Origin
                        </span>
                      ) : (
                        <span
                          title="Created in Portal • Protected from Duplication"
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          <ShieldCheck className="w-3 h-3 mr-1 text-blue-600" />
                          Portal Bill
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => onPrintInvoice(inv)}
                          title="Print / View Tax Invoice PDF"
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handlePushToTally(inv)}
                          disabled={syncingId === inv.id}
                          title={
                            inv.tallySyncStatus === 'synced'
                              ? 'Re-export / Update Voucher in Tally Prime'
                              : 'Push Sales Voucher directly to Tally Prime'
                          }
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition disabled:opacity-50 cursor-pointer"
                        >
                          <UploadCloud className={`w-4 h-4 ${syncingId === inv.id ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                          onClick={() => handleDownloadXml(inv)}
                          title="Download Tally Prime Voucher XML file"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                        >
                          <FileCode className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDeleteInvoice(inv.id)}
                          title="Delete Invoice"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Report Modal */}
      <TallySyncReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        report={syncReport}
        onViewInvoice={onPrintInvoice}
      />
    </div>
  );
};
