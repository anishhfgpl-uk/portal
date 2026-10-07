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
    setStartingConnector(true);
    setMessage('Office Connector start kiya ja raha hai...');
    try {
      window.location.href = 'anish-tally://start';
    } catch {
      // The custom protocol is handled by the Windows connector installer.
    }
    window.setTimeout(() => {
      setStartingConnector(false);
      setMessage('Connector start command bhej diya gaya. Tally 9000 chalu ho to Refresh from Tally dabayein.');
    }, 1800);
  };

  const refreshFromTally = async () => {
    setRefreshing(true);
    setMessage('Tally Prime se current company read ho rahi hai...');
    try {
      const imported = await fetchCompaniesFromTally(tallyConfig);
      imported.forEach(onUpsertCompany);
      if (imported[0]) {
        onSelectCompany(imported[0]);
        setMessage(`Tally company loaded: ${imported[0].name}`);
      }
    } catch (error: any) {
      setMessage(error?.message || 'Tally company read nahi ho payi.');
    } finally {
      setRefreshing(false);
    }
  };

  const hasSelection = Boolean(currentCompany?.name);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
      <div className="w-full max-w-5xl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-300 uppercase">Tally Prime Gateway</div>
              <h1 className="text-2xl font-bold mt-1">Select Company</h1>
              <p className="text-sm text-slate-300 mt-1">Tally ki tarah pehle company select karein. Iske baad sirf usi company ka data open hoga.</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${tallyStatus === 'online' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
              {tallyStatus === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {tallyStatus === 'online' ? 'Tally Online' : 'Tally Offline'}
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-5 gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Company List</h2>
                <p className="text-xs text-slate-500 mt-1">{companies.length} saved company{companies.length === 1 ? '' : 'ies'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startConnector}
                  disabled={startingConnector}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                >
                  <Wifi className="w-4 h-4" />
                  {startingConnector ? 'Starting...' : 'Start Connector'}
                </button>
                <button
                  onClick={refreshFromTally}
                disabled={refreshing}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Reading Tally...' : 'Refresh from Tally'}
                </button>
              </div>
            </div>

            {message && (
              <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 text-sm">
                {message}
              </div>
            )}

            {companies.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                <Building2 className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700 mt-3">Tally company abhi saved nahi hai</p>
                <p className="text-sm text-slate-500 mt-1">Tally 9000/Office Connector chalu karke Refresh from Tally dabayein.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {companies.map((company) => {
                  const selected = currentCompany?.id === company.id || (
                    Boolean(currentCompany?.gstin && company.gstin) &&
                    currentCompany.gstin.toLowerCase() === company.gstin.toLowerCase()
                  );
                  return (
                    <button
                      key={company.id || company.name}
                      onClick={() => onSelectCompany(company)}
                      className={`text-left rounded-xl border-2 p-5 transition ${selected ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2 rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{company.name}</div>
                            <div className="text-xs font-mono text-slate-500 mt-1">{company.gstin || 'GSTIN not set'}</div>
                          </div>
                        </div>
                        {selected && <span className="text-[10px] font-bold uppercase text-blue-700">Selected</span>}
                      </div>
                      <div className="mt-4 text-xs text-slate-600 space-y-1">
                        <div>{company.address || 'Address not available'}</div>
                        <div>{company.state || 'State not available'} {company.stateCode ? `(${company.stateCode})` : ''}</div>
                        {company.financialYearFrom && <div>Books from: {company.financialYearFrom}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-slate-200 flex justify-end">
              <button
                onClick={onContinue}
                disabled={!hasSelection}
                className="px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Open Selected Company <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
