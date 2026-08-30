import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Printer,
  UploadCloud,
  FileCode,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles,
  Info,
  Calendar,
  Building,
  UserCheck,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { Party, StockItem, Invoice, InvoiceItemRow } from '../types';
import {
  INDIAN_STATES,
  getStateCodeByName,
  extractPanFromGstin,
  extractStateCodeFromGstin,
  numberToIndianWords,
} from '../utils/gstUtils';
import { generateTallySalesVoucherXML, sendTallyRequest } from '../services/tallyService';

interface NewInvoiceViewProps {
  parties: Party[];
  stockItems: StockItem[];
  sellerState: string;
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerPhone: string;
  onSaveInvoice: (invoice: Invoice) => void;
  onPrintInvoice: (invoice: Invoice) => void;
  onShowTallySync: () => void;
  tallyStatus: 'online' | 'offline' | 'checking';
}

export const NewInvoiceView: React.FC<NewInvoiceViewProps> = ({
  parties,
  stockItems,
  sellerState,
  sellerName,
  sellerGstin,
  sellerAddress,
  sellerPhone,
  onSaveInvoice,
  onPrintInvoice,
  onShowTallySync,
  tallyStatus,
}) => {
  // Invoice Header State
  const [invoiceNo, setInvoiceNo] = useState<string>('INV-1001');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Customer / Debtor Form State
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [searchDebtorText, setSearchDebtorText] = useState<string>('');
  const [partyName, setPartyName] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [partyState, setPartyState] = useState<string>(sellerState);
  const [stateCode, setStateCode] = useState<string>(getStateCodeByName(sellerState));
  const [pinCode, setPinCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [completeAddress, setCompleteAddress] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [registrationType, setRegistrationType] = useState<string>('Regular');
  const [notes, setNotes] = useState<string>('');

  // Item Rows State
  const [items, setItems] = useState<InvoiceItemRow[]>([
    {
      id: 'row-1',
      name: '',
      hsn: '',
      qty: 1,
      unit: 'Nos',
      rate: 0,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    },
  ]);

  // Additional Charges & Expenses State (Freight, Labour, Other)
  const [freightAmount, setFreightAmount] = useState<number>(0);
  const [freightGstRate, setFreightGstRate] = useState<number>(18);
  const [labourAmount, setLabourAmount] = useState<number>(0);
  const [labourGstRate, setLabourGstRate] = useState<number>(18);
  const [otherExpenseAmount, setOtherExpenseAmount] = useState<number>(0);
  const [otherExpenseLabel, setOtherExpenseLabel] = useState<string>('Packing / Other Charges');
  const [otherExpenseGstRate, setOtherExpenseGstRate] = useState<number>(18);

  // Sync / Alert State
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isPushingToTally, setIsPushingToTally] = useState<boolean>(false);

  // Determine if Inter-State (IGST) or Intra-State (CGST + SGST)
  const isInterState =
    partyState.trim().toLowerCase() !== sellerState.trim().toLowerCase();

  // Recalculate financial amounts on items change
  const calculateRow = (
    row: InvoiceItemRow,
    isInter: boolean
  ): InvoiceItemRow => {
    const qty = Number(row.qty) || 0;
    const rate = Number(row.rate) || 0;
    const discPct = Number(row.discountPercent) || 0;
    const gstRate = Number(row.gstRate) || 0;

    const gross = qty * rate;
    const discount = (gross * discPct) / 100;
    const taxable = Math.max(0, gross - discount);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInter) {
      igst = (taxable * gstRate) / 100;
    } else {
      cgst = (taxable * (gstRate / 2)) / 100;
      sgst = (taxable * (gstRate / 2)) / 100;
    }

    const total = taxable + cgst + sgst + igst;

    return {
      ...row,
      taxableAmount: Number(taxable.toFixed(2)),
      cgstAmount: Number(cgst.toFixed(2)),
      sgstAmount: Number(sgst.toFixed(2)),
      igstAmount: Number(igst.toFixed(2)),
      totalAmount: Number(total.toFixed(2)),
    };
  };

  // Re-evaluate all rows when partyState changes
  useEffect(() => {
    setItems((prev) => prev.map((item) => calculateRow(item, isInterState)));
  }, [partyState, sellerState]);

  // Auto calculate Totals
  const itemsTaxable = items.reduce(
    (acc, curr) => acc + (curr.taxableAmount || 0),
    0
  );
  const itemsCgst = items.reduce(
    (acc, curr) => acc + (curr.cgstAmount || 0),
    0
  );
  const itemsSgst = items.reduce(
    (acc, curr) => acc + (curr.sgstAmount || 0),
    0
  );
  const itemsIgst = items.reduce(
    (acc, curr) => acc + (curr.igstAmount || 0),
    0
  );

  // Additional Charges GST Calculations
  const validFreight = Number(freightAmount) || 0;
  const freightGst = (validFreight * (Number(freightGstRate) || 0)) / 100;
  const freightCgst = isInterState ? 0 : freightGst / 2;
  const freightSgst = isInterState ? 0 : freightGst / 2;
  const freightIgst = isInterState ? freightGst : 0;

  const validLabour = Number(labourAmount) || 0;
  const labourGst = (validLabour * (Number(labourGstRate) || 0)) / 100;
  const labourCgst = isInterState ? 0 : labourGst / 2;
  const labourSgst = isInterState ? 0 : labourGst / 2;
  const labourIgst = isInterState ? labourGst : 0;

  const validOther = Number(otherExpenseAmount) || 0;
  const otherGst = (validOther * (Number(otherExpenseGstRate) || 0)) / 100;
  const otherCgst = isInterState ? 0 : otherGst / 2;
  const otherSgst = isInterState ? 0 : otherGst / 2;
  const otherIgst = isInterState ? otherGst : 0;

  const totalAdditionalCharges = validFreight + validLabour + validOther;
  const totalAdditionalGst = freightGst + labourGst + otherGst;

  const subtotalTaxable = itemsTaxable + totalAdditionalCharges;
  const totalCgst = itemsCgst + freightCgst + labourCgst + otherCgst;
  const totalSgst = itemsSgst + freightSgst + labourSgst + otherSgst;
  const totalIgst = itemsIgst + freightIgst + labourIgst + otherIgst;
  const totalTax = totalCgst + totalSgst + totalIgst;

  const rawGrandTotal = subtotalTaxable + totalTax;
  const grandTotalRounded = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotalRounded - rawGrandTotal).toFixed(2));
  const amountInWords = numberToIndianWords(grandTotalRounded);

  // Handle selecting a debtor from party master
  const handleSelectParty = (selectedName: string) => {
    setSearchDebtorText(selectedName);
    const found = parties.find(
      (p) => p.name.toLowerCase() === selectedName.trim().toLowerCase()
    );

    if (found) {
      setSelectedPartyId(found.id);
      setPartyName(found.name);
      setGstin(found.gstin || '');
      setMobile(found.mobile || '');
      setPartyState(found.state || sellerState);
      setStateCode(
        found.state_code ||
          extractStateCodeFromGstin(found.gstin) ||
          getStateCodeByName(found.state)
      );
      setPinCode(found.pin || '');
      setCity(found.city || '');
      setCompleteAddress(found.address || '');
      setPan(found.pan || extractPanFromGstin(found.gstin));
      setRegistrationType(found.registration_type || (found.gstin ? 'Regular' : 'Unregistered'));
    } else {
      setPartyName(selectedName);
    }
  };

  // Handle GSTIN change with auto PAN & State Code extraction
  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase();
    setGstin(upper);
    if (upper.length >= 2) {
      const code = extractStateCodeFromGstin(upper);
      if (code) {
        setStateCode(code);
        const matchState = INDIAN_STATES.find((s) => s.code === code);
        if (matchState) {
          setPartyState(matchState.name);
        }
      }
    }
    if (upper.length === 15) {
      const extractedPan = extractPanFromGstin(upper);
      if (extractedPan) setPan(extractedPan);
    }
  };

  // Handle Party State change
  const handlePartyStateChange = (stateName: string) => {
    setPartyState(stateName);
    const code = getStateCodeByName(stateName);
    if (code) setStateCode(code);
  };

  // Handle Item Row updates
  const handleRowChange = (
    index: number,
    field: keyof InvoiceItemRow,
    value: any
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };
      copy[index] = calculateRow(target, isInterState);
      return copy;
    });
  };

  // Handle Stock Item selection for a row
  const handleSelectStockItem = (index: number, itemName: string) => {
    const found = stockItems.find(
      (item) => item.name.toLowerCase() === itemName.trim().toLowerCase()
    );

    setItems((prev) => {
      const copy = [...prev];
      const row = copy[index];
      if (found) {
        row.itemId = found.id;
        row.name = found.name;
        row.hsn = found.hsn || row.hsn;
        row.gstRate = Number(found.gst) || 18;
        row.unit = found.unit || row.unit || 'Nos';
        if (found.rate && found.rate > 0 && row.rate === 0) {
          row.rate = found.rate;
        }
      } else {
        row.name = itemName;
      }
      copy[index] = calculateRow(row, isInterState);
      return copy;
    });
  };

  const handleAddRow = () => {
    const newRow: InvoiceItemRow = {
      id: `row-${Date.now()}-${items.length + 1}`,
      name: '',
      hsn: '',
      qty: 1,
      unit: 'Nos',
      rate: 0,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    };
    setItems((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      // Reset the single row
      setItems([
        {
          id: `row-${Date.now()}`,
          name: '',
          hsn: '',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          discountPercent: 0,
          gstRate: 18,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalAmount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Build current Invoice object
  const buildCurrentInvoice = (syncStatus: 'synced' | 'pending' | 'not_synced' = 'not_synced'): Invoice => {
    return {
      id: `inv-${Date.now()}`,
      invoiceNo: invoiceNo || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceDate: invoiceDate,
      sellerState: sellerState,
      sellerStateCode: getStateCodeByName(sellerState),
      sellerGstin: sellerGstin,
      sellerName: sellerName,
      sellerAddress: sellerAddress,
      sellerPhone: sellerPhone,

      partyId: selectedPartyId,
      partyName: partyName || searchDebtorText || 'Cash Customer',
      gstin: gstin,
      mobile: mobile,
      partyState: partyState,
      stateCode: stateCode,
      pinCode: pinCode,
      city: city,
      completeAddress: completeAddress,
      pan: pan,
      registrationType: registrationType,

      items: items.filter((i) => i.name.trim() !== '' || i.taxableAmount > 0),

      // Additional charges & expenses
      freightAmount: validFreight,
      freightGstRate: Number(freightGstRate) || 0,
      freightTaxable: validFreight,
      freightGstAmount: freightGst,

      labourAmount: validLabour,
      labourGstRate: Number(labourGstRate) || 0,
      labourTaxable: validLabour,
      labourGstAmount: labourGst,

      otherExpenseAmount: validOther,
      otherExpenseLabel: otherExpenseLabel,
      otherExpenseGstRate: Number(otherExpenseGstRate) || 0,
      otherExpenseTaxable: validOther,
      otherExpenseGstAmount: otherGst,

      totalAdditionalCharges: totalAdditionalCharges,
      totalAdditionalGst: totalAdditionalGst,

      subtotalTaxable: Number(subtotalTaxable.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      totalIgst: Number(totalIgst.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      roundOff: roundOff,
      grandTotal: grandTotalRounded,
      amountInWords: amountInWords,

      isInterState: isInterState,
      tallySyncStatus: syncStatus,
      createdAt: new Date().toISOString(),
      notes: notes,
    };
  };

  // Handle Save
  const handleSave = () => {
    if (!partyName && !searchDebtorText) {
      setNotification({
        message: 'Please select or enter a Customer / Debtor name before saving.',
        type: 'error',
      });
      return;
    }

    const inv = buildCurrentInvoice('not_synced');
    onSaveInvoice(inv);
    setNotification({
      message: `Invoice ${inv.invoiceNo} saved successfully to local database.`,
      type: 'success',
    });
  };

  // Handle Print
  const handlePrint = () => {
    const inv = buildCurrentInvoice('not_synced');
    onPrintInvoice(inv);
  };

  // Handle Direct Push to Tally Prime
  const handlePushToTally = async () => {
    if (!partyName && !searchDebtorText) {
      setNotification({
        message: 'Please specify Debtor name first.',
        type: 'error',
      });
      return;
    }

    setIsPushingToTally(true);
    setNotification({
      message: 'Sending Sales Voucher XML to Tally Prime on Port 9000...',
      type: 'info',
    });

    try {
      const inv = buildCurrentInvoice('pending');
      const xml = generateTallySalesVoucherXML(inv);
      const res = await sendTallyRequest(xml);

      setNotification({
        message: `✅ Sales Voucher ${inv.invoiceNo} imported into Tally successfully!`,
        type: 'success',
      });

      const updatedInv = { ...inv, tallySyncStatus: 'synced' as const, tallySyncDate: new Date().toISOString() };
      onSaveInvoice(updatedInv);
    } catch (err: any) {
      setNotification({
        message: `❌ Tally Push Failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsPushingToTally(false);
    }
  };

  // Handle XML File Download
  const handleDownloadXml = () => {
    const inv = buildCurrentInvoice('not_synced');
    const xml = generateTallySalesVoucherXML(inv);
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tally_Sales_${inv.invoiceNo}.xml`;
    link.click();
    URL.revokeObjectURL(url);

    setNotification({
      message: `Tally XML for ${inv.invoiceNo} downloaded. You can import this directly in Tally Prime via Alt+O > Import > Transactions.`,
      type: 'success',
    });
  };

  // Reset form
  const handleReset = () => {
    setInvoiceNo(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
    setSearchDebtorText('');
    setPartyName('');
    setGstin('');
    setMobile('');
    setPinCode('');
    setCity('');
    setCompleteAddress('');
    setPan('');
    setItems([
      {
        id: `row-${Date.now()}`,
        name: '',
        hsn: '',
        qty: 1,
        unit: 'Nos',
        rate: 0,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalAmount: 0,
      },
    ]);
    setNotes('');
    setFreightAmount(0);
    setFreightGstRate(18);
    setLabourAmount(0);
    setLabourGstRate(18);
    setOtherExpenseAmount(0);
    setOtherExpenseLabel('Packing / Other Charges');
    setOtherExpenseGstRate(18);
    setNotification(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-start justify-between border shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {notification.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
            <span className="text-sm font-medium leading-relaxed whitespace-pre-line">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold uppercase hover:opacity-75 cursor-pointer ml-3 text-slate-500"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Header Card: Invoice Meta */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Invoice No */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Invoice No
            </label>
            <input
              type="text"
              id="invoice-no-input"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="e.g. INV-1001"
            />
          </div>

          {/* Invoice Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Invoice Date</span>
            </label>
            <input
              type="date"
              id="invoice-date-input"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
            />
          </div>

          {/* Seller State Indicator */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Your State (Supply Origin)</span>
            </label>
            <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>{sellerState}</span>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                Code: {getStateCodeByName(sellerState)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Customer / Debtor Details Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-base">Customer / Debtor Details</h3>
          </div>
          {/* Supply Type Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Supply Type:</span>
            {isInterState ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                ⚡ Inter-State Supply (IGST Applicable)
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                🏢 Intra-State Supply (CGST + SGST Applicable)
              </span>
            )}
          </div>
        </div>

        {/* Row 1: Search Debtor, GSTIN, Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search Debtor */}
          <div className="md:col-span-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Search Debtor / Customer Name</span>
              {parties.length > 0 && (
                <span className="text-[11px] font-normal text-blue-600">
                  {parties.length} debtors loaded from Tally
                </span>
              )}
            </label>
            <div className="relative">
              <input
                list="debtors-datalist"
                id="search-debtor-input"
                value={searchDebtorText}
                onChange={(e) => handleSelectParty(e.target.value)}
                placeholder="Type debtor name or select from Tally..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <datalist id="debtors-datalist">
                {parties.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.gstin ? `(${p.gstin})` : ''} - {p.state}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* GSTIN */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              GSTIN
            </label>
            <input
              type="text"
              id="gstin-input"
              value={gstin}
              onChange={(e) => handleGstinChange(e.target.value)}
              maxLength={15}
              placeholder="e.g. 07AAAAA0000A1Z5"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-800 uppercase focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {/* Mobile */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Mobile / Phone
            </label>
            <input
              type="text"
              id="mobile-input"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit mobile"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>
        </div>

        {/* Row 2: Party State, State Code, Pin Code, City */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Party State */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Party State
            </label>
            <select
              id="party-state-select"
              value={partyState}
              onChange={(e) => handlePartyStateChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.name}>
                  [{st.code}] {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* State Code */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              State Code
            </label>
            <input
              type="text"
              id="state-code-input"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              maxLength={2}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {/* Pin Code */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              PIN Code
            </label>
            <input
              type="text"
              id="pin-code-input"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              maxLength={6}
              placeholder="e.g. 110001"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {/* City */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              City
            </label>
            <input
              type="text"
              id="city-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City name"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>
        </div>

        {/* Row 3: Complete Address, PAN, Registration Type */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Complete Address */}
          <div className="md:col-span-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Complete Address
            </label>
            <textarea
              id="address-input"
              rows={2}
              value={completeAddress}
              onChange={(e) => setCompleteAddress(e.target.value)}
              placeholder="Street name, landmark, building..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
            />
          </div>

          {/* PAN */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              PAN
            </label>
            <input
              type="text"
              id="pan-input"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="e.g. AAAAA0000A"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-800 uppercase focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {/* Registration Type */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Registration Type
            </label>
            <select
              id="registration-type-select"
              value={registrationType}
              onChange={(e) => setRegistrationType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
            >
              <option value="Regular">Regular</option>
              <option value="Composition">Composition</option>
              <option value="Unregistered">Unregistered / Consumer</option>
              <option value="Overseas">Overseas / SEZ</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Items & Services Table Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-800 text-base">Itemised Billing & Taxes</h3>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {items.length} {items.length === 1 ? 'line' : 'lines'}
            </span>
          </div>
          <button
            onClick={handleAddRow}
            id="btn-add-item-row"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 w-72">Stock Item / Description</th>
                <th className="py-3 px-2 w-24">HSN/SAC</th>
                <th className="py-3 px-2 w-20 text-right">Qty</th>
                <th className="py-3 px-2 w-20">Unit</th>
                <th className="py-3 px-2 w-28 text-right">Rate (₹)</th>
                <th className="py-3 px-2 w-20 text-right">Disc %</th>
                <th className="py-3 px-2 w-20 text-right">GST %</th>
                <th className="py-3 px-3 w-28 text-right">Taxable (₹)</th>
                <th className="py-3 px-3 w-28 text-right">
                  {isInterState ? 'IGST (₹)' : 'CGST+SGST (₹)'}
                </th>
                <th className="py-3 px-3 w-32 text-right">Total (₹)</th>
                <th className="py-3 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {items.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                    {index + 1}
                  </td>

                  {/* Stock Item Search / Input */}
                  <td className="py-2 px-3">
                    <div className="relative">
                      <input
                        list={`items-datalist-${index}`}
                        value={row.name}
                        onChange={(e) => handleSelectStockItem(index, e.target.value)}
                        placeholder="Search item from Tally..."
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                      />
                      <datalist id={`items-datalist-${index}`}>
                        {stockItems.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name} | HSN: {item.hsn} | GST: {item.gst}% | ₹{item.rate || 0}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </td>

                  {/* HSN */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={row.hsn}
                      onChange={(e) => handleRowChange(index, 'hsn', e.target.value)}
                      placeholder="HSN"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </td>

                  {/* Qty */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={row.qty || ''}
                      onChange={(e) => handleRowChange(index, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-right font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </td>

                  {/* Unit */}
                  <td className="py-2 px-2">
                    <select
                      value={row.unit}
                      onChange={(e) => handleRowChange(index, 'unit', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-1.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                    >
                      <option value="Nos">Nos</option>
                      <option value="Pcs">Pcs</option>
                      <option value="Box">Box</option>
                      <option value="Kg">Kg</option>
                      <option value="Mtr">Mtr</option>
                      <option value="Roll">Roll</option>
                      <option value="Set">Set</option>
                      <option value="Ltr">Ltr</option>
                      <option value="Pack">Pack</option>
                    </select>
                  </td>

                  {/* Rate */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.rate || ''}
                      onChange={(e) => handleRowChange(index, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-right font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </td>

                  {/* Discount % */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={row.discountPercent || ''}
                      onChange={(e) => handleRowChange(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-right text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </td>

                  {/* GST % */}
                  <td className="py-2 px-2">
                    <select
                      value={row.gstRate}
                      onChange={(e) => handleRowChange(index, 'gstRate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-1 py-1.5 text-xs text-right font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>

                  {/* Taxable Amount */}
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                    ₹{row.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>

                  {/* Tax Breakup Amount */}
                  <td className="py-2 px-3 text-right font-mono text-slate-600">
                    {isInterState ? (
                      <span>₹{row.igstAmount.toFixed(2)}</span>
                    ) : (
                      <span title={`CGST: ₹${row.cgstAmount.toFixed(2)} + SGST: ₹${row.sgstAmount.toFixed(2)}`}>
                        ₹{(row.cgstAmount + row.sgstAmount).toFixed(2)}
                      </span>
                    )}
                  </td>

                  {/* Row Total */}
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    ₹{row.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>

                  {/* Delete Row Button */}
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => handleRemoveRow(index)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3.5. Additional Charges & Expenses (Freight, Labour, Packaging) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Freight, Labour &amp; Additional Expense Charges (Tally Direct Sync)
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Auto-calculates GST &amp; Exports to Tally Ledger Entries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Freight Charges */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Freight / Transport (₹)</span>
              </label>
              <select
                value={freightGstRate}
                onChange={(e) => setFreightGstRate(Number(e.target.value))}
                className="text-[11px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 outline-none cursor-pointer"
                title="Freight GST Rate"
              >
                <option value="0">GST 0%</option>
                <option value="5">GST 5%</option>
                <option value="12">GST 12%</option>
                <option value="18">GST 18%</option>
                <option value="28">GST 28%</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                step="any"
                value={freightAmount || ''}
                onChange={(e) => setFreightAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
            {validFreight > 0 && (
              <div className="text-[10px] text-slate-500 flex justify-between pt-1">
                <span>Taxable: ₹{validFreight.toFixed(2)}</span>
                <span className="font-mono font-semibold text-blue-600">
                  GST ({freightGstRate}%): ₹{freightGst.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Labour & Handling Charges */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Labour / Handling (₹)</span>
              </label>
              <select
                value={labourGstRate}
                onChange={(e) => setLabourGstRate(Number(e.target.value))}
                className="text-[11px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 outline-none cursor-pointer"
                title="Labour GST Rate"
              >
                <option value="0">GST 0%</option>
                <option value="5">GST 5%</option>
                <option value="12">GST 12%</option>
                <option value="18">GST 18%</option>
                <option value="28">GST 28%</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                step="any"
                value={labourAmount || ''}
                onChange={(e) => setLabourAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
            {validLabour > 0 && (
              <div className="text-[10px] text-slate-500 flex justify-between pt-1">
                <span>Taxable: ₹{validLabour.toFixed(2)}</span>
                <span className="font-mono font-semibold text-emerald-600">
                  GST ({labourGstRate}%): ₹{labourGst.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Other Charges / Packing / Loading */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={otherExpenseLabel}
                onChange={(e) => setOtherExpenseLabel(e.target.value)}
                className="text-xs font-bold uppercase text-slate-700 bg-transparent border-b border-dashed border-slate-300 outline-none max-w-[150px]"
                title="Custom Expense Name"
              />
              <select
                value={otherExpenseGstRate}
                onChange={(e) => setOtherExpenseGstRate(Number(e.target.value))}
                className="text-[11px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 outline-none cursor-pointer"
                title="Other Expense GST Rate"
              >
                <option value="0">GST 0%</option>
                <option value="5">GST 5%</option>
                <option value="12">GST 12%</option>
                <option value="18">GST 18%</option>
                <option value="28">GST 28%</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                step="any"
                value={otherExpenseAmount || ''}
                onChange={(e) => setOtherExpenseAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
            {validOther > 0 && (
              <div className="text-[10px] text-slate-500 flex justify-between pt-1">
                <span>Taxable: ₹{validOther.toFixed(2)}</span>
                <span className="font-mono font-semibold text-purple-600">
                  GST ({otherExpenseGstRate}%): ₹{otherGst.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Financial Calculations & Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Notes & Indian Words */}
        <div className="md:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Invoice Narration / Terms
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Being goods sold against PO-1029. Payment terms 30 days. Bank: HDFC Bank A/C 502000..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Amount In Words (Indian Rupees)
            </span>
            <p className="text-xs font-semibold text-slate-800 italic leading-relaxed">
              {amountInWords}
            </p>
          </div>
        </div>

        {/* Right: Calculations Breakdown */}
        <div className="md:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            Tax & Amount Breakdown
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Items Taxable Amount:</span>
              <span className="font-mono font-semibold text-slate-800">
                ₹{itemsTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {totalAdditionalCharges > 0 && (
              <div className="flex justify-between items-center text-blue-700 bg-blue-50/50 px-2 py-1 rounded">
                <span>Freight, Labour &amp; Expenses:</span>
                <span className="font-mono font-semibold">
                  +₹{totalAdditionalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-700 font-semibold border-t border-slate-100 pt-1.5">
              <span>Total Taxable Base:</span>
              <span className="font-mono">
                ₹{subtotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {isInterState ? (
              <div className="flex justify-between items-center text-purple-700 bg-purple-50/70 px-2 py-1 rounded">
                <span>Output IGST (Integrated Tax):</span>
                <span className="font-mono font-bold">
                  ₹{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-blue-700 bg-blue-50/70 px-2 py-1 rounded">
                  <span>Output CGST (Central Tax):</span>
                  <span className="font-mono font-bold">
                    ₹{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-blue-700 bg-blue-50/70 px-2 py-1 rounded">
                  <span>Output SGST (State Tax):</span>
                  <span className="font-mono font-bold">
                    ₹{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center text-slate-500 text-[11px]">
              <span>Round Off:</span>
              <span className="font-mono">{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-900">Grand Total:</span>
              <span className="text-xl font-extrabold font-mono text-blue-600">
                ₹{grandTotalRounded.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Sticky Bottom Action Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 sticky bottom-4 z-10">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Tally XML */}
          <button
            onClick={handleDownloadXml}
            title="Download .xml file ready for Tally Prime Alt+O > Import > Transactions"
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>Download Tally XML</span>
          </button>

          {/* Push Directly to Tally */}
          <button
            onClick={handlePushToTally}
            disabled={isPushingToTally}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <UploadCloud className={`w-4 h-4 ${isPushingToTally ? 'animate-bounce' : ''}`} />
            <span>{isPushingToTally ? 'Pushing to Tally...' : 'Push to Tally Prime'}</span>
          </button>

          {/* Print Invoice */}
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Tax Invoice</span>
          </button>

          {/* Save Invoice */}
          <button
            onClick={handleSave}
            id="btn-save-invoice"
            className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
};
