import { Invoice, SellerInfo, TallyConfig } from '../types';
import { sendTallyRequest, parseSalesVouchersXML } from './tallyService';

const MAX_SAFE_BATCH = 50;

function tallyDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}-${Number(m)}-${y}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function midpoint(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return new Date(Math.floor((a + b) / 2)).toISOString().slice(0, 10);
}

function salesRangeXml(from: string, to: string): string {
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>GSTR1AllSales</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${tallyDate(from)}</SVFROMDATE>
        <SVTODATE TYPE="Date">${tallyDate(to)}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="GSTR1AllSales" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>
              DATE,VOUCHERTYPENAME,VOUCHERNUMBER,REFERENCE,PARTYLEDGERNAME,PARTYNAME,
              PARTYGSTIN,STATENAME,PLACEOFSUPPLY,COUNTRYOFRESIDENCE,BASICBUYERADDRESS,
              ADDRESS,NARRATION,GUID,MASTERID,ALLINVENTORYENTRIES.LIST,LEDGERENTRIES.LIST
            </FETCH>
            <FILTER>GSTR1SalesOnly</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="GSTR1SalesOnly">$$IsSales:$VOUCHERTYPENAME</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

async function fetchRange(
  from: string,
  to: string,
  config: TallyConfig,
  sellerInfo?: SellerInfo,
  depth = 0,
): Promise<Invoice[]> {
  const result = await sendTallyRequest(salesRangeXml(from, to), config);
  const parsed = parseSalesVouchersXML(result.text, sellerInfo);
  const rows = parsed.invoices || [];

  // Tally/report integrations can return a bounded batch. If we hit the
  // boundary, split the date range and fetch both halves so no vouchers are lost.
  if (rows.length >= MAX_SAFE_BATCH && from !== to && depth < 12) {
    const mid = midpoint(from, to);
    const right = addDays(mid, 1);
    if (right <= to) {
      const [leftRows, rightRows] = await Promise.all([
        fetchRange(from, mid, config, sellerInfo, depth + 1),
        fetchRange(right, to, config, sellerInfo, depth + 1),
      ]);
      return [...leftRows, ...rightRows];
    }
  }

  return rows;
}

export async function fetchAllSalesVouchersFromTally(
  config: TallyConfig,
  sellerInfo: SellerInfo,
  financialYearStart: number,
): Promise<Invoice[]> {
  const from = `${financialYearStart}-04-01`;
  const to = `${financialYearStart + 1}-03-31`;
  const rows = await fetchRange(from, to, config, sellerInfo);

  const seen = new Set<string>();
  return rows.filter((invoice) => {
    const key = `${invoice.id || ''}|${invoice.invoiceNo || ''}|${invoice.invoiceDate || ''}|${invoice.gstin || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
