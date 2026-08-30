import React, { useState } from 'react';
import { Download, FileCode, CheckCircle2, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface Props {
  onDownloadAllXml: () => void;
  onDownloadMastersXml: () => void;
  selectedCount: number;
}

export const TallyImportStepsGuide: React.FC<Props> = ({
  onDownloadAllXml,
  onDownloadMastersXml,
  selectedCount,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const chromeFlag = 'chrome://flags/#block-insecure-private-network-requests';

  const handleCopy = () => {
    navigator.clipboard.writeText(chromeFlag);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="tally-steps-guide" className="bg-white rounded-xl border border-slate-200 shadow-xs mb-6 overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center space-x-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
            Alt+O
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Tally Prime mein 1-Minute mein Invoice Import karne ka Tarika (100% Guaranteed Success)
            </h3>
            <p className="text-xs text-slate-300">
              Browser Security / CORS ki wajah se Direct Push fail ho to ye 3 aasan steps follow karein
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-xs font-medium">Guide {isOpen ? 'Hide' : 'Show'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h4 className="font-semibold text-slate-900 text-sm">XML File Download karein</h4>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Neeche diye button par click karke Tally Prime ke liye tayar XML file download karein.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  id="btn-download-vouchers-guide"
                  onClick={onDownloadAllXml}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Voucher XML ({selectedCount > 0 ? `${selectedCount} Invoices` : 'All'})</span>
                </button>
                <button
                  id="btn-download-masters-guide"
                  onClick={onDownloadMastersXml}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download Masters XML (Party & Items)</span>
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h4 className="font-semibold text-slate-900 text-sm">TallyPrime mein Alt + O dabayein</h4>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  TallyPrime open karein aur top menu mein <strong className="text-slate-900">Import (Alt + O)</strong> par jayein:
                </p>
                <div className="bg-white p-2.5 rounded border border-slate-200 text-xs font-mono text-slate-700 space-y-1">
                  <div className="flex items-center space-x-1 text-indigo-700 font-semibold">
                    <span>1.</span>
                    <span>Import &gt; Transactions select karein</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-600">
                    <span>2.</span>
                    <span>File Path &gt; Downloads folder chunein</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-600">
                    <span>3.</span>
                    <span>Downloaded .xml file select karein</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded text-xs flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Enter dabate hi saare vouchers instant import ho jayenge!</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h4 className="font-semibold text-slate-900 text-sm">Agar "Exceptions: 1" aaye to Fix</h4>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Invoice <strong className="text-slate-900">BG/26-27/000384</strong> ke liye ye 2 setting zaroor check karein:
                </p>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-900 block">1. Financial Year (Alt + F2):</span>
                    Tally me period <code className="bg-slate-100 px-1 rounded text-indigo-600 font-mono">01-04-2026 to 31-03-2027</code> set karein.
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-900 block">2. Voucher Numbering:</span>
                    <span className="text-slate-600">Alter &gt; Voucher Type &gt; Sales &gt; Method =</span> <strong className="text-indigo-600">Automatic (Manual Override)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chrome direct sync unlock tip */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-start space-x-2.5">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Direct 1-Click Sync Chalu karna hai?</span> Chrome browser mein direct port 9000 push enable karne ke liye Chrome flags me private network request allow karein:
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <code className="bg-white px-2 py-1 rounded border border-blue-200 font-mono text-[11px] text-blue-700">
                {chromeFlag}
              </code>
              <button
                id="btn-copy-chrome-flag"
                onClick={handleCopy}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied' : 'Copy Flag URL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
