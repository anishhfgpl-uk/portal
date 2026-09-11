import { Invoice, InvoiceItemRow, SellerInfo } from '../types';
import { extractPanFromGstin, extractStateCodeFromGstin, getStateCodeByName, getStateNameByCode, numberToIndianWords } from '../utils/gstUtils';

export interface Gstr1TallyImportResult { invoices: Invoice[]; rawCount: number; period: string; }

const cleanText = (value: string) => (value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
const nodeText = (el: Element, name: string) => cleanText(el.getElementsByTagName(name)[0]?.textContent || '');
const attrOrNode = (el: Element, attr: string, node: string) => cleanText(el.getAttribute(attr) || nodeText(el, node));
const money = (v: string) => Math.abs(Number(String(v || '').replace(/,/g, '')) || 0);

function monthRange(period: string) {
  const mm = Number(period.slice(0, 2));
  const yyyy = Number(period.slice(2));
  const last = new Date(yyyy, mm, 0).getDate();
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { from: `1-${names[mm - 1]}-${yyyy}`, to: `${last}-${names[mm - 1]}-${yyyy}` };
}

function dateRange(period: string) {
  const { from, to } = monthRange(period);
  const mm = Number(period.slice(0, 2));
  const yyyy = Number(period.slice(2));
  const last = new Date(yyyy, mm, 0).getDate();
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return Array.from({ length: last }, (_, i) => {
    const day = i + 1;
    return { from: `${day}-${names[mm - 1]}-${yyyy}`, to: `${day}-${names[mm - 1]}-${yyyy}` };
  });
}

// Do NOT ask Tally for a whole month in one Voucher Register export. Large Voucher
// Register XML responses can make TallyPrime appear frozen. We deliberately fetch one
// day at a time, sequentially, so Tally gets a small request and can recover between days.
function buildSalesRequest(from: string, to: string) {
  return `<ENVELOPE>\n  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Data</TYPE>\n    <ID>Voucher Register</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n        <SVFROMDATE TYPE="Date">${from}</SVFROMDATE>\n        <SVTODATE TYPE="Date">${to}</SVTODATE>\n        <VOUCHERTYPENAME TYPE="String">Sales</VOUCHERTYPENAME>\n      </STATICVARIABLES>\n    </DESC>\n  </BODY>\n</ENVELOPE>`;
}

async function requestTally(xml: string, tallyUrl: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/tally/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tallyUrl || 'http://127.0.0.1:9000', xml }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) throw new Error(body?.error || `Tally request failed (${response.status})`);
    if (!body.xml || !String(body.xml).trim()) return '';
    return String(body.xml);
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseDate(raw: string) {
  const s = cleanText(raw);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) { const [d, m, y] = s.split('-'); return `${y}-${m}-${d}`; }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; }
  return s || new Date().toISOString().slice(0, 10);
}

function parseQty(raw: string) {
  const m = cleanText(raw).match(/^([\d,.]+)\s*(.*)$/);
  return { qty: m ? Number(m[1].replace(/,/g, '')) || 1 : 1, unit: m?.[2]?.trim() || 'Nos' };
}

function parseInvoices(xml: string, seller: SellerInfo): Invoice[] {
  const doc = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ''), 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Tally ka XML response valid nahi hai.');
  const vouchers = Array.from(doc.getElementsByTagName('VOUCHER'));
  const invoices: Invoice[] = [];
  const sellerState = (seller.state || getStateNameByCode(seller.stateCode) || 'Delhi').toLowerCase();

  vouchers.forEach((vch, index) => {
    const type = (attrOrNode(vch, 'VCHTYPE', 'VOUCHERTYPENAME') || 'Sales').toLowerCase();
    if (!type.includes('sales')) return;
    if (/^(yes|1|true)$/i.test(nodeText(vch, 'ISCANCELLED')) || /^(yes|1|true)$/i.test(nodeText(vch, 'ISOPTIONAL'))) return;

    const invoiceNo = nodeText(vch, 'VOUCHERNUMBER') || nodeText(vch, 'REFERENCE') || `TALLY-${index + 1}`;
    const invoiceDate = parseDate(nodeText(vch, 'DATE'));
    const partyName = nodeText(vch, 'PARTYLEDGERNAME') || nodeText(vch, 'PARTYNAME') || nodeText(vch, 'BASICBUYERNAME') || 'Cash Customer';
    const gstin = (nodeText(vch, 'PARTYGSTIN') || nodeText(vch, 'GSTIN')).toUpperCase();
    const partyState = nodeText(vch, 'PLACEOFSUPPLY') || nodeText(vch, 'STATENAME') || seller.state || 'Delhi';
    const stateCode = extractStateCodeFromGstin(gstin) || getStateCodeByName(partyState) || seller.stateCode || '07';
    const isInterState = partyState.toLowerCase() !== sellerState;

    const inventoryNodes = Array.from(vch.getElementsByTagName('ALLINVENTORYENTRIES.LIST'));
    const items: InvoiceItemRow[] = [];
    inventoryNodes.forEach((row, itemIndex) => {
      const name = nodeText(row, 'STOCKITEMNAME') || `Item ${itemIndex + 1}`;
      const qtyData = parseQty(nodeText(row, 'BILLEDQTY') || nodeText(row, 'ACTUALQTY'));
      const rateRaw = nodeText(row, 'RATE');
      const rate = money(rateRaw.split('/')[0]);
      const taxable = money(nodeText(row, 'AMOUNT')) || rate * qtyData.qty;
      const hsn = nodeText(row, 'HSNSACCODE') || nodeText(row, 'HSNCODE') || nodeText(row, 'HSN') || '';
      const explicitRate = Number((nodeText(row, 'GSTOVRDIGSTRATE') || nodeText(row, 'GSTOVRCGSTRATE') || '').replace(/[^0-9.]/g, '')) || 0;
      const gstRate = explicitRate || 18;
      const cgst = isInterState ? 0 : taxable * gstRate / 200;
      const sgst = isInterState ? 0 : taxable * gstRate / 200;
      const igst = isInterState ? taxable * gstRate / 100 : 0;
      items.push({ id:`gstr-tally-${index + 1}-${itemIndex + 1}`, name, hsn, qty:qtyData.qty, unit:qtyData.unit, rate:rate || (qtyData.qty ? taxable / qtyData.qty : 0), discountPercent:0, gstRate, taxableAmount:taxable, cgstAmount:cgst, sgstAmount:sgst, igstAmount:igst, totalAmount:taxable + cgst + sgst + igst });
    });

    if (!items.length) {
      const ledgerNodes = Array.from(vch.getElementsByTagName('LEDGERENTRIES.LIST'));
      let taxable = 0;
      ledgerNodes.forEach(l => {
        const amount = Number(nodeText(l, 'AMOUNT').replace(/,/g, '')) || 0;
        const name = nodeText(l, 'LEDGERNAME').toLowerCase();
        if (amount < 0 && !/(cgst|sgst|igst|cess|round)/.test(name)) taxable += Math.abs(amount);
      });
      if (!taxable) taxable = money(nodeText(vch, 'AMOUNT'));
      const gstRate = 18;
      const cgst = isInterState ? 0 : taxable * gstRate / 200;
      const sgst = isInterState ? 0 : taxable * gstRate / 200;
      const igst = isInterState ? taxable * gstRate / 100 : 0;
      items.push({ id:`gstr-tally-${index + 1}-1`, name:'Sales / Services', hsn:'', qty:1, unit:'Nos', rate:taxable, discountPercent:0, gstRate, taxableAmount:taxable, cgstAmount:cgst, sgstAmount:sgst, igstAmount:igst, totalAmount:taxable + cgst + sgst + igst });
    }

    const subtotalTaxable = items.reduce((n,x)=>n+x.taxableAmount,0);
    const totalCgst = items.reduce((n,x)=>n+x.cgstAmount,0);
    const totalSgst = items.reduce((n,x)=>n+x.sgstAmount,0);
    const totalIgst = items.reduce((n,x)=>n+x.igstAmount,0);
    const totalTax = totalCgst + totalSgst + totalIgst;
    const grandTotal = Math.round(subtotalTaxable + totalTax);
    const roundOff = Number((grandTotal - subtotalTaxable - totalTax).toFixed(2));
    const tallyGuid = nodeText(vch, 'GUID');
    const tallyMasterId = nodeText(vch, 'MASTERID');

    invoices.push({
      id:`tally-${tallyGuid || tallyMasterId || `${invoiceNo}-${invoiceDate}`}`,
      invoiceNo, invoiceDate, sellerState:seller.state, sellerStateCode:seller.stateCode, sellerGstin:seller.gstin, sellerName:seller.name, sellerAddress:seller.address, sellerPhone:seller.phone,
      partyName, gstin, mobile:'', partyState, stateCode, pinCode:'', city:'', completeAddress:'', pan:gstin ? extractPanFromGstin(gstin) : '', registrationType:gstin ? 'Regular' : 'Unregistered', items,
      subtotalTaxable, totalCgst, totalSgst, totalIgst, totalTax, roundOff, grandTotal, amountInWords:numberToIndianWords(grandTotal), isInterState,
      tallySyncStatus:'synced', tallySyncDate:new Date().toISOString(), tallyGuid, tallyMasterId, tallyVoucherType:nodeText(vch,'VOUCHERTYPENAME') || 'Sales', source:'tally_import', isDuplicateProtected:true, createdAt:new Date().toISOString(), notes:nodeText(vch,'NARRATION') || `Imported from Tally Prime (${invoiceNo})`,
    });
  });
  return invoices;
}

export async function importGstr1SalesFromTally(period: string, seller: SellerInfo, tallyUrl = 'http://127.0.0.1:9000'): Promise<Gstr1TallyImportResult> {
  const chunks: string[] = [];
  const days = dateRange(period);
  let failedDays = 0;

  // Sequential requests are intentional: never bombard Tally with parallel XML exports.
  for (const day of days) {
    try {
      const xml = await requestTally(buildSalesRequest(day.from, day.to), tallyUrl);
      if (xml) chunks.push(xml);
    } catch (error: any) {
      failedDays += 1;
      // A single empty/failed day must not discard the other days. Abort only after
      // repeated failures, which normally means Tally is unavailable rather than a
      // genuinely empty day.
      if (failedDays >= 3) throw error;
    }
  }

  if (!chunks.length) {
    throw new Error(`Tally se selected period ka data read nahi ho saka. ${failedDays ? `${failedDays} day requests failed.` : 'Koi Sales voucher nahi mila.'}`);
  }

  const parsed = chunks.flatMap(xml => parseInvoices(xml, seller));
  const seen = new Set<string>();
  const invoices = parsed.filter(inv => {
    const key = `${inv.invoiceNo.trim().toLowerCase()}|${inv.invoiceDate}|${inv.tallyGuid || inv.tallyMasterId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { invoices, rawCount: parsed.length, period };
}
