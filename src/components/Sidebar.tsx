import React from 'react';
import {
  FilePlus,
  FolderOpen,
  ReceiptText,
  Users,
  Package,
  Activity,
  Building2,
  ArrowDownToLine,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { ImportStatusState, SellerInfo } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tallyStatus: 'online' | 'offline' | 'checking';
  importStatus: ImportStatusState;
  onImportDebtors: () => void;
  onImportItems: () => void;
  onTestConnection: () => void;
  isImportingDebtors: boolean;
  isImportingItems: boolean;
  partyCount: number;
  itemCount: number;
  savedInvoiceCount: number;
  activeCompany?: SellerInfo;
  companyCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  tallyStatus,
  importStatus,
  onImportDebtors,
  onImportItems,
  onTestConnection,
  isImportingDebtors,
  isImportingItems,
  partyCount,
  itemCount,
  savedInvoiceCount,
  activeCompany,
  companyCount = 1,
}) => {
  const navItems = [
    {
      id: 'new-invoice',
      label: 'New Invoice',
      icon: FilePlus,
      badge: null,
    },
    {
      id: 'saved-invoices',
      label: 'Saved Invoices',
      icon: FolderOpen,
      badge: savedInvoiceCount > 0 ? savedInvoiceCount : null,
    },
    {
      id: 'delivery-challan',
      label: 'Delivery Challans',
      icon: ClipboardList,
      badge: 'Offline',
      badgeColor: 'bg-amber-500/20 text-amber-300',
    },
    {
      id: 'gstr-1',
      label: 'GSTR-1 Portal Return',
      icon: ShieldCheck,
      badge: 'Portal Ready',
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      id: 'invoice-list',
      label: 'Invoice List',
      icon: ReceiptText,
      badge: null,
    },
    {
      id: 'company-profile',
      label: 'Company Profile',
      icon: Building2,
      badge: companyCount > 1 ? `${companyCount} Firms` : 'Active',
      badgeColor: 'bg-blue-500/20 text-blue-300',
    },
    {
      id: 'party-master',
      label: 'Party Master',
      icon: Users,
      badge: partyCount > 0 ? partyCount : null,
    },
    {
      id: 'item-master',
      label: 'Item Master',
      icon: Package,
      badge: itemCount > 0 ? itemCount : null,
    },
    {
      id: 'tally-sync',
      label: 'Tally Hub & Fixes',
      icon: Activity,
      badge: tallyStatus === 'online' ? 'Live' : 'Fix',
      badgeColor: tallyStatus === 'online' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen shrink-0 select-none border-r border-slate-800">
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm tracking-wide text-white truncate">
              ANISH TECHNOLOGIES
            </h1>
            <p className="text-[11px] text-blue-400 font-semibold truncate">
              {activeCompany?.name || 'Tally Prime Direct'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 pb-2">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => {
                if (item.id === 'delivery-challan') {
                  window.location.href = '/challan.html';
                  return;
                }
                setActiveTab(item.id);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.badgeColor || (isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300')
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 bg-slate-950/70 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                tallyStatus === 'online'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : tallyStatus === 'checking'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-200">
              {tallyStatus === 'online'
                ? 'Tally Online (Port 9000)'
                : tallyStatus === 'checking'
                ? 'Connecting Tally...'
                : 'Tally Offline'}
            </span>
          </div>
          <button
            onClick={onTestConnection}
            title="Refresh connection test"
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${tallyStatus === 'checking' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          <button
            id="btnImportDebtors"
            onClick={onImportDebtors}
            disabled={isImportingDebtors}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isImportingDebtors ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>⏳ Importing Debtors...</span>
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>📥 Import Debtors</span>
              </>
            )}
          </button>

          <button
            id="btnImportItems"
            onClick={onImportItems}
            disabled={isImportingItems}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700/60 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isImportingItems ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>⏳ Importing Items...</span>
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>📥 Import Items</span>
              </>
            )}
          </button>
        </div>

        <div
          id="import-status"
          className={`p-2 rounded text-[11px] leading-relaxed border transition ${
            importStatus.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
              : importStatus.type === 'error'
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : importStatus.type === 'loading'
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-start space-x-1.5">
            {importStatus.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" />}
            {importStatus.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />}
            {importStatus.type === 'loading' && <RefreshCw className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-spin mt-0.5" />}
            {importStatus.type === 'normal' && <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />}
            <span className="line-clamp-2">{importStatus.message || 'Ready for Tally Operations'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
