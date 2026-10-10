import { Party, StockItem, Invoice, TallyConfig, SellerInfo, SyncReport, InvoiceItemRow, TallyVoucher } from '../types';
import {
  getStateCodeByName,
  getStateNameByCode,
  extractPanFromGstin,
  extractStateCodeFromGstin,
  xmlEscape,
  numberToIndianWords,
} from '../utils/gstUtils';


/** Current Indian financial year (1 April to 31 March). */
export function getCurrentFinancialYearRange(now = new Date()): { start: string; end: string } {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 3 ? year : year - 1;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

/** Normalize portal dates to ISO YYYY-MM-DD without silently substituting today's date. */
function normalizeInvoiceDateToIso(dateValue: string | undefined | null): string {
  const value = String(dateValue || '').trim();
  if (!value) return '';
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const dmy = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
}

function formatInvoiceDateForTally(dateValue: string | undefined | null): string {
  const iso = normalizeInvoiceDateToIso(dateValue);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  const y = Number(year), m = Number(month), d = Number(day);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return '';
  return `${year}${month}${day}`;
}

function isDateInCurrentFinancialYear(dateValue: string, now = new Date()): boolean {
  const range = getCurrentFinancialYearRange(now);
  const iso = normalizeInvoiceDateToIso(dateValue);
  return Boolean(iso && iso >= range.start && iso <= range.end);
}

export const DEFAULT_TALLY_CONFIG: TallyConfig = {
  tallyUrl: 'https://tally-bridge.anish-tech.online',
  proxyMode: true,
  autoSync: false,
  companyName: '',
  financialYear: '2025-2026',
};

// XML Queries for Tally Prime
export const TALLY_XML_QUERIES = {
  COMPANY_COLLECTION: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>CompanyCollection</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="CompanyCollection" ISMODIFY="No">
                        <TYPE>Company</TYPE>
                        <FETCH>
                            NAME,
                            MAILINGNAME,
                            BASICCOMPANYFORMALNAME,
                            ADDRESS,
                            STATENAME,
                            COUNTRYNAME,
                            PINCODE,
                            PHONENUMBER,
                            MOBILENUMBER,
                            TELEPHONENUMBER,
                            EMAIL,
                            EMAILID,
                            WEBSITE,
                            GSTIN,
                            PARTYGSTIN,
                            VATREGISTRATIONNO,
                            PANNUMBER,
                            INCOMETAXNUMBER,
                            STARTINGFROM,
                            ENDINGAT,
                            BOOKSFROM,
                            CURRENCYSYMBOL,
                            CURRENCYFORMALNAME,
                            BANKNAME,
                            BANKACCOUNTNUMBER,
                            IFSCODE,
                            GUID
                        </FETCH>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  COMPANY_COLLECTION_SIMPLE: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>CompanySimple</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="CompanySimple" ISMODIFY="No">
                        <TYPE>Company</TYPE>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  COMPANY_INFO: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>CompanyInfo</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
        </DESC>
    </BODY>
</ENVELOPE>`,

  DEBTOR_COLLECTION: `<ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>DebtorCollection</ID></HEADER>
    <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL><TDLMESSAGE>
        <COLLECTION NAME="DebtorCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No">
          <TYPE>Ledger</TYPE>
          <CHILDOF>$$GroupSundryDebtors</CHILDOF>
          <BELONGSTO>Yes</BELONGSTO>
          <FETCH>NAME,ADDRESS,LEDGERPHONE,LEDGERMOBILE,PINCODE,GSTIN,PARTYGSTIN,GSTREGISTRATIONTYPE,STATENAME,LEDGERPAN,COUNTRYNAME,OPENINGBALANCE,PARENT,GUID,MASTERID</FETCH>
        </COLLECTION>
      </TDLMESSAGE></TDL>
    </DESC></BODY>
  </ENVELOPE>`,
  DEBTOR_COLLECTION_FALLBACK: `<ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Ledgers</ID></HEADER>
    <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL><TDLMESSAGE>
        <COLLECTION NAME="List of Ledgers" ISMODIFY="Yes">
          <ADD>CHILD OF : $$GroupSundryDebtors</ADD>
          <NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>Parent</NATIVEMETHOD><NATIVEMETHOD>Address</NATIVEMETHOD>
          <NATIVEMETHOD>LedgerPhone</NATIVEMETHOD><NATIVEMETHOD>LedgerMobile</NATIVEMETHOD><NATIVEMETHOD>PINCODE</NATIVEMETHOD>
          <NATIVEMETHOD>GSTIN</NATIVEMETHOD><NATIVEMETHOD>PartyGSTIN</NATIVEMETHOD><NATIVEMETHOD>GSTRegistrationType</NATIVEMETHOD>
          <NATIVEMETHOD>StateName</NATIVEMETHOD><NATIVEMETHOD>LedgerPAN</NATIVEMETHOD><NATIVEMETHOD>CountryName</NATIVEMETHOD>
          <NATIVEMETHOD>OpeningBalance</NATIVEMETHOD><NATIVEMETHOD>GUID</NATIVEMETHOD><NATIVEMETHOD>MASTERID</NATIVEMETHOD>
        </COLLECTION>
      </TDLMESSAGE></TDL>
    </DESC></BODY>
  </ENVELOPE>`,
  STOCK_ITEM_COLLECTION: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>StockItemCollection</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="StockItemCollection" ISMODIFY="No">
                        <TYPE>Stock Item</TYPE>
                        <FETCH>
                            NAME,
                            BASEUNITS,
                            HSNCODE,
                            HSNDETAILS,
                            GSTDETAILS,
                            GSTAPPLICABLE,
                            HSN,
                            GST,
                            STANDARDCOST,
                            STANDARDPRICE,
                            OPENINGBALANCE,
                            OPENINGRATE,
                            CLOSINGRATE,
                            RATEOFVAT,
                            INTEGRATEDTAX,
                            GSTRATE,
                            GSTREPRATEDETAILS,
                            DESCRIPTION,
                            PARTNUMBER
                        </FETCH>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  STOCK_ITEM_COLLECTION_SIMPLE: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>StockItemCollectionSimple</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="StockItemCollectionSimple" ISMODIFY="No">
                        <TYPE>StockItem</TYPE>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  STOCK_ITEM_LIST_ACCOUNTS: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>List of Accounts</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <ACCOUNTTYPE>Stock Items</ACCOUNTTYPE>
            </STATICVARIABLES>
        </DESC>
    </BODY>
</ENVELOPE>`,

  // Portal voucher type check: Portal bills are stored in Tally under Sales > Portal.
  PORTAL_VOUCHER_TYPE_COLLECTION: `<ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>PortalVoucherTypeCollection</ID></HEADER>
    <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL><TDLMESSAGE>
        <COLLECTION NAME="PortalVoucherTypeCollection" ISMODIFY="No"><TYPE>VoucherType</TYPE><FETCH>NAME,PARENT</FETCH></COLLECTION>
      </TDLMESSAGE></TDL>
    </DESC></BODY>
  </ENVELOPE>`,

  // Lightweight Sales import: keep the query item-wise but fetch only the fields
  // required to build an invoice. Large ledger/GST collections can make Tally Prime
  // appear frozen, so do not request the full LedgerEntries tree during invoice import.
  SALES_VOUCHERS_NATIVE: `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>PortalSalesInvoicesSafe</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVViewName>Accounting Voucher View</SVViewName><SVCURRENTCOMPANY>__PORTAL_COMPANY__</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="PortalSalesInvoicesSafe" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes"><TYPE>Voucher</TYPE><FILTER>PortalIsSalesInRange</FILTER><FETCH>GUID,MASTERID,Date,VoucherNumber,VoucherTypeName,PartyLedgerName,PartyName,PartyGSTIN,GSTIN,PlaceOfSupply,StateName,BasicBuyerName,BasicBuyerAddress,Address,Pincode,MobileNumber,PhoneNumber,Amount,Narration,IsCancelled,IsOptional</FETCH><FETCH>AllInventoryEntries.StockItemName,AllInventoryEntries.BilledQty,AllInventoryEntries.ActualQty,AllInventoryEntries.Rate,AllInventoryEntries.Amount,AllInventoryEntries.HSNSACCode,AllInventoryEntries.HSNCODE,AllInventoryEntries.HSN</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="PortalIsSalesInRange">$$And:$$IsSales:$VoucherTypeName:$$IsBetween:$Date:##SVFROMDATE:##SVTODATE</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`,
  // Sales Vouchers (Invoices) Collection Query for Tally Prime
  SALES_VOUCHERS_COLLECTION: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>SalesVoucherCollection</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="SalesVoucherCollection" ISMODIFY="No">
                        <TYPE>Voucher</TYPE>
                        <FETCH>
                            DATE,
                            VOUCHERTYPENAME,
                            VOUCHERNUMBER,
                            REFERENCE,
                            PARTYLEDGERNAME,
                            PARTYNAME,
                            PARTYGSTIN,
                            STATENAME,
                            PLACEOFSUPPLY,
                            COUNTRYOFRESIDENCE,
                            BASICBUYERADDRESS,
                            ADDRESS,
                            NARRATION,
                            GUID,
                            MASTERID,
                            ALLINVENTORYENTRIES.LIST,
                            LEDGERENTRIES.LIST
                        </FETCH>
                        <FILTER>IsSalesVoucherOnly</FILTER>
                    </COLLECTION>
                    <SYSTEM TYPE="Formulae" NAME="IsSalesVoucherOnly">$$IsSales:$VOUCHERTYPENAME</SYSTEM>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  // Simpler Voucher Collection if TDL Filter is restricted
  SALES_VOUCHERS_SIMPLE: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>VoucherCollection</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="VoucherCollection" ISMODIFY="No">
                        <TYPE>Voucher</TYPE>
                        <FETCH>
                            DATE,
                            VOUCHERTYPENAME,
                            VOUCHERNUMBER,
                            REFERENCE,
                            PARTYLEDGERNAME,
                            PARTYNAME,
                            PARTYGSTIN,
                            STATENAME,
                            PLACEOFSUPPLY,
                            BASICBUYERADDRESS,
                            ADDRESS,
                            NARRATION,
                            GUID,
                            MASTERID,
                            ALLINVENTORYENTRIES.LIST,
                            LEDGERENTRIES.LIST
                        </FETCH>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  // All accounting vouchers (Receipt, Credit Note and party-ledger import)
  // Fetch all voucher types and filter them in the portal UI for compatibility across Tally Prime builds.
  ACCOUNTING_VOUCHERS_BOUNDED: `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>AccountingVouchersBounded</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><SYSTEM TYPE="Formulae" NAME="AccountingVoucherInRange">$$IsBetween:$Date:##SVFROMDATE:##SVTODATE</SYSTEM><COLLECTION NAME="AccountingVouchersBounded" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No"><TYPE>Voucher</TYPE><FILTER>AccountingVoucherInRange</FILTER><FETCH>DATE,VCHTYPE,VOUCHERTYPENAME,VOUCHERNUMBER,REFERENCE,PARTYLEDGERNAME,PARTYNAME,NARRATION,GUID,MASTERID,LEDGERENTRIES.LIST</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`,
  ACCOUNTING_VOUCHERS_COLLECTION: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>AccountingVoucherCollection</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="AccountingVoucherCollection" ISMODIFY="No">
                        <TYPE>Voucher</TYPE>
                        <FETCH>
                            DATE,
                            VCHTYPE,
                            VOUCHERTYPENAME,
                            VOUCHERNUMBER,
                            REFERENCE,
                            PARTYLEDGERNAME,
                            PARTYNAME,
                            NARRATION,
                            GUID,
                            MASTERID,
                            LEDGERENTRIES.LIST
                        </FETCH>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>`,

  // Day Book Export
  DAYBOOK_EXPORT: `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Day Book</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
        </DESC>
    </BODY>
</ENVELOPE>`,
};

/**
 * Universal XML Requester to Tally Prime:
 * 1. Tries Backend Proxy route (/api/tally/request) to avoid browser CORS/PNA issues.
 * 2. If proxy fails or direct mode selected, attempts direct fetch.
 */
export async function sendTallyRequest(
  xml: string,
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<{ text: string; via: 'proxy' | 'direct' }> {
  const tallyUrl = config.tallyUrl || 'http://localhost:9000';

  // Strategy 1: Backend Express proxy (Eliminates CORS completely)
  if (config.proxyMode !== false) {
    try {
      const response = await fetch('/api/tally/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: tallyUrl,
          xml: xml,
          bridgeToken: config.bridgeToken || '',
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.xml && json.xml.trim()) {
          return { text: json.xml, via: 'proxy' };
        } else if (json.error) {
          throw new Error(json.error);
        }
      } else {
        const errJson = await response.json().catch(() => null);
        if (errJson && errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (proxyError: any) {
      console.warn('Proxy request failed, trying direct browser fetch fallback:', proxyError.message);
      // If the error was a specific connection error from Tally, forward it
      if (proxyError.message && proxyError.message.includes('Tally')) {
        throw proxyError;
      }
    }
  }

  // In proxy mode the browser must never bypass the hosted backend.
  if (config.proxyMode !== false) {
    throw new Error('Hosted Tally proxy request failed; direct browser fallback is disabled.');
  }

  // Direct browser fetch is allowed only when proxy mode is explicitly disabled.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const directResponse = await fetch(tallyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
      },
      body: xml,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!directResponse.ok) {
      throw new Error(`Tally HTTP Error: ${directResponse.status} ${directResponse.statusText}`);
    }

    const text = await directResponse.text();
    if (!text || !text.trim()) {
      throw new Error('Tally ne empty response diya.');
    }

    return { text, via: 'direct' };
  } catch (directError: any) {
    if (
      directError.name === 'TypeError' ||
      directError.name === 'AbortError' ||
      directError.message.includes('Failed to fetch')
    ) {
      throw new Error(
        `Tally Prime se connection nahi ho raha (${tallyUrl}).\n\n` +
        `Kripya check karein:\n` +
        `1. Tally Prime chalu hai aur koi Company open hai.\n` +
        `2. Tally Prime mein F1: Help > Settings > Connectivity > Client/Server configuration mein HTTP Server enabled hai aur Port 9000 set hai.\n` +
        `3. Browser Security (CORS/Private Network) block kar rahi hai to XML File Import feature use karein ya Local Proxy Bridge chalayein.`
      );
    }
    throw directError;
  }
}

/**
 * Tests connection to Tally Prime by querying company information
 */
export async function testTallyConnection(
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<boolean> {
  try {
    const result = await sendTallyRequest(TALLY_XML_QUERIES.COMPANY_INFO, config);
    return Boolean(result.text && result.text.includes('<ENVELOPE>'));
  } catch (err) {
    return false;
  }
}

/**
 * Fetches and parses all Company Profiles from active Tally Prime instance
 */
export async function fetchCompaniesFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<SellerInfo[]> {
  // Query 1: Full Company Collection with TDL fetch attributes
  try {
    const result = await sendTallyRequest(TALLY_XML_QUERIES.COMPANY_COLLECTION, config);
    const companies = parseCompaniesXML(result.text);
    if (companies.length > 0) {
      return companies;
    }
  } catch (err) {
    console.warn('CompanyCollection query failed, trying simple collection fallback:', err);
  }

  // Query 2: Simple Company Collection
  try {
    const result2 = await sendTallyRequest(TALLY_XML_QUERIES.COMPANY_COLLECTION_SIMPLE, config);
    const companies2 = parseCompaniesXML(result2.text);
    if (companies2.length > 0) {
      return companies2;
    }
  } catch (err2) {
    console.warn('CompanySimple query failed, trying CompanyInfo fallback:', err2);
  }

  // Query 3: Company Info
  try {
    const result3 = await sendTallyRequest(TALLY_XML_QUERIES.COMPANY_INFO, config);
    return parseCompaniesXML(result3.text);
  } catch (err3) {
    console.error('All Tally Company fetch attempts failed:', err3);
    throw err3;
  }
}

/**
 * Fetches and parses all Sundry Debtors from Tally Prime
 */
export async function fetchDebtorsFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<Party[]> {
  const queries = [
    TALLY_XML_QUERIES.DEBTOR_COLLECTION,
    TALLY_XML_QUERIES.DEBTOR_COLLECTION_FALLBACK,
  ];
  const merged = new Map<string, Party>();
  let lastError: any = null;

  for (const query of queries) {
    try {
      const result = await sendTallyRequest(query, config);
      const rows = parseDebtorsXML(result.text);
      for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        if (key) merged.set(key, row);
      }
      if (merged.size > 0) break;
    } catch (err) {
      lastError = err;
      console.warn('Tally debtor collection query failed, trying fallback:', err);
    }
  }

  if (merged.size === 0 && lastError) throw lastError;
  return Array.from(merged.values());
}

/**
 * Sanitizes XML string to prevent DOMParser crashes on special characters,
 * unencoded ampersands, or control characters often sent by Tally Prime.
 */
export function sanitizeXmlString(rawXml: string): string {
  if (!rawXml) return '';

  return rawXml
    // Strip UTF-8 BOM
    .replace(/^\uFEFF/, '')
    // Strip non-printable ASCII control characters except tab, newline, carriage return
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Fix unescaped ampersands (e.g. "M&M Ltd", "R & D", "A&B")
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    // Fix common Tally numeric entities that are invalid
    .replace(/&#0*([0-8]|11|12|14|15|16|17|18|19|2[0-9]|30|31);/g, '');
}

/**
 * Fetches and parses all Stock Items from Tally Prime with multiple query fallbacks
 */
export async function fetchStockItemsFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<StockItem[]> {
  // Run every compatible query and merge the results. Returning the first
  // non-empty response can silently lose items on Tally builds/configurations
  // that return only a subset from a particular collection shape.
  const queries = [
    TALLY_XML_QUERIES.STOCK_ITEM_COLLECTION,
    TALLY_XML_QUERIES.STOCK_ITEM_COLLECTION_SIMPLE,
    TALLY_XML_QUERIES.STOCK_ITEM_LIST_ACCOUNTS,
  ];
  const merged = new Map<string, StockItem>();
  let lastError: any = null;
  for (const query of queries) {
    try {
      const result = await sendTallyRequest(query, config);
      const rows = parseStockItemsXML(result.text);
      for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        if (key) merged.set(key, row);
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (merged.size === 0 && lastError) {
    console.error('All Tally Stock Item queries failed:', lastError);
    throw lastError;
  }
  return Array.from(merged.values());
}

/**
 * Parses XML text into XML DOM Document with auto-sanitization
 */
export function parseTallyXML(xmlText: string): Document {
  const sanitized = sanitizeXmlString(xmlText);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/xml');
  const parserError = doc.getElementsByTagName('parsererror');

  if (parserError.length > 0) {
    console.warn('DOMParser reported warning/error on Tally XML:', parserError[0].textContent);
  }

  return doc;
}

export function getNodeValue(parent: Element | null, tagName: string): string {
  if (!parent) return '';
  // DOM tag lookup is case-sensitive. Tally versions/export paths can vary
  // in tag casing, so try the exact name first and then a case-insensitive scan.
  const exact = parent.getElementsByTagName(tagName)[0];
  if (exact) return (exact.textContent || '').trim();
  const wanted = tagName.toUpperCase();
  const node = Array.from(parent.getElementsByTagName('*')).find(
    (candidate) => candidate.tagName.toUpperCase() === wanted
  );
  return (node?.textContent || '').trim();
}

export function getAttributeOrNode(
  element: Element | null,
  attributeName: string,
  nodeName: string
): string {
  if (!element) return '';
  const attr = element.getAttribute(attributeName);
  if (attr && attr.trim()) {
    return attr.trim();
  }
  const val = getNodeValue(element, nodeName);
  if (val) return val;

  // Check language name list nested structure in Tally
  const langName = element.getElementsByTagName('LANGUAGENAME.LIST')[0];
  if (langName) {
    const nameNode = langName.getElementsByTagName('NAME')[0];
    if (nameNode && nameNode.textContent) {
      return nameNode.textContent.trim();
    }
  }
  return '';
}

/**
 * Robust regex-based Stock Item extractor for malformed or unescaped XML
 */
function extractStockItemsWithRegex(rawXml: string): StockItem[] {
  const items: StockItem[] = [];
  const clean = sanitizeXmlString(rawXml);
  const itemBlocks = clean.match(/<STOCKITEM\b[\s\S]*?<\/STOCKITEM>/gi) || [];

  itemBlocks.forEach((block, index) => {
    // Extract Name
    let name = '';
    const nameAttrMatch = block.match(/NAME="([^"]+)"/i);
    if (nameAttrMatch && nameAttrMatch[1]) {
      name = nameAttrMatch[1].trim();
    } else {
      const nameTagMatch = block.match(/<NAME>([^<]+)<\/NAME>/i);
      if (nameTagMatch && nameTagMatch[1]) {
        name = nameTagMatch[1].trim();
      }
    }

    if (!name) return;

    // Extract HSN
    let hsn = '';
    const hsnMatch = block.match(/<(?:HSNCODE|HSN|HSNMASTERNAME)>([^<]+)<\/(?:HSNCODE|HSN|HSNMASTERNAME)>/i);
    if (hsnMatch && hsnMatch[1]) {
      hsn = hsnMatch[1].trim();
    }

    // Extract GST
    let gstNum = 18;
    const gstMatch = block.match(/<(?:GSTRATE|IGSTRATE|INTEGRATEDTAX|GST|RATEOFVAT)>([^<]+)<\/(?:GSTRATE|IGSTRATE|INTEGRATEDTAX|GST|RATEOFVAT)>/i);
    if (gstMatch && gstMatch[1]) {
      const parsed = parseFloat(gstMatch[1].replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) gstNum = parsed;
    } else {
      const allNumbers = block.match(/\b(0|3|5|12|18|28)(?:\.0+)?\b/g);
      if (allNumbers && allNumbers.length > 0) {
        gstNum = parseFloat(allNumbers[allNumbers.length - 1]);
      }
    }

    // Extract Unit
    let unit = 'Nos';
    const unitMatch = block.match(/<(?:BASEUNITS|BASEUNIT|UOM)>([^<]+)<\/(?:BASEUNITS|BASEUNIT|UOM)>/i);
    if (unitMatch && unitMatch[1]) {
      unit = unitMatch[1].trim();
    }

    // Extract Rate / Cost
    let rateNum = 0;
    const rateMatch = block.match(/<(?:STANDARDCOST|STANDARDPRICE|CLOSINGRATE|OPENINGRATE|RATE)>([^<]+)<\/(?:STANDARDCOST|STANDARDPRICE|CLOSINGRATE|OPENINGRATE|RATE)>/i);
    if (rateMatch && rateMatch[1]) {
      rateNum = parseFloat(rateMatch[1].replace(/[^0-9.]/g, '')) || 0;
    }

    // Extract Description
    let desc = '';
    const descMatch = block.match(/<(?:DESCRIPTION|PARTNUMBER)>([^<]+)<\/(?:DESCRIPTION|PARTNUMBER)>/i);
    if (descMatch && descMatch[1]) {
      desc = descMatch[1].trim();
    }

    items.push({
      id: `item-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name,
      hsn: hsn || '',
      gst: gstNum,
      unit: unit,
      rate: rateNum,
      description: desc || '',
    });
  });

  return items;
}

/**
 * Robust regex-based Party / Debtor extractor
 */
function extractDebtorsWithRegex(rawXml: string): Party[] {
  const parties: Party[] = [];
  const clean = sanitizeXmlString(rawXml);
  const ledgerBlocks = clean.match(/<LEDGER\b[\s\S]*?<\/LEDGER>/gi) || [];

  ledgerBlocks.forEach((block, index) => {
    let name = '';
    const nameAttrMatch = block.match(/NAME="([^"]+)"/i);
    if (nameAttrMatch && nameAttrMatch[1]) {
      name = nameAttrMatch[1].trim();
    } else {
      const nameTagMatch = block.match(/<NAME>([^<]+)<\/NAME>/i);
      if (nameTagMatch && nameTagMatch[1]) {
        name = nameTagMatch[1].trim();
      }
    }

    if (!name) return;

    const gstinMatch = block.match(/<(?:GSTIN|PARTYGSTIN)>([^<]+)<\/(?:GSTIN|PARTYGSTIN)>/i);
    const gstin = gstinMatch ? gstinMatch[1].trim() : '';

    const phoneMatch = block.match(/<(?:LEDGERMOBILE|LEDGERPHONE|PHONE|MOBILE)>([^<]+)<\/(?:LEDGERMOBILE|LEDGERPHONE|PHONE|MOBILE)>/i);
    const mobile = phoneMatch ? phoneMatch[1].trim() : '';

    const pinMatch = block.match(/<PINCODE>([^<]+)<\/PINCODE>/i);
    const pin = pinMatch ? pinMatch[1].trim() : '';

    const stateMatch = block.match(/<STATENAME>([^<]+)<\/STATENAME>/i);
    const state = stateMatch ? stateMatch[1].trim() : '';

    const addrMatches = block.match(/<ADDRESS>([^<]+)<\/ADDRESS>/gi) || [];
    const address = addrMatches.map(m => m.replace(/<\/?ADDRESS>/gi, '').trim()).filter(Boolean).join(', ');

    parties.push({
      id: `party-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name,
      address: address,
      pin: pin,
      mobile: mobile,
      gstin: gstin,
      state: state,
      state_code: gstin ? extractStateCodeFromGstin(gstin) : (state ? getStateCodeByName(state) : ''),
      city: '',
      pan: gstin ? extractPanFromGstin(gstin) : '',
      registration_type: gstin ? 'Regular' : 'Unregistered',
      country: 'India',
    });
  });

  return parties;
}

/**
 * Parses Debtors (Sundry Debtors ledgers) from Tally XML string or Document
 */
export function parseDebtorsXML(xmlInput: string | Document): Party[] {
  let doc: Document | null = null;
  if (typeof xmlInput === 'string') {
    try {
      doc = parseTallyXML(xmlInput);
    } catch {
      doc = null;
    }
  } else {
    doc = xmlInput;
  }

  let ledgers: Element[] = [];
  if (doc) {
    ledgers = Array.from(doc.getElementsByTagName('LEDGER'));
  }

  // If DOM parsing returned 0 ledgers and input is a string, use regex extractor
  if (ledgers.length === 0 && typeof xmlInput === 'string') {
    const regexParties = extractDebtorsWithRegex(xmlInput);
    if (regexParties.length > 0) return regexParties;
  }

  const parties: Party[] = [];

  ledgers.forEach((ledger, index) => {
    const name = getAttributeOrNode(ledger, 'NAME', 'NAME');
    if (!name) return;

    // Address extraction (handles multiple <ADDRESS> lines)
    const addressNodes = ledger.getElementsByTagName('ADDRESS');
    let fullAddress = '';
    if (addressNodes.length > 0) {
      const lines: string[] = [];
      for (let i = 0; i < addressNodes.length; i++) {
        const text = (addressNodes[i].textContent || '').trim();
        if (text) lines.push(text);
      }
      fullAddress = lines.join(', ');
    } else {
      fullAddress = getNodeValue(ledger, 'ADDRESS');
    }

    const mobile =
      getNodeValue(ledger, 'LEDGERMOBILE') ||
      getNodeValue(ledger, 'LEDGERPHONE') ||
      getNodeValue(ledger, 'PHONE') ||
      getNodeValue(ledger, 'MOBILE');

    const pin = getNodeValue(ledger, 'PINCODE');

    const gstin =
      getNodeValue(ledger, 'GSTIN') ||
      getNodeValue(ledger, 'PARTYGSTIN');

    const state = getNodeValue(ledger, 'STATENAME');

    let pan = getNodeValue(ledger, 'LEDGERPAN') || getNodeValue(ledger, 'PAN');
    if (!pan && gstin) {
      pan = extractPanFromGstin(gstin);
    }

    let stateCode = '';
    if (gstin) {
      stateCode = extractStateCodeFromGstin(gstin);
    }
    if (!stateCode && state) {
      stateCode = getStateCodeByName(state);
    }

    const registrationType =
      getNodeValue(ledger, 'GSTREGISTRATIONTYPE') ||
      (gstin ? 'Regular' : 'Unregistered');

    const country = getNodeValue(ledger, 'COUNTRYNAME') || 'India';

    parties.push({
      id: `party-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name,
      address: fullAddress,
      pin: pin,
      mobile: mobile,
      gstin: gstin,
      state: state,
      state_code: stateCode,
      city: '',
      pan: pan,
      registration_type: registrationType,
      country: country,
    });
  });

  // If standard DOM extraction found nothing, try regex
  if (parties.length === 0 && typeof xmlInput === 'string') {
    return extractDebtorsWithRegex(xmlInput);
  }

  // Deduplicate by lowercase name
  const unique: Party[] = [];
  const seen = new Set<string>();

  parties.forEach(p => {
    const key = p.name.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  });

  return unique;
}

/**
 * Parses Stock Items from Tally XML string or Document
 */
export function parseStockItemsXML(xmlInput: string | Document): StockItem[] {
  let doc: Document | null = null;
  if (typeof xmlInput === 'string') {
    try {
      doc = parseTallyXML(xmlInput);
    } catch {
      doc = null;
    }
  } else {
    doc = xmlInput;
  }

  let stockItems: Element[] = [];
  if (doc) {
    stockItems = Array.from(doc.getElementsByTagName('STOCKITEM'));
  }

  // If DOM parsing returned 0 items and input is string, use regex extractor
  if (stockItems.length === 0 && typeof xmlInput === 'string') {
    const regexItems = extractStockItemsWithRegex(xmlInput);
    if (regexItems.length > 0) return regexItems;
  }

  const items: StockItem[] = [];

  stockItems.forEach((item, index) => {
    const name = getAttributeOrNode(item, 'NAME', 'NAME');
    if (!name) return;

    let hsn =
      getNodeValue(item, 'HSNCODE') ||
      getNodeValue(item, 'HSN') ||
      getNodeValue(item, 'HSNMASTERNAME');

    let gstRaw =
      getNodeValue(item, 'GSTRATE') ||
      getNodeValue(item, 'IGSTRATE') ||
      getNodeValue(item, 'INTEGRATEDTAX') ||
      getNodeValue(item, 'GST') ||
      getNodeValue(item, 'RATEOFVAT');

    const unit =
      getNodeValue(item, 'BASEUNITS') ||
      getNodeValue(item, 'BASEUNIT') ||
      getNodeValue(item, 'UOM') ||
      'Nos';

    const stdCost =
      getNodeValue(item, 'STANDARDCOST') ||
      getNodeValue(item, 'STANDARDPRICE') ||
      getNodeValue(item, 'CLOSINGRATE') ||
      getNodeValue(item, 'OPENINGRATE') ||
      getNodeValue(item, 'RATE');

    // HSN Fallback from HSNDETAILS or GSTDETAILS nodes
    if (!hsn) {
      const hsnDetails = item.getElementsByTagName('HSNDETAILS')[0] || item.getElementsByTagName('HSNDETAILS.LIST')[0];
      if (hsnDetails) {
        hsn =
          getNodeValue(hsnDetails, 'HSNCODE') ||
          getNodeValue(hsnDetails, 'HSN') ||
          (hsnDetails.textContent || '').trim();
      }
    }

    if (!hsn) {
      const gstDetails = item.getElementsByTagName('GSTDETAILS.LIST')[0] || item.getElementsByTagName('GSTDETAILS')[0];
      if (gstDetails) {
        hsn = getNodeValue(gstDetails, 'HSNCODE') || getNodeValue(gstDetails, 'HSN');
      }
    }

    // GST Fallback from GSTDETAILS / GSTREPRATEDETAILS / RATEDETAILS nodes
    if (!gstRaw) {
      const repDetails = item.getElementsByTagName('GSTREPRATEDETAILS.LIST')[0];
      if (repDetails) {
        gstRaw = getNodeValue(repDetails, 'GSTRATE') || getNodeValue(repDetails, 'IGSTRATE');
      }
    }

    if (!gstRaw) {
      const rateDetails = item.getElementsByTagName('RATEDETAILS.LIST')[0];
      if (rateDetails) {
        gstRaw = getNodeValue(rateDetails, 'GSTRATE');
      }
    }

    if (!gstRaw) {
      const gstNode = item.getElementsByTagName('GSTDETAILS.LIST')[0] || item.getElementsByTagName('GSTDETAILS')[0];
      if (gstNode) {
        const text = (gstNode.textContent || '').trim();
        const matches = text.match(/\b(0|3|5|12|18|28)(?:\.0+)?\b/g);
        if (matches && matches.length > 0) {
          gstRaw = matches[matches.length - 1];
        }
      }
    }

    const gstNum = parseFloat(gstRaw) || 18;
    const rateNum = parseFloat(stdCost.replace(/[^0-9.]/g, '')) || 0;
    const description = getNodeValue(item, 'DESCRIPTION') || getNodeValue(item, 'PARTNUMBER');

    items.push({
      id: `item-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name,
      hsn: hsn || '',
      gst: gstNum,
      unit: unit,
      rate: rateNum,
      description: description || '',
    });
  });

  // If DOM parsed 0 items, try regex extractor
  if (items.length === 0 && typeof xmlInput === 'string') {
    return extractStockItemsWithRegex(xmlInput);
  }

  // Deduplicate by lowercase name
  const unique: StockItem[] = [];
  const seen = new Set<string>();

  items.forEach(item => {
    const key = item.name.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  });

  return unique;
}

/**
 * Robust regex-based Company Profile extractor for raw or malformed Tally XML
 */
function extractCompaniesWithRegex(rawXml: string): SellerInfo[] {
  const companies: SellerInfo[] = [];
  const clean = sanitizeXmlString(rawXml);

  // Match <COMPANY...> ... </COMPANY> or <TALLYMESSAGE...> ... </TALLYMESSAGE>
  const companyBlocks = clean.match(/<COMPANY\b[\s\S]*?<\/COMPANY>/gi) || [];

  companyBlocks.forEach((block, index) => {
    let name = '';
    const nameAttrMatch = block.match(/NAME="([^"]+)"/i);
    if (nameAttrMatch && nameAttrMatch[1]) {
      name = nameAttrMatch[1].trim();
    } else {
      const nameTagMatch = block.match(/<(?:BASICCOMPANYNAME|NAME)>([^<]+)<\/(?:BASICCOMPANYNAME|NAME)>/i);
      if (nameTagMatch && nameTagMatch[1]) {
        name = nameTagMatch[1].trim();
      }
    }

    if (!name) return;

    // Mailing name / Formal Name
    let mailingName = '';
    const mailMatch = block.match(/<(?:MAILINGNAME|BASICCOMPANYFORMALNAME)>([^<]+)<\/(?:MAILINGNAME|BASICCOMPANYFORMALNAME)>/i);
    if (mailMatch && mailMatch[1]) {
      mailingName = mailMatch[1].trim();
    }

    // Address
    const addrMatches = block.match(/<ADDRESS>([^<]+)<\/ADDRESS>/gi) || [];
    let address = addrMatches.map((m) => m.replace(/<\/?ADDRESS>/gi, '').trim()).filter(Boolean).join(', ');
    if (!address) {
      const singleAddrMatch = block.match(/<ADDRESS>([\s\S]*?)<\/ADDRESS>/i);
      if (singleAddrMatch && singleAddrMatch[1]) {
        address = singleAddrMatch[1].replace(/<[^>]+>/g, ' ').trim();
      }
    }

    // State & Country
    const stateMatch = block.match(/<(?:STATENAME|STATE)>([^<]+)<\/(?:STATENAME|STATE)>/i);
    const state = stateMatch ? stateMatch[1].trim() : 'Delhi';

    const countryMatch = block.match(/<(?:COUNTRYNAME|COUNTRY)>([^<]+)<\/(?:COUNTRYNAME|COUNTRY)>/i);
    const country = countryMatch ? countryMatch[1].trim() : 'India';

    const pinMatch = block.match(/<PINCODE>([^<]+)<\/PINCODE>/i);
    let pincode = pinMatch ? pinMatch[1].trim() : '';
    if (!pincode) {
      const pinFromAddr = address.match(/\b\d{6}\b/);
      if (pinFromAddr) pincode = pinFromAddr[0];
    }

    // Phone / Mobile / Email / Website
    const phoneMatch = block.match(/<(?:PHONENUMBER|TELEPHONENUMBER|PHONE)>([^<]+)<\/(?:PHONENUMBER|TELEPHONENUMBER|PHONE)>/i);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';

    const mobMatch = block.match(/<(?:MOBILENUMBER|MOBILE)>([^<]+)<\/(?:MOBILENUMBER|MOBILE)>/i);
    const mobile = mobMatch ? mobMatch[1].trim() : '';

    const emailMatch = block.match(/<(?:EMAIL|EMAILID)>([^<]+)<\/(?:EMAIL|EMAILID)>/i);
    const email = emailMatch ? emailMatch[1].trim() : '';

    const webMatch = block.match(/<WEBSITE>([^<]+)<\/WEBSITE>/i);
    const website = webMatch ? webMatch[1].trim() : '';

    // GSTIN & PAN
    const gstinMatch = block.match(/<(?:GSTIN|PARTYGSTIN|VATREGISTRATIONNO)>([^<]+)<\/(?:GSTIN|PARTYGSTIN|VATREGISTRATIONNO)>/i);
    const gstin = gstinMatch ? gstinMatch[1].trim().toUpperCase() : '';

    const panMatch = block.match(/<(?:PANNUMBER|INCOMETAXNUMBER|PAN)>([^<]+)<\/(?:PANNUMBER|INCOMETAXNUMBER|PAN)>/i);
    let pan = panMatch ? panMatch[1].trim().toUpperCase() : '';
    if (!pan && gstin) {
      pan = extractPanFromGstin(gstin);
    }

    let stateCode = '';
    if (gstin) {
      stateCode = extractStateCodeFromGstin(gstin);
    }
    if (!stateCode && state) {
      stateCode = getStateCodeByName(state) || '07';
    }

    // Accounting Dates & Currency
    const fyMatch = block.match(/<(?:STARTINGFROM|BOOKSFROM)>([^<]+)<\/(?:STARTINGFROM|BOOKSFROM)>/i);
    const financialYearFrom = fyMatch ? fyMatch[1].trim() : '';

    const booksMatch = block.match(/<BOOKSFROM>([^<]+)<\/BOOKSFROM>/i);
    const booksBeginningFrom = booksMatch ? booksMatch[1].trim() : '';

    const currSymMatch = block.match(/<CURRENCYSYMBOL>([^<]+)<\/CURRENCYSYMBOL>/i);
    const currencySymbol = currSymMatch ? currSymMatch[1].trim() : '₹';

    const currFormalMatch = block.match(/<CURRENCYFORMALNAME>([^<]+)<\/CURRENCYFORMALNAME>/i);
    const currencyFormalName = currFormalMatch ? currFormalMatch[1].trim() : 'INR';

    const guidMatch = block.match(/<GUID>([^<]+)<\/GUID>/i);
    const tallyGuid = guidMatch ? guidMatch[1].trim() : '';

    // Bank Details
    const bankNameMatch = block.match(/<BANKNAME>([^<]+)<\/BANKNAME>/i);
    const bankName = bankNameMatch ? bankNameMatch[1].trim() : '';

    const bankAccMatch = block.match(/<(?:BANKACCOUNTNUMBER|BANKACCOUNTNO)>([^<]+)<\/(?:BANKACCOUNTNUMBER|BANKACCOUNTNO)>/i);
    const bankAccountNo = bankAccMatch ? bankAccMatch[1].trim() : '';

    const ifscMatch = block.match(/<(?:IFSCODE|BANKIFSC)>([^<]+)<\/(?:IFSCODE|BANKIFSC)>/i);
    const bankIfsc = ifscMatch ? ifscMatch[1].trim().toUpperCase() : '';

    companies.push({
      id: `comp-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name,
      tradeName: mailingName && mailingName !== name ? mailingName : undefined,
      mailingName: mailingName || name,
      address: address || '',
      pincode: pincode || '',
      state: state || 'Delhi',
      stateCode: stateCode || '07',
      country: country || 'India',
      phone: phone || mobile || '',
      mobile: mobile || '',
      email: email || '',
      website: website || '',
      gstin: gstin || '',
      pan: pan || '',
      financialYearFrom: financialYearFrom || '',
      booksBeginningFrom: booksBeginningFrom || '',
      currencySymbol: currencySymbol || '₹',
      currencyFormalName: currencyFormalName || 'INR',
      tallyGuid: tallyGuid || '',
      bankName: bankName || '',
      bankAccountNo: bankAccountNo || '',
      bankIfsc: bankIfsc || '',
    });
  });

  return companies;
}

/**
 * Parses Company profiles from Tally XML string or Document
 */
export function parseCompaniesXML(xmlInput: string | Document): SellerInfo[] {
  let doc: Document | null = null;
  if (typeof xmlInput === 'string') {
    try {
      doc = parseTallyXML(xmlInput);
    } catch {
      doc = null;
    }
  } else {
    doc = xmlInput;
  }

  let compElements: Element[] = [];
  if (doc) {
    compElements = Array.from(doc.getElementsByTagName('COMPANY'));
    if (compElements.length === 0) {
      // In some Tally responses, it's under <STATICVARIABLES><SVCURRENTCOMPANY>
      const svComp = doc.getElementsByTagName('SVCURRENTCOMPANY')[0];
      if (svComp && svComp.textContent && svComp.textContent.trim()) {
        const compName = svComp.textContent.trim();
        return [
          {
            id: `comp-tally-${Date.now()}`,
            name: compName,
            mailingName: compName,
            address: '',
            state: 'Delhi',
            stateCode: '07',
            country: 'India',
            phone: '',
            gstin: '',
            pan: '',
            isDefault: true,
          },
        ];
      }
    }
  }

  // If DOM parsing returned 0 companies and input is string, use regex extractor
  if (compElements.length === 0 && typeof xmlInput === 'string') {
    const regexCompanies = extractCompaniesWithRegex(xmlInput);
    if (regexCompanies.length > 0) return regexCompanies;
  }

  const companies: SellerInfo[] = [];

  compElements.forEach((comp, index) => {
    const name =
      getAttributeOrNode(comp, 'NAME', 'NAME') ||
      getNodeValue(comp, 'BASICCOMPANYNAME');
    if (!name) return;

    // Mailing name / formal name
    let mailingName = '';
    const mailingListNode = comp.getElementsByTagName('MAILINGNAME.LIST')[0];
    if (mailingListNode) {
      mailingName = getNodeValue(mailingListNode, 'MAILINGNAME');
    }
    if (!mailingName) {
      mailingName = getNodeValue(comp, 'MAILINGNAME') || getNodeValue(comp, 'BASICCOMPANYFORMALNAME') || name;
    }

    // Address extraction
    const addressNodes = comp.getElementsByTagName('ADDRESS');
    let fullAddress = '';
    if (addressNodes.length > 0) {
      const lines: string[] = [];
      for (let i = 0; i < addressNodes.length; i++) {
        const text = (addressNodes[i].textContent || '').trim();
        if (text) lines.push(text);
      }
      fullAddress = lines.join(', ');
    } else {
      fullAddress = getNodeValue(comp, 'ADDRESS');
    }

    const state = getNodeValue(comp, 'STATENAME') || getNodeValue(comp, 'STATE') || 'Delhi';
    const country = getNodeValue(comp, 'COUNTRYNAME') || getNodeValue(comp, 'COUNTRY') || 'India';
    let pincode = getNodeValue(comp, 'PINCODE');
    if (!pincode && fullAddress) {
      const pinMatch = fullAddress.match(/\b\d{6}\b/);
      if (pinMatch) pincode = pinMatch[0];
    }

    const phone =
      getNodeValue(comp, 'PHONENUMBER') ||
      getNodeValue(comp, 'TELEPHONENUMBER') ||
      getNodeValue(comp, 'PHONE');

    const mobile = getNodeValue(comp, 'MOBILENUMBER') || getNodeValue(comp, 'MOBILE');
    const email = getNodeValue(comp, 'EMAIL') || getNodeValue(comp, 'EMAILID');
    const website = getNodeValue(comp, 'WEBSITE');

    const gstin = (
      getNodeValue(comp, 'GSTIN') ||
      getNodeValue(comp, 'PARTYGSTIN') ||
      getNodeValue(comp, 'VATREGISTRATIONNO')
    ).toUpperCase();

    let pan = (
      getNodeValue(comp, 'PANNUMBER') ||
      getNodeValue(comp, 'INCOMETAXNUMBER') ||
      getNodeValue(comp, 'PAN')
    ).toUpperCase();

    if (!pan && gstin) {
      pan = extractPanFromGstin(gstin);
    }

    let stateCode = '';
    if (gstin) {
      stateCode = extractStateCodeFromGstin(gstin);
    }
    if (!stateCode && state) {
      stateCode = getStateCodeByName(state) || '07';
    }

    const financialYearFrom = getNodeValue(comp, 'STARTINGFROM');
    const booksBeginningFrom = getNodeValue(comp, 'BOOKSFROM');
    const currencySymbol = getNodeValue(comp, 'CURRENCYSYMBOL') || '₹';
    const currencyFormalName = getNodeValue(comp, 'CURRENCYFORMALNAME') || 'INR';
    const tallyGuid = getNodeValue(comp, 'GUID');

    const bankName = getNodeValue(comp, 'BANKNAME');
    const bankAccountNo = getNodeValue(comp, 'BANKACCOUNTNUMBER') || getNodeValue(comp, 'BANKACCOUNTNO');
    const bankIfsc = (getNodeValue(comp, 'IFSCODE') || getNodeValue(comp, 'BANKIFSC')).toUpperCase();

    companies.push({
      id: `comp-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name: name,
      tradeName: mailingName && mailingName !== name ? mailingName : undefined,
      mailingName: mailingName || name,
      address: fullAddress,
      pincode: pincode,
      state: state,
      stateCode: stateCode,
      country: country,
      phone: phone || mobile || '',
      mobile: mobile || '',
      email: email || '',
      website: website || '',
      gstin: gstin || '',
      pan: pan || '',
      financialYearFrom: financialYearFrom,
      booksBeginningFrom: booksBeginningFrom,
      currencySymbol: currencySymbol,
      currencyFormalName: currencyFormalName,
      tallyGuid: tallyGuid,
      bankName: bankName,
      bankAccountNo: bankAccountNo,
      bankIfsc: bankIfsc,
    });
  });

  // Fallback to regex if DOM gave 0
  if (companies.length === 0 && typeof xmlInput === 'string') {
    return extractCompaniesWithRegex(xmlInput);
  }

  // Deduplicate
  const unique: SellerInfo[] = [];
  const seen = new Set<string>();

  companies.forEach((comp) => {
    const key = comp.name.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(comp);
    }
  });

  return unique;
}

/**
 * Generates standard Tally Prime Sales Voucher XML for seamless import
 */
export function generateTallySalesVoucherXML(invoice: Invoice, companyName = ''): string {
  // Tally Prime Item Invoice / Accounting Invoice mode.
  const voucherDate = formatInvoiceDateForTally(invoice.invoiceDate);

  const isInterState = Boolean(invoice.isInterState);

  // One inventory row per portal invoice item. Each row carries stock item,
  // quantity, rate and taxable amount, so Tally opens it as an Item Invoice.
  const inventoryEntriesXML = (invoice.items || []).map(item => {
    // Tally Item Invoice: quantity/rate are ALWAYS sent explicitly and positively.
    // Credit-side amounts remain negative in Tally XML; this is the accounting sign,
    // not a negative quantity/rate. Never derive quantity/rate from the amount.
    const qty = Math.abs(Number(item.qty)) || 1;
    const rate = Math.abs(Number(item.rate)) || 0;
    const amount = +(qty * rate).toFixed(2);
    const unit = item.unit || 'Nos';

    return `
        <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${xmlEscape(item.name)}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
            <ISINVENTORYAFFECTED>Yes</ISINVENTORYAFFECTED>
            <RATE>${rate.toFixed(2)}/${xmlEscape(unit)}</RATE>
            <ACTUALQTY>${qty.toFixed(3)} ${xmlEscape(unit)}</ACTUALQTY>
            <BILLEDQTY>${qty.toFixed(3)} ${xmlEscape(unit)}</BILLEDQTY>
            <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales Account</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`;
  }).join('\\n');

  let additionalExpensesXML = '';
  if (invoice.freightAmount && invoice.freightAmount > 0) {
    additionalExpensesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Freight &amp; Forwarding Charges</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${invoice.freightAmount.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  }
  if (invoice.labourAmount && invoice.labourAmount > 0) {
    additionalExpensesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Labour &amp; Handling Charges</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${invoice.labourAmount.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  }
  if (invoice.otherExpenseAmount && invoice.otherExpenseAmount > 0) {
    const expenseLabel = invoice.otherExpenseLabel || 'Other Charges / Expenses';
    additionalExpensesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(expenseLabel)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${invoice.otherExpenseAmount.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  }

  let taxEntriesXML = '';
  if (isInterState) {
    if (invoice.totalIgst > 0) {
      taxEntriesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output IGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${invoice.totalIgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
  } else {
    if (invoice.totalCgst > 0) {
      taxEntriesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${invoice.totalCgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
    if (invoice.totalSgst > 0) {
      taxEntriesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${invoice.totalSgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
  }

  let roundOffXML = '';
  if (invoice.roundOff !== 0) {
    roundOffXML = `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Round Off</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${invoice.roundOff > 0 ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
            <AMOUNT>${(-invoice.roundOff).toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
  }

  return `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Vouchers</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </DESC>
        <DATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <VOUCHER VCHTYPE="Portal" ACTION="Create" OBJVIEW="Invoice Voucher View">
                    <DATE>${voucherDate}</DATE>
                    <EFFECTIVEDATE>${voucherDate}</EFFECTIVEDATE>
                    <VOUCHERTYPENAME>Portal</VOUCHERTYPENAME>
                    <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>
                    <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
                    <OBJVIEW>Invoice Voucher View</OBJVIEW>
                    <VOUCHERNUMBER>${xmlEscape(invoice.invoiceNo)}</VOUCHERNUMBER>
                    <REFERENCE>${xmlEscape(invoice.invoiceNo)}</REFERENCE>
                    <PARTYLEDGERNAME>${xmlEscape(invoice.partyName)}</PARTYLEDGERNAME>
                    <PARTYNAME>${xmlEscape(invoice.partyName)}</PARTYNAME>
                    <PLACEOFSUPPLY>${xmlEscape(invoice.partyState || invoice.sellerState)}</PLACEOFSUPPLY>
                    <PARTYGSTIN>${xmlEscape(invoice.gstin)}</PARTYGSTIN>
                    <STATENAME>${xmlEscape(invoice.partyState)}</STATENAME>
                    <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
                    <ISINVOICE>Yes</ISINVOICE>
                    <NARRATION>${xmlEscape(invoice.notes || `Tax Invoice ${invoice.invoiceNo}`)}</NARRATION>

                    <LEDGERENTRIES.LIST>
                        <LEDGERNAME>${xmlEscape(invoice.partyName)}</LEDGERNAME>
                        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                        <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                        <AMOUNT>-${invoice.grandTotal.toFixed(2)}</AMOUNT>
                        <BILLALLOCATIONS.LIST>
                            <NAME>${xmlEscape(invoice.invoiceNo)}</NAME>
                            <BILLTYPE>New Ref</BILLTYPE>
                            <AMOUNT>-${invoice.grandTotal.toFixed(2)}</AMOUNT>
                        </BILLALLOCATIONS.LIST>
                    </LEDGERENTRIES.LIST>

                    ${inventoryEntriesXML}
                    ${additionalExpensesXML}
                    ${taxEntriesXML}
                    ${roundOffXML}
                </VOUCHER>
            </TALLYMESSAGE>
        </DATA>
    </BODY>
</ENVELOPE>`;
}
/**
 * Generates XML for pushing or downloading a Party (Debtor Ledger) into Tally
 */
export function generateTallyLedgerXML(party: Party, action: 'Create' | 'Alter' = 'Create'): string {
  return `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>All Masters</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
        </DESC>
        <DATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <LEDGER NAME="${xmlEscape(party.name)}" ACTION="${action}">
                    <NAME>${xmlEscape(party.name)}</NAME>
                    <PARENT>Sundry Debtors</PARENT>
                    <ISBILLWISEON>Yes</ISBILLWISEON>
                    <MAILINGNAME>${xmlEscape(party.name)}</MAILINGNAME>
                    <ADDRESS.LIST>
                        <ADDRESS>${xmlEscape(party.address)}</ADDRESS>
                    </ADDRESS.LIST>
                    <STATENAME>${xmlEscape(party.state)}</STATENAME>
                    <PINCODE>${xmlEscape(party.pin)}</PINCODE>
                    <COUNTRYNAME>${xmlEscape(party.country || 'India')}</COUNTRYNAME>
                    <LEDGERPHONE>${xmlEscape(party.mobile)}</LEDGERPHONE>
                    <LEDGERMOBILE>${xmlEscape(party.mobile)}</LEDGERMOBILE>
                    <INCOMETAXNUMBER>${xmlEscape(party.pan)}</INCOMETAXNUMBER>
                    <GSTREGISTRATIONTYPE>${xmlEscape(party.registration_type || 'Regular')}</GSTREGISTRATIONTYPE>
                    <PARTYGSTIN>${xmlEscape(party.gstin)}</PARTYGSTIN>
                    <GSTIN>${xmlEscape(party.gstin)}</GSTIN>
                </LEDGER>
            </TALLYMESSAGE>
        </DATA>
    </BODY>
</ENVELOPE>`;
}

/**
 * Generates XML for pushing or downloading a Stock Item into Tally Prime
 */
export function generateTallyStockItemXML(item: StockItem, action: 'Create' | 'Alter' = 'Create'): string {
  return `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>All Masters</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
        </DESC>
        <DATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <STOCKITEM NAME="${xmlEscape(item.name)}" ACTION="${action}">
                    <NAME>${xmlEscape(item.name)}</NAME>
                    <BASEUNITS>${xmlEscape(item.unit || 'Nos')}</BASEUNITS>
                    <OPENINGRATE>${item.rate || 0}</OPENINGRATE>
                    <STANDARDCOST>${item.rate || 0}</STANDARDCOST>
                    <DESCRIPTION>${xmlEscape(item.description || '')}</DESCRIPTION>
                    <GSTDETAILS.LIST>
                        <APPLICABLEFROM>20170701</APPLICABLEFROM>
                        <TAXABILITY>Taxable</TAXABILITY>
                        <HSNCODE>${xmlEscape(item.hsn || '')}</HSNCODE>
                        <GSTRATE>${Number(item.gst) || 18}</GSTRATE>
                        <IGSTRATE>${Number(item.gst) || 18}</IGSTRATE>
                        <CGSTRATE>${(Number(item.gst) || 18) / 2}</CGSTRATE>
                        <SGSTRATE>${(Number(item.gst) || 18) / 2}</SGSTRATE>
                    </GSTDETAILS.LIST>
                </STOCKITEM>
            </TALLYMESSAGE>
        </DATA>
    </BODY>
</ENVELOPE>`;
}

/**
 * Push a Portal Debtor to the currently open Tally company.
 * Creates it first; if it already exists, retries as Alter.
 */
export async function syncPartyToTally(
  party: Party,
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<{ success: boolean; message: string; responseXml?: string }> {
  const createXml = generateTallyLedgerXML(party, 'Create');
  const first = await sendTallyRequest(createXml, config);
  const created = /<CREATED>\s*[1-9]\d*\s*<\/CREATED>/i.test(first.text);
  const errors = /<LINEERROR>|<ERRORS>\s*[1-9]\d*\s*<\/ERRORS>/i.test(first.text);
  if (created && !errors) return { success: true, message: 'Debtor created in Tally Prime', responseXml: first.text };

  const alterXml = generateTallyLedgerXML(party, 'Alter');
  const second = await sendTallyRequest(alterXml, config);
  const altered = /<ALTERED>\s*[1-9]\d*\s*<\/ALTERED>/i.test(second.text);
  if (altered && !/<LINEERROR>|<ERRORS>\s*[1-9]\d*\s*<\/ERRORS>/i.test(second.text)) {
    return { success: true, message: 'Debtor updated in Tally Prime', responseXml: second.text };
  }
  const line = (second.text.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i) || first.text.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i))?.[1];
  return { success: false, message: line || 'Tally did not create/update the debtor', responseXml: second.text || first.text };
}

/**
 * Push a Portal Stock Item to the currently open Tally company.
 * Creates it first; if it already exists, retries as Alter.
 */
export async function syncStockItemToTally(
  item: StockItem,
  config: TallyConfig = DEFAULT_TALLY_CONFIG
): Promise<{ success: boolean; message: string; responseXml?: string }> {
  const createXml = generateTallyStockItemXML(item, 'Create');
  const first = await sendTallyRequest(createXml, config);
  const created = /<CREATED>\s*[1-9]\d*\s*<\/CREATED>/i.test(first.text);
  const errors = /<LINEERROR>|<ERRORS>\s*[1-9]\d*\s*<\/ERRORS>/i.test(first.text);
  if (created && !errors) return { success: true, message: 'Stock Item created in Tally Prime', responseXml: first.text };

  const alterXml = generateTallyStockItemXML(item, 'Alter');
  const second = await sendTallyRequest(alterXml, config);
  const altered = /<ALTERED>\s*[1-9]\d*\s*<\/ALTERED>/i.test(second.text);
  if (altered && !/<LINEERROR>|<ERRORS>\s*[1-9]\d*\s*<\/ERRORS>/i.test(second.text)) {
    return { success: true, message: 'Stock Item updated in Tally Prime', responseXml: second.text };
  }
  const line = (second.text.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i) || first.text.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i))?.[1];
  return { success: false, message: line || 'Tally did not create/update the stock item', responseXml: second.text || first.text };
}

/**
 * Formats various Tally date string representations to standard ISO YYYY-MM-DD
 */
export function formatTallyDateToIso(rawDate: string): string {
  // Never replace a missing/invalid source date with today's date.
  const clean = String(rawDate || '').trim();
  if (!clean) return '';

  let year = '', month = '', day = '';
  // Tally's canonical format: YYYYMMDD (e.g. 20260401).
  let match = clean.match(/^(\\d{4})(\\d{2})(\\d{2})$/);
  if (match) [, year, month, day] = match;
  // ISO: YYYY-MM-DD (optional timestamp suffix).
  if (!match) {
    match = clean.match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:T.*)?$/);
    if (match) [, year, month, day] = match;
  }
  // Local numeric date: DD/MM/YYYY or DD-MM-YYYY.
  if (!match) {
    match = clean.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})$/);
    if (match) {
      day = match[1].padStart(2, '0');
      month = match[2].padStart(2, '0');
      year = match[3];
    }
  }
  // DD-MMM-YYYY or DD-MMM-YY (e.g. 01-Apr-2026).
  if (!match) {
    match = clean.match(/^(\\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\\d{2,4})$/);
    if (match) {
      day = match[1].padStart(2, '0');
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      month = months[match[2].toLowerCase()] || '';
      year = match[3].length === 2 ? '20' + match[3] : match[3];
    }
  }
  if (!year || !month || !day) return '';
  const y = Number(year), m = Number(month), d = Number(day);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return '';
  return `${year}-${month}-${day}`;
}

export interface ParsedVouchersResult {
  invoices: Invoice[];
  extractedParties: Party[];
  extractedItems: StockItem[];
}

/**
 * Regex-based Sales Voucher extractor for raw, malformed, or stream-copied Tally XML
 */
function extractSalesVouchersWithRegex(rawXml: string, sellerInfo?: SellerInfo): ParsedVouchersResult {
  const parsedInvoices: Invoice[] = [];
  const extractedParties: Party[] = [];
  const extractedItems: StockItem[] = [];
  const clean = sanitizeXmlString(rawXml);

  const voucherBlocks = clean.match(/<VOUCHER\b[\s\S]*?<\/VOUCHER>/gi) || [];

  voucherBlocks.forEach((block, idx) => {
    const vchTypeMatch = block.match(/<(?:VOUCHERTYPENAME|VCHTYPE)[^>]*>([^<]+)<\/(?:VOUCHERTYPENAME|VCHTYPE)>/i) ||
      block.match(/VCHTYPE="([^"]+)"/i);
    const vchType = vchTypeMatch ? vchTypeMatch[1].trim() : 'Sales';

    // Extract invoice number and date. Never synthesize fake TALLY-INV-N records.
    const noMatch = block.match(/<(?:VOUCHERNUMBER|REFERENCE|VCHNO)>([^<]+)<\/(?:VOUCHERNUMBER|REFERENCE|VCHNO)>/i);
    const invoiceNo = noMatch ? noMatch[1].trim() : '';
    const dateMatch = block.match(/<DATE>([^<]+)<\/DATE>/i);
    const invoiceDate = formatTallyDateToIso(dateMatch ? dateMatch[1].trim() : '');
    if (!invoiceNo || !invoiceDate) return;


    // Party Name
    const partyMatch = block.match(/<(?:PARTYLEDGERNAME|PARTYNAME|BASICBUYERNAME)>([^<]+)<\/(?:PARTYLEDGERNAME|PARTYNAME|BASICBUYERNAME)>/i);
    const partyName = partyMatch ? partyMatch[1].trim() : 'Cash Customer';

    // Party GSTIN
    const gstinMatch = block.match(/<(?:PARTYGSTIN|GSTIN)>([^<]+)<\/(?:PARTYGSTIN|GSTIN)>/i);
    const partyGstin = gstinMatch ? gstinMatch[1].trim().toUpperCase() : '';

    // State
    const stateMatch = block.match(/<(?:STATENAME|PLACEOFSUPPLY|STATE)>([^<]+)<\/(?:STATENAME|PLACEOFSUPPLY|STATE)>/i);
    const partyState = stateMatch ? stateMatch[1].trim() : sellerInfo?.state || 'Delhi';
    const partyStateCode = partyGstin ? extractStateCodeFromGstin(partyGstin) : (getStateCodeByName(partyState) || '07');

    // Address
    const addrMatches = block.match(/<(?:ADDRESS|BASICBUYERADDRESS)>([^<]+)<\/(?:ADDRESS|BASICBUYERADDRESS)>/gi) || [];
    const address = addrMatches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join(', ');

    // Narration / Notes
    const narrMatch = block.match(/<NARRATION>([^<]+)<\/NARRATION>/i);
    const notes = narrMatch ? narrMatch[1].trim() : '';

    // GUID & MasterID
    const guidMatch = block.match(/<GUID>([^<]+)<\/GUID>/i);
    const tallyGuid = guidMatch ? guidMatch[1].trim() : '';

    const masterIdMatch = block.match(/<MASTERID>([^<]+)<\/MASTERID>/i);
    const tallyMasterId = masterIdMatch ? masterIdMatch[1].trim() : '';

    // Inventory items
    const invEntries = block.match(/<ALLINVENTORYENTRIES\.LIST[\s\S]*?<\/ALLINVENTORYENTRIES\.LIST>/gi) || [];
    const items: InvoiceItemRow[] = [];

    invEntries.forEach((itemBlock, itemIdx) => {
      const nameMatch = itemBlock.match(/<STOCKITEMNAME>([^<]+)<\/STOCKITEMNAME>/i);
      const name = nameMatch ? nameMatch[1].trim() : `Item ${itemIdx + 1}`;

      const rateMatch = itemBlock.match(/<RATE>([^<]+)<\/RATE>/i);
      let rate = 0;
      let unit = 'Nos';
      if (rateMatch) {
        const rateParts = rateMatch[1].split('/');
        rate = Math.abs(parseFloat(rateParts[0])) || 0;
        if (rateParts[1]) unit = rateParts[1].trim();
      }

      const qtyMatch = itemBlock.match(/<(?:BILLEDQTY|ACTUALQTY)>([^<]+)<\/(?:BILLEDQTY|ACTUALQTY)>/i);
      let qty = 1;
      if (qtyMatch) {
        const qm = qtyMatch[1].match(/^([\d.]+)\s*(.*)$/);
        if (qm) {
          qty = parseFloat(qm[1]) || 1;
          if (qm[2] && !unit) unit = qm[2].trim();
        }
      }

      const amtMatch = itemBlock.match(/<AMOUNT>([^<]+)<\/AMOUNT>/i);
      const amount = amtMatch ? Math.abs(parseFloat(amtMatch[1])) || 0 : (rate * qty);

      // Default 18% standard GST if not extracted
      // Use GST rate and HSN from the voucher's item-level Tally metadata.
      const rateDetailsText = itemBlock.match(/<RATEDETAILS\.LIST[\s\S]*?<\/RATEDETAILS\.LIST>/gi) || [];
      const rateValues = rateDetailsText.flatMap(detail => {
        const match = detail.match(/<GSTRATE[^>]*>([^<]+)<\/GSTRATE>/i);
        const value = match ? Number(match[1]) : 0;
        return Number.isFinite(value) && value > 0 ? [value] : [];
      });
      const gstRate = rateValues.length ? Math.max(...rateValues) : 18;
      const hsnMatch = itemBlock.match(/<(?:GSTHSNNAME|HSNSACCODE|HSNCODE|HSN)[^>]*>([^<]+)<\/(?:GSTHSNNAME|HSNSACCODE|HSNCODE|HSN)>/i);
      const hsn = hsnMatch ? hsnMatch[1].trim() : '';
      const isInter = partyState.toLowerCase() !== (sellerInfo?.state || 'Delhi').toLowerCase();
      const cgst = isInter ? 0 : (amount * (gstRate / 2)) / 100;
      const sgst = isInter ? 0 : (amount * (gstRate / 2)) / 100;
      const igst = isInter ? (amount * gstRate) / 100 : 0;
      const total = amount + cgst + sgst + igst;

      const itemRow: InvoiceItemRow = {
        id: `row-tally-${idx + 1}-${itemIdx + 1}`,
        name,
        hsn,
        qty,
        unit: unit || 'Nos',
        rate: rate || (qty > 0 ? amount / qty : 0),
        discountPercent: 0,
        gstRate,
        taxableAmount: amount,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: total,
      };

      items.push(itemRow);

      // Auto-extract item master
      extractedItems.push({
        id: `item-auto-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        name,
        hsn,
        gst: gstRate,
        unit: unit || 'Nos',
        rate: rate || 0,
      });
    });

    // If no inventory entries (e.g. accounting voucher), extract from ledger entries
    if (items.length === 0) {
      const ledgerEntries = block.match(/<LEDGERENTRIES\.LIST[\s\S]*?<\/LEDGERENTRIES\.LIST>/gi) || [];
      let primaryAmount = 0;

      ledgerEntries.forEach((lBlock) => {
        const lNameMatch = lBlock.match(/<LEDGERNAME>([^<]+)<\/LEDGERNAME>/i);
        const lAmtMatch = lBlock.match(/<AMOUNT>([^<]+)<\/AMOUNT>/i);
        if (lNameMatch && lAmtMatch) {
          const lName = lNameMatch[1].trim();
          const lAmt = parseFloat(lAmtMatch[1]);
          // Sales account or non-party credit
          if (!lName.toLowerCase().includes('gst') && lAmt < 0) {
            primaryAmount += Math.abs(lAmt);
          }
        }
      });

      if (primaryAmount === 0) {
        const anyAmtMatch = block.match(/<AMOUNT>([^<]+)<\/AMOUNT>/i);
        primaryAmount = anyAmtMatch ? Math.abs(parseFloat(anyAmtMatch[1])) : 1000;
      }

      items.push({
        id: `row-tally-${idx + 1}-1`,
        name: 'Sales / Professional Services',
        hsn: '998313',
        qty: 1,
        unit: 'Nos',
        rate: primaryAmount,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: primaryAmount,
        cgstAmount: primaryAmount * 0.09,
        sgstAmount: primaryAmount * 0.09,
        igstAmount: 0,
        totalAmount: primaryAmount * 1.18,
      });
    }

    // Auto-extract Party
    if (partyName && partyName !== 'Cash Customer') {
      extractedParties.push({
        id: `party-auto-${partyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        name: partyName,
        address: address || '',
        pin: partyGstin ? '' : '110001',
        mobile: '',
        gstin: partyGstin,
        state: partyState,
        state_code: partyStateCode,
        city: partyState,
        pan: partyGstin ? extractPanFromGstin(partyGstin) : '',
        registration_type: partyGstin ? 'Regular' : 'Unregistered',
        country: 'India',
      });
    }

    const isInterState = partyState.toLowerCase() !== (sellerInfo?.state || 'Delhi').toLowerCase();
    const subtotalTaxable = items.reduce((acc, it) => acc + it.taxableAmount, 0);
    const totalCgst = items.reduce((acc, it) => acc + it.cgstAmount, 0);
    const totalSgst = items.reduce((acc, it) => acc + it.sgstAmount, 0);
    const totalIgst = items.reduce((acc, it) => acc + it.igstAmount, 0);
    const totalTax = totalCgst + totalSgst + totalIgst;
    const rawTotal = subtotalTaxable + totalTax;
    const grandTotal = Math.round(rawTotal);
    const roundOff = +(grandTotal - rawTotal).toFixed(2);

    parsedInvoices.push({
      id: `inv-tally-${idx + 1}-${invoiceNo.replace(/[^a-zA-Z0-9]/g, '')}`,
      invoiceNo,
      invoiceDate,
      partyName,
      gstin: partyGstin,
      mobile: '',
      partyState,
      stateCode: partyStateCode,
      pinCode: '',
      city: partyState,
      completeAddress: address,
      pan: partyGstin ? extractPanFromGstin(partyGstin) : '',
      registrationType: partyGstin ? 'Regular' : 'Unregistered',
      sellerName: sellerInfo?.name || 'My Company',
      sellerGstin: sellerInfo?.gstin || '',
      sellerState: sellerInfo?.state || 'Delhi',
      sellerStateCode: sellerInfo?.stateCode || '07',
      sellerAddress: sellerInfo?.address || '',
      sellerPhone: sellerInfo?.phone || '',
      isInterState,
      items,
      subtotalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff,
      grandTotal,
      amountInWords: numberToIndianWords(grandTotal),
      notes: notes || `Imported from Tally Prime (Voucher: ${invoiceNo})`,
      tallySyncStatus: 'synced',
      tallySyncDate: new Date().toISOString(),
      tallyGuid,
      tallyMasterId,
      tallyVoucherType: vchType,
      source: vchType.trim().toLowerCase() === 'portal' ? 'portal' : 'tally_import',
      isDuplicateProtected: true,
      createdAt: new Date().toISOString(),
    });
  });

  return {
    invoices: parsedInvoices,
    extractedParties,
    extractedItems,
  };
}

/**
 * Parses Sales Vouchers (Invoices) from Tally XML string or Document
 */
export function parseSalesVouchersXML(xmlInput: string | Document, sellerInfo?: SellerInfo): ParsedVouchersResult {
  let doc: Document | null = null;
  if (typeof xmlInput === 'string') {
    try {
      doc = parseTallyXML(xmlInput);
    } catch {
      doc = null;
    }
  } else {
    doc = xmlInput;
  }

  let voucherElements: Element[] = [];
  if (doc) {
    voucherElements = Array.from(doc.getElementsByTagName('VOUCHER'));
  }

  // If DOM parsing gave 0 vouchers, fallback to regex extractor
  if (voucherElements.length === 0 && typeof xmlInput === 'string') {
    return extractSalesVouchersWithRegex(xmlInput, sellerInfo);
  }

  const invoices: Invoice[] = [];
  const extractedParties: Party[] = [];
  const extractedItems: StockItem[] = [];

  voucherElements.forEach((vch, index) => {
    const vchType = getAttributeOrNode(vch, 'VCHTYPE', 'VOUCHERTYPENAME') || 'Sales';
    
    // Extract invoice number
    const invoiceNo = getNodeValue(vch, 'VOUCHERNUMBER') || getNodeValue(vch, 'REFERENCE');

    // Never fabricate invoice numbers/dates for incomplete Tally voucher shells.
    // This previously created fake TALLY-INV-N bills with a default ₹1,000 taxable amount.
    const rawDate = getNodeValue(vch, 'DATE');
    const invoiceDate = formatTallyDateToIso(rawDate);
    if (!invoiceNo.trim() || !invoiceDate) {
      console.warn('Skipping incomplete Tally voucher response: missing invoice number or date.');
      return;
    }

    // Party Details
    const partyName = getNodeValue(vch, 'PARTYLEDGERNAME') || getNodeValue(vch, 'PARTYNAME') || getNodeValue(vch, 'BASICBUYERNAME') || 'Cash Customer';
    const partyGstin = (getNodeValue(vch, 'PARTYGSTIN') || getNodeValue(vch, 'GSTIN')).toUpperCase();
    const partyState = getNodeValue(vch, 'STATENAME') || getNodeValue(vch, 'PLACEOFSUPPLY') || sellerInfo?.state || 'Delhi';
    const stateCode = partyGstin ? extractStateCodeFromGstin(partyGstin) : (getStateCodeByName(partyState) || '07');
    
    // Address
    const addressNodes = vch.getElementsByTagName('ADDRESS');
    let address = '';
    if (addressNodes.length > 0) {
      const lines: string[] = [];
      for (let i = 0; i < addressNodes.length; i++) {
        const text = (addressNodes[i].textContent || '').trim();
        if (text) lines.push(text);
      }
      address = lines.join(', ');
    } else {
      address = getNodeValue(vch, 'BASICBUYERADDRESS') || getNodeValue(vch, 'ADDRESS');
    }

    const narration = getNodeValue(vch, 'NARRATION');
    const tallyGuid = getNodeValue(vch, 'GUID');
    const tallyMasterId = getNodeValue(vch, 'MASTERID');

    // Extract Inventory Items
    // Tally Prime may emit inventory lines under either collection name
    // depending on the report/view used for export.
    const inventoryNodes = [
      ...Array.from(vch.getElementsByTagName('ALLINVENTORYENTRIES.LIST')),
      ...Array.from(vch.getElementsByTagName('INVENTORYENTRIES.LIST')),
    ].filter((node, nodeIndex, all) => all.indexOf(node) === nodeIndex);
    const items: InvoiceItemRow[] = [];

    inventoryNodes.forEach((invNode, itemIndex) => {
      const itemName = getNodeValue(invNode, 'STOCKITEMNAME') || `Item ${itemIndex + 1}`;
      
      // Parse Qty and Unit
      const rawQty = getNodeValue(invNode, 'ACTUALQTY') || getNodeValue(invNode, 'BILLEDQTY');
      let qty = 1;
      let unit = 'Nos';
      if (rawQty) {
        // Tally may return quantity as "2 Nos", "2.000 PCS" or with extra
        // formatting. Always preserve the numeric quantity and unit separately.
        const match = rawQty.trim().match(/^(-?[\d,]+(?:\.\d+)?)\s*(.*)$/);
        if (match) {
          const parsedQty = Number(match[1].replace(/,/g, ''));
          if (Number.isFinite(parsedQty) && parsedQty !== 0) qty = Math.abs(parsedQty);
          if (match[2]?.trim()) unit = match[2].trim();
        }
      }

      // Parse Rate. Tally can return values such as "500/Nos", "500.00 / PCS"
      // or currency-formatted text. Do not let parseFloat() turn a formatted rate
      // into zero; the invoice must retain the actual Qty + Rate from Tally.
      const rawRate = getNodeValue(invNode, 'RATE');
      let rate = 0;
      if (rawRate) {
        const rParts = rawRate.split('/');
        const numericRate = rParts[0].replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
        if (numericRate) {
          const parsedRate = Number(numericRate[0]);
          if (Number.isFinite(parsedRate)) rate = Math.abs(parsedRate);
        }
        if (rParts[1]?.trim()) unit = rParts[1].trim();
      }

      // Some Tally exports expose the rate through RATEOFVATTAX or another
      // numeric child while RATE is empty. Never lose the rate when the amount
      // and quantity are available.
      if (!rate && qty > 0) {
        const fallbackAmount = Math.abs(Number(getNodeValue(invNode, 'AMOUNT')) || 0);
        if (fallbackAmount > 0) rate = +(fallbackAmount / qty).toFixed(2);
      }

      // Parse Amount (Credit in sales is negative in Tally XML)
      const rawAmt = getNodeValue(invNode, 'AMOUNT');
      const amount = rawAmt ? Math.abs(parseFloat(rawAmt)) : (rate * qty);

      const gstRate = 18;
      const isInter = partyState.toLowerCase() !== (sellerInfo?.state || 'Delhi').toLowerCase();
      const cgst = isInter ? 0 : (amount * (gstRate / 2)) / 100;
      const sgst = isInter ? 0 : (amount * (gstRate / 2)) / 100;
      const igst = isInter ? (amount * gstRate) / 100 : 0;
      const total = amount + cgst + sgst + igst;

      items.push({
        id: `row-tally-${index + 1}-${itemIndex + 1}`,
        name: itemName,
        hsn: '84713010',
        qty,
        unit: unit || 'Nos',
        rate: rate || (qty > 0 ? +(amount / qty).toFixed(2) : 0),
        discountPercent: 0,
        gstRate,
        taxableAmount: amount,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: total,
      });

      extractedItems.push({
        id: `item-auto-${itemName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        name: itemName,
        hsn: '84713010',
        gst: gstRate,
        unit: unit || 'Nos',
        rate: rate || 0,
      });
    });

    // If no inventory entries, check ledger allocations
    if (items.length === 0) {
      const ledgerNodes = Array.from(vch.getElementsByTagName('LEDGERENTRIES.LIST'));
      let primaryAmt = 0;
      ledgerNodes.forEach(lNode => {
        const lName = getNodeValue(lNode, 'LEDGERNAME');
        const lAmtStr = getNodeValue(lNode, 'AMOUNT');
        if (lAmtStr && !lName.toLowerCase().includes('gst')) {
          const lAmt = parseFloat(lAmtStr);
          if (lAmt < 0) primaryAmt += Math.abs(lAmt);
        }
      });

      if (primaryAmt === 0) {
        const anyAmt = getNodeValue(vch, 'AMOUNT');
        primaryAmt = anyAmt ? Math.abs(parseFloat(anyAmt)) : 0;
      }

      items.push({
        id: `row-tally-${index + 1}-1`,
        name: 'Sales / Services Provided',
        hsn: '998313',
        qty: 1,
        unit: 'Nos',
        rate: primaryAmt,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: primaryAmt,
        cgstAmount: primaryAmt * 0.09,
        sgstAmount: primaryAmt * 0.09,
        igstAmount: 0,
        totalAmount: primaryAmt * 1.18,
      });
    }

    if (partyName && partyName !== 'Cash Customer') {
      extractedParties.push({
        id: `party-auto-${partyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        name: partyName,
        address: address || '',
        pin: '110001',
        mobile: '',
        gstin: partyGstin,
        state: partyState,
        state_code: stateCode,
        city: partyState,
        pan: partyGstin ? extractPanFromGstin(partyGstin) : '',
        registration_type: partyGstin ? 'Regular' : 'Unregistered',
        country: 'India',
      });
    }

    const isInterState = partyState.toLowerCase() !== (sellerInfo?.state || 'Delhi').toLowerCase();
    const subtotalTaxable = items.reduce((acc, it) => acc + it.taxableAmount, 0);
    const totalCgst = items.reduce((acc, it) => acc + it.cgstAmount, 0);
    const totalSgst = items.reduce((acc, it) => acc + it.sgstAmount, 0);
    const totalIgst = items.reduce((acc, it) => acc + it.igstAmount, 0);
    const totalTax = totalCgst + totalSgst + totalIgst;
    const rawTotal = subtotalTaxable + totalTax;
    const grandTotal = Math.round(rawTotal);
    const roundOff = +(grandTotal - rawTotal).toFixed(2);

    invoices.push({
      id: `inv-tally-${index + 1}-${invoiceNo.replace(/[^a-zA-Z0-9]/g, '')}`,
      invoiceNo,
      invoiceDate,
      partyName,
      gstin: partyGstin,
      mobile: '',
      partyState,
      stateCode,
      pinCode: '',
      city: partyState,
      completeAddress: address,
      pan: partyGstin ? extractPanFromGstin(partyGstin) : '',
      registrationType: partyGstin ? 'Regular' : 'Unregistered',
      sellerName: sellerInfo?.name || 'My Company',
      sellerGstin: sellerInfo?.gstin || '',
      sellerState: sellerInfo?.state || 'Delhi',
      sellerStateCode: sellerInfo?.stateCode || '07',
      sellerAddress: sellerInfo?.address || '',
      sellerPhone: sellerInfo?.phone || '',
      isInterState,
      items,
      subtotalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff,
      grandTotal,
      amountInWords: numberToIndianWords(grandTotal),
      notes: narration || `Imported from Tally Prime (Voucher: ${invoiceNo})`,
      tallySyncStatus: 'synced',
      tallySyncDate: new Date().toISOString(),
      tallyGuid,
      tallyMasterId,
      tallyVoucherType: vchType,
      source: 'tally_import',
      isDuplicateProtected: true,
      createdAt: new Date().toISOString(),
    });
  });

  return {
    invoices,
    extractedParties,
    extractedItems,
  };
}

/**
 * Direct Live API to fetch Sales Vouchers from Tally Prime in safe sequential
 * 31-day batches. Defaults to the company's books beginning date, falling back
 * to the current FY only when Tally company dates are unavailable.
 */
export async function fetchSalesVouchersFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  sellerInfo?: SellerInfo,
  fromDate?: string,
  toDate?: string
): Promise<ParsedVouchersResult> {
  const parseIsoDate = (value?: string): Date | null => {
    const raw = String(value || '').trim();
    let m = raw.match(/^(\d{4})[-/ ]?(\d{2})[-/ ]?(\d{2})$/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) return d;
    }
    m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      if (d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1])) return d;
    }
    const parsed = new Date(raw);
    return raw && !Number.isNaN(parsed.getTime()) ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null;
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => String(d.getFullYear()) + pad(d.getMonth() + 1) + pad(d.getDate());
  const iso = (d: Date) => String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const selectedFrom = parseIsoDate(fromDate);
  const selectedTo = parseIsoDate(toDate);
  if ((fromDate || toDate) && (!selectedFrom || !selectedTo)) throw new Error('Invalid From Date/To Date. Please select valid dates.');
  if (selectedFrom && selectedTo && selectedFrom.getTime() > selectedTo.getTime()) throw new Error('From Date cannot be after To Date.');

  const fy = getCurrentFinancialYearRange();
  const rangeFrom = selectedFrom || parseIsoDate(fy.start)!;
  const rangeTo = selectedTo || new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  if (rangeFrom.getTime() > rangeTo.getTime()) throw new Error('Invoice import start date is after end date.');

  // First try the lightweight native query; if it returns no valid invoices, retry
  // with a date-bounded fallback that fetches invoice fields and inventory lines only.
  const boundedSalesFallback = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>PortalSalesInvoicesBoundedFallback</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT><SVViewName>Accounting Voucher View</SVViewName><SVCURRENTCOMPANY>__PORTAL_COMPANY__</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><SYSTEM TYPE="Formulae" NAME="PortalSalesInRange">$$And:$$IsSales:$VoucherTypeName:$$IsBetween:$Date:##SVFROMDATE:##SVTODATE</SYSTEM><COLLECTION NAME="PortalSalesInvoicesBoundedFallback" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes"><TYPE>Voucher</TYPE><FILTER>PortalSalesInRange</FILTER><FETCH>GUID,MASTERID,DATE,VOUCHERNUMBER,VOUCHERTYPENAME,PARTYLEDGERNAME,PARTYNAME,PARTYGSTIN,GSTIN,PLACEOFSUPPLY,STATENAME,BASICBUYERNAME,BASICBUYERADDRESS,NARRATION,AMOUNT</FETCH><FETCH>ALLINVENTORYENTRIES.STOCKITEMNAME,ALLINVENTORYENTRIES.BILLEDQTY,ALLINVENTORYENTRIES.ACTUALQTY,ALLINVENTORYENTRIES.RATE,ALLINVENTORYENTRIES.AMOUNT,ALLINVENTORYENTRIES.HSNSACCODE,ALLINVENTORYENTRIES.HSNCODE,ALLINVENTORYENTRIES.HSN</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  const baseQueries = [TALLY_XML_QUERIES.SALES_VOUCHERS_NATIVE, boundedSalesFallback];
  const invoiceMap = new Map<string, Invoice>();
  const parties = new Map<string, Party>();
  const items = new Map<string, StockItem>();
  let lastError: Error | null = null;

  // Import in short sequential batches. If the lightweight custom TDL query is
  // unsupported by this Tally build, fall back to the known HSFGPL collection queries.
  for (let cursor = new Date(rangeFrom.getTime()); cursor.getTime() <= rangeTo.getTime();) {
    const batchEnd = new Date(cursor.getTime());
    batchEnd.setDate(batchEnd.getDate() + 30);
    if (batchEnd.getTime() > rangeTo.getTime()) batchEnd.setTime(rangeTo.getTime());
    let batchInvoiceCount = 0;

    for (const baseQuery of baseQueries) {
      const queryWithCompany = baseQuery.includes('__PORTAL_COMPANY__')
        ? baseQuery.replace('__PORTAL_COMPANY__', xmlEscape(sellerInfo?.name || config.companyName || ''))
        : baseQuery.replace(
            '<STATICVARIABLES>',
            '<STATICVARIABLES><SVCURRENTCOMPANY>' + xmlEscape(sellerInfo?.name || config.companyName || '') + '</SVCURRENTCOMPANY>'
          );
      const xmlQuery = queryWithCompany.replace(
        '<STATICVARIABLES>',
        '<STATICVARIABLES><SVFROMDATE TYPE="Date">' + ymd(cursor) + '</SVFROMDATE><SVTODATE TYPE="Date">' + ymd(batchEnd) + '</SVTODATE>'
      );
      try {
        const res = await sendTallyRequest(xmlQuery, config);
        if (!res?.text?.trim()) continue;
        const parsed = parseSalesVouchersXML(res.text, sellerInfo);
        const before = batchInvoiceCount;
        let acceptedFromThisQuery = 0;
        for (const invoice of parsed.invoices) {
          const date = String(invoice.invoiceDate || '').slice(0, 10);
          // Some Tally reports ignore SVFROMDATE/SVTODATE. Do not let an
          // out-of-range voucher stop the fallback queries for this batch.
          if (!date || date < iso(cursor) || date > iso(batchEnd)) continue;
          const key = date + '|' + String(invoice.invoiceNo || '').trim().toLowerCase() + '|' +
            String(invoice.tallyGuid || invoice.tallyMasterId || invoice.sellerGstin || '').trim().toLowerCase();
          invoiceMap.set(key, invoice);
          acceptedFromThisQuery++;
        }
        batchInvoiceCount = Array.from(invoiceMap.values()).filter(inv => {
          const d = String(inv.invoiceDate || '').slice(0, 10);
          return d >= iso(cursor) && d <= iso(batchEnd);
        }).length;
        for (const party of parsed.extractedParties) parties.set(party.name.trim().toLowerCase(), party);
        for (const item of parsed.extractedItems) items.set(item.name.trim().toLowerCase(), item);
        // Continue to the next fallback query unless this query actually
        // yielded an invoice inside the requested batch date range.
        if (batchInvoiceCount > before || acceptedFromThisQuery > 0) break;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err?.message || err));
      }
    }

    cursor = new Date(batchEnd.getTime());
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getTime() <= rangeTo.getTime()) await new Promise(resolve => setTimeout(resolve, 150));
  }

  if (invoiceMap.size > 0) return {
    invoices: Array.from(invoiceMap.values()).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)),
    extractedParties: Array.from(parties.values()),
    extractedItems: Array.from(items.values()),
  };
  if (lastError) throw lastError;
  return { invoices: [], extractedParties: [], extractedItems: [] };
}

/**
 * Ensures Tally has a Voucher Type named "Portal" under the Sales parent.
 * This is a regular part of Portal -> Tally export, not an exception workflow.
 */
export async function ensurePortalVoucherTypeInTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  companyName = ''
): Promise<{ created: boolean; exists: boolean; message: string }> {
  const result = await sendTallyRequest(TALLY_XML_QUERIES.PORTAL_VOUCHER_TYPE_COLLECTION, config);
  const xml = sanitizeXmlString(result.text);
  const blocks = [...xml.matchAll(/<VOUCHERTYPE(?:\s[^>]*)?>([\s\S]*?)<\/VOUCHERTYPE>/gi)];
  for (const m of blocks) {
    const block = m[1];
    const name = (block.match(/<NAME[^>]*>([^<]+)<\/NAME>/i)?.[1] || '').trim();
    const parent = (block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i)?.[1] || '').trim();
    if (name.toLowerCase() === 'portal' && parent.toLowerCase() === 'sales') {
      return { created: false, exists: true, message: 'Tally me Sales > Portal voucher type already available.' };
    }
  }

  const createXml = `<ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Voucher Types</ID></HEADER>
    <BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY>${xmlEscape(companyName || config.companyName || '')}</SVCURRENTCOMPANY></STATICVARIABLES></DESC>
      <DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHERTYPE NAME="Portal" ACTION="Create">
          <PARENT>Sales</PARENT><NUMBERINGMETHOD>Automatic</NUMBERINGMETHOD><ISOPTIONAL>No</ISOPTIONAL>
          <USEFORPOSINVOICE>No</USEFORPOSINVOICE><ALLOWZEROENTRIES>No</ALLOWZEROENTRIES>
        </VOUCHERTYPE>
      </TALLYMESSAGE></DATA>
    </BODY>
  </ENVELOPE>`;
  const createdResult = await sendTallyRequest(createXml, config);
  const response = sanitizeXmlString(createdResult.text);
  const errors = Number(response.match(/<ERRORS>(\d+)<\/ERRORS>/i)?.[1] || 0);
  const lineError = response.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i)?.[1];
  if (errors > 0 || lineError) {
    throw new Error(lineError || ('Tally voucher type creation failed (' + errors + ' error(s)).'));
  }
  return { created: true, exists: true, message: 'Tally me Sales > Portal voucher type create ho gaya.' };
}

/**
 * Exports a single Invoice to Tally Prime with error parsing and confirmation
 */
export async function exportInvoiceToTally(
  invoice: Invoice,
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  companyName = ''
): Promise<{ success: boolean; message: string; responseXml?: string }> {
  if (!formatInvoiceDateForTally(invoice.invoiceDate)) {
    return {
      success: false,
      message: `Invoice date "${invoice.invoiceDate || ''}" valid nahi hai. Date ko YYYY-MM-DD ya DD/MM/YYYY format mein set karke dobara sync karein.`,
    };
  }
  if (!isDateInCurrentFinancialYear(invoice.invoiceDate)) {
    return {
      success: false,
      message: 'Invoice current financial year (01-Apr to 31-Mar) ke bahar hai. Tally sync blocked.',
    };
  }

  const targetCompany = companyName || config.companyName || '';

  // Voucher type check is best-effort. The actual voucher import below is the
  // authoritative Tally operation. A temporary bridge 502 during the check
  // must not block a valid Portal voucher export.
  try {
    await ensurePortalVoucherTypeInTally(config, targetCompany);
  } catch (voucherTypeCheckError: any) {
    console.warn('Portal voucher type pre-check skipped:', voucherTypeCheckError?.message || voucherTypeCheckError);
  }

  const xml = generateTallySalesVoucherXML(invoice, targetCompany);
  const res = await sendTallyRequest(xml, config);

  if (!res || !res.text) {
    throw new Error('Empty response received from Tally Prime');
  }

  const responseText = res.text;

  // Check for Tally success indicators: <CREATED>1</CREATED>, <ALTERED>1</ALTERED>, <ERRORS>0</ERRORS>
  const errorsMatch = responseText.match(/<ERRORS>(\d+)<\/ERRORS>/i);
  const createdMatch = responseText.match(/<CREATED>(\d+)<\/CREATED>/i);
  const alteredMatch = responseText.match(/<ALTERED>(\d+)<\/ALTERED>/i);
  const lineErrorMatch = responseText.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i);

  const errorsCount = errorsMatch ? parseInt(errorsMatch[1], 10) : 0;
  const createdCount = createdMatch ? parseInt(createdMatch[1], 10) : 0;
  const alteredCount = alteredMatch ? parseInt(alteredMatch[1], 10) : 0;

  if (errorsCount > 0 || lineErrorMatch) {
    const errorDetail = lineErrorMatch ? lineErrorMatch[1] : `Tally reported ${errorsCount} error(s)`;
    return {
      success: false,
      message: errorDetail,
      responseXml: responseText,
    };
  }

  if (createdCount > 0 || alteredCount > 0 || responseText.includes('RESPONSE')) {
    return {
      success: true,
      message: `Successfully posted to Tally (${createdCount > 0 ? 'Created' : 'Updated'} Voucher ${invoice.invoiceNo})`,
      responseXml: responseText,
    };
  }

  return {
    success: true,
    message: `Voucher ${invoice.invoiceNo} sent to Tally Prime`,
    responseXml: responseText,
  };
}

/**
 * Generates an XML envelope containing multiple Sales Vouchers for bulk import
 */
export function generateTallyBatchSalesVouchersXML(invoices: Invoice[], companyName = ''): string {
  const voucherXmls = invoices
    .map(inv => {
      const voucherDate = formatInvoiceDateForTally(inv.invoiceDate);
      const isInterState = inv.isInterState;

      const inventoryEntriesXML = inv.items
        .map(item => {
          const rate = Math.abs(Number(item.rate)) || 0;
          const qty = Math.abs(Number(item.qty)) || 1;
          const amount = +(qty * rate).toFixed(2);

          return `
            <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${xmlEscape(item.name)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
                <ISINVENTORYAFFECTED>Yes</ISINVENTORYAFFECTED>
                <RATE>${rate.toFixed(2)}/${xmlEscape(item.unit || 'Nos')}</RATE>
                <ACTUALQTY>${qty.toFixed(3)} ${xmlEscape(item.unit || 'Nos')}</ACTUALQTY>
                <BILLEDQTY>${qty.toFixed(3)} ${xmlEscape(item.unit || 'Nos')}</BILLEDQTY>
                <AMOUNT>${amount.toFixed(2)}</AMOUNT>
                <ACCOUNTINGALLOCATIONS.LIST>
                    <LEDGERNAME>Sales Account</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                    <AMOUNT>${amount.toFixed(2)}</AMOUNT>
                </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>`;
        })
        .join('\n');

      let taxEntriesXML = '';
      if (isInterState) {
        if (inv.totalIgst > 0) {
          taxEntriesXML += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output IGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${inv.totalIgst.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
        }
      } else {
        if (inv.totalCgst > 0) {
          taxEntriesXML += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output CGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${inv.totalCgst.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
        }
        if (inv.totalSgst > 0) {
          taxEntriesXML += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output SGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${inv.totalSgst.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
        }
      }

      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Portal" ACTION="Create" OBJVIEW="Invoice Voucher View">
                <DATE>${voucherDate}</DATE>
                <EFFECTIVEDATE>${voucherDate}</EFFECTIVEDATE>
                <VOUCHERTYPENAME>Portal</VOUCHERTYPENAME>
                <VOUCHERNUMBER>${xmlEscape(inv.invoiceNo)}</VOUCHERNUMBER>
                <REFERENCE>${xmlEscape(inv.invoiceNo)}</REFERENCE>
                <PARTYLEDGERNAME>${xmlEscape(inv.partyName)}</PARTYLEDGERNAME>
                <PARTYNAME>${xmlEscape(inv.partyName)}</PARTYNAME>
                <PLACEOFSUPPLY>${xmlEscape(inv.partyState || inv.sellerState)}</PLACEOFSUPPLY>
                <PARTYGSTIN>${xmlEscape(inv.gstin)}</PARTYGSTIN>
                <STATENAME>${xmlEscape(inv.partyState)}</STATENAME>
                <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
                <ISINVOICE>Yes</ISINVOICE>
                <NARRATION>${xmlEscape(inv.notes || `Tax Invoice ${inv.invoiceNo}`)}</NARRATION>
                <LEDGERENTRIES.LIST>
                    <LEDGERNAME>${xmlEscape(inv.partyName)}</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                    <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                    <AMOUNT>-${inv.grandTotal.toFixed(2)}</AMOUNT>
                    <BILLALLOCATIONS.LIST>
                        <NAME>${xmlEscape(inv.invoiceNo)}</NAME>
                        <BILLTYPE>New Ref</BILLTYPE>
                        <AMOUNT>-${inv.grandTotal.toFixed(2)}</AMOUNT>
                    </BILLALLOCATIONS.LIST>
                </LEDGERENTRIES.LIST>
                ${inventoryEntriesXML}
                ${taxEntriesXML}
            </VOUCHER>
        </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Vouchers</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </DESC>
        <DATA>
            ${voucherXmls}
        </DATA>
    </BODY>
</ENVELOPE>`;
}

/**
 * Intelligent Two-Way Sync Engine with Strict Anti-Duplication Protection:
 * 1. Pulls all vouchers from Tally Prime.
 * 2. Compares against existing portal invoices using normalized invoice numbers and Tally GUIDs.
 * 3. Imports new Tally invoices into the portal (marked as synced).
 * 4. Protects existing matches by updating sync status without creating duplicates.
 * 5. Identifies un-synced portal invoices and exports them to Tally Prime.
 * 6. Returns a detailed SyncReport and the synchronized state.
 */
export async function performTwoWaySync({
  portalInvoices,
  sellerInfo,
  tallyConfig = DEFAULT_TALLY_CONFIG,
}: {
  portalInvoices: Invoice[];
  sellerInfo: SellerInfo;
  tallyConfig?: TallyConfig;
}): Promise<{
  updatedInvoices: Invoice[];
  newParties: Party[];
  newItems: StockItem[];
  report: SyncReport;
}> {
  const report: SyncReport = {
    timestamp: new Date().toISOString(),
    importedCount: 0,
    exportedCount: 0,
    updatedCount: 0,
    duplicatesPreventedCount: 0,
    totalInPortal: portalInvoices.length,
    totalInTally: 0,
    importedInvoices: [],
    exportedInvoices: [],
    skippedInvoices: [],
    discoveredParties: 0,
    discoveredItems: 0,
    errors: [],
    syncExceptions: [],
  };

  // Step 1: Query Tally Prime for all Sales Vouchers
  let tallyResult: ParsedVouchersResult = {
    invoices: [],
    extractedParties: [],
    extractedItems: [],
  };

  try {
    tallyResult = await fetchSalesVouchersFromTally(tallyConfig, sellerInfo);
  } catch (err: any) {
    report.errors.push(`Tally Fetch Warning: ${err.message}`);
  }

  report.totalInTally = tallyResult.invoices.length;
  report.discoveredParties = tallyResult.extractedParties.length;
  report.discoveredItems = tallyResult.extractedItems.length;

  // Build lookup index of existing portal invoices by normalized invoice number and GUID
  const portalMap = new Map<string, Invoice>();
  const guidMap = new Map<string, Invoice>();

  portalInvoices.forEach((inv) => {
    const normNo = inv.invoiceNo.trim().toLowerCase();
    if (normNo) portalMap.set(normNo, inv);
    if (inv.tallyGuid) guidMap.set(inv.tallyGuid.trim().toLowerCase(), inv);
  });

  const mergedInvoices: Invoice[] = [...portalInvoices];
  const newImportedFromTally: Invoice[] = [];

  // Step 2: Process Tally Invoices into Portal (Import & De-duplication)
  tallyResult.invoices.forEach((tallyInv) => {
    const normNo = tallyInv.invoiceNo.trim().toLowerCase();
    const tallyGuid = tallyInv.tallyGuid ? tallyInv.tallyGuid.trim().toLowerCase() : '';

    const existingMatch = (normNo && portalMap.get(normNo)) || (tallyGuid && guidMap.get(tallyGuid));

    if (existingMatch) {
      // DUPLICATE PREVENTED: Already exists in portal! Update sync status to 'synced'
      report.duplicatesPreventedCount++;
      report.skippedInvoices.push({
        invoiceNo: tallyInv.invoiceNo,
        reason: `Matched existing portal invoice ${existingMatch.invoiceNo} (Duplicate prevented)`,
      });

      // Update existing invoice sync status if needed
      const idx = mergedInvoices.findIndex((i) => i.id === existingMatch.id);
      if (idx !== -1) {
        mergedInvoices[idx] = {
          ...mergedInvoices[idx],
          tallySyncStatus: 'synced',
          tallySyncDate: mergedInvoices[idx].tallySyncDate || new Date().toISOString(),
          tallyGuid: mergedInvoices[idx].tallyGuid || tallyInv.tallyGuid,
          tallyMasterId: mergedInvoices[idx].tallyMasterId || tallyInv.tallyMasterId,
          isDuplicateProtected: true,
        };
        report.updatedCount++;
      }
    } else {
      // NEW INVOICE FROM TALLY: Add to portal
      newImportedFromTally.push(tallyInv);
      mergedInvoices.unshift(tallyInv);
      report.importedCount++;
      report.importedInvoices.push(tallyInv);
      // Register in map so subsequent items don't duplicate
      if (normNo) portalMap.set(normNo, tallyInv);
    }
  });

  // Step 3: Export portal-created pending invoices to Tally automatically.
  // Tally-imported invoices are already marked synced, so only genuine portal pending
  // invoices are pushed. Each successful export is marked synced to prevent duplicates.
  const pendingPortalInvoices = mergedInvoices.filter((inv) =>
    inv.tallySyncStatus !== 'synced' &&
    (inv.source === 'portal' || !inv.source)
  );

  for (const inv of pendingPortalInvoices) {
    try {
      const exportResult = await exportInvoiceToTally(inv, tallyConfig, sellerInfo.name);
      if (exportResult.success) {
        const idx = mergedInvoices.findIndex((i) => i.id === inv.id);
        if (idx !== -1) {
          mergedInvoices[idx] = {
            ...mergedInvoices[idx],
            tallySyncStatus: 'synced',
            tallySyncDate: new Date().toISOString(),
            tallyVoucherType: 'Portal',
            source: 'portal',
            isDuplicateProtected: true,
          };
          report.exportedCount++;
          report.exportedInvoices.push(mergedInvoices[idx]);
        }
      } else {
        report.errors.push(`Portal export ${inv.invoiceNo}: ${exportResult.message}`);
      }
    } catch (err: any) {
      report.errors.push(`Portal export ${inv.invoiceNo}: ${err?.message || 'Unknown Tally error'}`);
    }
  }

  report.totalInPortal = mergedInvoices.length;

  return {
    updatedInvoices: mergedInvoices,
    newParties: tallyResult.extractedParties,
    newItems: tallyResult.extractedItems,
    report,
  };
}



export async function fetchAccountingVouchersFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  fromDate?: string,
  toDate?: string
): Promise<TallyVoucher[]> {
  const cleanDate = (value?: string) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}${match[2]}${match[3]}` : '';
  };
  const from = cleanDate(fromDate);
  const to = cleanDate(toDate);
  if (!from || !to) {
    throw new Error('Receipt/Payment/Credit Note import ke liye From Date aur To Date zaroori hai.');
  }
  const xml = TALLY_XML_QUERIES.ACCOUNTING_VOUCHERS_BOUNDED.replace(
    '<STATICVARIABLES>',
    `<STATICVARIABLES><SVFROMDATE TYPE="Date">${from}</SVFROMDATE><SVTODATE TYPE="Date">${to}</SVTODATE>`
  );
  const result = await sendTallyRequest(xml, config);
  return parseAccountingVouchersXML(result.text).filter(v => {
    const type = v.voucherType.trim().toLowerCase();
    return type === 'receipt' || type === 'payment' || type === 'credit note' || type === 'creditnote';
  });
}

export function parseAccountingVouchersXML(xmlInput: string | Document): TallyVoucher[] {
  const doc = typeof xmlInput === 'string' ? parseTallyXML(xmlInput) : xmlInput;
  const voucherElements = Array.from(doc.getElementsByTagName('VOUCHER'));
  return voucherElements.map((vch, index) => {
    const voucherType = getAttributeOrNode(vch, 'VCHTYPE', 'VOUCHERTYPENAME') || 'Unknown';
    const number = getNodeValue(vch, 'VOUCHERNUMBER') || getNodeValue(vch, 'REFERENCE') || ('TALLY-' + (index + 1));
    const date = formatTallyDateToIso(getNodeValue(vch, 'DATE'));
    const partyName = getNodeValue(vch, 'PARTYLEDGERNAME') || getNodeValue(vch, 'PARTYNAME') || getNodeValue(vch, 'LEDGERNAME') || '';
    const reference = getNodeValue(vch, 'REFERENCE');
    const narration = getNodeValue(vch, 'NARRATION');
    const guid = getNodeValue(vch, 'GUID');
    const masterId = getNodeValue(vch, 'MASTERID');
    const ledgerNodes = Array.from(vch.getElementsByTagName('LEDGERENTRIES.LIST'));
    let partyEffect = 0;
    let partyLedger = partyName;
    for (const node of ledgerNodes) {
      const name = getNodeValue(node, 'LEDGERNAME');
      const amount = parseFloat(getNodeValue(node, 'AMOUNT') || '0') || 0;
      const isParty = getNodeValue(node, 'ISPARTYLEDGER').toLowerCase() === 'yes';
      if (isParty || (partyName && name.toLowerCase() === partyName.toLowerCase())) {
        partyEffect += amount;
        if (name) partyLedger = name;
      }
    }
    if (!partyEffect) {
      partyEffect = parseFloat(getNodeValue(vch, 'AMOUNT') || '0') || 0;
    }
    return {
      id: 'tally-voucher-' + (guid || masterId || number) + '-' + index,
      date, voucherType, voucherNumber: number, reference,
      partyName: partyLedger, amount: Math.abs(partyEffect), partyEffect,
      narration, tallyGuid: guid, tallyMasterId: masterId, source: 'tally_import'
    };
  });
}
