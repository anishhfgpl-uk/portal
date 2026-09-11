import { Invoice, InvoiceItemRow, SellerInfo } from '../types';
import { extractPanFromGstin, extractStateCodeFromGstin, getStateCodeByName, getStateNameByCode, numberToIndianWords } from '../utils/gstUtils';

export interface Gstr1TallyImportResult { invoices: Invoice[]; rawCount: number; period: string; }
const clean = (v: string) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
const text = (el: Element, name: string) => clean(el.getAttribute(name) || el.getAttribute(name.toUpperCase()) || el.getElementsByTagName(name)[0]?.textContent || '');
const money = (v: string) => Math.abs(Number(String(v || '').replace(/,/g, '')) || 0);
const dates = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function tallyDate(d: Date) { return `${d.getDate()}-${dates[d.getMonth()]}-${d.getFullYear()}`; }
function parseDate(v: string) { const s=clean(v); if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`; if (/^\d{2}-\d{2}-\d{4}$/.test(s)) { const [d,m,y]=s.split('-'); return `${y}-${m}-${d}`; } if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; } return s || new Date().toISOString().slice(0,10); }
function qty(v: string) { const m=clean(v).match(/^([\d,.]+)\s*(.*)$/); return { qty:m ? Number(m[1].replace(/,/g,'')) || 1 : 1, unit:m?.[2]?.trim() || 'Nos' }; }
export function repairXml(xml:string) { return String(xml||'').replace(/^\uFEFF/,'').replace(/&(?!#(?:\d+|x[0-9a-fA-F]+);|[A-Za-z][A-Za-z0-9]+;)/g,'&amp;'); }

export function buildSalesRequest(from:string,to:string,companyName='') {
  const c=companyName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>GSTR1SalesVouchersSafe</ID></HEADER><BODY><DESC><STATICVARIABLES>${c?`<SVCURRENTCOMPANY>${c}</SVCURRENTCOMPANY>`:''}<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE TYPE="Date">${from}</SVFROMDATE><SVTODATE TYPE="Date">${to}</SVTODATE><SVViewName>Accounting Voucher View</SVViewName></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="GSTR1SalesVouchersSafe" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes"><TYPE>Voucher</TYPE><FILTER>GSTR1IsSales</FILTER><FETCH>GUID,MASTERID,Date,VoucherNumber,VoucherTypeName,PartyLedgerName,PartyName,PartyGSTIN,GSTIN,PlaceOfSupply,StateName,BasicBuyerName,BasicBuyerAddress,Address,Pincode,MobileNumber,PhoneNumber,Amount,Narration,IsCancelled,IsOptional</FETCH><FETCH>AllInventoryEntries.StockItemName,AllInventoryEntries.BilledQty,AllInventoryEntries.ActualQty,AllInventoryEntries.Rate,AllInventoryEntries.Amount,AllInventoryEntries.HSNSACCode,AllInventoryEntries.HSNCODE,AllInventoryEntries.HSN,AllInventoryEntries.GSTOVRDIGSTRATE</FETCH><FETCH>LedgerEntries.LedgerName,LedgerEntries.Amount</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="GSTR1IsSales">$$IsSales:$VoucherTypeName</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

async function requestTally(xml:string,tallyUrl:string) {
  const controller=new AbortController(); const timer=window.setTimeout(()=>controller.abort(),30000);
  try { const r=await fetch('/api/tally/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:tallyUrl||'http://127.0.0.1:9000',xml}),signal:controller.signal}); const b=await r.json().catch(()=>null); if(!r.ok||!b?.success) throw new Error(b?.error||`Tally request failed (${r.status})`); return String(b.xml||''); }
  finally { window.clearTimeout(timer); }
}

export function parseInvoices(xml:string,seller:SellerInfo):Invoice[] {
  const doc=new DOMParser().parseFromString(repairXml(xml),'text/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error(`Tally XML response valid nahi hai: ${clean(xml.slice(0,300))||'empty response'}`);
  const status=clean(doc.getElementsByTagName('STATUS')[0]?.textContent||'1'); if(status==='0') throw new Error(clean(doc.getElementsByTagName('DESC')[0]?.textContent||'Tally rejected request'));
  const out:Invoice[]=[]; const sellerState=(seller.state||getStateNameByCode(seller.stateCode)||'Delhi').toLowerCase();
  Array.from(doc.getElementsByTagName('VOUCHER')).forEach((v,i)=>{
    const type=(text(v,'VOUCHERTYPENAME')||v.getAttribute('VCHTYPE')||'Sales').toLowerCase(); if(!type.includes('sales')) return;
    if(/^(yes|1|true)$/i.test(text(v,'ISCANCELLED'))||/^(yes|1|true)$/i.test(text(v,'ISOPTIONAL'))) return;
    const invoiceNo=text(v,'VOUCHERNUMBER')||text(v,'REFERENCE')||`TALLY-${i+1}`; const invoiceDate=parseDate(text(v,'DATE')); const partyName=text(v,'PARTYLEDGERNAME')||text(v,'PARTYNAME')||text(v,'BASICBUYERNAME')||'Cash Customer';
    const gstin=(text(v,'PARTYGSTIN')||text(v,'GSTIN')).toUpperCase(); const partyState=text(v,'PLACEOFSUPPLY')||text(v,'STATENAME')||seller.state||'Delhi'; const stateCode=extractStateCodeFromGstin(gstin)||getStateCodeByName(partyState)||seller.stateCode||'07'; const interstate=partyState.toLowerCase()!==sellerState;
    let cgst=0,sgst=0,igst=0,cess=0,taxableLedger=0; Array.from(v.getElementsByTagName('LEDGERENTRIES.LIST')).forEach(l=>{const a=Number(text(l,'AMOUNT').replace(/,/g,''))||0,n=text(l,'LEDGERNAME').toLowerCase(),x=Math.abs(a); if(/cgst/.test(n))cgst+=x; else if(/sgst|utgst/.test(n))sgst+=x; else if(/igst/.test(n))igst+=x; else if(/cess/.test(n))cess+=x; else if(a<0&&!/(round|tds|tcs|discount)/.test(n))taxableLedger+=x;});
    const items:InvoiceItemRow[]=[]; Array.from(v.getElementsByTagName('ALLINVENTORYENTRIES.LIST')).forEach((row,j)=>{const name=text(row,'STOCKITEMNAME')||`Item ${j+1}`,q=qty(text(row,'BILLEDQTY')||text(row,'ACTUALQTY')),rate=money(text(row,'RATE').split('/')[0]),taxable=money(text(row,'AMOUNT'))||rate*q.qty,hsn=text(row,'HSNSACCODE')||text(row,'HSNCODE')||text(row,'HSN'),gr=Number((text(row,'GSTOVRDIGSTRATE')||'').replace(/[^0-9.]/g,''))||0; items.push({id:`gstr-tally-${i+1}-${j+1}`,name,hsn,qty:q.qty,unit:q.unit,rate:rate||(q.qty?taxable/q.qty:0),discountPercent:0,gstRate:gr,taxableAmount:taxable,cgstAmount:0,sgstAmount:0,igstAmount:0,totalAmount:taxable});});
    if(!items.length){const taxable=taxableLedger||money(text(v,'AMOUNT'));if(taxable>0)items.push({id:`gstr-tally-${i+1}-1`,name:'Sales / Services',hsn:'',qty:1,unit:'Nos',rate:taxable,discountPercent:0,gstRate:0,taxableAmount:taxable,cgstAmount:0,sgstAmount:0,igstAmount:0,totalAmount:taxable});}
    const subtotal=items.reduce((n,x)=>n+x.taxableAmount,0); if(!subtotal)return; const hasTax=cgst+sgst+igst+cess>0; const rate=items.find(x=>x.gstRate>0)?.gstRate||0;
    items.forEach(item=>{const share=item.taxableAmount/subtotal;item.cgstAmount=hasTax?Number((cgst*share).toFixed(2)):(!interstate&&rate?Number((item.taxableAmount*rate/200).toFixed(2)):0);item.sgstAmount=hasTax?Number((sgst*share).toFixed(2)):(!interstate&&rate?Number((item.taxableAmount*rate/200).toFixed(2)):0);item.igstAmount=hasTax?Number((igst*share).toFixed(2)):(interstate&&rate?Number((item.taxableAmount*rate/100).toFixed(2)):0);const t=item.cgstAmount+item.sgstAmount+item.igstAmount;item.gstRate=t>0?Number((t/item.taxableAmount*100).toFixed(2)):0;item.totalAmount=item.taxableAmount+t;});
    const totalCgst=items.reduce((n,x)=>n+x.cgstAmount,0),totalSgst=items.reduce((n,x)=>n+x.sgstAmount,0),totalIgst=items.reduce((n,x)=>n+x.igstAmount,0),totalTax=totalCgst+totalSgst+totalIgst,grand=Number((subtotal+totalTax+cess).toFixed(2)); const guid=text(v,'GUID'),master=text(v,'MASTERID'); const address=text(v,'BASICBUYERADDRESS')||text(v,'ADDRESS');
    out.push({id:`tally-${guid||master||`${invoiceNo}-${invoiceDate}`}`,invoiceNo,invoiceDate,sellerState:seller.state,sellerStateCode:seller.stateCode,sellerGstin:seller.gstin,sellerName:seller.name,sellerAddress:seller.address,sellerPhone:seller.phone,partyName,gstin,mobile:text(v,'MOBILENUMBER')||text(v,'MOBILE')||text(v,'PHONE'),partyState,stateCode,pinCode:text(v,'PINCODE')||(address.match(/\b\d{6}\b/)?.[0]||''),city:'',completeAddress:address,pan:gstin?extractPanFromGstin(gstin):'',registrationType:gstin?'Regular':'Unregistered',items,subtotalTaxable:subtotal,totalCgst,totalSgst,totalIgst,totalTax,roundOff:0,grandTotal:grand,amountInWords:numberToIndianWords(grand),isInterState:interstate,tallySyncStatus:'synced',tallySyncDate:new Date().toISOString(),tallyGuid:guid,tallyMasterId:master,tallyVoucherType:text(v,'VOUCHERTYPENAME')||'Sales',source:'tally_import',isDuplicateProtected:true,createdAt:new Date().toISOString(),notes:text(v,'NARRATION')||`Imported from Tally Prime (${invoiceNo})`});
  }); return out;
}

export async function importGstr1SalesFromTally(period:string,seller:SellerInfo,tallyUrl='http://127.0.0.1:9000'):Promise<Gstr1TallyImportResult>{
  const mm=Number(period.slice(0,2)),yyyy=Number(period.slice(2)),start=new Date(yyyy,mm-1,1),end=new Date(yyyy,mm,0),all:Invoice[]=[],seen=new Set<string>();
  for(let cursor=new Date(start);cursor<=end;){const chunkEnd=new Date(Math.min(end.getTime(),cursor.getTime()+2*86400000));const xml=await requestTally(buildSalesRequest(tallyDate(cursor),tallyDate(chunkEnd),seller.name),tallyUrl);if(xml)parseInvoices(xml,seller).forEach(inv=>{const key=`${inv.invoiceNo.trim().toLowerCase()}|${inv.invoiceDate}|${inv.tallyGuid||inv.tallyMasterId||''}`;if(!seen.has(key)){seen.add(key);all.push(inv);}});cursor=new Date(chunkEnd);cursor.setDate(cursor.getDate()+1);}
  return {invoices:all,rawCount:all.length,period};
}
