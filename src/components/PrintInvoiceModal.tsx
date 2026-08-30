import React from 'react';
import { Printer, X, Download, FileCode, CheckCircle2 } from 'lucide-react';
import { Invoice } from '../types';
import { numberToIndianWords } from '../utils/gstUtils';
import { generateTallySalesVoucherXML } from '../services/tallyService';

interface PrintInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  invoice,
  onClose,
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadXml = () => {
    const xml = generateTallySalesVoucherXML(invoice);
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_Sales_${invoice.invoiceNo}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group items by HSN for GST Summary
  const hsnMap = new Map<
    string,
    {
      hsn: string;
      taxable: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
      total: number;
    }
  >();

  invoice.items.forEach((item) => {
    const key = `${item.hsn || 'N/A'}-${item.gstRate}`;
    const existing = hsnMap.get(key) || {
      hsn: item.hsn || 'N/A',
      taxable: 0,
      gstRate: item.gstRate,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0,
    };

    existing.taxable += item.taxableAmount || 0;
    existing.cgst += item.cgstAmount || 0;
    existing.sgst += item.sgstAmount || 0;
    existing.igst += item.igstAmount || 0;
    existing.total += (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0);

    hsnMap.set(key, existing);
  });

  const hsnSummaryList = Array.from(hsnMap.values());

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Container */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden print:shadow-none print:border-none print:max-w-none print:rounded-none">
        {/* Modal Top Action Bar (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm">Tax Invoice Preview</span>
            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded font-mono font-bold">
              {invoice.invoiceNo}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadXml}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold transition cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Tally XML</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Sheet */}
        <div className="p-8 max-w-3xl mx-auto space-y-6 text-slate-900 text-xs print:p-4 font-sans">
          {/* Header Title */}
          <div className="text-center border-b-2 border-slate-900 pb-3">
            <h1 className="text-xl font-extrabold tracking-wider uppercase">TAX INVOICE</h1>
            <p className="text-[11px] text-slate-600 font-semibold">(ORIGINAL FOR RECIPIENT)</p>
          </div>

          {/* Seller and Buyer Info Grid */}
          <div className="grid grid-cols-2 border border-slate-300 rounded-lg overflow-hidden divide-x divide-slate-300">
            {/* Seller */}
            <div className="p-4 space-y-1 bg-slate-50/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Details of Supplier / Seller
              </span>
              <h2 className="font-extrabold text-sm text-slate-900">{invoice.sellerName}</h2>
              <p className="text-[11px] text-slate-600 leading-relaxed">{invoice.sellerAddress}</p>
              <div className="pt-1.5 space-y-0.5 font-mono text-[11px]">
                <p><strong>GSTIN:</strong> {invoice.sellerGstin}</p>
                <p><strong>State:</strong> {invoice.sellerState} (Code: {invoice.sellerStateCode})</p>
                {invoice.sellerPhone && <p><strong>Phone:</strong> {invoice.sellerPhone}</p>}
              </div>
            </div>

            {/* Buyer */}
            <div className="p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Details of Receiver / Billed To
              </span>
              <h2 className="font-extrabold text-sm text-slate-900">{invoice.partyName}</h2>
              <p className="text-[11px] text-slate-600 leading-relaxed">{invoice.completeAddress || 'N/A'}</p>
              <div className="pt-1.5 space-y-0.5 font-mono text-[11px]">
                <p><strong>GSTIN:</strong> {invoice.gstin || 'Unregistered / Consumer'}</p>
                <p><strong>State:</strong> {invoice.partyState} (Code: {invoice.stateCode})</p>
                {invoice.pan && <p><strong>PAN:</strong> {invoice.pan}</p>}
                {invoice.mobile && <p><strong>Mobile:</strong> {invoice.mobile}</p>}
              </div>
            </div>
          </div>

          {/* Invoice Meta Bar */}
          <div className="grid grid-cols-3 border border-slate-300 rounded-lg p-3 bg-slate-50 text-[11px] font-medium divide-x divide-slate-200">
            <div className="px-2">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Invoice Number</span>
              <span className="font-mono font-bold text-slate-900">{invoice.invoiceNo}</span>
            </div>
            <div className="px-2">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Invoice Date</span>
              <span className="font-bold text-slate-900">{invoice.invoiceDate}</span>
            </div>
            <div className="px-2">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Place of Supply</span>
              <span className="font-bold text-slate-900">{invoice.partyState}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 font-bold uppercase text-slate-700 border-b border-slate-300 text-[10px]">
                  <th className="p-2 text-center w-8">#</th>
                  <th className="p-2">Item Description</th>
                  <th className="p-2 w-20">HSN</th>
                  <th className="p-2 w-12 text-right">Qty</th>
                  <th className="p-2 w-12">Unit</th>
                  <th className="p-2 w-20 text-right">Rate (₹)</th>
                  <th className="p-2 w-20 text-right">Taxable (₹)</th>
                  <th className="p-2 w-14 text-right">GST %</th>
                  <th className="p-2 w-24 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="p-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="p-2 font-mono text-slate-600">{item.hsn || '-'}</td>
                    <td className="p-2 text-right font-bold">{item.qty}</td>
                    <td className="p-2 text-slate-600">{item.unit}</td>
                    <td className="p-2 text-right font-mono">{item.rate.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-semibold">{item.taxableAmount.toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">{item.gstRate}%</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">{item.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Breakdown */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left: Narration & Bank Details */}
            <div className="col-span-7 space-y-3">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Amount in Words
                </span>
                <p className="text-[11px] font-bold text-slate-800 italic leading-relaxed">
                  {invoice.amountInWords || numberToIndianWords(invoice.grandTotal)}
                </p>
              </div>

              {invoice.notes && (
                <div className="border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
                  <p>{invoice.notes}</p>
                </div>
              )}
            </div>

            {/* Right: Calculations */}
            <div className="col-span-5 border border-slate-300 rounded-lg p-3 space-y-1.5 bg-slate-50/30 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Items Value:</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹{(invoice.subtotalTaxable - (invoice.totalAdditionalCharges || 0)).toFixed(2)}
                </span>
              </div>

              {/* Additional Expense Lines */}
              {invoice.freightAmount && invoice.freightAmount > 0 && (
                <div className="flex justify-between text-blue-800">
                  <span>Freight &amp; Forwarding:</span>
                  <span className="font-mono">₹{invoice.freightAmount.toFixed(2)}</span>
                </div>
              )}
              {invoice.labourAmount && invoice.labourAmount > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Labour &amp; Handling:</span>
                  <span className="font-mono">₹{invoice.labourAmount.toFixed(2)}</span>
                </div>
              )}
              {invoice.otherExpenseAmount && invoice.otherExpenseAmount > 0 && (
                <div className="flex justify-between text-purple-800">
                  <span>{invoice.otherExpenseLabel || 'Other Charges'}:</span>
                  <span className="font-mono">₹{invoice.otherExpenseAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200 pt-1">
                <span>Total Taxable Base:</span>
                <span className="font-mono text-slate-900">₹{invoice.subtotalTaxable.toFixed(2)}</span>
              </div>

              {invoice.isInterState ? (
                <div className="flex justify-between text-purple-700 font-semibold">
                  <span>Output IGST:</span>
                  <span className="font-mono">₹{invoice.totalIgst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-blue-700 font-semibold">
                    <span>Output CGST:</span>
                    <span className="font-mono">₹{invoice.totalCgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-700 font-semibold">
                    <span>Output SGST:</span>
                    <span className="font-mono">₹{invoice.totalSgst.toFixed(2)}</span>
                  </div>
                </>
              )}

              {invoice.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>Round Off:</span>
                  <span className="font-mono">₹{invoice.roundOff.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-extrabold text-slate-900">
                <span>Invoice Total:</span>
                <span className="font-mono text-base">₹{invoice.grandTotal.toLocaleString('en-IN')}.00</span>
              </div>
            </div>
          </div>

          {/* HSN Summary Table */}
          <div className="space-y-1 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              GST Tax Summary (HSN/SAC Wise)
            </span>
            <table className="w-full text-left border border-slate-300 text-[10px] border-collapse">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                  <th className="p-1.5">HSN/SAC</th>
                  <th className="p-1.5 text-right">Taxable Value (₹)</th>
                  <th className="p-1.5 text-right">Rate</th>
                  {invoice.isInterState ? (
                    <th className="p-1.5 text-right">IGST (₹)</th>
                  ) : (
                    <>
                      <th className="p-1.5 text-right">CGST (₹)</th>
                      <th className="p-1.5 text-right">SGST (₹)</th>
                    </>
                  )}
                  <th className="p-1.5 text-right">Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hsnSummaryList.map((row, i) => (
                  <tr key={i}>
                    <td className="p-1.5 font-mono">{row.hsn}</td>
                    <td className="p-1.5 text-right font-mono">{row.taxable.toFixed(2)}</td>
                    <td className="p-1.5 text-right">{row.gstRate}%</td>
                    {invoice.isInterState ? (
                      <td className="p-1.5 text-right font-mono">{row.igst.toFixed(2)}</td>
                    ) : (
                      <>
                        <td className="p-1.5 text-right font-mono">{row.cgst.toFixed(2)}</td>
                        <td className="p-1.5 text-right font-mono">{row.sgst.toFixed(2)}</td>
                      </>
                    )}
                    <td className="p-1.5 text-right font-mono font-bold">{row.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Signatures */}
          <div className="pt-10 flex justify-between items-end border-t border-slate-200">
            <div className="text-[10px] text-slate-500 space-y-1">
              <p>Terms & Conditions:</p>
              <p>1. Goods once sold will not be taken back.</p>
              <p>2. Subject to local jurisdiction.</p>
            </div>

            <div className="text-center space-y-8">
              <span className="text-[10px] font-bold uppercase text-slate-600">
                For {invoice.sellerName}
              </span>
              <div className="border-t border-slate-400 pt-1 text-[10px] font-bold text-slate-700">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
