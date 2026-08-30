import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Check,
  Building,
  Phone,
  Mail,
  MapPin,
  Landmark,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Download,
  Upload,
  FileCode2,
  RefreshCw,
  Calendar,
  Globe,
  Coins,
  FileText,
  AlertCircle,
  HelpCircle,
  QrCode,
  Copy,
} from 'lucide-react';
import { SellerInfo, TallyConfig } from '../types';
import {
  INDIAN_STATES,
  getStateCodeByName,
  extractStateCodeFromGstin,
  extractPanFromGstin,
} from '../utils/gstUtils';
import {
  fetchCompaniesFromTally,
  parseCompaniesXML,
  DEFAULT_TALLY_CONFIG,
} from '../services/tallyService';

interface CompanyProfileViewProps {
  companies: SellerInfo[];
  currentCompany: SellerInfo;
  onSelectCompany: (company: SellerInfo) => void;
  onAddCompany: (company: SellerInfo) => void;
  onUpdateCompany: (company: SellerInfo) => void;
  onDeleteCompany: (id: string) => void;
  tallyConfig?: TallyConfig;
}

export const CompanyProfileView: React.FC<CompanyProfileViewProps> = ({
  companies,
  currentCompany,
  onSelectCompany,
  onAddCompany,
  onUpdateCompany,
  onDeleteCompany,
  tallyConfig = DEFAULT_TALLY_CONFIG,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImportingFromTally, setIsImportingFromTally] = useState<boolean>(false);
  const [isXmlPasteOpen, setIsXmlPasteOpen] = useState<boolean>(false);
  const [pastedXml, setPastedXml] = useState<string>('');

  // Form State - Fully aligned with Tally Prime Company Master
  const [name, setName] = useState<string>('');
  const [mailingName, setMailingName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [state, setState] = useState<string>('Delhi');
  const [stateCode, setStateCode] = useState<string>('07');
  const [country, setCountry] = useState<string>('India');
  const [pincode, setPincode] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [website, setWebsite] = useState<string>('');

  // Statutory Details
  const [gstin, setGstin] = useState<string>('');
  const [pan, setPan] = useState<string>('');

  // Financial Year & Accounting
  const [financialYearFrom, setFinancialYearFrom] = useState<string>('2025-04-01');
  const [booksBeginningFrom, setBooksBeginningFrom] = useState<string>('2025-04-01');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [currencyFormalName, setCurrencyFormalName] = useState<string>('INR');

  // Banking Details
  const [bankName, setBankName] = useState<string>('');
  const [bankAccountNo, setBankAccountNo] = useState<string>('');
  const [bankIfsc, setBankIfsc] = useState<string>('');
  const [bankBranch, setBankBranch] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');

  const [notification, setNotification] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const resetForm = () => {
    setName('');
    setMailingName('');
    setAddress('');
    setState('Delhi');
    setStateCode('07');
    setCountry('India');
    setPincode('');
    setPhone('');
    setMobile('');
    setEmail('');
    setWebsite('');
    setGstin('');
    setPan('');
    setFinancialYearFrom('2025-04-01');
    setBooksBeginningFrom('2025-04-01');
    setCurrencySymbol('₹');
    setCurrencyFormalName('INR');
    setBankName('');
    setBankAccountNo('');
    setBankIfsc('');
    setBankBranch('');
    setUpiId('');
    setEditingId(null);
    setIsEditing(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleOpenEdit = (comp: SellerInfo) => {
    setEditingId(comp.id || comp.name);
    setName(comp.name);
    setMailingName(comp.mailingName || comp.tradeName || comp.name);
    setAddress(comp.address || '');
    setState(comp.state || 'Delhi');
    setStateCode(comp.stateCode || getStateCodeByName(comp.state) || '07');
    setCountry(comp.country || 'India');
    setPincode(comp.pincode || '');
    setPhone(comp.phone || '');
    setMobile(comp.mobile || '');
    setEmail(comp.email || '');
    setWebsite(comp.website || '');
    setGstin(comp.gstin || '');
    setPan(comp.pan || (comp.gstin ? extractPanFromGstin(comp.gstin) : ''));
    setFinancialYearFrom(comp.financialYearFrom || '2025-04-01');
    setBooksBeginningFrom(comp.booksBeginningFrom || '2025-04-01');
    setCurrencySymbol(comp.currencySymbol || '₹');
    setCurrencyFormalName(comp.currencyFormalName || 'INR');
    setBankName(comp.bankName || '');
    setBankAccountNo(comp.bankAccountNo || '');
    setBankIfsc(comp.bankIfsc || '');
    setBankBranch(comp.bankBranch || '');
    setUpiId(comp.upiId || '');
    setIsEditing(true);
  };

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    setGstin(upper);
    if (upper.length >= 2) {
      const code = extractStateCodeFromGstin(upper);
      if (code) {
        setStateCode(code);
        const matchState = INDIAN_STATES.find((s) => s.code === code);
        if (matchState) setState(matchState.name);
      }
    }
    if (upper.length >= 10) {
      const extractedPan = extractPanFromGstin(upper);
      if (extractedPan) setPan(extractedPan);
    }
  };

  const handleStateChange = (selectedStateName: string) => {
    setState(selectedStateName);
    const code = getStateCodeByName(selectedStateName);
    if (code) setStateCode(code);
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNotification({ text: 'Company Name is required.', type: 'error' });
      return;
    }

    const companyData: SellerInfo = {
      id: editingId || `comp-${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name.trim().toUpperCase(),
      tradeName: mailingName && mailingName !== name ? mailingName.trim() : undefined,
      mailingName: mailingName.trim() || name.trim().toUpperCase(),
      address: address.trim(),
      state: state.trim(),
      stateCode: stateCode.trim() || '07',
      country: country.trim() || 'India',
      pincode: pincode.trim(),
      phone: phone.trim() || mobile.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      website: website.trim(),
      gstin: gstin.trim().toUpperCase(),
      pan: pan.trim().toUpperCase() || (gstin ? extractPanFromGstin(gstin) : ''),
      financialYearFrom: financialYearFrom,
      booksBeginningFrom: booksBeginningFrom,
      currencySymbol: currencySymbol || '₹',
      currencyFormalName: currencyFormalName || 'INR',
      bankName: bankName.trim(),
      bankAccountNo: bankAccountNo.trim(),
      bankIfsc: bankIfsc.trim().toUpperCase(),
      bankBranch: bankBranch.trim(),
      upiId: upiId.trim(),
      isDefault: currentCompany.id === editingId || companies.length === 0,
    };

    if (editingId) {
      onUpdateCompany(companyData);
      setNotification({
        text: `✅ Company "${companyData.name}" details updated successfully (Tally Master Altered)!`,
        type: 'success',
      });
    } else {
      onAddCompany(companyData);
      setNotification({
        text: `✅ New Company "${companyData.name}" created and set as active!`,
        type: 'success',
      });
    }

    resetForm();
    setTimeout(() => setNotification(null), 4000);
  };

  // 1-Click Direct Import from Active Tally Prime Instance
  const handleImportFromTallyPrime = async () => {
    setIsImportingFromTally(true);
    setNotification({
      text: 'Connecting to Tally Prime on Port 9000 and exporting Company Master...',
      type: 'info',
    });

    try {
      const importedCompanies = await fetchCompaniesFromTally(tallyConfig);
      if (importedCompanies.length > 0) {
        // Add or update all fetched companies
        importedCompanies.forEach((comp) => {
          const exists = companies.find(
            (c) => c.name.toLowerCase() === comp.name.toLowerCase() || (comp.gstin && c.gstin === comp.gstin)
          );
          if (exists) {
            onUpdateCompany({ ...comp, id: exists.id });
          } else {
            onAddCompany(comp);
          }
        });

        // Set the first imported company as current active
        onSelectCompany(importedCompanies[0]);

        setNotification({
          text: `🎉 Successfully imported ${importedCompanies.length} Company profile(s) from Tally Prime! Active Company: "${importedCompanies[0].name}"`,
          type: 'success',
        });
      } else {
        setNotification({
          text: '⚠️ Tally Prime responded, but no open company was detected. Please ensure a Company is open in Tally Prime.',
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('Error importing company from Tally:', err);
      setNotification({
        text: `❌ Could not connect to Tally Prime (${err.message || 'Port 9000 unreachable'}). Make sure Tally Prime is running with HTTP Server enabled (F12 > Advanced Configuration > Allow HTTP: Yes, Port: 9000) or use "Paste Tally XML".`,
        type: 'error',
      });
    } finally {
      setIsImportingFromTally(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  // Process Pasted Tally XML
  const handleProcessPastedXml = () => {
    if (!pastedXml.trim()) {
      setNotification({ text: 'Please paste Tally XML content first.', type: 'error' });
      return;
    }

    try {
      const parsedCompanies = parseCompaniesXML(pastedXml);
      if (parsedCompanies.length > 0) {
        parsedCompanies.forEach((comp) => {
          const exists = companies.find(
            (c) => c.name.toLowerCase() === comp.name.toLowerCase() || (comp.gstin && c.gstin === comp.gstin)
          );
          if (exists) {
            onUpdateCompany({ ...comp, id: exists.id });
          } else {
            onAddCompany(comp);
          }
        });

        onSelectCompany(parsedCompanies[0]);
        setIsXmlPasteOpen(false);
        setPastedXml('');
        setNotification({
          text: `🎉 Successfully imported ${parsedCompanies.length} Company profile(s) from XML! Active: "${parsedCompanies[0].name}"`,
          type: 'success',
        });
      } else {
        setNotification({
          text: '❌ No valid <COMPANY> master found in the pasted XML. Please check the XML format.',
          type: 'error',
        });
      }
    } catch (e: any) {
      setNotification({
        text: `❌ Failed to parse XML: ${e.message}`,
        type: 'error',
      });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  // Load sample Indian GST companies
  const handleLoadSampleCompanies = () => {
    const samples: SellerInfo[] = [
      {
        id: 'comp-anish-tech',
        name: 'ANISH TECHNOLOGIES PVT LTD',
        tradeName: 'Anish Tech & Hardware Solutions',
        mailingName: 'ANISH TECHNOLOGIES PVT LTD',
        gstin: '07AABCA1234F1Z5',
        state: 'Delhi',
        stateCode: '07',
        country: 'India',
        pincode: '110020',
        address: 'Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
        phone: '+91 98110 23456',
        mobile: '+91 98110 23456',
        email: 'contact@anishtechnologies.com',
        website: 'www.anishtechnologies.com',
        pan: 'AABCA1234F',
        financialYearFrom: '2025-04-01',
        booksBeginningFrom: '2025-04-01',
        currencySymbol: '₹',
        currencyFormalName: 'INR',
        bankName: 'HDFC Bank Ltd',
        bankAccountNo: '50200018945612',
        bankIfsc: 'HDFC0000123',
        bankBranch: 'Okhla Phase-III, New Delhi',
        upiId: 'anish@hdfcbank',
        isDefault: true,
      },
      {
        id: 'comp-apex-solutions',
        name: 'APEX INDUSTRIAL SOLUTIONS',
        tradeName: 'Apex Spares & Engineering',
        mailingName: 'APEX INDUSTRIAL SOLUTIONS',
        gstin: '27AABCA9876E1Z2',
        state: 'Maharashtra',
        stateCode: '27',
        country: 'India',
        pincode: '400093',
        address: 'B-14, MIDC Central Road, Andheri East, Mumbai - 400093',
        phone: '+91 98200 55443',
        mobile: '+91 98200 55443',
        email: 'accounts@apexsolutions.in',
        website: 'www.apexsolutions.in',
        pan: 'AABCA9876E',
        financialYearFrom: '2025-04-01',
        booksBeginningFrom: '2025-04-01',
        currencySymbol: '₹',
        currencyFormalName: 'INR',
        bankName: 'ICICI Bank Ltd',
        bankAccountNo: '102938475601',
        bankIfsc: 'ICIC0001029',
        bankBranch: 'Andheri East, Mumbai',
        upiId: 'apex@icici',
        isDefault: false,
      },
      {
        id: 'comp-shree-radhey',
        name: 'SHREE RADHEY ENTERPRISES',
        tradeName: 'Radhey Electricals & Automation',
        mailingName: 'SHREE RADHEY ENTERPRISES',
        gstin: '09AABCS5544P1ZV',
        state: 'Uttar Pradesh',
        stateCode: '09',
        country: 'India',
        pincode: '201301',
        address: 'C-89, Sector 63, Noida, Gautam Buddha Nagar, Uttar Pradesh - 201301',
        phone: '+91 99100 88776',
        mobile: '+91 99100 88776',
        email: 'sales@shreeradhey.com',
        website: 'www.shreeradhey.com',
        pan: 'AABCS5544P',
        financialYearFrom: '2025-04-01',
        booksBeginningFrom: '2025-04-01',
        currencySymbol: '₹',
        currencyFormalName: 'INR',
        bankName: 'State Bank of India',
        bankAccountNo: '30495867120',
        bankIfsc: 'SBIN0004050',
        bankBranch: 'Sector 62 Noida',
        upiId: 'radhey@sbi',
        isDefault: false,
      },
    ];

    samples.forEach((s) => {
      const exists = companies.find((c) => c.name === s.name);
      if (!exists) onAddCompany(s);
    });

    setNotification({
      text: '✅ Sample companies loaded with full GST & Banking details!',
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Tally Prime Style Banner & Quick Action Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-blue-900/30 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="bg-amber-400/20 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-amber-400/40">
                Alt + K : Company Info
              </span>
              <span className="text-xs text-slate-300 font-semibold">Tally Prime Mirror Master</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-400" />
              Company Master &amp; Profile Directory
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Manage your company information exactly as configured in Tally Prime (Mailing Name, Registered Address, State Code, Financial Year, GSTIN, PAN, and Bank Details).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Direct Import from Tally Prime Button */}
            <button
              onClick={handleImportFromTallyPrime}
              disabled={isImportingFromTally}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              title="Queries active Tally Prime instance on port 9000 and pulls company name, address, GSTIN, etc."
            >
              <RefreshCw className={`w-4 h-4 ${isImportingFromTally ? 'animate-spin' : ''}`} />
              <span>{isImportingFromTally ? 'Connecting Tally...' : '📥 Import from Tally Prime'}</span>
            </button>

            {/* Paste XML Button */}
            <button
              onClick={() => setIsXmlPasteOpen(true)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer"
              title="Paste exported Tally Company XML"
            >
              <FileCode2 className="w-4 h-4 text-amber-400" />
              <span>Paste Company XML</span>
            </button>

            {/* Add Company Button */}
            <button
              onClick={handleOpenAdd}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Company</span>
            </button>
          </div>
        </div>

        {/* Active Company Quick Status Card */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Current Active Company:</span>
            <span className="font-bold text-amber-300 font-mono text-sm tracking-wide">
              {currentCompany.name}
            </span>
            {currentCompany.gstin && (
              <span className="bg-slate-800 text-slate-200 font-mono px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                GSTIN: {currentCompany.gstin}
              </span>
            )}
            <span className="bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded border border-blue-800/60 text-[11px] font-semibold">
              State: [{currentCompany.stateCode || getStateCodeByName(currentCompany.state) || '07'}] {currentCompany.state}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span>Books From: <strong className="text-slate-200">{currentCompany.financialYearFrom || '01-Apr-2025'}</strong></span>
            <span>•</span>
            <span>Currency: <strong className="text-slate-200">{currentCompany.currencySymbol || '₹'} ({currentCompany.currencyFormalName || 'INR'})</strong></span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs border animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : notification.type === 'info'
              ? 'bg-blue-50 border-blue-300 text-blue-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'info' ? (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* XML Paste Modal */}
      {isXmlPasteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileCode2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Paste Tally Company XML Master</h3>
              </div>
              <button
                onClick={() => setIsXmlPasteOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Export Company Master from Tally Prime (<strong>Alt + E &gt; Masters &gt; Company &gt; XML</strong>) or copy any raw Tally XML containing <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">&lt;COMPANY&gt;</code> tags and paste below:
            </p>

            <textarea
              rows={8}
              value={pastedXml}
              onChange={(e) => setPastedXml(e.target.value)}
              placeholder="<ENVELOPE>&#10;  <BODY>&#10;    <IMPORTDATA>&#10;      <REQUESTDATA>&#10;        <TALLYMESSAGE>&#10;          <COMPANY NAME=&quot;ANISH TECHNOLOGIES PVT LTD&quot;>&#10;            <BASICCOMPANYFORMALNAME>Anish Tech</BASICCOMPANYFORMALNAME>&#10;            <GSTIN>07AABCA1234F1Z5</GSTIN>&#10;            ...&#10;          </COMPANY>&#10;        </TALLYMESSAGE>&#10;      </REQUESTDATA>&#10;    </IMPORTDATA>&#10;  </BODY>&#10;</ENVELOPE>"
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:border-blue-500 focus:bg-white outline-none"
            />

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsXmlPasteOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPastedXml}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Parse &amp; Import Company</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form: Tally Prime Company Creation / Alteration Screen */}
      {isEditing ? (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-lg overflow-hidden animate-fadeIn">
          {/* Tally Classic Screen Header */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-blue-950 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center space-x-3">
              <span className="bg-amber-400 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
                {editingId ? 'Company Alteration' : 'Company Creation'}
              </span>
              <h2 className="font-bold text-sm tracking-wide text-white">
                {editingId ? `Altering: ${name || 'Company Profile'}` : 'New Company Master Form'}
              </h2>
            </div>
            <span className="text-[11px] text-slate-300 font-mono">Gateway of Tally &gt; Company Info</span>
          </div>

          <form onSubmit={handleSaveCompany} className="p-6 space-y-6">
            {/* Tally Dual Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Directory, Mailing & Contact Details */}
              <div className="lg:col-span-6 space-y-4 border-r-0 lg:border-r lg:border-slate-200 lg:pr-8">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                    Company Directory &amp; Mailing Details
                  </h3>
                </div>

                {/* Company Name (Primary) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Company Name (As per Tally Books) *</span>
                    <span className="text-[10px] text-blue-600 font-normal">Primary Identity</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!mailingName || mailingName === name) {
                        setMailingName(e.target.value);
                      }
                    }}
                    placeholder="e.g. ANISH TECHNOLOGIES PVT LTD"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-900 uppercase focus:border-blue-500 focus:bg-white outline-none"
                  />
                </div>

                {/* Mailing Name (To print on Invoices) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Mailing Name (Print on Invoices)</span>
                    <span className="text-[10px] text-slate-400">Trade / Display Name</span>
                  </label>
                  <input
                    type="text"
                    value={mailingName}
                    onChange={(e) => setMailingName(e.target.value)}
                    placeholder="e.g. Anish Tech & Hardware Solutions"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                  />
                </div>

                {/* Registered Address */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Registered Office / Factory Address</label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                  />
                </div>

                {/* State, State Code & Country */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">State / Province</label>
                    <select
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none cursor-pointer"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st.code} value={st.name}>
                          [{st.code}] {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">State Code</label>
                    <input
                      type="text"
                      readOnly
                      value={stateCode}
                      className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-700 text-center outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Country & Pincode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Country</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="India"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Pincode</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="110020"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>

                {/* Telephone & Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Telephone (Landline)</span>
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="011-23456789"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mobile Number</span>
                    </label>
                    <input
                      type="text"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="+91 98110 23456"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>

                {/* Email & Website */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>E-mail</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@anishtechnologies.com"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>Website</span>
                    </label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="www.anishtechnologies.com"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Financial Year, Statutory & Banking Details */}
              <div className="lg:col-span-6 space-y-6">
                {/* 1. Financial Year & Accounting Details */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                      Financial Year &amp; Currency Defaults
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Financial Year Beginning From</label>
                      <input
                        type="date"
                        value={financialYearFrom}
                        onChange={(e) => setFinancialYearFrom(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Books Beginning From</label>
                      <input
                        type="date"
                        value={booksBeginningFrom}
                        onChange={(e) => setBooksBeginningFrom(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Base Currency Symbol</label>
                      <input
                        type="text"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        placeholder="₹"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Formal Name</label>
                      <input
                        type="text"
                        value={currencyFormalName}
                        onChange={(e) => setCurrencyFormalName(e.target.value)}
                        placeholder="INR"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Statutory / GST & PAN Details */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                      Statutory &amp; GSTIN / PAN Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>GSTIN / UIN Number</span>
                        <span className="text-[10px] text-emerald-600 font-mono">15 Digits</span>
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={gstin}
                        onChange={(e) => handleGstinChange(e.target.value)}
                        placeholder="07AABCA1234F1Z5"
                        className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-emerald-950 uppercase focus:border-emerald-600 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>Income Tax PAN</span>
                        <span className="text-[10px] text-slate-400 font-mono">10 Digits</span>
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={pan}
                        onChange={(e) => setPan(e.target.value.toUpperCase())}
                        placeholder="AABCA1234F"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-slate-800 uppercase focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Banking & Digital Payment Details */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <Landmark className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                      Bank Account &amp; QR Settlement (Invoice Print)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Bank Name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank Ltd"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Bank Account Number</label>
                      <input
                        type="text"
                        value={bankAccountNo}
                        onChange={(e) => setBankAccountNo(e.target.value)}
                        placeholder="50200018945612"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-semibold text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">IFSC Code</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={bankIfsc}
                        onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                        placeholder="HDFC0000123"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-purple-900 uppercase focus:border-purple-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Branch Name</label>
                      <input
                        type="text"
                        value={bankBranch}
                        onChange={(e) => setBankBranch(e.target.value)}
                        placeholder="Okhla Phase-III"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-purple-600" />
                        <span>UPI ID / VPA</span>
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="anish@hdfcbank"
                        className="w-full bg-purple-50/40 border border-purple-200 rounded-lg px-3.5 py-2 text-xs font-mono text-purple-900 focus:border-purple-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel &amp; Close Form
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingId ? 'Accept & Alter Company (Ctrl+A)' : 'Accept & Create Company (Ctrl+A)'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {/* Stored Companies List & Active Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Registered Company Directory ({companies.length} Companies)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch billing company anytime. Invoices, GST calculations, and Tally Exports automatically bind to the selected company.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLoadSampleCompanies}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
              title="Load demo companies with valid Indian GST and banking configurations"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Load Demo Profiles</span>
            </button>
          </div>
        </div>

        {/* Company Cards Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.map((comp) => {
            const isActive = currentCompany.name === comp.name || currentCompany.id === comp.id;

            return (
              <div
                key={comp.id || comp.name}
                className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between p-5 relative ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Active Indicator Badge */}
                {isActive && (
                  <div className="absolute top-4 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 shadow-xs">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>ACTIVE BILLING CO.</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      [{comp.stateCode || getStateCodeByName(comp.state) || '07'}] {comp.state}
                    </span>
                    <h4 className="font-bold text-slate-900 text-base leading-snug mt-0.5 pr-20">
                      {comp.name}
                    </h4>
                    {comp.mailingName && comp.mailingName !== comp.name && (
                      <p className="text-xs text-slate-600 font-medium italic mt-0.5">
                        Trade: {comp.mailingName}
                      </p>
                    )}
                  </div>

                  {/* GSTIN & PAN Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {comp.gstin ? (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono text-[11px] font-bold px-2 py-0.5 rounded">
                        GSTIN: {comp.gstin}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-[11px] px-2 py-0.5 rounded">
                        Unregistered
                      </span>
                    )}

                    {comp.pan && (
                      <span className="bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded">
                        PAN: {comp.pan}
                      </span>
                    )}
                  </div>

                  {/* Address & Contact */}
                  <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                    {comp.address && (
                      <div className="flex items-start space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{comp.address}</span>
                      </div>
                    )}
                    {comp.phone && (
                      <div className="flex items-center space-x-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{comp.phone}</span>
                      </div>
                    )}
                    {comp.email && (
                      <div className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{comp.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Banking Info Tag */}
                  {comp.bankName && (
                    <div className="bg-purple-50/60 border border-purple-100 rounded-lg p-2 text-[11px] text-purple-950 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Landmark className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="font-semibold">{comp.bankName}</span>
                      </div>
                      {comp.bankAccountNo && (
                        <span className="font-mono text-[10px] text-purple-700">
                          •••• {comp.bankAccountNo.slice(-4)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  {!isActive ? (
                    <button
                      onClick={() => onSelectCompany(comp)}
                      className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Select as Active</span>
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 py-1 px-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active for All Invoices
                    </span>
                  )}

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(comp)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title="Alter / Edit Company Profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {companies.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete profile for "${comp.name}"?`)) {
                            onDeleteCompany(comp.id || comp.name);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Company"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tally Prime Integration Help Box */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3 text-xs text-amber-900">
        <div className="flex items-center space-x-2 font-bold text-amber-950">
          <HelpCircle className="w-4 h-4 text-amber-700" />
          <span>How Tally Prime Company Sync Works:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-amber-900/90 leading-relaxed">
          <div className="space-y-1 bg-white/60 p-3 rounded-xl border border-amber-200/60">
            <strong className="text-amber-950 font-bold block">1. 1-Click Direct Import</strong>
            When Tally Prime is open on your desktop, click <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950">📥 Import from Tally Prime</code>. It automatically extracts company name, address, GSTIN, and financial year via Tally HTTP API (Port 9000).
          </div>
          <div className="space-y-1 bg-white/60 p-3 rounded-xl border border-amber-200/60">
            <strong className="text-amber-950 font-bold block">2. XML Master Export</strong>
            In Tally Prime, you can also press <kbd className="bg-amber-100 px-1 py-0.5 rounded font-mono">Alt + E</kbd> &gt; <strong>Masters</strong> &gt; <strong>Company</strong> and paste the XML directly using <strong>Paste Company XML</strong>.
          </div>
          <div className="space-y-1 bg-white/60 p-3 rounded-xl border border-amber-200/60">
            <strong className="text-amber-950 font-bold block">3. Multi-Company Invoicing</strong>
            Each invoice created will inherit the active company's state code, GSTIN, place of supply rules (Intra-State vs Inter-State CGST/SGST/IGST), and printable bank account details.
          </div>
        </div>
      </div>
    </div>
  );
};
