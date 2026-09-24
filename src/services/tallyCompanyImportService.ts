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
  const doc = parseDocument(xml);
  if (!doc) return [];

  const candidates: Element[] = [];
  const addCandidate = (el: Element | null | undefined) => {
    if (!el || candidates.includes(el)) return;
    candidates.push(el);
  };

  // Tally Prime can return company masters in several shapes depending on
  // version/query: <COMPANY>, <COMPANY .../>, or a wrapper containing
  // SERVERCOMPANYNAME/COMPANYNAME plus the company fields. Be deliberately
  // tolerant here instead of assuming one exact XML shape.
  Array.from(doc.getElementsByTagName('COMPANY')).forEach(addCandidate);
  Array.from(doc.getElementsByTagName('CURRENTCOMPANY')).forEach(addCandidate);
  Array.from(doc.getElementsByTagName('CURRENT_COMPANY')).forEach(addCandidate);
  Array.from(doc.getElementsByTagName('TALLYMESSAGE')).forEach(x => {
    addCandidate(x.getElementsByTagName('COMPANY')[0]);
  });

  // CompanyInfo/Object exports sometimes expose the company name at the
  // envelope level rather than inside a COMPANY element. In that case use
  // the response element itself as the candidate so its child fields can
  // still be read by value().
  if (candidates.length === 0) {
    const root = doc.documentElement;
    const rootName = value(root, 'SERVERCOMPANYNAME', 'CURRENTCOMPANY', 'CURRENT_COMPANY', 'COMPANYNAME', 'NAME');
    if (rootName) addCandidate(root);
  }

  // Some Tally builds return a generic OBJECT node with NAME as an attribute.
  if (candidates.length === 0) {
    Array.from(doc.getElementsByTagName('*')).forEach(el => {
      const attrName = clean(el.getAttribute('NAME') || '');
      if (attrName && /company/i.test(el.tagName)) addCandidate(el);
    });
  }

  const out: SellerInfo[] = [];
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
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CurrentCompanyDetails</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CurrentCompanyDetails" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Company</TYPE>
            <FILTER>CurrentCompanyFilter</FILTER>
            <FETCH>
              NAME, MAILINGNAME, BASICCOMPANYFORMALNAME, ADDRESS, STATENAME,
              COUNTRYNAME, PINCODE, PHONENUMBER, MOBILENUMBER, TELEPHONENUMBER,
              EMAIL, EMAILID, WEBSITE, GSTIN, PARTYGSTIN, PANNUMBER,
              INCOMETAXNUMBER, STARTINGFROM, ENDINGAT, BOOKSFROM,
              CURRENCYSYMBOL, CURRENCYFORMALNAME, BANKNAME, BANKACCOUNTNUMBER,
              IFSCODE, GUID
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="CurrentCompanyFilter">$$IsEqual:$$Name:##SVCURRENTCOMPANY</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

const CURRENT_COMPANY_XML = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanyInfo</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <OBJECT NAME="CurrentCompany">
            <LOCALFORMULA>CurrentCompany:##SVCURRENTCOMPANY</LOCALFORMULA>
          </OBJECT>
          <COLLECTION NAME="CompanyInfo">
            <OBJECTS>CurrentCompany</OBJECTS>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`

const COMPANY_OBJECT_XML = (companyName: string) => {
  const escaped = companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Object</TYPE><SUBTYPE>Company</SUBTYPE><ID TYPE="Name">${escaped}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escaped}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><FETCHLIST><FETCH>*</FETCH></FETCHLIST></DESC></BODY></ENVELOPE>`;
};

const COMPANY_XML_FALLBACK = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVIsSimpleCompany>No</SVIsSimpleCompany><SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No" NAME="List of Companies"><TYPE>Company</TYPE><NATIVEMETHOD>*</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

function currentCompanyName(xml: string): string {
  const doc = parseDocument(xml);
  if (!doc) return '';
  const names = ['SERVERCOMPANYNAME', 'CURRENTCOMPANY', 'CURRENT_COMPANY', 'COMPANYNAME', 'NAME'];
  for (const n of names) {
    const el = doc.getElementsByTagName(n)[0];
    const text = clean(el?.textContent || '');
    if (text) return text;
  }
  return '';
}

function companyProxyPath(): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
    return '/app/api/tally/request';
  }
  return '/api/tally/request';
}

async function requestCompanyTally(xml: string, config: TallyConfig): Promise<{ text: string; via: 'proxy' | 'direct' }> {
  // Company Import must use the portal backend. When the portal is mounted at
  // /app, the old /api URL hits the website/tunnel instead of the portal server.
  // Calling /app/api keeps the request on the same portal origin and avoids CORS.
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
  // Primary path: ask Tally for the Company master whose Name equals the
  // company currently open in Tally. This avoids the fragile two-request
  // "discover name -> Object export" flow.
  try {
    const master = await requestCompanyTally(CURRENT_COMPANY_MASTER_XML, config);
    const companies = parseCompanyXml(master.text);
    if (companies.length) return companies;
  } catch (err) {
    console.warn('Current company master query failed:', err);
  }

  // Fallback: identify the open company and then request its Company object.
  let openName = '';
  try {
    const current = await requestCompanyTally(CURRENT_COMPANY_XML, config);
    openName = currentCompanyName(current.text);
    if (openName) {
      const detail = await requestCompanyTally(COMPANY_OBJECT_XML(openName), config);
      const companies = parseCompanyXml(detail.text);
      if (companies.length) return companies;
    }
  } catch (err) {
    console.warn('Current company object fallback failed:', err);
  }

  // Final fallback for Tally builds that reject Object/Company.
  try {
    const fallback = await requestCompanyTally(COMPANY_XML_FALLBACK, config);
    const companies = parseCompanyXml(fallback.text);
    if (companies.length) {
      if (openName) {
        const exact = companies.filter(c => c.name.toLowerCase() === openName.toLowerCase());
        if (exact.length) return exact;
      }
      return companies;
    }
  } catch (err) {
    console.warn('List of Companies fallback failed:', err);
  }

  throw new Error(openName
    ? `Tally ne current company "${openName}" ka Company master return nahi kiya.`
    : 'Tally connected hai, lekin current/open company ka naam Tally response me nahi mila.');
}

export function parseCompaniesXML(xml: string): SellerInfo[] {
  return parseCompanyXml(xml);
}
