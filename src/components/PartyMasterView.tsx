import React, { useState, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  ArrowDownToLine,
  FileCode,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Party } from '../types';
import { INDIAN_STATES, getStateCodeByName, extractPanFromGstin, extractStateCodeFromGstin } from '../utils/gstUtils';
import { generateTallyLedgerXML, parseDebtorsXML } from '../services/tallyService';

interface PartyMasterViewProps {
  parties: Party[];
  onAddParty: (party: Party) => void;
  onUpdateParty: (party: Party) => void;
  onDeleteParty: (id: string) => void;
  onImportFromTally: () => void;
  onOpenXmlPaste: () => void;
  onLoadSampleParties: () => void;
  isImporting: boolean;
}

export const PartyMasterView: React.FC<PartyMasterViewProps> = ({
  parties,
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onImportFromTally,
  onOpenXmlPaste,
  onLoadSampleParties,
  isImporting,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Add / Edit
  const [formName, setFormName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formState, setFormState] = useState('Delhi');
  const [formStateCode, setFormStateCode] = useState('07');
  const [formPin, setFormPin] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPan, setFormPan] = useState('');
  const [formRegistrationType, setFormRegistrationType] = useState('Regular');

  const filteredParties = parties.filter((p) => {
    return (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.state && p.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.mobile && p.mobile.includes(searchTerm))
    );
  });

  const openAddModal = () => {
    setEditingParty(null);
    setFormName('');
    setFormGstin('');
    setFormMobile('');
    setFormState('Delhi');
    setFormStateCode('07');
    setFormPin('');
    setFormCity('');
    setFormAddress('');
    setFormPan('');
    setFormRegistrationType('Regular');
    setIsModalOpen(true);
  };

  const openEditModal = (party: Party) => {
    setEditingParty(party);
    setFormName(party.name);
    setFormGstin(party.gstin || '');
    setFormMobile(party.mobile || '');
    setFormState(party.state || 'Delhi');
    setFormStateCode(party.state_code || getStateCodeByName(party.state) || '07');
    setFormPin(party.pin || '');
    setFormCity(party.city || '');
    setFormAddress(party.address || '');
    setFormPan(party.pan || '');
    setFormRegistrationType(party.registration_type || 'Regular');
    setIsModalOpen(true);
  };

  const handleFormGstinChange = (val: string) => {
    const upper = val.toUpperCase();
    setFormGstin(upper);
    if (upper.length >= 2) {
      const code = extractStateCodeFromGstin(upper);
      if (code) {
        setFormStateCode(code);
        const match = INDIAN_STATES.find((s) => s.code === code);
        if (match) setFormState(match.name);
      }
    }
    if (upper.length === 15) {
      const p = extractPanFromGstin(upper);
      if (p) setFormPan(p);
    }
  };

  const handleSaveParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingParty) {
      const updated: Party = {
        ...editingParty,
        name: formName.trim(),
        gstin: formGstin.trim(),
        mobile: formMobile.trim(),
        state: formState,
        state_code: formStateCode || getStateCodeByName(formState),
        pin: formPin.trim(),
        city: formCity.trim(),
        address: formAddress.trim(),
        pan: formPan.trim(),
        registration_type: formRegistrationType,
        country: 'India',
      };
      onUpdateParty(updated);
    } else {
      const newParty: Party = {
        id: `party-${Date.now()}`,
        name: formName.trim(),
        gstin: formGstin.trim(),
        mobile: formMobile.trim(),
        state: formState,
        state_code: formStateCode || getStateCodeByName(formState),
        pin: formPin.trim(),
        city: formCity.trim(),
        address: formAddress.trim(),
        pan: formPan.trim(),
        registration_type: formRegistrationType,
        country: 'India',
      };
      onAddParty(newParty);
    }
    setIsModalOpen(false);
  };

  // Handle direct XML File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseDebtorsXML(text);
        if (parsed.length > 0) {
          parsed.forEach((p) => onAddParty(p));
          alert(`✅ Successfully imported ${parsed.length} debtors from XML file!`);
        } else {
          alert('No Sundry Debtors found in the uploaded XML file.');
        }
      } catch (err: any) {
        alert(`XML Parse Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Export single party to XML
  const handleExportPartyXml = (party: Party) => {
    const xml = generateTallyLedgerXML(party);
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_Ledger_${party.name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Sundry Debtors & Customer Directory</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {parties.length} customer ledgers registered for GST invoicing and Tally Prime sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Load Sample Debtors */}
          <button
            onClick={onLoadSampleParties}
            className="flex items-center space-x-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Sample Debtors</span>
          </button>

          {/* Import from Tally Direct */}
          <button
            onClick={onImportFromTally}
            disabled={isImporting}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <ArrowDownToLine className={`w-3.5 h-3.5 ${isImporting ? 'animate-bounce' : ''}`} />
            <span>{isImporting ? 'Reading Tally...' : '📥 Import From Tally'}</span>
          </button>

          {/* Upload XML File */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Tally XML</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml"
            className="hidden"
          />

          {/* Add New Debtor */}
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Debtor</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name, GSTIN, mobile, or state..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Parties Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredParties.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-700">No Debtors Found</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Import Sundry Debtors from Tally Prime using the "Import From Tally" button or add new customers manually.
            </p>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
            >
              Add Customer Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Party / Customer Name</th>
                  <th className="py-3 px-3">GSTIN</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3">Mobile / Phone</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredParties.map((party) => (
                  <tr key={party.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{party.name}</div>
                      {party.pan && <div className="font-mono text-[10px] text-slate-400">PAN: {party.pan}</div>}
                    </td>

                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      {party.gstin || <span className="text-slate-400 font-normal italic">Unregistered</span>}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700">{party.state}</span>
                      {party.state_code && (
                        <span className="ml-1.5 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-500">
                          {party.state_code}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      {party.mobile || '-'}
                    </td>

                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={party.address}>
                      {party.address || '-'}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {party.registration_type || 'Regular'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleExportPartyXml(party)}
                          title="Export Tally Ledger XML"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                        >
                          <FileCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(party)}
                          title="Edit Party"
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteParty(party.id)}
                          title="Delete Party"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Party Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingParty ? 'Edit Customer / Debtor' : 'Add New Debtor to Master'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Reliance Retail Ltd"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={formGstin}
                    maxLength={15}
                    onChange={(e) => handleFormGstinChange(e.target.value)}
                    placeholder="15-digit GSTIN"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-semibold uppercase text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Mobile / Phone
                  </label>
                  <input
                    type="text"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    State
                  </label>
                  <select
                    value={formState}
                    onChange={(e) => {
                      setFormState(e.target.value);
                      const code = getStateCodeByName(e.target.value);
                      if (code) setFormStateCode(code);
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

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    value={formPin}
                    maxLength={6}
                    onChange={(e) => setFormPin(e.target.value)}
                    placeholder="e.g. 110001"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Registration Type
                  </label>
                  <select
                    value={formRegistrationType}
                    onChange={(e) => setFormRegistrationType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Composition">Composition</option>
                    <option value="Unregistered">Unregistered</option>
                    <option value="Overseas">Overseas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Complete Address
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address, building, landmark..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {editingParty ? 'Save Changes' : 'Create Debtor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
