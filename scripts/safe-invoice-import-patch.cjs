const fs = require('fs');
const path = 'src/services/tallyService.ts';
let s = fs.readFileSync(path, 'utf8');
if (s.includes('SAFE_BATCH_INVOICE_IMPORT_V1')) process.exit(0);
const start = s.indexOf('/**\n * Direct Live API to fetch all Sales Vouchers from Tally Prime over Port 9000');
const end = s.indexOf('/**\n * Exports a single Invoice to Tally Prime');
if (start < 0 || end < 0 || end <= start) throw new Error('invoice fetch function markers not found');
const replacement = String.raw`/**
 * SAFE_BATCH_INVOICE_IMPORT_V1
 * Fetch all Sales Vouchers in sequential 31-day batches so one huge XML export
 * cannot lock TallyPrime. The user still gets one complete import operation.
 */
export async function fetchSalesVouchersFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  sellerInfo?: SellerInfo
): Promise<ParsedVouchersResult> {
  const allInvoices: Invoice[] = [];
  const allParties: Party[] = [];
  const allItems: StockItem[] = [];
  const seen = new Set<string>();

  const today = new Date();
  const parseDate = (value: string) => {
    const m = String(value || '').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return String(y) + m + day;
  };
  const fallbackStart = today.getMonth() >= 3
    ? new Date(today.getFullYear(), 3, 1)
    : new Date(today.getFullYear() - 1, 3, 1);
  const from = parseDate(sellerInfo?.booksBeginningFrom || sellerInfo?.financialYearFrom || '') || fallbackStart;
  from.setHours(0, 0, 0, 0);
  const until = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Sequential 31-day windows. Never Promise.all() requests to Tally.
  for (let cursor = new Date(from); cursor <= until; ) {
    const batchEnd = new Date(cursor);
    batchEnd.setDate(batchEnd.getDate() + 30);
    if (batchEnd > until) batchEnd.setTime(until.getTime());

    let xml = TALLY_XML_QUERIES.SALES_VOUCHERS_COLLECTION;
    xml = xml.replace(
      '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>',
      '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>' + toYmd(cursor) + '</SVFROMDATE><SVTODATE>' + toYmd(batchEnd) + '</SVTODATE>'
    );
    xml = xml.replace(
      '<FILTER>IsSalesVoucherOnly</FILTER>',
      '<FILTER>IsSalesVoucherOnly,IsVoucherInBatch</FILTER>'
    );
    xml = xml.replace(
      '<SYSTEM TYPE="Formulae" NAME="IsSalesVoucherOnly">$$IsSales:$VOUCHERTYPENAME</SYSTEM>',
      '<SYSTEM TYPE="Formulae" NAME="IsSalesVoucherOnly">$$IsSales:$VOUCHERTYPENAME</SYSTEM><SYSTEM TYPE="Formulae" NAME="IsVoucherInBatch">$Date &gt;= ##SVFromDate AND $Date &lt;= ##SVToDate</SYSTEM>'
    );

    const res = await sendTallyRequest(xml, config);
    if (res?.text?.trim()) {
      const parsed = parseSalesVouchersXML(res.text, sellerInfo);
      for (const inv of parsed.invoices) {
        const key = String(inv.tallyGuid || (inv.invoiceNo + '|' + inv.invoiceDate)).trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          allInvoices.push(inv);
        }
      }
      allParties.push(...parsed.extractedParties);
      allItems.push(...parsed.extractedItems);
    }

    cursor = new Date(batchEnd);
    cursor.setDate(cursor.getDate() + 1);
    // Small pause prevents a rapid request queue from building in Tally.
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  const uniqueParties = Array.from(new Map(allParties.map(p => [p.name.trim().toLowerCase(), p])).values());
  const uniqueItems = Array.from(new Map(allItems.map(i => [i.name.trim().toLowerCase(), i])).values());
  return { invoices: allInvoices, extractedParties: uniqueParties, extractedItems: uniqueItems };
}

`;
s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s);
console.log('patched', path);