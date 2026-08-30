import React, { useState } from 'react';
import { X, Settings, Check, HelpCircle } from 'lucide-react';
import { TallyConfig } from '../types';

interface Props {
  config: TallyConfig;
  onSave: (config: TallyConfig) => void;
  onClose: () => void;
}

export const TallySettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const [formData, setFormData] = useState<TallyConfig>({ ...config });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Tally Prime Connection &amp; Ledger Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tally Host */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tally XML Server Host URL
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="http://localhost:9000"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Default: http://localhost:9000 (TallyPrime F1 &gt; Settings &gt; Connectivity)
            </span>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tally Company Name (Optional)
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. My Business Pvt Ltd (Blank rakhein agar active company me push karna ho)"
            />
          </div>

          {/* Sales Voucher Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sales Voucher Type Name
            </label>
            <input
              type="text"
              value={formData.salesVoucherType}
              onChange={(e) => setFormData({ ...formData, salesVoucherType: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Sales"
            />
          </div>

          {/* Sales Ledger */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Sales Ledger Name in Tally
            </label>
            <input
              type="text"
              value={formData.salesLedgerName}
              onChange={(e) => setFormData({ ...formData, salesLedgerName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Sales Account"
            />
          </div>

          {/* Tax Ledgers */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CGST Ledger</label>
              <input
                type="text"
                value={formData.cgstLedgerName}
                onChange={(e) => setFormData({ ...formData, cgstLedgerName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SGST Ledger</label>
              <input
                type="text"
                value={formData.sgstLedgerName}
                onChange={(e) => setFormData({ ...formData, sgstLedgerName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">IGST Ledger</label>
              <input
                type="text"
                value={formData.igstLedgerName}
                onChange={(e) => setFormData({ ...formData, igstLedgerName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Round Off */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Round Off Ledger Name
            </label>
            <input
              type="text"
              value={formData.roundOffLedgerName}
              onChange={(e) => setFormData({ ...formData, roundOffLedgerName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
