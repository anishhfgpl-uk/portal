import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, RefreshCw, Download, FileText, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';
import { Invoice, TallyConfig, SyncSummary } from '../types';
import { generateVoucherXml, downloadXmlFile } from '../utils/tallyXmlGenerator';
import { pushXmlToTally } from '../utils/tallySync';

interface Props {
  invoice: Invoice | null;
  config: TallyConfig;
  onClose: () => void;
  onUpdateInvoiceStatus: (id: string, status: Invoice['syncStatus'], message: string, xmlResponse?: string) => void;
}

export const SyncDiagnosticModal: React.FC<Props> = ({
  invoice,
  config,
  onClose,
  onUpdateInvoiceStatus,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    summary?: SyncSummary;
    errorDetail?: string;
  } | null>(null);

  if (!invoice) return null;

  const handleTestPush = async () => {
    setIsTesting(true);
    const xml = generateVoucherXml(invoice, config);
    const envelopeXml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          ${config.companyName ? `<SVCURRENTCOMPANY>${config.companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${xml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const res = await pushXmlToTally(config.host, envelopeXml);
    setIsTesting(false);
    setTestResult({
      tested: true,
      success: res.success,
      summary: res.summary,
      errorDetail: res.errorDetail,
    });

    if (res.success) {
      onUpdateInvoiceStatus(invoice.id, 'synced', 'Pushed successfully to Tally Prime', res.summary.rawResponse);
    } else if (res.summary.exceptions > 0) {
      onUpdateInvoiceStatus(invoice.id, 'exception', `Tally Exception: ${res.summary.exceptions} voucher rejected`, res.summary.rawResponse);
    } else {
      onUpdateInvoiceStatus(invoice.id, 'error', res.errorDetail || 'Sync failed', res.summary.rawResponse);
    }
  };

  const handleDownloadSingle = () => {
    const xml = generateVoucherXml(invoice, config);
    const envelopeXml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          ${config.companyName ? `<SVCURRENTCOMPANY>${config.companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${xml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    downloadXmlFile(envelopeXml, `Tally_Invoice_${invoice.invoiceNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`);
  };

  // Inspect invoice attributes
  const is2627 = invoice.invoiceNo.includes('26-27') || invoice.date.startsWith('2026');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-semibold text-white">
                Tally Diagnostic &amp; Auto-Fix Report
              </h3>
              <p className="text-xs text-slate-300">
                Invoice No: <span className="font-mono text-indigo-300 font-semibold">{invoice.invoiceNo}</span> | Party: {invoice.partyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">
                  Kyu "Exceptions: 1" ya Push Error aa raha hai?
                </h4>
                <p className="text-xs text-amber-800 mt-1">
                  Aapka invoice number <strong className="font-mono">{invoice.invoiceNo}</strong> hai. Tally me import karte waqt Tally ke 2 specific rules match hone zaroori hain:
                </p>
              </div>
            </div>
          </div>

          {/* Solutions checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Immediate Fix Checklist (In TallyPrime)
            </h4>

            {/* Step 1: Financial Year */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Financial Year Check (Alt + F2)</span>
                </span>
                {is2627 && (
                  <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                    Critical for {invoice.invoiceNo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tally me invoice tabhi add hoti hai jab uski date active Financial Year ke andar ho.
                Tally me <strong className="text-slate-900">Alt + F2</strong> dabakar period 
                <span className="font-mono font-semibold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 mx-1">
                  01-04-2026 to 31-03-2027
                </span>
                (ya current invoice year) set karein.
              </p>
            </div>

            {/* Step 2: Voucher Numbering */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Sales Voucher Numbering Setting</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aapke invoice number me letters aur slashes hain (<code className="font-mono text-indigo-700 font-semibold">{invoice.invoiceNo}</code>). 
                Tally me jayein: <strong className="text-slate-900">Gateway of Tally &gt; Alter &gt; Voucher Type &gt; Sales</strong>.
                Wahan <strong className="text-slate-900">Method of Voucher Numbering</strong> ko 
                <span className="font-semibold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 mx-1">
                  Automatic (Manual Override)
                </span> 
                ya <span className="font-semibold text-indigo-700">Manual</span> karein.
              </p>
            </div>

            {/* Step 3: Ledgers */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Party &amp; Tax Ledgers Verification</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                Ensure karein ki party ledger <strong className="text-slate-900">{invoice.partyName}</strong> (Sundry Debtors) aur Tax ledgers ({invoice.isInterState ? config.igstLedgerName : `${config.cgstLedgerName}, ${config.sgstLedgerName}`}) Tally me banaye gaye hain.
              </p>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <span>Party State: {invoice.partyState || 'N/A'}</span>
                <span>•</span>
                <span>GST Type: {invoice.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</span>
                <span>•</span>
                <span>Total: ₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Test Results Output */}
          {testResult && (
            <div className={`p-4 rounded-lg border text-xs ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center space-x-2 font-bold mb-1">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Success! Voucher Tally me successfully create ho gaya!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Push Test Result:</span>
                  </>
                )}
              </div>
              {testResult.summary && (
                <div className="font-mono text-[11px] mt-1 space-x-3 bg-white/70 p-2 rounded border border-current/20">
                  <span>Created: {testResult.summary.created}</span>
                  <span>Exceptions: {testResult.summary.exceptions}</span>
                  <span>Errors: {testResult.summary.errors}</span>
                  <span>Altered: {testResult.summary.altered}</span>
                </div>
              )}
              {testResult.errorDetail && (
                <p className="mt-2 text-slate-700 whitespace-pre-line bg-white/80 p-2 rounded font-sans text-xs">
                  {testResult.errorDetail}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleDownloadSingle}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Clean XML File (For Alt + O Import)</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTestPush}
              disabled={isTesting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Push...' : 'Test Direct Push to Port 9000'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
