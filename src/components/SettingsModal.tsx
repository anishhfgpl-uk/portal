import React, { useState } from 'react';
import { Settings, X, Building2, Server, Save, Check } from 'lucide-react';
import { SellerInfo, TallyConfig } from '../types';
import { INDIAN_STATES, getStateCodeByName, extractStateCodeFromGstin } from '../utils/gstUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerInfo: SellerInfo;
  onUpdateSellerInfo: (info: SellerInfo) => void;
  tallyConfig: TallyConfig;
  onUpdateTallyConfig: (config: TallyConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  sellerInfo,
  onUpdateSellerInfo,
  tallyConfig,
  onUpdateTallyConfig,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'seller' | 'tally'>('seller');

  // Seller State
  const [sellerName, setSellerName] = useState(sellerInfo.name);
  const [sellerGstin, setSellerGstin] = useState(sellerInfo.gstin);
  const [sellerState, setSellerState] = useState(sellerInfo.state);
  const [sellerStateCode, setSellerStateCode] = useState(sellerInfo.stateCode);
  const [sellerAddress, setSellerAddress] = useState(sellerInfo.address);
  const [sellerPhone, setSellerPhone] = useState(sellerInfo.phone || '');
  const [sellerEmail, setSellerEmail] = useState(sellerInfo.email || '');
  const [bankName, setBankName] = useState(sellerInfo.bankName || '');
  const [bankAccountNo, setBankAccountNo] = useState(sellerInfo.bankAccountNo || '');
  const [bankIfsc, setBankIfsc] = useState(sellerInfo.bankIfsc || '');

  // Tally State
  const [tallyUrl, setTallyUrl] = useState(tallyConfig.tallyUrl || 'http://localhost:9000');
  const [tallyPort, setTallyPort] = useState(tallyConfig.tallyPort || 9000);
  const [tallyCompany, setTallyCompany] = useState(tallyConfig.companyName || '');
  const [defaultVoucherType, setDefaultVoucherType] = useState(tallyConfig.defaultVoucherType || 'Sales');
  const [proxyMode, setProxyMode] = useState(tallyConfig.proxyMode !== false);

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase();
    setSellerGstin(upper);
    if (upper.length >= 2) {
      const code = extractStateCodeFromGstin(upper);
      if (code) {
        setSellerStateCode(code);
        const match = INDIAN_STATES.find((s) => s.code === code);
        if (match) setSellerState(match.name);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateSellerInfo({
      name: sellerName.trim(),
      gstin: sellerGstin.trim(),
      state: sellerState,
      stateCode: sellerStateCode || getStateCodeByName(sellerState) || '07',
      address: sellerAddress.trim(),
      phone: sellerPhone.trim(),
      email: sellerEmail.trim(),
      bankName: bankName.trim(),
      bankAccountNo: bankAccountNo.trim(),
      bankIfsc: bankIfsc.trim(),
    });

    onUpdateTallyConfig({
      tallyUrl: tallyUrl.trim(),
      tallyPort: Number(tallyPort) || 9000,
      companyName: tallyCompany.trim(),
      defaultVoucherType: defaultVoucherType.trim(),
      proxyMode: proxyMode,
    });

    alert('✅ Settings saved successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">
              System Settings & Master Configurations
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('seller')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'seller'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Seller & Company Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tally')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tally'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Tally Prime Integration Setup</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {activeTab === 'seller' ? (
            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Your Business / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={sellerGstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-semibold uppercase text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    State
                  </label>
                  <select
                    value={sellerState}
                    onChange={(e) => {
                      setSellerState(e.target.value);
                      const code = getStateCodeByName(e.target.value);
                      if (code) setSellerStateCode(code);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>
                        [{s.code}] {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Registered Address
                </label>
                <input
                  type="text"
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Email ID
                  </label>
                  <input
                    type="email"
                    value={sellerEmail}
                    onChange={(e) => setSellerEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Bank Account Details (Printed on Invoice)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      A/C Number
                    </label>
                    <input
                      type="text"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      placeholder="e.g. 50200012345678"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Tally Prime HTTP Server URL
                </label>
                <input
                  type="text"
                  required
                  value={tallyUrl}
                  onChange={(e) => setTallyUrl(e.target.value)}
                  placeholder="http://localhost:9000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Default Tally Prime XML port is 9000.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Company Name in Tally (Optional)
                  </label>
                  <input
                    type="text"
                    value={tallyCompany}
                    onChange={(e) => setTallyCompany(e.target.value)}
                    placeholder="Leave empty for currently open company"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Default Voucher Type
                  </label>
                  <input
                    type="text"
                    value={defaultVoucherType}
                    onChange={(e) => setDefaultVoucherType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="settings-proxy-check"
                  checked={proxyMode}
                  onChange={(e) => setProxyMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="settings-proxy-check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Route through Express Backend Proxy (Recommended for CORS bypass)
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
