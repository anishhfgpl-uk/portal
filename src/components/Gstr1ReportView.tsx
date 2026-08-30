import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Copy,
  CheckCircle2,
  ExternalLink,
  Wrench,
  Printer,
  ChevronDown,
  Info,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Invoice, SellerInfo } from '../types';
import {
  validateInvoicesForGstr1,
  autoFixInvoicesForGstr1,
  calculateGstr1Summary,
  downloadGstr1JsonFile,
  downloadGstr1CsvFile,
  buildGstr1JsonPayload,
  Gstr1TableSummary,
} from '../services/gstr1Service';
import { getStateNameByCode } from '../utils/gstUtils';

interface Gstr1ReportViewProps {
  invoices: Invoice[];
  sellerInfo: SellerInfo;
  companies?: SellerInfo[];
  onSelectCompany?: (company: SellerInfo) => void;
  onUpdateInvoices: (updatedInvoices: Invoice[]) => void;
  onNewInvoiceClick: () => void;
}

export const Gstr1ReportView: React.FC<Gstr1ReportViewProps> = ({
  invoices,
  sellerInfo,
  companies = [],
  onSelectCompany,
  onUpdateInvoices,
  onNewInvoiceClick,
}) => {
  // Current Month & Financial Year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();

  // Determine current FY
  const defaultFyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const [selectedFy, setSelectedFy] = useState<string>(`${defaultFyStart}-${String(defaultFyStart + 1).slice(-2)}`);
  
  // Format MMYYYY e.g. "042025"
  const defaultFilingPeriod = `${String(currentMonth).padStart(2, '0')}${currentYear}`;
  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultFilingPeriod);
  const [periodFilterMode, setPeriodFilterMode] = useState<'selected-month' | 'all'>('all');
  const [companyFilterMode, setCompanyFilterMode] = useState<'active' | 'all'>('active');

  // Active Tab
  const [activeTableTab, setActiveTableTab] = useState<'b2b' | 'b2cs' | 'b2cl' | 'hsn' | 'docs' | 'json' | 'guide'>('b2b');

  // Copy Feedback
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [fixedNotice, setFixedNotice] = useState<string | null>(null);

  // Month options for the selector
  const monthsList = [
    { num: 4, name: 'April', code: '04' },
    { num: 5, name: 'May', code: '05' },
    { num: 6, name: 'June', code: '06' },
    { num: 7, name: 'July', code: '07' },
    { num: 8, name: 'August', code: '08' },
    { num: 9, name: 'September', code: '09' },
    { num: 10, name: 'October', code: '10' },
    { num: 11, name: 'November', code: '11' },
    { num: 12, name: 'December', code: '12' },
    { num: 1, name: 'January', code: '01' },
    { num: 2, name: 'February', code: '02' },
    { num: 3, name: 'March', code: '03' },
  ];

  // Derive target year for the selected month based on selected FY
  const fyStartYear = parseInt(selectedFy.split('-')[0], 10);
  const selectedMonthNum = parseInt(selectedPeriod.slice(0, 2), 10);
  const selectedMonthYear = selectedMonthNum >= 4 ? fyStartYear : fyStartYear + 1;
  const currentFilingPeriodCode = `${String(selectedMonthNum).padStart(2, '0')}${selectedMonthYear}`;

  // Filter invoices for company and return period
  const filteredInvoices = useMemo(() => {
    // 1. Company Scope
    const companyInvoices = invoices.filter((inv) => {
      if (companyFilterMode === 'all') return true;
      if (inv.sellerGstin && sellerInfo.gstin) {
        return inv.sellerGstin.trim().toLowerCase() === sellerInfo.gstin.trim().toLowerCase();
      }
      if (inv.sellerName && sellerInfo.name) {
        return inv.sellerName.trim().toLowerCase() === sellerInfo.name.trim().toLowerCase();
      }
      return true;
    });

    // 2. Period Scope
    if (periodFilterMode === 'all') {
      return companyInvoices;
    }
    return companyInvoices.filter((inv) => {
      if (!inv.invoiceDate) return false;
      const clean = inv.invoiceDate.trim();
      let d: Date | null = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        d = new Date(clean);
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        const [day, mon, yr] = clean.split('-');
        d = new Date(parseInt(yr, 10), parseInt(mon, 10) - 1, parseInt(day, 10));
      }
      if (!d || isNaN(d.getTime())) return true;
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      return m === selectedMonthNum && y === selectedMonthYear;
    });
  }, [invoices, companyFilterMode, sellerInfo.gstin, sellerInfo.name, periodFilterMode, selectedMonthNum, selectedMonthYear]);

  // Validation Result
  const validation = useMemo(() => {
    return validateInvoicesForGstr1(filteredInvoices, sellerInfo, currentFilingPeriodCode);
  }, [filteredInvoices, sellerInfo, currentFilingPeriodCode]);

  // Summary Table Data
  const summary: Gstr1TableSummary = useMemo(() => {
    return calculateGstr1Summary(filteredInvoices, sellerInfo, currentFilingPeriodCode);
  }, [filteredInvoices, sellerInfo, currentFilingPeriodCode]);

  // Handle Month Selection
  const handleSelectMonth = (monthCode: string, monthNum: number) => {
    const yr = monthNum >= 4 ? fyStartYear : fyStartYear + 1;
    setSelectedPeriod(`${monthCode}${yr}`);
    setPeriodFilterMode('selected-month');
  };

  // Handle 1-Click Auto Fix
  const handleAutoFixAll = () => {
    const corrected = autoFixInvoicesForGstr1(invoices, sellerInfo);
    onUpdateInvoices(corrected);
    setFixedNotice('✨ All invoice numbers, GSTINs, POS codes, HSNs, and UQCs auto-sanitized for 100% portal compliance!');
    setTimeout(() => setFixedNotice(null), 6000);
  };

  // Copy JSON
  const handleCopyJson = () => {
    const payload = buildGstr1JsonPayload(summary);
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Print Summary
  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div id="gstr1-report-view" className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-screen overflow-y-auto">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                  GSTR-1 Outward Supplies Return Hub
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                    GST Offline Tool Schema v3.1.4 Ready
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Prepare, validate, and download error-free GSTR-1 JSON for direct upload on the Government GST Portal (gst.gov.in).
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              id="gstr1-autofix-btn"
              onClick={handleAutoFixAll}
              className="px-3.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-colors text-sm font-medium flex items-center gap-2"
              title="Fix invoice numbers, uppercase GSTINs, POS, and UQC format"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Auto-Fix All Format Errors
            </button>

            <button
              id="gstr1-export-csv-btn"
              onClick={() => downloadGstr1CsvFile(summary)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Download Excel/CSV Report for CA reconciliation"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Export Excel / CSV
            </button>

            <button
              id="gstr1-download-json-btn"
              onClick={() => downloadGstr1JsonFile(summary)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 hover:shadow-emerald-700/40 transition-all flex items-center gap-2"
              title="Download official GST Offline Tool JSON file for direct upload"
            >
              <Download className="w-4 h-4" />
              Download Portal JSON (Offline Tool)
            </button>
          </div>
        </div>

        {/* Success Alert Notice */}
        {fixedNotice && (
          <div className="mt-4 p-3 bg-emerald-900/30 border border-emerald-500/40 rounded-lg text-emerald-300 text-sm flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{fixedNotice}</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Period & Taxpayer Selector Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Taxpayer Information Card */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filing Taxpayer (Seller)</span>
                  {companies.length > 1 && (
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                      {companies.length} Firms
                    </span>
                  )}
                </div>
                {companies.length > 0 && onSelectCompany ? (
                  <select
                    value={sellerInfo.name}
                    onChange={(e) => {
                      const target = companies.find((c) => c.name === e.target.value);
                      if (target) {
                        onSelectCompany(target);
                        setFixedNotice(`Switched to "${target.name}". GSTR-1 tables and invoice dataset refreshed!`);
                      }
                    }}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-700 text-white font-bold text-sm rounded-lg px-2.5 py-1.5 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {companies.map((comp) => {
                      const count = invoices.filter(
                        (i) => i.sellerGstin === comp.gstin || i.sellerName === comp.name
                      ).length;
                      return (
                        <option key={comp.id || comp.name} value={comp.name} className="bg-slate-900 text-white">
                          {comp.name} ({count} Invoices)
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <h2 className="text-base font-bold text-white mt-1 leading-snug">{sellerInfo.name}</h2>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {sellerInfo.gstin || 'NO GSTIN'}
                  </span>
                  <span className="text-xs text-slate-400">
                    State: {sellerInfo.state} ({sellerInfo.stateCode})
                  </span>
                </div>
              </div>
              <Building2 className="w-7 h-7 text-slate-600 shrink-0" />
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>Scope:</span>
                <button
                  onClick={() => setCompanyFilterMode('active')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                    companyFilterMode === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Active Firm ({invoices.filter((i) => i.sellerGstin === sellerInfo.gstin || i.sellerName === sellerInfo.name).length})
                </button>
                <button
                  onClick={() => setCompanyFilterMode('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                    companyFilterMode === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All ({invoices.length})
                </button>
              </div>
              <span>Return Period: <strong className="text-slate-200">{summary.periodLabel}</strong></span>
            </div>
          </div>

          {/* Period Selector Tabs */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Select Return Period</span>
              </div>

              {/* FY Selector & All / Month toggle */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400">FY:</span>
                  <select
                    value={selectedFy}
                    onChange={(e) => setSelectedFy(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="2025-26" className="bg-slate-900">2025-26</option>
                    <option value="2024-25" className="bg-slate-900">2024-25</option>
                    <option value="2023-24" className="bg-slate-900">2023-24</option>
                  </select>
                </div>

                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setPeriodFilterMode('all')}
                    className={`px-3 py-1 rounded font-medium transition-all ${
                      periodFilterMode === 'all'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Invoices ({invoices.length})
                  </button>
                  <button
                    onClick={() => setPeriodFilterMode('selected-month')}
                    className={`px-3 py-1 rounded font-medium transition-all ${
                      periodFilterMode === 'selected-month'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    By Month
                  </button>
                </div>
              </div>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {monthsList.map((m) => {
                const yr = m.num >= 4 ? fyStartYear : fyStartYear + 1;
                const isSelected = selectedPeriod === `${m.code}${yr}` && periodFilterMode === 'selected-month';
                return (
                  <button
                    key={m.code}
                    onClick={() => handleSelectMonth(m.code, m.num)}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-medium transition-all flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm ring-1 ring-emerald-500'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-semibold">{m.name.slice(0, 3)}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">'{String(yr).slice(-2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* "Zero-Error Portal Readiness Shield" */}
        <div
          id="portal-readiness-shield"
          className={`rounded-xl border p-5 transition-all ${
            validation.isValid
              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
              : 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  validation.isValid
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                }`}
              >
                {validation.isValid ? (
                  <ShieldCheck className="w-8 h-8" />
                ) : (
                  <AlertTriangle className="w-8 h-8" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white">
                    {validation.isValid
                      ? '🛡️ 100% GST Portal Ready (Zero Errors)'
                      : `⚠️ ${validation.errorCount} Error${validation.errorCount > 1 ? 's' : ''} & ${validation.warningCount} Warning${validation.warningCount > 1 ? 's' : ''} Found`}
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      validation.isValid
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    Readiness Score: {validation.readinessScore}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {validation.isValid
                    ? 'All invoice numbers, buyer GSTINs, Place of Supply (POS) codes, and Table 12 HSN data are 100% compliant with the Government GSTN Offline JSON schema. You can upload directly to gst.gov.in without validation rejection.'
                    : 'GST Portal strict validation requires all fields to match schema format. Review below or click "Auto-Fix All" to resolve format warnings automatically.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
              {!validation.isValid && (
                <button
                  onClick={handleAutoFixAll}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Auto-Resolve Issues
                </button>
              )}

              <button
                onClick={() => downloadGstr1JsonFile(summary)}
                disabled={filteredInvoices.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON ({summary.totalInvoiceCount} Invoices)
              </button>
            </div>
          </div>

          {/* Validation Issue Details List */}
          {validation.issues.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Compliance Inspection Results:
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                {validation.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                      issue.severity === 'error'
                        ? 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                        : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          issue.severity === 'error' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <div>
                        <strong className="text-white">[{issue.invoiceNo}]</strong> {issue.title}: {issue.description}
                      </div>
                    </div>

                    {issue.autoFixable && (
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700 whitespace-nowrap">
                        Fix: {issue.proposedFix}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Invoices</span>
            <div className="text-xl font-bold text-white mt-1">{summary.totalInvoiceCount}</div>
            <span className="text-[10px] text-slate-500">B2B: {summary.b2bInvoiceCount} | B2C: {summary.b2csCount + summary.b2clInvoiceCount}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Taxable Turnover</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">₹{summary.grandTaxable.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500">Total Base Amount</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Central Tax (CGST)</span>
            <div className="text-xl font-bold text-blue-400 mt-1">₹{summary.grandCgst.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500">Intra-State Share</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">State Tax (SGST)</span>
            <div className="text-xl font-bold text-blue-400 mt-1">₹{summary.grandSgst.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500">Intra-State Share</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Integrated Tax (IGST)</span>
            <div className="text-xl font-bold text-indigo-400 mt-1">₹{summary.grandIgst.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500">Inter-State Share</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total GST Output</span>
            <div className="text-xl font-bold text-amber-400 mt-1">₹{summary.grandTotalTax.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500">CGST + SGST + IGST</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Gross Invoice Value</span>
            <div className="text-xl font-bold text-white mt-1">₹{summary.grandInvoiceValue.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500">Total with Taxes</span>
          </div>
        </div>

        {/* Return Tables Navigation Tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="border-b border-slate-800 px-4 pt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1 overflow-x-auto">
              <button
                id="tab-b2b"
                onClick={() => setActiveTableTab('b2b')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'b2b'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span>Table 4: B2B Invoices</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {summary.b2bInvoiceCount}
                </span>
              </button>

              <button
                id="tab-b2cs"
                onClick={() => setActiveTableTab('b2cs')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'b2cs'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span>Table 7: B2C Small</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {summary.b2csEntries.length}
                </span>
              </button>

              <button
                id="tab-b2cl"
                onClick={() => setActiveTableTab('b2cl')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'b2cl'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span>Table 5: B2C Large</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {summary.b2clInvoiceCount}
                </span>
              </button>

              <button
                id="tab-hsn"
                onClick={() => setActiveTableTab('hsn')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'hsn'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span>Table 12: HSN Summary</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {summary.hsnItems.length}
                </span>
              </button>

              <button
                id="tab-docs"
                onClick={() => setActiveTableTab('docs')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'docs'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span>Table 13: Documents</span>
              </button>

              <button
                id="tab-json"
                onClick={() => setActiveTableTab('json')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'json'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span>JSON Schema Inspector</span>
              </button>

              <button
                id="tab-guide"
                onClick={() => setActiveTableTab('guide')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                  activeTableTab === 'guide'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Portal Upload Guide</span>
              </button>
            </div>

            <div className="pb-2 flex items-center gap-2">
              <button
                onClick={handlePrintSummary}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-950 rounded border border-slate-800 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          {/* Table Content Area */}
          <div className="p-4">
            {/* 1. TABLE 4: B2B INVOICES */}
            {activeTableTab === 'b2b' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Showing supplies made to <strong>Registered Taxpayers</strong> having a valid GSTIN. (Section 4A, 4B, 4C, 6B, 6C)
                  </div>
                  <div className="text-xs font-mono font-medium text-slate-300">
                    Taxable: ₹{summary.b2bTaxable.toLocaleString('en-IN')} | Tax: ₹{summary.b2bTotalTax.toLocaleString('en-IN')}
                  </div>
                </div>

                {summary.b2bGroups.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/50 rounded-lg border border-slate-800/60">
                    <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">No B2B Invoices Recorded in Selected Period</p>
                    <p className="text-xs text-slate-500 mt-1">Invoices made to buyers with registered GSTIN will automatically appear here.</p>
                    <button
                      onClick={onNewInvoiceClick}
                      className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700"
                    >
                      + Create New Invoice
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Receiver GSTIN</th>
                          <th className="p-3">Party Name</th>
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Invoice Date</th>
                          <th className="p-3">POS</th>
                          <th className="p-3 text-right">Taxable Val (₹)</th>
                          <th className="p-3 text-right">Rate</th>
                          <th className="p-3 text-right">CGST (₹)</th>
                          <th className="p-3 text-right">SGST (₹)</th>
                          <th className="p-3 text-right">IGST (₹)</th>
                          <th className="p-3 text-right font-bold text-white">Invoice Val (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {summary.b2bGroups.flatMap((group) =>
                          group.inv.flatMap((inv) =>
                            inv.itms.map((itm, itmIdx) => (
                              <tr key={`${inv.inum}-${itmIdx}`} className="hover:bg-slate-800/40 transition-colors">
                                {itmIdx === 0 ? (
                                  <>
                                    <td rowSpan={inv.itms.length} className="p-3 font-mono font-bold text-blue-400 align-top border-r border-slate-800/60">
                                      {group.ctin}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 font-medium text-white align-top border-r border-slate-800/60">
                                      {inv.partyName || 'Customer'}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 font-mono font-medium text-slate-300 align-top border-r border-slate-800/60">
                                      {inv.inum}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 text-slate-400 align-top border-r border-slate-800/60">
                                      {inv.idt}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 text-slate-400 align-top border-r border-slate-800/60">
                                      <span className="font-mono">{inv.pos}</span> - {getStateNameByCode(inv.pos)}
                                    </td>
                                  </>
                                ) : null}
                                <td className="p-3 text-right font-mono text-emerald-400 font-medium">
                                  ₹{itm.itm_det.txval.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-300">
                                  {itm.itm_det.rt}%
                                </td>
                                <td className="p-3 text-right font-mono text-slate-400">
                                  {itm.itm_det.camt > 0 ? `₹${itm.itm_det.camt.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-400">
                                  {itm.itm_det.samt > 0 ? `₹${itm.itm_det.samt.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-3 text-right font-mono text-indigo-400">
                                  {itm.itm_det.iamt > 0 ? `₹${itm.itm_det.iamt.toFixed(2)}` : '-'}
                                </td>
                                {itmIdx === 0 ? (
                                  <td rowSpan={inv.itms.length} className="p-3 text-right font-mono font-bold text-white align-top border-l border-slate-800/60">
                                    ₹{inv.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                ) : null}
                              </tr>
                            ))
                          )
                        )}
                      </tbody>
                      <tfoot className="bg-slate-950 font-semibold text-slate-200 border-t border-slate-700">
                        <tr>
                          <td colSpan={5} className="p-3 text-right uppercase">B2B Total:</td>
                          <td className="p-3 text-right font-mono text-emerald-400">₹{summary.b2bTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td></td>
                          <td className="p-3 text-right font-mono text-blue-400">₹{summary.b2bCgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-blue-400">₹{summary.b2bSgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-indigo-400">₹{summary.b2bIgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-white font-bold">₹{summary.b2bGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 2. TABLE 7: B2C SMALL */}
            {activeTableTab === 'b2cs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Aggregated summary of supplies to <strong>Unregistered Customers</strong> (Intra-state and Interstate ≤ ₹2.5L).
                  </div>
                  <div className="text-xs font-mono font-medium text-slate-300">
                    Taxable: ₹{summary.b2csTaxable.toLocaleString('en-IN')} | Tax: ₹{summary.b2csTotalTax.toLocaleString('en-IN')}
                  </div>
                </div>

                {summary.b2csEntries.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/50 rounded-lg border border-slate-800/60">
                    <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">No B2C Small Transactions in Period</p>
                    <p className="text-xs text-slate-500 mt-1">Cash retail sales and unregistered customer invoices will be aggregated here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Type</th>
                          <th className="p-3">Place of Supply (POS)</th>
                          <th className="p-3 text-right">Applicable % Rate</th>
                          <th className="p-3 text-right">Taxable Value (₹)</th>
                          <th className="p-3 text-right">CGST (₹)</th>
                          <th className="p-3 text-right">SGST (₹)</th>
                          <th className="p-3 text-right">IGST (₹)</th>
                          <th className="p-3 text-right">Cess (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {summary.b2csEntries.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 font-medium text-slate-300">
                              {e.typ} - {e.sply_ty}
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-blue-400 font-bold">{e.pos}</span> - {e.stateName}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-200">{e.rt}%</td>
                            <td className="p-3 text-right font-mono text-emerald-400 font-medium">
                              ₹{e.txval.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {e.camt > 0 ? `₹${e.camt.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {e.samt > 0 ? `₹${e.samt.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono text-indigo-400">
                              {e.iamt > 0 ? `₹${e.iamt.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-500">0.00</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-950 font-semibold text-slate-200 border-t border-slate-700">
                        <tr>
                          <td colSpan={3} className="p-3 text-right uppercase">B2CS Total:</td>
                          <td className="p-3 text-right font-mono text-emerald-400">₹{summary.b2csTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-blue-400">₹{summary.b2csCgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-blue-400">₹{summary.b2csSgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-indigo-400">₹{summary.b2csIgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-slate-500">0.00</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. TABLE 5: B2C LARGE */}
            {activeTableTab === 'b2cl' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Inter-state supplies to <strong>Unregistered Persons</strong> where invoice value exceeds <strong>₹2,50,000</strong>.
                  </div>
                </div>

                {summary.b2clGroups.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/50 rounded-lg border border-slate-800/60">
                    <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">No B2C Large Invoices Found</p>
                    <p className="text-xs text-slate-500 mt-1">Interstate retail invoices above ₹2.5 Lakhs will be listed here separately per GST portal guidelines.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">POS</th>
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Invoice Date</th>
                          <th className="p-3 text-right">Invoice Value (₹)</th>
                          <th className="p-3 text-right">Rate</th>
                          <th className="p-3 text-right">Taxable Val (₹)</th>
                          <th className="p-3 text-right">IGST (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {summary.b2clGroups.flatMap((group) =>
                          group.inv.flatMap((inv) =>
                            inv.itms.map((itm, itmIdx) => (
                              <tr key={`${inv.inum}-${itmIdx}`} className="hover:bg-slate-800/40 transition-colors">
                                {itmIdx === 0 ? (
                                  <>
                                    <td rowSpan={inv.itms.length} className="p-3 font-mono font-bold text-blue-400 align-top">
                                      {group.pos} - {getStateNameByCode(group.pos)}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 font-mono font-medium text-slate-300 align-top">
                                      {inv.inum}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 text-slate-400 align-top">
                                      {inv.idt}
                                    </td>
                                    <td rowSpan={inv.itms.length} className="p-3 text-right font-mono font-bold text-white align-top">
                                      ₹{inv.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </>
                                ) : null}
                                <td className="p-3 text-right font-mono text-slate-300">{itm.itm_det.rt}%</td>
                                <td className="p-3 text-right font-mono text-emerald-400">₹{itm.itm_det.txval.toFixed(2)}</td>
                                <td className="p-3 text-right font-mono text-indigo-400">₹{itm.itm_det.iamt.toFixed(2)}</td>
                              </tr>
                            ))
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4. TABLE 12: HSN SUMMARY */}
            {activeTableTab === 'hsn' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Mandatory <strong>HSN/SAC-wise Summary</strong> of outward supplies with standard GST Unit Quantity Codes (UQC).
                  </div>
                  <div className="text-xs font-mono font-medium text-slate-300">
                    Total Taxable: ₹{summary.hsnTotalTaxable.toLocaleString('en-IN')} | Tax: ₹{summary.hsnTotalTax.toLocaleString('en-IN')}
                  </div>
                </div>

                {summary.hsnItems.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/50 rounded-lg border border-slate-800/60">
                    <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">No Item Data for HSN Table</p>
                    <p className="text-xs text-slate-500 mt-1">Product lines in invoices with HSN codes will be aggregated here automatically.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">HSN/SAC Code</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">UQC Unit</th>
                          <th className="p-3 text-right">Total Qty</th>
                          <th className="p-3 text-right">Total Value (₹)</th>
                          <th className="p-3 text-right">Taxable Val (₹)</th>
                          <th className="p-3 text-right">IGST (₹)</th>
                          <th className="p-3 text-right">CGST (₹)</th>
                          <th className="p-3 text-right">SGST (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {summary.hsnItems.map((h) => (
                          <tr key={h.num} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-slate-500">{h.num}</td>
                            <td className="p-3 font-mono font-bold text-amber-400">{h.hsn_sc}</td>
                            <td className="p-3 text-slate-200 max-w-xs truncate">{h.desc}</td>
                            <td className="p-3 font-mono text-xs bg-slate-950/40 text-blue-300 px-2 py-0.5 rounded">
                              {h.uqc}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-300">{h.qty}</td>
                            <td className="p-3 text-right font-mono font-medium text-white">
                              ₹{h.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-400 font-medium">
                              ₹{h.txval.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-indigo-400">{h.iamt > 0 ? `₹${h.iamt.toFixed(2)}` : '-'}</td>
                            <td className="p-3 text-right font-mono text-slate-400">{h.camt > 0 ? `₹${h.camt.toFixed(2)}` : '-'}</td>
                            <td className="p-3 text-right font-mono text-slate-400">{h.samt > 0 ? `₹${h.samt.toFixed(2)}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-950 font-semibold text-slate-200 border-t border-slate-700">
                        <tr>
                          <td colSpan={5} className="p-3 text-right uppercase">HSN Total:</td>
                          <td className="p-3 text-right font-mono text-white">₹{summary.hsnTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-emerald-400">₹{summary.hsnTotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-indigo-400">₹{summary.grandIgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-blue-400">₹{summary.grandCgst.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-blue-400">₹{summary.grandSgst.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. TABLE 13: DOCUMENTS ISSUED */}
            {activeTableTab === 'docs' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400">
                  Summary of documents issued during the tax period (Invoices series for outward supply).
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Nature of Document</th>
                        <th className="p-3 font-mono">Sr. No. From</th>
                        <th className="p-3 font-mono">Sr. No. To</th>
                        <th className="p-3 text-right">Total Count</th>
                        <th className="p-3 text-right">Cancelled</th>
                        <th className="p-3 text-right font-bold text-emerald-400">Net Issued</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {summary.docSummary.doc_det.map((det) =>
                        det.docs.map((doc, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-3 font-semibold text-white">{det.doc_typ}</td>
                            <td className="p-3 font-mono text-blue-300">{doc.from}</td>
                            <td className="p-3 font-mono text-blue-300">{doc.to}</td>
                            <td className="p-3 text-right font-mono text-slate-200">{doc.totnum}</td>
                            <td className="p-3 text-right font-mono text-slate-500">{doc.canc}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{doc.net_issue}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. JSON PAYLOAD INSPECTOR */}
            {activeTableTab === 'json' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Live Generated JSON payload conforming to <strong>Government GSTN Offline Tool format (v3.1.4)</strong>.
                  </div>
                  <button
                    onClick={handleCopyJson}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    {copiedJson ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-sans">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="font-sans">Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 max-h-[500px] overflow-y-auto whitespace-pre">
                  {JSON.stringify(buildGstr1JsonPayload(summary), null, 2)}
                </div>
              </div>
            )}

            {/* 7. PORTAL UPLOAD GUIDE */}
            {activeTableTab === 'guide' && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    How to Upload This Return to GST Portal Without Errors
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Follow these 4 simple steps to file your GSTR-1 in under 1 minute directly on the Government GST Portal.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold">
                      1
                    </div>
                    <h4 className="font-bold text-white text-sm">Download Offline JSON</h4>
                    <p className="text-slate-400">
                      Click the green <strong>"Download Portal JSON"</strong> button above. A file named <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">GSTR1_{summary.sellerGstin}_{summary.filingPeriod}.json</code> will be saved to your computer.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold">
                      2
                    </div>
                    <h4 className="font-bold text-white text-sm">Log in to GST Portal</h4>
                    <p className="text-slate-400">
                      Visit <a href="https://services.gst.gov.in" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline inline-flex items-center gap-1">gst.gov.in <ExternalLink className="w-3 h-3" /></a> and login with your Taxpayer credentials.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
                      3
                    </div>
                    <h4 className="font-bold text-white text-sm">Open Return Dashboard & GSTR-1</h4>
                    <p className="text-slate-400">
                      Navigate to <strong>Services &gt; Returns &gt; Returns Dashboard</strong>. Select the Financial Year ({selectedFy}) and Filing Month ({summary.periodLabel}).
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-amber-600/30 text-amber-400 flex items-center justify-center font-bold">
                      4
                    </div>
                    <h4 className="font-bold text-white text-sm">Click "PREPARE OFFLINE" & Upload</h4>
                    <p className="text-slate-400">
                      Under the <strong>Details of Outward Supplies (GSTR-1)</strong> tile, click <strong>"PREPARE OFFLINE"</strong> &gt; Click <strong>"Upload"</strong> tab &gt; Choose your downloaded JSON file.
                    </p>
                    <span className="inline-block mt-2 font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/20">
                      ✅ Status: Processed with 0 Errors!
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
