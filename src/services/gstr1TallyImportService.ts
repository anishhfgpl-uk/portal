import { Invoice, InvoiceItemRow, SellerInfo } from '../types';
import { extractPanFromGstin, extractStateCodeFromGstin, getStateCodeByName, getStateNameByCode, numberToIndianWords } from '../utils/gstUtils';

export interface Gstr1TallyImportResult { invoices: Invoice[]; rawCount: number; period: string; }

const cleanText = (value: string) => (value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
const nodeText = (el: Element, name: string) => {
  const attr = el.getAttribute(name) || el.getAttribute(name.toUpperCase()) || el.getAttribute(name.toLowerCase());
  if (attr?.trim()) return cleanText(attr);
  return cleanText(el.getElementsByTagName(name)[0]?.textContent || '');
};
const attrOrNode = (el: Element, attr: string, node: string) => cleanText(el.getAttribute(attr) || el.getAttribute(attr.toUpperCase()) || nodeText(el, node));
const money = (v: string) => Math.abs(Number(String(v || '').replace(/,/g, '')) || 0);

export function monthRange(period: string) {
  const mm = Number(period.slice(0, 2));
  const yyyy = Number(period.slice(2));
  const last = new Date(yyyy, mm, 0).getDate();
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { from: `1-${names[mm - 1]}-${yyyy}`, to: `${last}-${names[mm - 1]}-${yyyy}` };
}

export function repairXmlForParsing(xml: string) {
  return String(xml || '').replace(/^\uFEFF/, '').replace(/&(?!#(?:\d+|x[0-9a-fA-F]+);|[A-Za-z][A-Za-z0-9]+;)/g, '&amp;');
}

export function buildSalesRequest(from: string, to: string) {
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>GSTR1SalesVouchers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE TYPE="Date">${from}</SVFROMDATE><SVTODATE TYPE="Date">${to}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="GSTR1SalesVouchers" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No"><TYPE>Voucher</TYPE><FILTER>GSTR1IsSales</FILTER><FETCH>GUID,MASTERID,Date,VoucherNumber,VoucherTypeName,PartyLedgerName,PartyName,PartyGSTIN,GSTIN,PlaceOfSupply,StateName,BasicBuyerName,Amount,Narration,IsCancelled,IsOptional</FETCH><FETCH>AllInventoryEntries.StockItemName,AllInventoryEntries.BilledQty,AllInventoryEntries.ActualQty,AllInventoryEntries.Rate,AllInventoryEntries.Amount,AllInventoryEntries.HSNSACCode,AllInventoryEntries.HSNCODE,AllInventoryEntries.HSN,AllInventoryEntries.GSTOVRDIGSTRATE,AllInventoryEntries.GSTOVRCGSTRATE,AllInventoryEntries.GSTOVRSGSTRATE</FETCH><FETCH>LedgerEntries.LedgerName,LedgerEntries.Amount,LedgerEntries.IsPartyLedger</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="GSTR1IsSales" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$$IsSales:$VoucherTypeName</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

export async function requestTally(xml: string, tallyUrl: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('/api/tally/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: tallyUrl || 'http://127.0.0.1:9000', xml }), signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) throw new Error(body?.error || `Tally request failed (${response.status})`);
    return body.xml ? String(body.xml) : '';
  } finally { window.clearTimeout(timeout); }
}

function parseDate(raw: string) {
  const s = cleanText(raw);
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) { const [d,m,y] = s.split('-'); return `${y}-${m}-${d}`; }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y] = s.split('/'); return `${y}-${m}-${d}`; }
  return s || new Date().toISOString().slice(0,10);
}

function parseQty(raw: string) {
  const m = cleanText(raw).match(/^([\d,.]+)\s*(.*)$/);
  return { qty: m ? Number(m[1].replace(/,/g,'')) || 1 : 1, unit: m?.[2]?.trim() || 'Nos' };
}

export function parseInvoices(xml: string, seller: SellerInfo): Invoice[] {
  const doc = new DOMParser().parseFromString(repairXmlForParsing(xml), 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`Tally XML response valid nahi hai. Tally response: ${cleanText(xml.slice(0,500)) || 'empty response'}`);
  const invoices: Invoice[] = [];
  const sellerState = (seller.state || getStateNameByCode(seller.stateCode) || 'Delhi').toLowerCase();

  Array.from(doc.getElementsByTagName('VOUCHER')).forEach((vch, index) => {
    const type = (attrOrNode(vch, 'VCHTYPE', 'VOUCHERTYPENAME') || 'Sales').toLowerCase();
    if (!type.includes('sales')) return;
    if (/^(yes|1|true)$/i.test(nodeText(vch,'ISCANCELLED')) || /^(yes|1|true)$/i.test(nodeText(vch,'ISOPTIONAL'))) return;

    const invoiceNo = nodeText(vch,'VOUCHERNUMBER') || nodeText(vch,'REFERENCE') || `TALLY-${index+1}`;
    const invoiceDate = parseDate(nodeText(vch,'DATE'));
    const partyName = nodeText(vch,'PARTYLEDGERNAME') || nodeText(vch,'PARTYNAME') || nodeText(vch,'BASICBUYERNAME') || 'Cash Customer';
    const gstin = (nodeText(vch,'PARTYGSTIN') || nodeText(vch,'GSTIN')).toUpperCase();
    const partyState = nodeText(vch,'PLACEOFSUPPLY') || nodeText(vch,'STATENAME') || seller.state || 'Delhi';
    const stateCode = extractStateCodeFromGstin(gstin) || getStateCodeByName(partyState) || seller.stateCode || '07';
    const isInterState = partyState.toLowerCase() !== sellerState;

    const ledgerNodes = Array.from(vch.getElementsByTagName('LEDGERENTRIES.LIST'));
    let ledgerCgst = 0, ledgerSgst = 0, ledgerIgst = 0, ledgerCess = 0;
    let ledgerTaxable = 0;
    ledgerNodes.forEach(l => {
      const amount = Number(nodeText(l,'AMOUNT').replace(/,/g,'')) || 0;
      const name = nodeText(l,'LEDGERNAME').toLowerCase();
      const abs = Math.abs(amount);
      if (/cgst/.test(name)) ledgerCgst += abs;
      else if (/sgst|utgst/.test(name)) ledgerSgst += abs;
      else if (/igst/.test(name)) ledgerIgst += abs;
      else if (/cess/.test(name)) ledgerCess += abs;
      else if (amount < 0 && !/(round|tds|tcs|discount)/.test(name)) ledgerTaxable += abs;
    });

    const inventoryNodes = Array.from(vch.getElementsByTagName('ALLINVENTORYENTRIES.LIST'));
    const items: InvoiceItemRow[] = [];
    inventoryNodes.forEach((row, itemIndex) => {
      const name = nodeText(row,'STOCKITEMNAME') || `Item ${itemIndex+1}`;
      const qtyData = parseQty(nodeText(row,'BILLEDQTY') || nodeText(row,'ACTUALQTY'));
      const rate = money(nodeText(row,'RATE').split('/')[0]);
      const taxable = money(nodeText(row,'AMOUNT')) || rate * qtyData.qty;
      const hsn = nodeText(row,'HSNSACCODE') || nodeText(row,'HSNCODE') || nodeText(row,'HSN') || '';
      const explicitRate = Number((nodeText(row,'GSTOVRDIGSTRATE') || '').replace(/[^0-9.]/g,'')) || 0;
      items.push({ id:`gstr-tally-${index+1}-${itemIndex+1}`, name, hsn, qty:qtyData.qty, unit:qtyData.unit, rate:rate || (qtyData.qty ? taxable/qtyData.qty : 0), discountPercent:0, gstRate:explicitRate, taxableAmount:taxable, cgstAmount:0, sgstAmount:0, igstAmount:0, totalAmount:taxable });
    });

    if (!items.length) {
      const taxable = ledgerTaxable || money(nodeText(vch,'AMOUNT'));
      if (taxable > 0) items.push({ id:`gstr-tally-${index+1}-1`, name:'Sales / Services', hsn:'', qty:1, unit:'Nos', rate:taxable, discountPercent:0, gstRate:0, taxableAmount:taxable, cgstAmount:0, sgstAmount:0, igstAmount:0, totalAmount:taxable });
    }

    const subtotalTaxable = items.reduce((n,x)=>n+x.taxableAmount,0);
    if (!subtotalTaxable) return;

    const actualCgst = ledgerCgst;
    const actualSgst = ledgerSgst;
    const actualIgst = ledgerIgst;
    const actualCess = ledgerCess;
    const hasActualTax = actualCgst + actualSgst + actualIgst + actualCess > 0;
    const explicitRate = items.find(x => x.gstRate > 0)?.gstRate || 0;
    if (!hasActualTax && !explicitRate) console.warn(`Invoice ${invoiceNo}: Tally se GST amount/rate nahi mila; invoice retained with GST 0 for review.`);

    items.forEach(item => {
      const share = item.taxableAmount / subtotalTaxable;
      item.cgstAmount = hasActualTax ? Number((actualCgst * share).toFixed(2)) : (!isInterState && explicitRate ? Number((item.taxableAmount * explicitRate / 200).toFixed(2)) : 0);
      item.sgstAmount = hasActualTax ? Number((actualSgst * share).toFixed(2)) : (!isInterState && explicitRate ? Number((item.taxableAmount * explicitRate / 200).toFixed(2)) : 0);
      item.igstAmount = hasActualTax ? Number((actualIgst * share).toFixed(2)) : (isInterState && explicitRate ? Number((item.taxableAmount * explicitRate / 100).toFixed(2)) : 0);
      const itemTax = item.cgstAmount + item.sgstAmount + item.igstAmount;
      item.gstRate = itemTax > 0 ? Number(((itemTax / item.taxableAmount) * 100).toFixed(2)) : 0;
      item.totalAmount = item.taxableAmount + itemTax;
    });

    const totalCgst = items.reduce((n,x)=>n+x.cgstAmount,0);
    const totalSgst = items.reduce((n,x)=>n+x.sgstAmount,0);
    const totalIgst = items.reduce((n,x)=>n+x.igstAmount,0);
    const totalTax = totalCgst + totalSgst + totalIgst;
    const exactTotal = subtotalTaxable + totalTax + actualCess;
    const grandTotal = Number(exactTotal.toFixed(2));
    const roundOff = 0;
    const tallyGuid = nodeText(vch,'GUID');
    const tallyMasterId = nodeText(vch,'MASTERID');

    invoices.push({ id:`tally-${tallyGuid || tallyMasterId || `${invoiceNo}-${invoiceDate}`}`, invoiceNo, invoiceDate, sellerState:seller.state, sellerStateCode:seller.stateCode, sellerGstin:seller.gstin, sellerName:seller.name, sellerAddress:seller.address, sellerPhone:seller.phone, partyName, gstin, mobile:'', partyState, stateCode, pinCode:'', city:'', completeAddress:nodeText(vch,'BASICBUYERADDRESS') || nodeText(vch,'ADDRESS'), pan:gstin ? extractPanFromGstin(gstin) : '', registrationType:gstin ? 'Regular' : 'Unregistered', items, subtotalTaxable, totalCgst, totalSgst, totalIgst, totalTax, roundOff, grandTotal, amountInWords:numberToIndianWords(grandTotal), isInterState, tallySyncStatus:'synced', tallySyncDate:new Date().toISOString(), tallyGuid, tallyMasterId, tallyVoucherType:nodeText(vch,'VOUCHERTYPENAME') || 'Sales', source:'tally_import', isDuplicateProtected:true, createdAt:new Date().toISOString(), notes:nodeText(vch,'NARRATION') || `Imported from Tally Prime (${invoiceNo})` });
  });
  return invoices;
}

export async function importGstr1SalesFromTally(period: string, seller: SellerInfo, tallyUrl = 'http://127.0.0.1:9000'): Promise<Gstr1TallyImportResult> {
  const { from, to } = monthRange(period);
  const xml = await requestTally(buildSalesRequest(from,to), tallyUrl);
  if (!xml) throw new Error('Tally ne selected period ke liye koi Sales data return nahi kiya.');
  const parsed = parseInvoices(xml, seller);
  const seen = new Set<string>();
  const invoices = parsed.filter(inv => { const key=`${inv.invoiceNo.trim().toLowerCase()}|${inv.invoiceDate}|${inv.tallyGuid || inv.tallyMasterId || ''}`; if(seen.has(key)) return false; seen.add(key); return true; });
  return { invoices, rawCount:parsed.length, period };
}
