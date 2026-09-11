import { Invoice, SellerInfo, TallyConfig } from '../types';
import { sendTallyRequest } from './tallyService';
import { parseInvoices } from './gstr1TallyImportService';

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
    <ID>GSTR1MonthlySales</ID>
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
          <COLLECTION NAME="GSTR1MonthlySales" ISMODIFY="No">
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

/** Fetch exactly one calendar month, like Tally's period/month selection. */
async function fetchMonth(month: number, year: number, config: TallyConfig, sellerInfo: SellerInfo): Promise<Invoice[]> {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  const result = await sendTallyRequest(salesRangeXml(tallyDate(from), tallyDate(to)), config);
  return parseInvoices(result.text, sellerInfo);
}

/**
 * Loads the complete financial year MONTH BY MONTH (April, May, ... March).
 * Only one Tally request is active at a time. This matches how a user normally
 * selects a month/period in Tally and avoids a huge financial-year request.
 */
export async function fetchAllSalesVouchersFromTally(
  config: TallyConfig,
  sellerInfo: SellerInfo,
  financialYearStart: number,
): Promise<Invoice[]> {
  const all: Invoice[] = [];
  const seen = new Set<string>();

  for (let month = 4; month <= 12; month++) {
    const rows = await fetchMonth(month, financialYearStart, config, sellerInfo);
    for (const invoice of rows) {
      const key = `${invoice.tallyGuid || invoice.tallyMasterId || ''}|${invoice.invoiceNo || ''}|${invoice.invoiceDate || ''}|${invoice.gstin || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(invoice);
      }
    }
  }

  for (let month = 1; month <= 3; month++) {
    const rows = await fetchMonth(month, financialYearStart + 1, config, sellerInfo);
    for (const invoice of rows) {
      const key = `${invoice.tallyGuid || invoice.tallyMasterId || ''}|${invoice.invoiceNo || ''}|${invoice.invoiceDate || ''}|${invoice.gstin || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(invoice);
      }
    }
  }

  return all;
}
