import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { Invoice, InvoiceItem } from '../types';

interface Props {
  invoice?: Invoice | null;
  onSave: (invoice: Invoice) => void;
  onClose: () => void;
}

export const InvoiceEditorModal: React.FC<Props> = ({ invoice, onSave, onClose }) => {
  const isEditing = !!invoice;

  const [invoiceNo, setInvoiceNo] = useState(invoice?.invoiceNo || 'BG/26-27/000384');
  const [date, setDate] = useState(invoice?.date || '2026-08-29');
  const [partyName, setPartyName] = useState(invoice?.partyName || 'Shree Ganesh Trading Co.');
  const [partyGstin, setPartyGstin] = useState(invoice?.partyGstin || '27AAAAA0000A1Z5');
  const [partyState, setPartyState] = useState(invoice?.partyState || 'Maharashtra');
  const [isInterState, setIsInterState] = useState(invoice?.isInterState || false);
  const [salesLedger, setSalesLedger] = useState(invoice?.salesLedger || 'Sales Account');
  const [narration, setNarration] = useState(invoice?.narration || '');

  const [items, setItems] = useState<InvoiceItem[]>(
    invoice?.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            id: '1',
            name: 'Industrial Valve 25mm',
            hsn: '84818030',
            qty: 10,
            unit: 'PCS',
            rate: 1500,
            amount: 15000,
            gstRate: 18,
          },
        ]
  );

  const calculateTotals = () => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    items.forEach((item) => {
      const amt = item.qty * item.rate;
      taxable += amt;
      if (isInterState) {
        igst += (amt * item.gstRate) / 100;
      } else {
        cgst += (amt * (item.gstRate / 2)) / 100;
        sgst += (amt * (item.gstRate / 2)) / 100;
      }
    });

    const unroundedTotal = taxable + cgst + sgst + igst;
    const roundedTotal = Math.round(unroundedTotal);
    const roundOff = Number((roundedTotal - unroundedTotal).toFixed(2));

    return { taxable, cgst, sgst, igst, roundOff, total: roundedTotal };
  };

  const totals = calculateTotals();

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    if (field === 'qty' || field === 'rate') {
      item.amount = Number(item.qty || 0) * Number(item.rate || 0);
    }
    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        name: 'New Product Item',
        hsn: '8481',
        qty: 1,
        unit: 'PCS',
        rate: 1000,
        amount: 1000,
        gstRate: 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedInvoice: Invoice = {
      id: invoice?.id || Date.now().toString(),
      invoiceNo,
      date,
      partyName,
      partyGstin,
      partyState,
      salesLedger,
      voucherType: 'Sales',
      isInterState,
      items,
      cgstAmount: totals.cgst,
      sgstAmount: totals.sgst,
      igstAmount: totals.igst,
      roundOff: totals.roundOff,
      totalAmount: totals.total,
      narration,
      syncStatus: invoice?.syncStatus || 'pending',
    };

    onSave(updatedInvoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isEditing ? `Edit Invoice: ${invoiceNo}` : 'Add New Portal Invoice'}
            </h3>
            <p className="text-xs text-slate-400">
              Invoice data will be formatted according to Tally Prime standard XML schemas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Top Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Number *
              </label>
              <input
                type="text"
                required
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. BG/26-27/000384"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GST Supply Type
              </label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center space-x-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    checked={!isInterState}
                    onChange={() => setIsInterState(false)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Intra-State (CGST+SGST)</span>
                </label>
                <label className="flex items-center space-x-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    checked={isInterState}
                    onChange={() => setIsInterState(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Inter-State (IGST)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party / Customer Name *
              </label>
              <input
                type="text"
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Shree Ganesh Trading"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party GSTIN
              </label>
              <input
                type="text"
                value={partyGstin}
                onChange={(e) => setPartyGstin(e.target.value)}
                className="w-full px-3 py-1.5 text-xs uppercase font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="27AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State Name
              </label>
              <input
                type="text"
                value={partyState}
                onChange={(e) => setPartyState(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Maharashtra"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Item Line Entries
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="grid grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 items-center text-xs"
                >
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Stock Item Name"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Rate (₹)"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={item.gstRate}
                      onChange={(e) => handleItemChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value={0}>GST 0%</option>
                      <option value={5}>GST 5%</option>
                      <option value={12}>GST 12%</option>
                      <option value={18}>GST 18%</option>
                      <option value={28}>GST 28%</option>
                    </select>
                  </div>
                  <div className="col-span-1 text-right font-mono font-semibold text-slate-700">
                    ₹{(item.qty * item.rate).toLocaleString('en-IN')}
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div>Taxable Value: <span className="font-mono font-semibold">₹{totals.taxable.toFixed(2)}</span></div>
              {isInterState ? (
                <div>IGST Total: <span className="font-mono font-semibold">₹{totals.igst.toFixed(2)}</span></div>
              ) : (
                <div className="flex space-x-3">
                  <span>CGST: <strong className="font-mono">₹{totals.cgst.toFixed(2)}</strong></span>
                  <span>SGST: <strong className="font-mono">₹{totals.sgst.toFixed(2)}</strong></span>
                </div>
              )}
              <div>Round Off: <span className="font-mono">{totals.roundOff.toFixed(2)}</span></div>
            </div>

            <div className="text-right">
              <div className="text-slate-400 uppercase text-[10px] tracking-wider">Grand Total Amount</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Narration / Remarks
            </label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. Being goods sold against PO #1029"
            />
          </div>

          {/* Footer */}
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {isEditing ? 'Save Changes' : 'Add Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
