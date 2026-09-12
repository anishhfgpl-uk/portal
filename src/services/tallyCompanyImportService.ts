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
  Array.from(doc.getElementsByTagName('CURRENT_COMPANY')).forEach(x => candidates.push(x));
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

  return out;
}

// Tally's CompanyInfo pattern reliably identifies the OPEN company.  We explicitly
// expose the company object's native fields through local formulas so this works
// even when a TallyPrime release does not return COMPANY records from a generic
// Company collection. This is the important difference from the previous query.
const COMPANY_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><OBJECT NAME="CurrentCompany"><LOCALFORMULA>CompanyName:$Name</LOCALFORMULA><LOCALFORMULA>MailingName:$MailingName</LOCALFORMULA><LOCALFORMULA>FormalName:$BasicCompanyFormalName</LOCALFORMULA><LOCALFORMULA>Address:$Address</LOCALFORMULA><LOCALFORMULA>State:$StateName</LOCALFORMULA><LOCALFORMULA>Country:$CountryName</LOCALFORMULA><LOCALFORMULA>PIN:$PinCode</LOCALFORMULA><LOCALFORMULA>Phone:$PhoneNumber</LOCALFORMULA><LOCALFORMULA>Mobile:$MobileNumber</LOCALFORMULA><LOCALFORMULA>Email:$Email</LOCALFORMULA><LOCALFORMULA>Website:$Website</LOCALFORMULA><LOCALFORMULA>GSTIN:$GSTIN</LOCALFORMULA><LOCALFORMULA>PartyGSTIN:$PartyGSTIN</LOCALFORMULA><LOCALFORMULA>PAN:$PANNumber</LOCALFORMULA><LOCALFORMULA>IncomeTaxNumber:$IncomeTaxNumber</LOCALFORMULA><LOCALFORMULA>StartingFrom:$StartingFrom</LOCALFORMULA><LOCALFORMULA>BooksFrom:$BooksFrom</LOCALFORMULA><LOCALFORMULA>CurrencySymbol:$CurrencySymbol</LOCALFORMULA><LOCALFORMULA>CurrencyFormalName:$CurrencyFormalName</LOCALFORMULA><LOCALFORMULA>GUID:$GUID</LOCALFORMULA></OBJECT><COLLECTION NAME="CompanyInfo"><OBJECTS>CurrentCompany</OBJECTS><NATIVEMETHOD>*</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

const COMPANY_XML_FALLBACK = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVIsSimpleCompany>No</SVIsSimpleCompany><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No" NAME="List of Companies"><TYPE>Company</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>StartingFrom</NATIVEMETHOD><NATIVEMETHOD>BooksFrom</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export { DEFAULT_TALLY_CONFIG };

export async function fetchCompaniesFromTally(config: TallyConfig = DEFAULT_TALLY_CONFIG): Promise<SellerInfo[]> {
  // 1) Current/open company: this is the primary path.
  try {
    const result = await sendTallyRequest(COMPANY_XML, config);
    const companies = parseCompanyXml(result.text);
    if (companies.length > 0) return companies;
  } catch (err) {
    console.warn('Current CompanyInfo query failed; trying List of Companies fallback:', err);
  }

  // 2) Safe fallback: at least get the company name and dates instead of showing
  // the misleading "current company response not found" message.
  try {
    const result = await sendTallyRequest(COMPANY_XML_FALLBACK, config);
    const companies = parseCompanyXml(result.text);
    if (companies.length > 0) return companies;
  } catch (err) {
    console.warn('List of Companies fallback failed:', err);
  }

  throw new Error('Tally connected hai, lekin current company master data Tally ne return nahi kiya.');
}

export function parseCompaniesXML(xml: string): SellerInfo[] {
  return parseCompanyXml(xml);
}
