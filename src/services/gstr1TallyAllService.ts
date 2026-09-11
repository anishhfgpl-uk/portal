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

/** Fetch a small date window so TallyPrime is not hit with a huge Voucher Register. */
async function fetchWindow(from: Date, to: Date, config: TallyConfig, sellerInfo: SellerInfo): Promise<Invoice[]> {
  const result = await sendTallyRequest(salesRangeXml(tallyDate(from), tallyDate(to)), config);
  return parseInvoices(result.text, sellerInfo);
}

/**
 * Loads the complete financial year using strictly sequential 7-day windows.
 * This avoids the previous parallel recursive requests that could make Tally hang.
 * The parser is the GSTR-specific parser so HSN/GST values come from Tally XML
 * instead of a guessed default tax rate.
 */
export async function fetchAllSalesVouchersFromTally(
  config: TallyConfig,
  sellerInfo: SellerInfo,
  financialYearStart: number,
): Promise<Invoice[]> {
  const fyStart = new Date(financialYearStart, 3, 1);
  const fyEnd = new Date(financialYearStart + 1, 2, 31);
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
