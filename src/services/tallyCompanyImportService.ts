import { SellerInfo, TallyConfig } from '../types';
import { sendTallyRequest, DEFAULT_TALLY_CONFIG } from './tallyService';
import { extractPanFromGstin, extractStateCodeFromGstin, getStateCodeByName } from '../utils/gstUtils';

const clean = (v: string) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();

function value(el: Element, name: string): string {
  const attr = el.getAttribute(name) || el.getAttribute(name.toUpperCase()) || el.getAttribute(name.toLowerCase());
  if (attr) return clean(attr);
  return clean(el.getElementsByTagName(name)[0]?.textContent || '');
}

function parseCompanyXml(xml: string): SellerInfo[] {
  const repaired = String(xml || '').replace(/^\uFEFF/, '').replace(/&(?!#(?:\d+|x[0-9a-fA-F]+);|[A-Za-z][A-Za-z0-9]+;)/g, '&amp;');
  const doc = new DOMParser().parseFromString(repaired, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];

  const elements = Array.from(doc.getElementsByTagName('COMPANY'));
  const out: SellerInfo[] = [];
  elements.forEach((comp, index) => {
    const name = value(comp, 'NAME') || value(comp, 'BASICCOMPANYNAME');
    if (!name) return;

    const addressNodes = Array.from(comp.getElementsByTagName('ADDRESS'));
    const address = addressNodes.map(x => clean(x.textContent || '')).filter(Boolean).join(', ') || value(comp, 'ADDRESS');
    const state = value(comp, 'STATENAME') || value(comp, 'STATE');
    const country = value(comp, 'COUNTRYNAME') || value(comp, 'COUNTRY') || 'India';
    const gstin = (value(comp, 'GSTIN') || value(comp, 'PARTYGSTIN') || value(comp, 'VATREGISTRATIONNO')).toUpperCase();
    const stateCode = extractStateCodeFromGstin(gstin) || getStateCodeByName(state) || '';
    const pan = (value(comp, 'PANNUMBER') || value(comp, 'INCOMETAXNUMBER') || (gstin ? extractPanFromGstin(gstin) : '')).toUpperCase();
    const pincode = value(comp, 'PINCODE') || (address.match(/\b\d{6}\b/)?.[0] || '');
    const mobile = value(comp, 'MOBILENUMBER') || value(comp, 'MOBILE');
    const phone = value(comp, 'PHONENUMBER') || value(comp, 'TELEPHONENUMBER') || value(comp, 'PHONE') || mobile;

    out.push({
      id: `comp-tally-${index + 1}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      name,
      tradeName: value(comp, 'MAILINGNAME') || undefined,
      mailingName: value(comp, 'MAILINGNAME') || name,
      address,
      state: state || (stateCode ? stateCode : 'Delhi'),
      stateCode,
      country,
      pincode,
      phone,
      mobile,
      email: value(comp, 'EMAIL') || value(comp, 'EMAILID'),
      website: value(comp, 'WEBSITE'),
      gstin,
      pan,
      financialYearFrom: value(comp, 'STARTINGFROM'),
      booksBeginningFrom: value(comp, 'BOOKSFROM'),
      currencySymbol: value(comp, 'CURRENCYSYMBOL') || '₹',
      currencyFormalName: value(comp, 'CURRENCYFORMALNAME') || 'INR',
      tallyGuid: value(comp, 'GUID'),
      bankName: value(comp, 'BANKNAME'),
      bankAccountNo: value(comp, 'BANKACCOUNTNUMBER') || value(comp, 'BANKACCOUNTNO'),
      bankIfsc: (value(comp, 'IFSCODE') || value(comp, 'BANKIFSC')).toUpperCase(),
    });
  });

  if (!out.length) {
    const current = clean(doc.getElementsByTagName('SVCURRENTCOMPANY')[0]?.textContent || '');
    if (current) out.push({ id:`comp-tally-current-${Date.now()}`, name:current, mailingName:current, address:'', state:'Delhi', stateCode:'07', country:'India', phone:'', mobile:'', email:'', website:'', gstin:'', pan:'', isDefault:true });
  }
  return out;
}

const COMPANY_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurrentCompanyProfile</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="CurrentCompanyProfile" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>NAME,MAILINGNAME,BASICCOMPANYFORMALNAME,ADDRESS,STATENAME,COUNTRYNAME,PINCODE,PHONENUMBER,MOBILENUMBER,TELEPHONENUMBER,EMAIL,EMAILID,WEBSITE,GSTIN,PARTYGSTIN,VATREGISTRATIONNO,PANNUMBER,INCOMETAXNUMBER,STARTINGFROM,ENDINGAT,BOOKSFROM,CURRENCYSYMBOL,CURRENCYFORMALNAME,BANKNAME,BANKACCOUNTNUMBER,IFSCODE,GUID</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export { DEFAULT_TALLY_CONFIG };
export async function fetchCompaniesFromTally(config: TallyConfig = DEFAULT_TALLY_CONFIG): Promise<SellerInfo[]> {
  const result = await sendTallyRequest(COMPANY_XML, config);
  const companies = parseCompanyXml(result.text);
  if (!companies.length) throw new Error('Tally connected hai, lekin current company ki profile details XML mein nahi mili.');
  return companies;
}

export function parseCompaniesXML(xml: string): SellerInfo[] {
  return parseCompanyXml(xml);
}
