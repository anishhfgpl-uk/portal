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

function parseCompanyXml(xml: string): SellerInfo[] {
  const repaired = String(xml || '')
    .replace(/^\uFEFF/, '')
    .replace(/&(?!#(?:\d+|x[0-9a-fA-F]+);|[A-Za-z][A-Za-z0-9]+;)/g, '&amp;');
  const doc = new DOMParser().parseFromString(repaired, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];

  const candidates: Element[] = [];
  Array.from(doc.getElementsByTagName('COMPANY')).forEach(x => candidates.push(x));
  Array.from(doc.getElementsByTagName('CURRENTCOMPANY')).forEach(x => candidates.push(x));
  Array.from(doc.getElementsByTagName('TALLYMESSAGE')).forEach(x => {
    const company = x.getElementsByTagName('COMPANY')[0];
    if (company) candidates.push(company);
  });

  const out: SellerInfo[] = [];
  const seen = new Set<string>();
  candidates.forEach((comp, index) => {
    const name = value(comp, 'NAME', 'BASICCOMPANYNAME', 'FORMALNAME', 'CURRENTCOMPANY') || clean(comp.getAttribute('NAME') || '');
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

  if (!out.length) {
    const current = clean(doc.getElementsByTagName('SVCURRENTCOMPANY')[0]?.textContent || '');
    if (current) {
      out.push({
        id: `comp-tally-current-${Date.now()}`,
        name: current,
        mailingName: current,
        address: '', state: '', stateCode: '', country: 'India',
        phone: '', mobile: '', email: '', website: '', gstin: '', pan: '', isDefault: true,
      });
    }
  }
  return out;
}

// TallyPrime's Company collection uses the singular FILTER element. The previous
// request used FILTERS, which can return an empty collection on TallyPrime even
// though the HTTP connection itself succeeds. We also request native Company
// methods so GSTIN/address/mobile/etc. are returned from the open company.
const COMPANY_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurrentCompanyProfile</ID></HEADER><BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY>##SVCURRENTCOMPANY</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="CurrentCompanyProfile" ISMODIFY="No"><TYPE>Company</TYPE><NATIVEMETHOD>*</NATIVEMETHOD><FILTER>IsCurrentCompany</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="IsCurrentCompany">$$IsEqual:$Name:##SVCURRENTCOMPANY</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export { DEFAULT_TALLY_CONFIG };

export async function fetchCompaniesFromTally(config: TallyConfig = DEFAULT_TALLY_CONFIG): Promise<SellerInfo[]> {
  const result = await sendTallyRequest(COMPANY_XML, config);
  const companies = parseCompanyXml(result.text);
  if (!companies.length) {
    throw new Error('Tally connected hai, lekin current company profile response nahi mila. TallyPrime me company open rakhein.');
  }
  return companies;
}

export function parseCompaniesXML(xml: string): SellerInfo[] {
  return parseCompanyXml(xml);
}
