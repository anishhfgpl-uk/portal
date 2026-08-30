import { Party, StockItem, Invoice, TallyConfig, SellerInfo, SyncReport, InvoiceItemRow } from '../types';
import {
  getStateCodeByName,
  getStateNameByCode,
  extractPanFromGstin,
  extractStateCodeFromGstin,
  xmlEscape,
  numberToIndianWords,
} from '../utils/gstUtils';

export const DEFAULT_TALLY_CONFIG: TallyConfig = {
  tallyUrl: 'http://localhost:9000',
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
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>DebtorCollection</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="DebtorCollection" ISMODIFY="No">
                        <TYPE>Ledger</TYPE>
                        <CHILDOF>$$GroupSundryDebtors</CHILDOF>
                        <BELONGSTO>Yes</BELONGSTO>
                        <FETCH>
                            NAME,
                            ADDRESS,
                            LEDGERPHONE,
                            LEDGERMOBILE,
                            PINCODE,
                            GSTIN,
                            PARTYGSTIN,
                            GSTREGISTRATIONTYPE,
                            STATENAME,
                            LEDGERPAN,
                            COUNTRYNAME,
                            OPENINGBALANCE
                        </FETCH>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
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

  // Strategy 2: Direct browser fetch (for when running on local desktop with CORS disabled or direct bridge)
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
  const result = await sendTallyRequest(TALLY_XML_QUERIES.DEBTOR_COLLECTION, config);
  return parseDebtorsXML(result.text);
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
  // Query 1: Standard Stock Item Collection
  try {
    const result = await sendTallyRequest(TALLY_XML_QUERIES.STOCK_ITEM_COLLECTION, config);
    const items = parseStockItemsXML(result.text);
    if (items.length > 0) {
      return items;
    }
  } catch (err) {
    console.warn('StockItemCollection query failed, trying simple collection fallback:', err);
  }

  // Query 2: Simple StockItem Collection
  try {
    const result2 = await sendTallyRequest(TALLY_XML_QUERIES.STOCK_ITEM_COLLECTION_SIMPLE, config);
    const items2 = parseStockItemsXML(result2.text);
    if (items2.length > 0) {
      return items2;
    }
  } catch (err2) {
    console.warn('StockItemCollectionSimple query failed, trying List of Accounts fallback:', err2);
  }

  // Query 3: List of Accounts (Stock Items)
  try {
    const fallbackResult = await sendTallyRequest(TALLY_XML_QUERIES.STOCK_ITEM_LIST_ACCOUNTS, config);
    return parseStockItemsXML(fallbackResult.text);
  } catch (fallbackErr) {
    console.error('All Tally Stock Item queries failed:', fallbackErr);
    throw fallbackErr;
  }
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
  const node = parent.getElementsByTagName(tagName)[0];
  if (!node) return '';
  return (node.textContent || '').trim();
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
  // Format date YYYYMMDD for Tally
  const cleanDate = invoice.invoiceDate.replace(/[-/]/g, '');
  const voucherDate = cleanDate.length === 8 ? cleanDate : new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const isInterState = invoice.isInterState;
  
  // Build inventory / ledger rows for XML
  const inventoryEntriesXML = invoice.items
    .map(item => {
      const rate = item.rate || 0;
      const qty = item.qty || 1;
      const amount = -(item.taxableAmount || 0); // Credit in Sales Voucher

      return `
        <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${xmlEscape(item.name)}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
            <RATE>${rate.toFixed(2)}/${xmlEscape(item.unit || 'Nos')}</RATE>
            <ACTUALQTY>${qty} ${xmlEscape(item.unit || 'Nos')}</ACTUALQTY>
            <BILLEDQTY>${qty} ${xmlEscape(item.unit || 'Nos')}</BILLEDQTY>
            <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales Account</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`;
    })
    .join('\n');

  // Additional Charges / Expense Ledgers
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

  // Tax ledger entries
  let taxEntriesXML = '';
  if (isInterState) {
    if (invoice.totalIgst > 0) {
      taxEntriesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output IGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${invoice.totalIgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
  } else {
    if (invoice.totalCgst > 0) {
      taxEntriesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${invoice.totalCgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
    if (invoice.totalSgst > 0) {
      taxEntriesXML += `
        <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${invoice.totalSgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`;
    }
  }

  // Round off entry if any
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
                <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
                    <DATE>${voucherDate}</DATE>
                    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
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
                    
                    <!-- Debtor Debit Entry -->
                    <LEDGERENTRIES.LIST>
                        <LEDGERNAME>${xmlEscape(invoice.partyName)}</LEDGERNAME>
                        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                        <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                        <AMOUNT>${invoice.grandTotal.toFixed(2)}</AMOUNT>
                        <BILLALLOCATIONS.LIST>
                            <NAME>${xmlEscape(invoice.invoiceNo)}</NAME>
                            <BILLTYPE>New Ref</BILLTYPE>
                            <AMOUNT>${invoice.grandTotal.toFixed(2)}</AMOUNT>
                        </BILLALLOCATIONS.LIST>
                    </LEDGERENTRIES.LIST>
                    
                    <!-- Inventory Entries with Sales Account Credit -->
                    ${inventoryEntriesXML}
                    
                    <!-- Additional Charges / Expenses (Freight, Labour, etc.) -->
                    ${additionalExpensesXML}
                    
                    <!-- GST Tax Ledgers -->
                    ${taxEntriesXML}
                    
                    <!-- Round Off -->
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
export function generateTallyLedgerXML(party: Party): string {
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
                <LEDGER NAME="${xmlEscape(party.name)}" ACTION="Create">
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
export function generateTallyStockItemXML(item: StockItem): string {
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
                <STOCKITEM NAME="${xmlEscape(item.name)}" ACTION="Create">
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
 * Formats various Tally date string representations to standard ISO YYYY-MM-DD
 */
export function formatTallyDateToIso(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const clean = rawDate.trim();
  
  // YYYYMMDD e.g. 20250415
  if (/^\d{8}$/.test(clean)) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    const parts = clean.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  // DD-MMM-YYYY or DD-MMM-YY e.g. 15-Apr-2025 or 15-Apr-25
  const match = clean.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const month = months[match[2].toLowerCase()] || '01';
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
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

    // Extract invoice number
    const noMatch = block.match(/<(?:VOUCHERNUMBER|REFERENCE|VCHNO)>([^<]+)<\/(?:VOUCHERNUMBER|REFERENCE|VCHNO)>/i);
    const invoiceNo = noMatch ? noMatch[1].trim() : `TALLY-INV-${idx + 1}`;

    // Extract date
    const dateMatch = block.match(/<DATE>([^<]+)<\/DATE>/i);
    const invoiceDate = formatTallyDateToIso(dateMatch ? dateMatch[1].trim() : '');

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
      const gstRate = 18;
      const isInter = partyState.toLowerCase() !== (sellerInfo?.state || 'Delhi').toLowerCase();
      const cgst = isInter ? 0 : (amount * (gstRate / 2)) / 100;
      const sgst = isInter ? 0 : (amount * (gstRate / 2)) / 100;
      const igst = isInter ? (amount * gstRate) / 100 : 0;
      const total = amount + cgst + sgst + igst;

      const itemRow: InvoiceItemRow = {
        id: `row-tally-${idx + 1}-${itemIdx + 1}`,
        name,
        hsn: '84713010',
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
        hsn: '84713010',
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
      source: 'tally_import',
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
    let invoiceNo = getNodeValue(vch, 'VOUCHERNUMBER') || getNodeValue(vch, 'REFERENCE');
    if (!invoiceNo) {
      invoiceNo = `TALLY-INV-${index + 1}`;
    }

    // Extract date
    const rawDate = getNodeValue(vch, 'DATE');
    const invoiceDate = formatTallyDateToIso(rawDate);

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
    const inventoryNodes = Array.from(vch.getElementsByTagName('ALLINVENTORYENTRIES.LIST'));
    const items: InvoiceItemRow[] = [];

    inventoryNodes.forEach((invNode, itemIndex) => {
      const itemName = getNodeValue(invNode, 'STOCKITEMNAME') || `Item ${itemIndex + 1}`;
      
      // Parse Qty and Unit
      const rawQty = getNodeValue(invNode, 'ACTUALQTY') || getNodeValue(invNode, 'BILLEDQTY');
      let qty = 1;
      let unit = 'Nos';
      if (rawQty) {
        const match = rawQty.match(/^([\d.]+)\s*(.*)$/);
        if (match) {
          qty = parseFloat(match[1]) || 1;
          if (match[2]) unit = match[2].trim();
        }
      }

      // Parse Rate
      const rawRate = getNodeValue(invNode, 'RATE');
      let rate = 0;
      if (rawRate) {
        const rParts = rawRate.split('/');
        rate = Math.abs(parseFloat(rParts[0])) || 0;
        if (rParts[1] && !unit) unit = rParts[1].trim();
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
        primaryAmt = anyAmt ? Math.abs(parseFloat(anyAmt)) : 1000;
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
 * Direct Live API to fetch all Sales Vouchers from Tally Prime over Port 9000
 */
export async function fetchSalesVouchersFromTally(
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  sellerInfo?: SellerInfo
): Promise<ParsedVouchersResult> {
  const queriesToTry = [
    TALLY_XML_QUERIES.SALES_VOUCHERS_COLLECTION,
    TALLY_XML_QUERIES.SALES_VOUCHERS_SIMPLE,
    TALLY_XML_QUERIES.DAYBOOK_EXPORT,
  ];

  let lastError: Error | null = null;

  for (const xmlQuery of queriesToTry) {
    try {
      const res = await sendTallyRequest(xmlQuery, config);
      if (res && res.text && res.text.trim()) {
        const parsed = parseSalesVouchersXML(res.text, sellerInfo);
        if (parsed.invoices.length > 0) {
          return parsed;
        }
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { invoices: [], extractedParties: [], extractedItems: [] };
}

/**
 * Exports a single Invoice to Tally Prime with error parsing and confirmation
 */
export async function exportInvoiceToTally(
  invoice: Invoice,
  config: TallyConfig = DEFAULT_TALLY_CONFIG,
  companyName = ''
): Promise<{ success: boolean; message: string; responseXml?: string }> {
  const xml = generateTallySalesVoucherXML(invoice, companyName || config.companyName || '');
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
      const cleanDate = inv.invoiceDate.replace(/[-/]/g, '');
      const voucherDate = cleanDate.length === 8 ? cleanDate : new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const isInterState = inv.isInterState;

      const inventoryEntriesXML = inv.items
        .map(item => {
          const rate = item.rate || 0;
          const qty = item.qty || 1;
          const amount = -(item.taxableAmount || 0);

          return `
            <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${xmlEscape(item.name)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
                <RATE>${rate.toFixed(2)}/${xmlEscape(item.unit || 'Nos')}</RATE>
                <ACTUALQTY>${qty} ${xmlEscape(item.unit || 'Nos')}</ACTUALQTY>
                <BILLEDQTY>${qty} ${xmlEscape(item.unit || 'Nos')}</BILLEDQTY>
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
                <AMOUNT>-${inv.totalIgst.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
        }
      } else {
        if (inv.totalCgst > 0) {
          taxEntriesXML += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output CGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${inv.totalCgst.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
        }
        if (inv.totalSgst > 0) {
          taxEntriesXML += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output SGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${inv.totalSgst.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>`;
        }
      }

      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
                <DATE>${voucherDate}</DATE>
                <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
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
                    <AMOUNT>${inv.grandTotal.toFixed(2)}</AMOUNT>
                    <BILLALLOCATIONS.LIST>
                        <NAME>${xmlEscape(inv.invoiceNo)}</NAME>
                        <BILLTYPE>New Ref</BILLTYPE>
                        <AMOUNT>${inv.grandTotal.toFixed(2)}</AMOUNT>
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

  // Step 3: Identify Pending Portal Invoices (Not yet in Tally) and Export to Tally
  const pendingInvoices = mergedInvoices.filter(
    (inv) =>
      inv.source !== 'tally_import' &&
      inv.tallySyncStatus !== 'synced' &&
      !tallyResult.invoices.some(
        (ti) => ti.invoiceNo.trim().toLowerCase() === inv.invoiceNo.trim().toLowerCase()
      )
  );

  for (const inv of pendingInvoices) {
    try {
      const exportRes = await exportInvoiceToTally(inv, tallyConfig, sellerInfo.name);
      if (exportRes.success) {
        const idx = mergedInvoices.findIndex((i) => i.id === inv.id);
        if (idx !== -1) {
          mergedInvoices[idx] = {
            ...mergedInvoices[idx],
            tallySyncStatus: 'synced',
            tallySyncDate: new Date().toISOString(),
            isDuplicateProtected: true,
          };
          report.exportedCount++;
          report.exportedInvoices.push(mergedInvoices[idx]);
        }
      } else {
        report.errors.push(`Export failed for ${inv.invoiceNo}: ${exportRes.message}`);
      }
    } catch (err: any) {
      report.errors.push(`Export error for ${inv.invoiceNo}: ${err.message}`);
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

