import React, { useState } from 'react';
import { FileCode2, X, CheckCircle2, AlertCircle, ArrowDownToLine } from 'lucide-react';
import { Party, StockItem, SellerInfo, Invoice } from '../types';
import { parseDebtorsXML, parseStockItemsXML, parseCompaniesXML, parseSalesVouchersXML } from '../services/tallyService';

interface XmlPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDebtors: (parties: Party[]) => void;
  onImportItems: (items: StockItem[]) => void;
  onImportCompanies?: (companies: SellerInfo[]) => void;
  onImportInvoices?: (invoices: Invoice[], parties?: Party[], items?: StockItem[]) => void;
  sellerInfo?: SellerInfo;
}

export const XmlPasteModal: React.FC<XmlPasteModalProps> = ({
  isOpen,
  onClose,
  onImportDebtors,
  onImportItems,
  onImportCompanies,
  onImportInvoices,
  sellerInfo,
}) => {
  if (!isOpen) return null;

  const [xmlText, setXmlText] = useState<string>('');
  const [importType, setImportType] = useState<'auto' | 'invoices' | 'debtors' | 'items' | 'company'>('auto');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleProcessXml = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!xmlText.trim()) {
      setErrorMsg('Please paste XML content first.');
      return;
    }

    try {
      const lower = xmlText.toLowerCase();

      // Check Sales Invoices / Vouchers
      if (
        (importType === 'invoices' || (importType === 'auto' && lower.includes('<voucher'))) &&
        onImportInvoices
      ) {
        const result = parseSalesVouchersXML(xmlText, sellerInfo);
        if (result.invoices.length > 0) {
          onImportInvoices(result.invoices, result.extractedParties, result.extractedItems);
          setSuccessMsg(`✅ Successfully imported ${result.invoices.length} Sales Invoices & auto-discovered ${result.extractedParties.length} Parties and ${result.extractedItems.length} Items from Tally XML!`);
          setTimeout(() => onClose(), 1800);
          return;
        }
      }

      // Check Company
      if (
        (importType === 'company' || (importType === 'auto' && lower.includes('<company'))) &&
        onImportCompanies
      ) {
        const companies = parseCompaniesXML(xmlText);
        if (companies.length > 0) {
          onImportCompanies(companies);
          setSuccessMsg(`✅ Successfully imported ${companies.length} Company profile(s) from XML!`);
          setTimeout(() => onClose(), 1500);
          return;
        }
      }

      // Check Debtors
      if (importType === 'debtors' || (importType === 'auto' && (lower.includes('<ledger') || lower.includes('debtor')))) {
        const debtors = parseDebtorsXML(xmlText);
        if (debtors.length > 0) {
          onImportDebtors(debtors);
          setSuccessMsg(`✅ Successfully imported ${debtors.length} Debtors from XML!`);
          setTimeout(() => onClose(), 1500);
          return;
        }
      }

      // Check Stock Items
      if (importType === 'items' || (importType === 'auto' && (lower.includes('<stockitem') || lower.includes('stock item')))) {
        const items = parseStockItemsXML(xmlText);
        if (items.length > 0) {
          onImportItems(items);
          setSuccessMsg(`✅ Successfully imported ${items.length} Stock Items from XML!`);
          setTimeout(() => onClose(), 1500);
          return;
        }
      }

      // If auto couldn't decide, try all sequentially
      if (onImportInvoices) {
        const voucherRes = parseSalesVouchersXML(xmlText, sellerInfo);
        if (voucherRes.invoices.length > 0) {
          onImportInvoices(voucherRes.invoices, voucherRes.extractedParties, voucherRes.extractedItems);
          setSuccessMsg(`✅ Successfully imported ${voucherRes.invoices.length} Sales Invoices from XML!`);
          setTimeout(() => onClose(), 1800);
          return;
        }
      }

      if (onImportCompanies) {
        const companies = parseCompaniesXML(xmlText);
        if (companies.length > 0) {
          onImportCompanies(companies);
          setSuccessMsg(`✅ Successfully imported ${companies.length} Company profile(s) from XML!`);
          setTimeout(() => onClose(), 1500);
          return;
        }
      }

      const debtors = parseDebtorsXML(xmlText);
      const items = parseStockItemsXML(xmlText);

      if (debtors.length > 0) {
        onImportDebtors(debtors);
        setSuccessMsg(`✅ Successfully imported ${debtors.length} Debtors from XML!`);
        setTimeout(() => onClose(), 1500);
      } else if (items.length > 0) {
        onImportItems(items);
        setSuccessMsg(`✅ Successfully imported ${items.length} Stock Items from XML!`);
        setTimeout(() => onClose(), 1500);
      } else {
        setErrorMsg('Could not find any <VOUCHER>, <COMPANY>, <LEDGER>, or <STOCKITEM> nodes in the pasted XML.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid XML string format');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FileCode2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">
              Paste Tally XML Content Directly
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Tally Prime se XML text copy karke yahan paste karein. Hamara parser auto-detect karke Invoices (Vouchers), Company Profiles, Debtors ya Stock Items import aur de-duplicate kar dega!
        </p>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-600">Expected Type:</label>
          <label className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="importType"
              checked={importType === 'auto'}
              onChange={() => setImportType('auto')}
            />
            <span>Auto Detect</span>
          </label>
          <label className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="importType"
              checked={importType === 'invoices'}
              onChange={() => setImportType('invoices')}
            />
            <span className="font-semibold text-blue-600">Invoices / Vouchers</span>
          </label>
          <label className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="importType"
              checked={importType === 'company'}
              onChange={() => setImportType('company')}
            />
            <span>Company Profile</span>
          </label>
          <label className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="importType"
              checked={importType === 'debtors'}
              onChange={() => setImportType('debtors')}
            />
            <span>Debtors (Ledgers)</span>
          </label>
          <label className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="importType"
              checked={importType === 'items'}
              onChange={() => setImportType('items')}
            />
            <span>Stock Items</span>
          </label>
        </div>

        <textarea
          rows={10}
          value={xmlText}
          onChange={(e) => setXmlText(e.target.value)}
          placeholder="<ENVELOPE>&#10;  <HEADER>...</HEADER>&#10;  <BODY>&#10;    <DATA>&#10;      <TALLYMESSAGE>&#10;        <VOUCHER VCHTYPE='Sales'>...</VOUCHER>&#10;      </TALLYMESSAGE>&#10;    </DATA>&#10;  </BODY>&#10;</ENVELOPE>"
          className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg border border-slate-800 outline-none resize-none leading-relaxed"
        />

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessXml}
            className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Parse &amp; Import Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};

