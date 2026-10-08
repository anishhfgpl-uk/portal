import React, { useState } from 'react';
import { Building2, RefreshCw, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { SellerInfo, TallyConfig } from '../types';
import { fetchCompaniesFromTally } from '../services/tallyCompanyImportService';

interface CompanySelectionViewProps {
  companies: SellerInfo[];
  currentCompany: SellerInfo;
  tallyConfig: TallyConfig;
  tallyStatus: 'online' | 'offline' | 'checking';
  onSelectCompany: (company: SellerInfo) => void;
  onUpsertCompany: (company: SellerInfo) => void;
  onContinue: () => void;
}

export const CompanySelectionView: React.FC<CompanySelectionViewProps> = ({
  companies,
  currentCompany,
  tallyConfig,
  tallyStatus,
  onSelectCompany,
  onUpsertCompany,
  onContinue,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [startingConnector, setStartingConnector] = useState(false);

  const startConnector = () => {
    if (startingConnector) return;
    setStartingConnector(true);
    setMessage('Office Connector start command bheja ja raha hai...');

    try {
      window.location.href = 'anish-tally://start';
    } catch {
      setStartingConnector(false);
      setMessage('❌ Connector button Windows par registered nahi hai. Connector installer ek baar Administrator ke roop mein run karein.');
      return;
    }

    // Single-shot launch: browser button must not repeatedly start/retry the task.
    window.setTimeout(async () => {
      try {
        const imported = await fetchCompaniesFromTally(tallyConfig);
        if (imported.length > 0) {
          imported.forEach(onUpsertCompany);
          setMessage('✅ Connector Connected — Portal ↔ Tally link active.');
        } else {
          setMessage('⚠️ Connector start command bhej diya gaya. Tally company list abhi nahi mili; Refresh from Tally ek baar dabayein.');
        }
      } catch {
        setMessage('⚠️ Connector start command bhej diya gaya. Tally link abhi verify nahi hua; Refresh from Tally ek baar dabayein.');
      } finally {
        setStartingConnector(false);
      }
    }, 2500);
  };

  const refreshFromTally = async (): Promise<SellerInfo[]> => {
    setRefreshing(true);
    setMessage('Tally Prime se company list read ho rahi hai...');
    try {
      const imported = await fetchCompaniesFromTally(tallyConfig);
      if (!imported.length) throw new Error('Tally se company list nahi mili.');
      imported.forEach(onUpsertCompany);
      setMessage(`Tally company list refreshed: ${imported.length} company(ies) found. Select the required row, then open it.`);
      return imported;
    } catch (error: any) {
      setMessage(`❌ ${error?.message || 'Tally company read nahi ho payi.'}`);
      throw error;
    } finally {
      setRefreshing(false);
    }
  };

  const normalizeCompanyName = (value: unknown): string =>
    String(value || '').trim().toLowerCase().replace(/\\s+/g, ' ');

  const companiesAreSame = (a: SellerInfo, b: SellerInfo): boolean => {
    const aGuid = String(a?.tallyGuid || '').trim().toLowerCase();
    const bGuid = String(b?.tallyGuid || '').trim().toLowerCase();
    const aGstin = String(a?.gstin || '').trim().toLowerCase();
    const bGstin = String(b?.gstin || '').trim().toLowerCase();
    const aName = normalizeCompanyName(a?.name);
    const bName = normalizeCompanyName(b?.name);
    if (aGuid && bGuid && aGuid === bGuid) return true;
    if (aGstin && bGstin && aGstin === bGstin) return true;
    return Boolean(aName && bName && aName === bName);
  };

  const hasSelection = Boolean(currentCompany?.name);

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-6xl bg-white border border-slate-400 shadow-2xl overflow-hidden">
        <div className="bg-[#17365d] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-300">Anish Tally Portal</div>
            <h1 className="text-xl font-bold">Company Selection</h1>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-bold ${tallyStatus === 'online' ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100' : 'border-slate-400 bg-white/10 text-slate-200'}`}>
            {tallyStatus === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {tallyStatus === 'online' ? 'TALLY ONLINE' : 'TALLY OFFLINE'}
          </div>
        </div>

        <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Select a Company to continue
        </div>

        <div className="p-4">
          {message && (
            <div className="mb-3 border border-blue-300 bg-blue-50 text-blue-800 px-3 py-2 text-sm">
              {message}
            </div>
          )}

          <div className="border border-slate-400 bg-white">
            <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_130px] bg-slate-200 border-b border-slate-400 text-xs font-bold text-slate-700 uppercase">
              <div className="px-3 py-2">Company Name</div>
              <div className="px-3 py-2 border-l border-slate-300">Financial Year</div>
              <div className="px-3 py-2 border-l border-slate-300">State / GSTIN</div>
              <div className="px-3 py-2 border-l border-slate-300 text-center">Status</div>
            </div>

            <div className="max-h-[430px] overflow-y-auto">
              {companies.length === 0 ? (
                <div className="py-16 text-center">
                  <Building2 className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-700 mt-3">No saved company found</p>
                  <p className="text-sm text-slate-500 mt-1">Tally/Office Connector start karke Refresh from Tally dabayein.</p>
                </div>
              ) : (
                companies.map((company) => {
                  const selected = Boolean(currentCompany?.name) && companiesAreSame(currentCompany, company);
                  return (
                    <button
                      type="button"
                      key={company.id || company.name}
                      onClick={() => onSelectCompany(company)}
                      className={`w-full grid grid-cols-[minmax(0,2fr)_1fr_1fr_130px] text-left border-b border-slate-200 last:border-b-0 transition ${selected ? 'bg-blue-100 ring-inset ring-2 ring-blue-600' : 'hover:bg-slate-50'}`}
                    >
                      <div className="px-3 py-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 shrink-0 ${selected ? 'text-blue-700' : 'text-slate-500'}`} />
                          <span className="font-semibold text-slate-900 truncate">{company.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 ml-6 mt-1 truncate">{company.address || 'Address not available'}</div>
                      </div>
                      <div className="px-3 py-3 border-l border-slate-200 text-sm text-slate-700">
                        {company.financialYearFrom || '—'}
                      </div>
                      <div className="px-3 py-3 border-l border-slate-200 text-xs text-slate-700">
                        <div>{company.state || '—'} {company.stateCode ? `(${company.stateCode})` : ''}</div>
                        <div className="font-mono text-slate-500 mt-1 truncate">{company.gstin || 'Unregistered'}</div>
                      </div>
                      <div className="px-3 py-3 border-l border-slate-200 flex items-center justify-center">
                        {selected ? (
                          <span className="px-2 py-1 text-[10px] font-bold uppercase bg-blue-600 text-white">Selected</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">Available</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={startConnector}
              disabled={startingConnector}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <Wifi className="w-4 h-4" />
              {startingConnector ? 'Starting...' : 'Start Connector'}
            </button>
            <button
              type="button"
              onClick={refreshFromTally}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Reading Tally...' : 'Refresh from Tally'}
            </button>
            <div className="ml-auto text-xs text-slate-500">
              {companies.length} saved compan{companies.length === 1 ? 'y' : 'ies'}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-300 pt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Double-click style selection: click a row, then open the selected company.
            </div>
            <button
              type="button"
              onClick={onContinue}
              disabled={!hasSelection}
              className="px-5 py-2.5 bg-[#17365d] hover:bg-[#102946] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Open Selected Company <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
