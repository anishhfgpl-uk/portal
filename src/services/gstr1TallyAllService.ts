import { Invoice, SellerInfo, TallyConfig } from '../types';
import { sendTallyRequest, parseSalesVouchersXML } from './tallyService';

function tallyDate(date: Date): string {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()}-${names[date.getMonth()]}-${date.getFullYear()}`;
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
        <SVFROMDATE TYPE="Date">${from}</SVFROMDATE>
        <SVTODATE TYPE="Date">${to}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="GSTR1AllSales" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>DATE,VOUCHERTYPENAME,VOUCHERNUMBER,REFERENCE,PARTYLEDGERNAME,PARTYNAME,PARTYGSTIN,STATENAME,PLACEOFSUPPLY,COUNTRYOFRESIDENCE,BASICBUYERADDRESS,ADDRESS,NARRATION,GUID,MASTERID,ALLINVENTORYENTRIES.LIST,LEDGERENTRIES.LIST</FETCH>
            <FILTER>GSTR1SalesOnly</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="GSTR1SalesOnly">$$IsSales:$VOUCHERTYPENAME</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

/**
 * Fetch one small date window. Keeping the window small is important because
 * TallyPrime can become unresponsive when a huge Voucher Collection is requested.
 */
async function fetchWindow(from: Date, to: Date, config: TallyConfig, sellerInfo: SellerInfo): Promise<Invoice[]> {
  const result = await sendTallyRequest(salesRangeXml(tallyDate(from), tallyDate(to)), config);
  const parsed = parseSalesVouchersXML(result.text, sellerInfo);
  return parsed.invoices || [];
}

/**
 * Loads the entire financial year without parallel Tally requests.
 * Requests are serial and limited to 7 calendar days each, which prevents the
 * repeated full-register fetch that was making Tally hang.
 */
export async function fetchAllSalesVouchersFromTally(
  config: TallyConfig,
  sellerInfo: SellerInfo,
  financialYearStart: number,
): Promise<Invoice[]> {
  const fyStart = new Date(financialYearStart, 3, 1); // 1 Apr
  const fyEnd = new Date(financialYearStart + 1, 2, 31); // 31 Mar
  const all: Invoice[] = [];
  const seen = new Set<string>();

  for (let cursor = new Date(fyStart); cursor <= fyEnd; ) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    if (end > fyEnd) end.setTime(fyEnd.getTime());

    const rows = await fetchWindow(cursor, end, config, sellerInfo);
    for (const invoice of rows) {
      const key = `${invoice.tallyGuid || invoice.tallyMasterId || ''}|${invoice.invoiceNo || ''}|${invoice.invoiceDate || ''}|${invoice.gstin || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(invoice);
      }
    }

    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }

  return all;
}
