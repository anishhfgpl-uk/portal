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
  Array.from(doc.getElementsByTagName('COMPANY')).forEach(x => candidates.push(x));
  Array.from(doc.getElementsByTagName('CURRENTCOMPANY')).forEach(x => candidates.push(x));
  Array.from(doc.getElementsByTagName('CURRENT_COMPANY')).forEach(x => candidates.push(x));
  Array.from(doc.getElementsByTagName('TALLYMESSAGE')).forEach(x => {
    const company = x.getElementsByTagName('COMPANY')[0];
    if (company) candidates.push(company);
  });

  const out: SellerInfo[] = [];
  const seen = new Set<string>();
  candidates.forEach((comp, index) => {
    const name = value(comp, 'NAME', 'BASICCOMPANYNAME', 'FORMALNAME', 'CURRENTCOMPANY', 'SERVERCOMPANYNAME') || clean(comp.getAttribute('NAME') || '');
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

// Step 1: Tally's documented CompanyInfo request identifies the currently loaded company.
// It is intentionally kept small; CompanyInfo is not a full Company master export.
const CURRENT_COMPANY_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><OBJECT NAME="CurrentCompany"><LOCALFORMULA>CurrentCompany:##SVCURRENTCOMPANY</LOCALFORMULA></OBJECT><COLLECTION NAME="CompanyInfo"><OBJECTS>CurrentCompany</OBJECTS></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

// Step 2: once we know the exact open company name, ask Tally for the actual Company object.
// This avoids relying on arbitrary LOCALFORMULA field names, which was the failure in the
// previous implementation. FETCH * lets TallyPrime return the fields supported by its version.
const COMPANY_OBJECT_XML = (companyName: string) => {
  const escaped = companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Object</TYPE><SUBTYPE>Company</SUBTYPE><ID TYPE="Name">${escaped}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escaped}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><FETCHLIST><FETCH>*</FETCH></FETCHLIST></DESC></BODY></ENVELOPE>`;
};

const COMPANY_XML_FALLBACK = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVIsSimpleCompany>No</SVIsSimpleCompany><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No" NAME="List of Companies"><TYPE>Company</TYPE><NATIVEMETHOD>*</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

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

export { DEFAULT_TALLY_CONFIG };

export async function fetchCompaniesFromTally(config: TallyConfig = DEFAULT_TALLY_CONFIG): Promise<SellerInfo[]> {
  // 1) Identify the company actually open in TallyPrime.
  const current = await sendTallyRequest(CURRENT_COMPANY_XML, config);
  const openName = currentCompanyName(current.text);

  if (openName) {
    // 2) Fetch the complete Company master for that exact company.
    try {
      const detail = await sendTallyRequest(COMPANY_OBJECT_XML(openName), config);
      const companies = parseCompanyXml(detail.text);
      if (companies.length) return companies;
    } catch (err) {
      console.warn('Company object export failed:', err);
    }
  }

  // 3) Safe fallback for Tally builds that reject Object/Company. This still returns
  // company records instead of falsely claiming that Tally is disconnected.
  try {
    const fallback = await sendTallyRequest(COMPANY_XML_FALLBACK, config);
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
