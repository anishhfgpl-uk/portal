import { SellerInfo, TallyConfig } from '../types';
import { sendTallyRequest, DEFAULT_TALLY_CONFIG } from './tallyService';
import { extractPanFromGstin, extractStateCodeFromGstin, getStateCodeByName } from '../utils/gstUtils';

const clean = (v: string) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();

function value(el: Element, ...names: string[]): string {
  for (const name of names) {
    const attr = el.getAttribute(name) || el.getAttribute(name.toUpperCase()) || el.getAttribute(name.toLowerCase());
    if (attr && clean(attr)) return clean(attr);
    const node = el.getElementsByTagName(name)[0]?.textContent;
    if (node && clean(node)) return clean(node);
    const upper = name.toUpperCase();
    const upperNode = el.getElementsByTagName(upper)[0]?.textContent;
    if (upperNode && clean(upperNode)) return clean(upperNode);
  }
  return '';
}

function parseDocument(xml: string): Document | null {
  const repaired = String(xml || '')
    .replace(/^\uFEFF/, '')
    .replace(/&(?!#(?:\d+|x[0-9a-fA-F]+);|[A-Za-z][A-Za-z0-9]+;)/g, '&amp;');
  const doc = new DOMParser().parseFromString(repaired, 'text/xml');
  return doc.getElementsByTagName('parsererror').length ? null : doc;
}

function parseCompanyXml(xml: string): SellerInfo[] {
  const raw = String(xml || '');
  const doc = parseDocument(raw);
  // Tally can return a response containing valid company NAME attributes even
  // when the surrounding XML is malformed or wrapped differently by the bridge.
  // Recover those names independently so discovery does not depend on DOM parsing.
  const rawNames: string[] = [];
  const nameRegex = /<(?:COMPANY|CURRENTCOMPANY|CURRENT_COMPANY)\\b[^>]*\\bNAME\\s*=\\s*["']([^"']+)["'][^>]*>/gi;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = nameRegex.exec(raw))) {
    const name = clean(rawMatch[1]);
    if (name && !rawNames.some(existing => existing.toLowerCase() === name.toLowerCase())) rawNames.push(name);
  }

  if (!doc) {
    return rawNames.map((name, index) => ({
      id: `comp-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name,
      mailingName: name,
      address: '', state: '', stateCode: '', country: 'India', pincode: '', phone: '', mobile: '',
      email: '', website: '', gstin: '', pan: '', financialYearFrom: '', booksBeginningFrom: '',
      currencySymbol: '₹', currencyFormalName: 'INR', tallyGuid: '', bankName: '', bankAccountNo: '', bankIfsc: '',
    }));
  }

  const candidates: Element[] = [];
  const addCandidate = (el: Element | null | undefined) => {
    if (!el || candidates.includes(el)) return;
    candidates.push(el);
  };

  Array.from(doc.getElementsByTagName('COMPANY')).forEach(addCandidate);
  Array.from(doc.getElementsByTagName('CURRENTCOMPANY')).forEach(addCandidate);
  Array.from(doc.getElementsByTagName('CURRENT_COMPANY')).forEach(addCandidate);
  Array.from(doc.getElementsByTagName('TALLYMESSAGE')).forEach(x => addCandidate(x.getElementsByTagName('COMPANY')[0]));

  if (candidates.length === 0) {
    const root = doc.documentElement;
    const rootName = value(root, 'SERVERCOMPANYNAME', 'CURRENTCOMPANY', 'CURRENT_COMPANY', 'COMPANYNAME', 'NAME');
    if (rootName) addCandidate(root);
  }

  if (candidates.length === 0) {
    Array.from(doc.getElementsByTagName('*')).forEach(el => {
      const attrName = clean(el.getAttribute('NAME') || '');
      if (attrName && /company/i.test(el.tagName)) addCandidate(el);
    });
  }

  // TallyPrime may expose company names only as NAME attributes in the\n  // List of Companies response. Recover those names from the raw XML too.\n  if (candidates.length === 0) {\n    const raw = String(xml || '');\n    const re = /<COMPANY\\b[^>]*\\bNAME\\s*=\\s*["']([^"']+)["'][^>]*>/gi;\n    let match: RegExpExecArray | null;\n    while ((match = re.exec(raw))) {\n      const name = clean(match[1]);\n      if (!name) continue;\n      const stub = doc.createElement('COMPANY');\n      stub.setAttribute('NAME', name);\n      addCandidate(stub);\n    }\n  }\n\n  const out: SellerInfo[] = [];
  const seen = new Set<string>();

  candidates.forEach((comp, index) => {
    const name = value(comp, 'NAME', 'BASICCOMPANYNAME', 'FORMALNAME', 'CURRENTCOMPANY', 'SERVERCOMPANYNAME', 'COMPANYNAME') || clean(comp.getAttribute('NAME') || '');
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());

    const addressLines = Array.from(comp.getElementsByTagName('ADDRESS'))
      .map(x => clean(x.textContent || ''))
      .filter(Boolean);
    const address = addressLines.join(', ') || value(comp, 'MAILINGADDRESS', 'COMPANYADDRESS', 'ADDRESS');
    const state = value(comp, 'STATENAME', 'STATE', 'MAILINGSTATE');
    const country = value(comp, 'COUNTRYNAME', 'COUNTRY') || 'India';
    const gstin = value(comp, 'GSTIN', 'GSTREGNUMBER', 'GSTREGISTRATIONNUMBER', 'GSTREGISTRATIONNO', 'PARTYGSTIN', 'CMPGSTAXNUMBER', 'VATREGISTRATIONNO').toUpperCase();
    const stateCode = extractStateCodeFromGstin(gstin) || getStateCodeByName(state) || '';
    const pan = value(comp, 'PANNUMBER', 'INCOMETAXNUMBER', 'PAN').toUpperCase() || (gstin ? extractPanFromGstin(gstin) : '');
    const pincode = value(comp, 'PINCODE', 'PINCODE1') || (address.match(/\b\d{6}\b/)?.[0] || '');
    const mobile = value(comp, 'MOBILENUMBER', 'MOBILE', 'MOBILEPHONE', 'MOBILEPHONE1');
    const phone = value(comp, 'PHONENUMBER', 'TELEPHONENUMBER', 'PHONE', 'TELEPHONE') || mobile;
    const email = value(comp, 'EMAIL', 'EMAILID', 'EMAILADDRESS');
    const website = value(comp, 'WEBSITE', 'WEB');

    out.push({
      id: `comp-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name,
      tradeName: value(comp, 'MAILINGNAME', 'TRADENAME') || undefined,
      mailingName: value(comp, 'MAILINGNAME', 'TRADENAME') || name,
      address,
      state,
      stateCode,
      country,
      pincode,
      phone,
      mobile,
      email,
      website,
      gstin,
      pan,
      financialYearFrom: value(comp, 'STARTINGFROM', 'FINANCIALYEARFROM'),
      booksBeginningFrom: value(comp, 'BOOKSFROM', 'BOOKSBEGINNINGFROM'),
      currencySymbol: value(comp, 'CURRENCYSYMBOL') || '₹',
      currencyFormalName: value(comp, 'CURRENCYFORMALNAME') || 'INR',
      tallyGuid: value(comp, 'GUID'),
      bankName: value(comp, 'BANKNAME'),
      bankAccountNo: value(comp, 'BANKACCOUNTNUMBER', 'BANKACCOUNTNO'),
      bankIfsc: value(comp, 'IFSCODE', 'BANKIFSC').toUpperCase(),
    });
  });

  return out;
}

const CURRENT_COMPANY_MASTER_XML = `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurrentCompanyDetails</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE>
    <COLLECTION NAME="CurrentCompanyDetails" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No">
      <TYPE>Company</TYPE><FILTER>CurrentCompanyFilter</FILTER>
      <FETCH>NAME, MAILINGNAME, BASICCOMPANYFORMALNAME, ADDRESS, STATENAME, COUNTRYNAME, PINCODE, PHONENUMBER, MOBILENUMBER, TELEPHONENUMBER, EMAIL, EMAILID, WEBSITE, GSTIN, PARTYGSTIN, PANNUMBER, INCOMETAXNUMBER, STARTINGFROM, ENDINGAT, BOOKSFROM, CURRENCYSYMBOL, CURRENCYFORMALNAME, BANKNAME, BANKACCOUNTNUMBER, IFSCODE, GUID</FETCH>
    </COLLECTION>
    <SYSTEM TYPE="Formulae" NAME="CurrentCompanyFilter">$IsEqual:$Name:##SVCURRENTCOMPANY</SYSTEM>
  </TDLMESSAGE></TDL></DESC></BODY>
</ENVELOPE>`;

const CURRENT_COMPANY_XML = `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER>
  <BODY><DESC>
    <STATICVARIABLES>
      <SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT>
      <SVIsSimpleCompany>No</SVIsSimpleCompany>
    </STATICVARIABLES>
    <TDL><TDLMESSAGE>
      <COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No" NAME="List of Companies">
        <TYPE>Company</TYPE>
        <NATIVEMETHOD>Name</NATIVEMETHOD>
        <NATIVEMETHOD>StartingFrom</NATIVEMETHOD>
        <NATIVEMETHOD>BooksFrom</NATIVEMETHOD>
      </COLLECTION>
    </TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>`;

const COMPANY_OBJECT_XML = (companyName: string) => {
  const escaped = companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Object</TYPE><SUBTYPE>Company</SUBTYPE><ID TYPE="Name">${escaped}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escaped}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><FETCHLIST><FETCH>*</FETCH></FETCHLIST></DESC></BODY></ENVELOPE>`;
};

const COMPANY_XML_FALLBACK = `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyProfileCollection</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
    <TDL><TDLMESSAGE>
      <COLLECTION NAME="CompanyProfileCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes">
        <TYPE>Company</TYPE>
        <FETCH>NAME, MAILINGNAME, BASICCOMPANYFORMALNAME, ADDRESS, STATENAME, COUNTRYNAME, PINCODE, PHONENUMBER, MOBILENUMBER, TELEPHONENUMBER, EMAIL, EMAILID, WEBSITE, GSTIN, PARTYGSTIN, VATREGISTRATIONNO, PANNUMBER, INCOMETAXNUMBER, STARTINGFROM, ENDINGAT, BOOKSFROM, CURRENCYSYMBOL, CURRENCYFORMALNAME, BANKNAME, BANKACCOUNTNUMBER, IFSCODE, GUID</FETCH>
      </COLLECTION>
    </TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>`;

function currentCompanyName(xml: string): string {
  const doc = parseDocument(xml);
  if (!doc) return '';

  const company = doc.getElementsByTagName('COMPANY')[0];
  if (company) {
    const attrName = clean(company.getAttribute('NAME') || '');
    if (attrName) return attrName;
    const childName = clean(company.getElementsByTagName('NAME')[0]?.textContent || '');
    if (childName) return childName;
  }

  const names = ['SERVERCOMPANYNAME', 'CURRENTCOMPANY', 'CURRENT_COMPANY', 'COMPANYNAME', 'NAME'];
  for (const n of names) {
    const el = doc.getElementsByTagName(n)[0];
    const text = clean(el?.textContent || '');
    if (text) return text;
  }

  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    const attrName = clean(el.getAttribute('NAME') || '');
    if (attrName && /company/i.test(el.tagName)) return attrName;
  }

  return '';
}

function companyProxyPath(): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) return '/app/api/tally/request';
  return '/api/tally/request';
}

async function requestCompanyTally(xml: string, config: TallyConfig): Promise<{ text: string; via: 'proxy' | 'direct' }> {
  if (config.proxyMode !== false) {
    const response = await fetch(companyProxyPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: config.tallyUrl || 'http://127.0.0.1:9000', xml }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.success && typeof payload.xml === 'string' && payload.xml.trim()) {
      return { text: payload.xml, via: 'proxy' };
    }
    if (payload?.error) throw new Error(payload.error);
    throw new Error(`Portal Tally proxy unavailable (HTTP ${response.status}).`);
  }
  return sendTallyRequest(xml, config);
}

export { DEFAULT_TALLY_CONFIG };

export async function fetchCompaniesFromTally(config: TallyConfig = DEFAULT_TALLY_CONFIG): Promise<SellerInfo[]> {
  // TallyPrime's HTTP response format varies by build. The safest discovery
  // path is the standard Company collection, which returns the companies
  // available to the running Tally HTTP server. Do not depend on CompanyInfo
  // or a single "current company" tag being present.
  const queries = [
    CURRENT_COMPANY_MASTER_XML,
    COMPANY_XML_FALLBACK,
  ];

  for (const xml of queries) {
    try {
      const result = await requestCompanyTally(xml, config);
      const companies = parseCompanyXml(result.text);
      if (companies.length > 0) return companies;
    } catch (err) {
      console.warn('Tally company collection query failed:', err);
    }
  }

  // Compatibility fallback: some TallyPrime builds expose the company list
  // through the built-in "List of Companies" report. Parse any COMPANY
  // elements/NAME attributes returned by that report.
  try {
    const result = await requestCompanyTally(CURRENT_COMPANY_XML, config);
    const companies = parseCompanyXml(result.text);
    if (companies.length > 0) return companies;
  } catch (err) {
    console.warn('Tally List of Companies query failed:', err);
  }

  // If the server answered successfully but did not expose company objects,
  // surface a useful message instead of pretending the connector is offline.
  throw new Error('Tally connected hai, lekin company list Tally response me nahi mili. Tally Prime me kam se kam ek company open karke Refresh from Tally dabayein.');
}
export function parseCompaniesXML(xml: string): SellerInfo[] {
  return parseCompanyXml(xml);
}
