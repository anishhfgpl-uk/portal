import React from 'react';
import {
  Building2,
  RefreshCw,
  FileCode2,
  SlidersHorizontal,
  FileCheck2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { INDIAN_STATES } from '../utils/gstUtils';
import { SellerInfo } from '../types';

interface HeaderProps {
  activeTab: string;
  sellerState: string;
  setSellerState: (state: string) => void;
  sellerName: string;
  sellerGstin: string;
  companies?: SellerInfo[];
  activeCompany?: SellerInfo;
  onSelectCompany?: (company: SellerInfo) => void;
  onOpenCompanyProfile?: () => void;
  tallyStatus: 'online' | 'offline' | 'checking';
  onTestConnection: () => void;
  onOpenXmlPaste: () => void;
  onLoadSampleData: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  sellerState,
  setSellerState,
  sellerName,
  sellerGstin,
  companies = [],
  activeCompany,
  onSelectCompany,
  onOpenCompanyProfile,
  tallyStatus,
  onTestConnection,
  onOpenXmlPaste,
  onLoadSampleData,
  onOpenSettings,
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'new-invoice':
        return 'NEW INVOICE GENERATOR';
      case 'saved-invoices':
        return 'SAVED INVOICES & REPOSITORY';
      case 'invoice-list':
        return 'INVOICE REGISTER & GST SUMMARY';
      case 'company-profile':
        return 'COMPANY PROFILES & FIRM MANAGER';
      case 'party-master':
        return 'PARTY MASTER (SUNDRY DEBTORS)';
      case 'item-master':
        return 'ITEM MASTER (STOCK ITEMS)';
      case 'tally-sync':
        return 'TALLY PRIME SYNC & TROUBLESHOOTING HUB';
      default:
        return 'BILLING DASHBOARD';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-20">
      {/* Left: Title and Breadcrumb */}
      <div className="flex items-center space-x-3">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
          {getTabTitle()}
        </h2>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Quick Company Profile Switcher */}
        {companies.length > 0 && onSelectCompany && (
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Billing Company</span>
                {onOpenCompanyProfile && (
                  <button
                    onClick={onOpenCompanyProfile}
                    className="text-[9px] text-blue-600 font-bold hover:underline ml-2 cursor-pointer"
                  >
                    + Manage
                  </button>
                )}
              </div>
              <select
                value={activeCompany?.name || sellerName}
                onChange={(e) => {
                  const target = companies.find((c) => c.name === e.target.value);
                  if (target) onSelectCompany(target);
                }}
                className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none py-0.5 cursor-pointer pr-2 max-w-[200px] truncate"
              >
                {companies.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name} {c.gstin ? `(${c.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Quick Sample Data Loader */}
        <button
          onClick={onLoadSampleData}
          title="Load sample Indian GST Debtors and Stock Items to test immediately"
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Load Demo Data</span>
        </button>

        {/* XML Paste / Import Tool */}
        <button
          onClick={onOpenXmlPaste}
          title="Paste raw Tally XML (Debtors, Stock Items, or Vouchers)"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
        >
          <FileCode2 className="w-3.5 h-3.5 text-slate-600" />
          <span>Paste Tally XML</span>
        </button>

        {/* Seller State Selector */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Supply State</span>
            <select
              value={sellerState}
              onChange={(e) => setSellerState(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none outline-none py-0.5 cursor-pointer pr-2"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.name}>
                  [{st.code}] {st.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tally Connectivity Pill */}
        <button
          onClick={onTestConnection}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
            tallyStatus === 'online'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
              : tallyStatus === 'checking'
              ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
          }`}
          title="Click to re-test Tally Prime on Port 9000"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              tallyStatus === 'online'
                ? 'bg-emerald-500'
                : tallyStatus === 'checking'
                ? 'bg-amber-500 animate-spin'
                : 'bg-rose-500'
            }`}
          />
          <span>
            {tallyStatus === 'online'
              ? 'Tally Online'
              : tallyStatus === 'checking'
              ? 'Testing...'
              : 'Tally Offline'}
          </span>
          <RefreshCw className={`w-3 h-3 ${tallyStatus === 'checking' ? 'animate-spin' : ''}`} />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Tally Configuration & Company Settings"
          className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
