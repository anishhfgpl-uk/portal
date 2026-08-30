import { Invoice, SellerInfo, Party, StockItem } from '../types';
import { INDIAN_STATES, getStateCodeByName, getStateNameByCode, extractStateCodeFromGstin } from '../utils/gstUtils';

export interface Gstr1Issue {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  field: 'gstin' | 'pos' | 'hsn' | 'date' | 'tax' | 'invoiceNo' | 'uqc' | 'sellerGstin';
  severity: 'error' | 'warning';
  title: string;
  description: string;
  autoFixable: boolean;
  proposedFix?: string;
}

export interface Gstr1ValidationResult {
  isValid: boolean;
  readinessScore: number; // 0 to 100
  totalInvoices: number;
  errorCount: number;
  warningCount: number;
  issues: Gstr1Issue[];
}

export interface Gstr1B2BInvoiceItem {
  num: number;
  itm_det: {
    rt: number;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
  };
}

export interface Gstr1B2BInvoice {
  inum: string;
  idt: string; // DD-MM-YYYY
  val: number;
  pos: string;
  rchrg: string; // "N"
  inv_typ: string; // "R"
  itms: Gstr1B2BInvoiceItem[];
  // Extra UI helpers
  partyName?: string;
  rawInvoice?: Invoice;
}

export interface Gstr1B2BCustomerGroup {
  ctin: string;
  cpty?: string;
  cfs?: string;
  inv: Gstr1B2BInvoice[];
}

export interface Gstr1B2CLGroup {
  pos: string;
  inv: {
    inum: string;
    idt: string;
    val: number;
    itms: {
      num: number;
      itm_det: {
        rt: number;
        txval: number;
        iamt: number;
        csamt: number;
      };
    }[];
    partyName?: string;
  }[];
}

export interface Gstr1B2CSEntry {
  sply_ty: 'INTRA' | 'INTER';
  pos: string;
  typ: 'OE'; // Other than E-Commerce
  rt: number;
  txval: number;
  camt: number;
  samt: number;
  iamt: number;
  csamt: number;
  stateName?: string;
}

export interface Gstr1HsnItem {
  num: number;
  hsn_sc: string;
  desc: string;
  uqc: string;
  qty: number;
  val: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface Gstr1DocIssue {
  doc_det: {
    doc_num: number;
    doc_typ: string;
    docs: {
      num: number;
      from: string;
      to: string;
      totnum: number;
      canc: number;
      net_issue: number;
    }[];
  }[];
}

export interface Gstr1JsonSchema {
  gstin: string;
  fp: string; // MMYYYY e.g. 042025
  version: string;
  hash: string;
  gt?: number;
  cur_gt?: number;
  b2b?: Gstr1B2BCustomerGroup[];
  b2cl?: Gstr1B2CLGroup[];
  b2cs?: Gstr1B2CSEntry[];
  hsn?: {
    data: Gstr1HsnItem[];
  };
  doc_issue?: Gstr1DocIssue;
}

export interface Gstr1TableSummary {
  filingPeriod: string; // MMYYYY
  periodLabel: string;
  financialYear: string;
  sellerGstin: string;
  sellerName: string;
  
  // Section Invoices and Aggregates
  b2bGroups: Gstr1B2BCustomerGroup[];
  b2clGroups: Gstr1B2CLGroup[];
  b2csEntries: Gstr1B2CSEntry[];
  hsnItems: Gstr1HsnItem[];
  docSummary: Gstr1DocIssue;

  // Counts & Totals
  b2bInvoiceCount: number;
  b2bTaxable: number;
  b2bCgst: number;
  b2bSgst: number;
  b2bIgst: number;
  b2bTotalTax: number;
  b2bGrandTotal: number;

  b2clInvoiceCount: number;
  b2clTaxable: number;
  b2clIgst: number;
  b2clGrandTotal: number;

  b2csCount: number;
  b2csTaxable: number;
  b2csCgst: number;
  b2csSgst: number;
  b2csIgst: number;
  b2csTotalTax: number;
  b2csGrandTotal: number;

  hsnTotalTaxable: number;
  hsnTotalTax: number;
  hsnTotalVal: number;

  grandTaxable: number;
  grandCgst: number;
  grandSgst: number;
  grandIgst: number;
  grandTotalTax: number;
  grandInvoiceValue: number;
  totalInvoiceCount: number;
}

/**
 * Standard GST Unit Quantity Code (UQC) mapping
 */
export function mapToStandardUqc(unit: string | undefined): string {
  if (!unit) return 'NOS-NUMBERS';
  const u = unit.trim().toUpperCase();

  if (['NOS', 'NO', 'NUMBERS', 'NUMBER', 'UNIT', 'UNITS'].includes(u)) return 'NOS-NUMBERS';
  if (['PCS', 'PIECE', 'PIECES', 'PC'].includes(u)) return 'PCS-PIECES';
  if (['KGS', 'KG', 'KILOGRAM', 'KILOGRAMS'].includes(u)) return 'KGS-KILOGRAMS';
  if (['MTR', 'METER', 'METERS', 'METRE', 'M'].includes(u)) return 'MTR-METERS';
  if (['BOX', 'BOXES', 'BX'].includes(u)) return 'BOX-BOX';
  if (['ROL', 'ROLL', 'ROLLS', 'RL'].includes(u)) return 'ROL-ROLLS';
  if (['SET', 'SETS', 'ST'].includes(u)) return 'SET-SETS';
  if (['BAG', 'BAGS', 'BG'].includes(u)) return 'BAG-BAGS';
  if (['BTL', 'BOTTLE', 'BOTTLES'].includes(u)) return 'BTL-BOTTLES';
  if (['CAN', 'CANS'].includes(u)) return 'CAN-CANS';
  if (['CTN', 'CARTON', 'CARTONS'].includes(u)) return 'CTN-CARTONS';
  if (['DOZ', 'DOZEN', 'DOZENS'].includes(u)) return 'DOZ-DOZENS';
  if (['LTR', 'LITRE', 'LITRES', 'L'].includes(u)) return 'LTR-LITRES';
  if (['PAC', 'PACK', 'PACKS', 'PKT'].includes(u)) return 'PAC-PACKS';
  if (['PAI', 'PAIR', 'PAIRS', 'PRS'].includes(u)) return 'PAI-PAIRS';
  if (['QTL', 'QUINTAL', 'QUINTALS'].includes(u)) return 'QTL-QUINTAL';
  if (['SQF', 'SQFT', 'SQ FT', 'SQUARE FEET'].includes(u)) return 'SQF-SQUARE FEET';
  if (['SQM', 'SQMT', 'SQ MT', 'SQUARE METRES'].includes(u)) return 'SQM-SQUARE METRES';
  if (['TON', 'TONS', 'TONNE', 'TONNES', 'MT'].includes(u)) return 'TON-TONNES';
  if (['TUB', 'TUBE', 'TUBES'].includes(u)) return 'TUB-TUBES';

  return 'OTH-OTHERS';
}

/**
 * Validates 15-character GSTIN string
 */
export function isValidGstin(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(clean);
}

/**
 * Validates invoice number (GST rules: max 16 alphanumeric characters, slashes and hyphens allowed)
 */
export function isValidInvoiceNumber(invNo: string): boolean {
  if (!invNo) return false;
  const clean = invNo.trim();
  if (clean.length > 16 || clean.length === 0) return false;
  // Only alphanumeric, hyphen, slash allowed
  return /^[a-zA-Z0-9\/\-]+$/.test(clean);
}

/**
 * Formats standard date from YYYY-MM-DD or other formats into DD-MM-YYYY for GST Portal
 */
export function formatToGstPortalDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();

  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;

  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    return `${d}-${m}-${y}`;
  }

  // If DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    return `${d}-${m}-${y}`;
  }

  // If YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    return `${d}-${m}-${y}`;
  }

  // Fallback to current date or parsed date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return clean;
}

/**
 * Extracts 2-digit Place of Supply (POS) code reliably
 */
export function resolvePosCode(invoice: Invoice, fallbackSellerStateCode: string): string {
  // 1. Direct stateCode
  if (invoice.stateCode && /^\d{2}$/.test(invoice.stateCode.trim())) {
    return invoice.stateCode.trim().padStart(2, '0');
  }

  // 2. From Buyer GSTIN
  if (invoice.gstin) {
    const fromGst = extractStateCodeFromGstin(invoice.gstin);
    if (fromGst) return fromGst;
  }

  // 3. From partyState string
  if (invoice.partyState) {
    const code = getStateCodeByName(invoice.partyState);
    if (code) return code;
  }

  // 4. Default to Seller state code
  return fallbackSellerStateCode.padStart(2, '0') || '07';
}

/**
 * Validates all invoices against Government GST Portal business rules.
 * Generates actionable error & warning list to ensure 0% portal upload failure.
 */
export function validateInvoicesForGstr1(
  invoices: Invoice[],
  sellerInfo: SellerInfo,
  filingPeriod: string // MMYYYY e.g. "042025"
): Gstr1ValidationResult {
  const issues: Gstr1Issue[] = [];

  // 1. Check Seller GSTIN
  if (!sellerInfo.gstin || !isValidGstin(sellerInfo.gstin)) {
    issues.push({
      id: 'err-seller-gstin',
      invoiceId: 'seller',
      invoiceNo: 'COMPANY PROFILE',
      field: 'sellerGstin',
      severity: 'error',
      title: 'Invalid or Missing Company GSTIN',
      description: `Your registered GSTIN (${sellerInfo.gstin || 'EMPTY'}) is invalid. GST portal requires a 15-character valid GSTIN.`,
      autoFixable: false,
      proposedFix: 'Update GSTIN in Company Profile',
    });
  }

  const sellerStateCode = sellerInfo.stateCode || extractStateCodeFromGstin(sellerInfo.gstin) || '07';

  // 2. Inspect Each Invoice
  invoices.forEach((inv) => {
    // Invoice Number Rule: max 16 chars, only [A-Za-z0-9/-]
    const cleanInvNo = inv.invoiceNo ? inv.invoiceNo.trim() : '';
    if (!cleanInvNo) {
      issues.push({
        id: `err-invno-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: 'BLANK',
        field: 'invoiceNo',
        severity: 'error',
        title: 'Missing Invoice Number',
        description: 'Invoice number is mandatory for GSTR-1 outward supply records.',
        autoFixable: false,
      });
    } else if (cleanInvNo.length > 16) {
      issues.push({
        id: `err-invlen-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: cleanInvNo,
        field: 'invoiceNo',
        severity: 'error',
        title: 'Invoice Number Exceeds 16 Characters',
        description: `"${cleanInvNo}" has ${cleanInvNo.length} characters. GST portal strictly limits invoice numbers to max 16 characters.`,
        autoFixable: true,
        proposedFix: cleanInvNo.slice(0, 16),
      });
    } else if (!/^[a-zA-Z0-9\/\-]+$/.test(cleanInvNo)) {
      const sanitized = cleanInvNo.replace(/[^a-zA-Z0-9\/\-]/g, '-');
      issues.push({
        id: `err-invchar-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: cleanInvNo,
        field: 'invoiceNo',
        severity: 'warning',
        title: 'Special Characters in Invoice Number',
        description: `"${cleanInvNo}" contains spaces or forbidden symbols. Only letters, digits, '/' and '-' are permitted.`,
        autoFixable: true,
        proposedFix: sanitized,
      });
    }

    // Date Validation
    if (!inv.invoiceDate) {
      issues.push({
        id: `err-date-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        field: 'date',
        severity: 'error',
        title: 'Missing Invoice Date',
        description: 'Invoice date is mandatory for GSTR-1 return filing.',
        autoFixable: false,
      });
    }

    // POS Validation
    const pos = resolvePosCode(inv, sellerStateCode);
    const validPosCodes = INDIAN_STATES.map((s) => s.code);
    if (!validPosCodes.includes(pos)) {
      issues.push({
        id: `err-pos-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        field: 'pos',
        severity: 'error',
        title: 'Invalid Place of Supply (POS)',
        description: `POS "${pos}" is not a recognized 2-digit Indian State code.`,
        autoFixable: true,
        proposedFix: sellerStateCode,
      });
    }

    // Buyer GSTIN validation (if B2B)
    const isRegistered = Boolean(inv.gstin && inv.gstin.trim().length > 0);
    if (isRegistered) {
      const cleanGst = inv.gstin.trim().toUpperCase();
      if (!isValidGstin(cleanGst)) {
        issues.push({
          id: `err-bgst-${inv.id}`,
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          field: 'gstin',
          severity: 'error',
          title: 'Invalid Buyer GSTIN Format',
          description: `Buyer GSTIN "${inv.gstin}" on ${inv.partyName} fails standard 15-digit checksum format.`,
          autoFixable: false,
        });
      } else {
        // Check state code matching
        const buyerStatePrefix = cleanGst.substring(0, 2);
        if (buyerStatePrefix !== pos) {
          issues.push({
            id: `warn-pos-mismatch-${inv.id}`,
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            field: 'pos',
            severity: 'warning',
            title: 'POS Differs from Buyer GSTIN State',
            description: `Buyer GSTIN is from state code ${buyerStatePrefix} (${getStateNameByCode(buyerStatePrefix)}), but POS is set to ${pos} (${getStateNameByCode(pos)}).`,
            autoFixable: true,
            proposedFix: buyerStatePrefix,
          });
        }
      }
    }

    // Items & HSN Validation
    if (!inv.items || inv.items.length === 0) {
      issues.push({
        id: `err-items-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        field: 'hsn',
        severity: 'error',
        title: 'No Line Items in Invoice',
        description: 'Invoice has zero items. GST Portal requires at least one taxable or nil-rated item.',
        autoFixable: false,
      });
    } else {
      inv.items.forEach((item, itemIdx) => {
        const cleanHsn = item.hsn ? item.hsn.trim() : '';
        if (!cleanHsn) {
          issues.push({
            id: `err-hsn-${inv.id}-${itemIdx}`,
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            field: 'hsn',
            severity: 'error',
            title: `Missing HSN Code for "${item.name}"`,
            description: `Table 12 HSN Summary requires a valid 4, 6 or 8-digit HSN/SAC code for every product line.`,
            autoFixable: true,
            proposedFix: '84713010',
          });
        } else if (cleanHsn.length < 2) {
          issues.push({
            id: `warn-hsn-len-${inv.id}-${itemIdx}`,
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            field: 'hsn',
            severity: 'warning',
            title: `Short HSN Code "${cleanHsn}" on "${item.name}"`,
            description: 'GST Portal mandates minimum 4 digits for turnover > ₹5 Cr, and min 2 digits for small taxpayers.',
            autoFixable: false,
          });
        }
      });
    }

    // Tax Split Validation (Intra-state vs Inter-state)
    const isInterState = pos !== sellerStateCode;
    if (isInterState && (inv.totalCgst > 0 || inv.totalSgst > 0) && inv.totalIgst === 0) {
      issues.push({
        id: `err-taxsplit-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        field: 'tax',
        severity: 'warning',
        title: 'Inter-State Supply with CGST/SGST',
        description: `POS is ${pos} (Different from Seller State ${sellerStateCode}), but taxes are booked under CGST/SGST instead of IGST.`,
        autoFixable: true,
        proposedFix: 'Recalculate as IGST',
      });
    } else if (!isInterState && inv.totalIgst > 0 && inv.totalCgst === 0) {
      issues.push({
        id: `err-taxsplit-intra-${inv.id}`,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        field: 'tax',
        severity: 'warning',
        title: 'Intra-State Supply with IGST',
        description: `POS is ${pos} (Same as Seller State ${sellerStateCode}), but taxes are booked under IGST instead of CGST + SGST.`,
        autoFixable: true,
        proposedFix: 'Recalculate as CGST + SGST',
      });
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  let readinessScore = 100;
  if (invoices.length === 0) {
    readinessScore = 0;
  } else {
    const penalty = errorCount * 25 + warningCount * 5;
    readinessScore = Math.max(0, Math.min(100, 100 - penalty));
  }

  return {
    isValid: errorCount === 0,
    readinessScore,
    totalInvoices: invoices.length,
    errorCount,
    warningCount,
    issues,
  };
}

/**
 * Automatically corrects formatting flaws in invoices before filing:
 * - Trims and capitalizes GSTINs
 * - Cleans forbidden characters from invoice numbers
 * - Standardizes POS codes from state / GSTIN
 * - Auto-resolves standard UQC codes
 */
export function autoFixInvoicesForGstr1(invoices: Invoice[], sellerInfo: SellerInfo): Invoice[] {
  const sellerStateCode = sellerInfo.stateCode || extractStateCodeFromGstin(sellerInfo.gstin) || '07';

  return invoices.map((inv) => {
    // 1. Sanitize invoice number
    let cleanNo = (inv.invoiceNo || `INV-${Date.now().toString().slice(-4)}`).trim();
    cleanNo = cleanNo.replace(/[^a-zA-Z0-9\/\-]/g, '-').slice(0, 16);

    // 2. Sanitize GSTIN
    const cleanGstin = (inv.gstin || '').trim().toUpperCase();

    // 3. Resolve POS
    const pos = resolvePosCode(inv, sellerStateCode);
    const partyStateName = getStateNameByCode(pos) || inv.partyState || sellerInfo.state;

    // 4. Sanitize Items & Tax split
    const isInterState = pos !== sellerStateCode;

    let subtotalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const fixedItems = (inv.items || []).map((item, idx) => {
      const cleanHsn = (item.hsn || '').trim() || '84713010';
      const uqc = mapToStandardUqc(item.unit);
      const qty = Number(item.qty) || 1;
      const rate = Number(item.rate) || 0;
      const discount = Number(item.discountPercent) || 0;
      const gstRate = Number(item.gstRate) || 18;

      const lineGross = qty * rate;
      const discountAmt = (lineGross * discount) / 100;
      const taxable = Math.round((lineGross - discountAmt) * 100) / 100;

      let itemCgst = 0;
      let itemSgst = 0;
      let itemIgst = 0;

      if (isInterState) {
        itemIgst = Math.round(((taxable * gstRate) / 100) * 100) / 100;
      } else {
        const halfRate = gstRate / 2;
        itemCgst = Math.round(((taxable * halfRate) / 100) * 100) / 100;
        itemSgst = Math.round(((taxable * halfRate) / 100) * 100) / 100;
      }

      const totalAmount = taxable + itemCgst + itemSgst + itemIgst;

      subtotalTaxable += taxable;
      totalCgst += itemCgst;
      totalSgst += itemSgst;
      totalIgst += itemIgst;

      return {
        ...item,
        hsn: cleanHsn,
        unit: uqc,
        taxableAmount: taxable,
        cgstAmount: itemCgst,
        sgstAmount: itemSgst,
        igstAmount: itemIgst,
        totalAmount,
      };
    });

    // Additional charges
    const freightTaxable = Number(inv.freightTaxable) || 0;
    const freightGstRate = Number(inv.freightGstRate) || 18;
    let freightCgst = 0;
    let freightSgst = 0;
    let freightIgst = 0;

    if (freightTaxable > 0) {
      if (isInterState) {
        freightIgst = Math.round(((freightTaxable * freightGstRate) / 100) * 100) / 100;
      } else {
        freightCgst = Math.round(((freightTaxable * (freightGstRate / 2)) / 100) * 100) / 100;
        freightSgst = Math.round(((freightTaxable * (freightGstRate / 2)) / 100) * 100) / 100;
      }
      subtotalTaxable += freightTaxable;
      totalCgst += freightCgst;
      totalSgst += freightSgst;
      totalIgst += freightIgst;
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    const unroundedGrand = subtotalTaxable + totalTax;
    const grandTotal = Math.round(unroundedGrand);
    const roundOff = Math.round((grandTotal - unroundedGrand) * 100) / 100;

    return {
      ...inv,
      invoiceNo: cleanNo,
      gstin: cleanGstin,
      stateCode: pos,
      partyState: partyStateName,
      isInterState,
      items: fixedItems,
      subtotalTaxable: Math.round(subtotalTaxable * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalIgst: Math.round(totalIgst * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      roundOff,
      grandTotal,
    };
  });
}

/**
 * Calculates GSTR-1 tables (B2B, B2CL, B2CS, Table 12 HSN, Table 13 Docs)
 */
export function calculateGstr1Summary(
  invoices: Invoice[],
  sellerInfo: SellerInfo,
  filingPeriod: string // MMYYYY e.g. "042025"
): Gstr1TableSummary {
  const sellerStateCode = sellerInfo.stateCode || extractStateCodeFromGstin(sellerInfo.gstin) || '07';
  const B2CL_THRESHOLD = 250000; // Rs 2,50,000 for inter-state unregistered

  // 1. Group B2B (Registered Buyers with GSTIN)
  const b2bMap = new Map<string, Gstr1B2BInvoice[]>();
  const b2clGroupsMap = new Map<string, Gstr1BLCInvoiceItem[]>();
  const b2csMap = new Map<string, Gstr1B2CSEntry>(); // key: `${sply_ty}_${pos}_${rt}`
  const hsnMap = new Map<string, Gstr1HsnItem>(); // key: `${hsn}_${uqc}_${rt}`

  const allInvoiceNumbers: string[] = [];

  let b2bTaxable = 0;
  let b2bCgst = 0;
  let b2bSgst = 0;
  let b2bIgst = 0;
  let b2bTotalTax = 0;
  let b2bGrandTotal = 0;
  let b2bCount = 0;

  let b2clTaxable = 0;
  let b2clIgst = 0;
  let b2clGrandTotal = 0;
  let b2clCount = 0;

  let b2csTaxable = 0;
  let b2csCgst = 0;
  let b2csSgst = 0;
  let b2csIgst = 0;
  let b2csTotalTax = 0;
  let b2csGrandTotal = 0;
  let b2csCount = 0;

  invoices.forEach((inv) => {
    allInvoiceNumbers.push(inv.invoiceNo);
    const pos = resolvePosCode(inv, sellerStateCode);
    const isInterState = pos !== sellerStateCode;
    const isRegistered = Boolean(inv.gstin && inv.gstin.trim().length > 0 && isValidGstin(inv.gstin.trim()));
    const portalDate = formatToGstPortalDate(inv.invoiceDate);

    // Rate breakdown for this invoice
    const rateItemMap = new Map<number, { txval: number; camt: number; samt: number; iamt: number }>();

    (inv.items || []).forEach((item) => {
      const rt = Number(item.gstRate) || 18;
      const tx = Number(item.taxableAmount) || 0;
      const camt = Number(item.cgstAmount) || 0;
      const samt = Number(item.sgstAmount) || 0;
      const iamt = Number(item.igstAmount) || 0;

      if (!rateItemMap.has(rt)) {
        rateItemMap.set(rt, { txval: 0, camt: 0, samt: 0, iamt: 0 });
      }
      const existing = rateItemMap.get(rt)!;
      existing.txval += tx;
      existing.camt += camt;
      existing.samt += samt;
      existing.iamt += iamt;

      // Table 12 HSN accumulator
      const hsnCode = (item.hsn || '84713010').trim();
      const uqc = mapToStandardUqc(item.unit);
      const hsnKey = `${hsnCode}_${uqc}`;

      if (!hsnMap.has(hsnKey)) {
        hsnMap.set(hsnKey, {
          num: hsnMap.size + 1,
          hsn_sc: hsnCode,
          desc: item.name.slice(0, 30),
          uqc,
          qty: 0,
          val: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        });
      }
      const hsnEntry = hsnMap.get(hsnKey)!;
      hsnEntry.qty += Number(item.qty) || 0;
      hsnEntry.txval += tx;
      hsnEntry.val += Number(item.totalAmount) || tx;
      hsnEntry.camt += camt;
      hsnEntry.samt += samt;
      hsnEntry.iamt += iamt;
    });

    // Additional charges into rate breakdown
    if (inv.freightTaxable && inv.freightTaxable > 0) {
      const frtRate = Number(inv.freightGstRate) || 18;
      const frtTx = Number(inv.freightTaxable) || 0;
      let frtCgst = 0;
      let frtSgst = 0;
      let frtIgst = 0;

      if (isInterState) {
        frtIgst = Number(inv.freightGstAmount) || (frtTx * frtRate) / 100;
      } else {
        frtCgst = (frtTx * (frtRate / 2)) / 100;
        frtSgst = (frtTx * (frtRate / 2)) / 100;
      }

      if (!rateItemMap.has(frtRate)) {
        rateItemMap.set(frtRate, { txval: 0, camt: 0, samt: 0, iamt: 0 });
      }
      const existing = rateItemMap.get(frtRate)!;
      existing.txval += frtTx;
      existing.camt += frtCgst;
      existing.samt += frtSgst;
      existing.iamt += frtIgst;

      // HSN for freight (SAC 9965)
      const frtHsnKey = '996511_OTH-OTHERS';
      if (!hsnMap.has(frtHsnKey)) {
        hsnMap.set(frtHsnKey, {
          num: hsnMap.size + 1,
          hsn_sc: '996511',
          desc: 'Freight Transport Services',
          uqc: 'OTH-OTHERS',
          qty: 1,
          val: frtTx + frtCgst + frtSgst + frtIgst,
          txval: frtTx,
          iamt: frtIgst,
          camt: frtCgst,
          samt: frtSgst,
          csamt: 0,
        });
      } else {
        const frtHsnEntry = hsnMap.get(frtHsnKey)!;
        frtHsnEntry.txval += frtTx;
        frtHsnEntry.val += frtTx + frtCgst + frtSgst + frtIgst;
        frtHsnEntry.camt += frtCgst;
        frtHsnEntry.samt += frtSgst;
        frtHsnEntry.iamt += frtIgst;
      }
    }

    // Classify into B2B, B2CL, or B2CS
    if (isRegistered) {
      // 1. Table 4: B2B
      const ctin = inv.gstin.trim().toUpperCase();
      const b2bItems: Gstr1B2BInvoiceItem[] = [];
      let itemSeq = 1;

      rateItemMap.forEach((vals, rt) => {
        b2bItems.push({
          num: itemSeq++,
          itm_det: {
            rt,
            txval: Math.round(vals.txval * 100) / 100,
            iamt: Math.round(vals.iamt * 100) / 100,
            camt: Math.round(vals.camt * 100) / 100,
            samt: Math.round(vals.samt * 100) / 100,
            csamt: 0,
          },
        });
      });

      const b2bInv: Gstr1B2BInvoice = {
        inum: inv.invoiceNo.trim(),
        idt: portalDate,
        val: Math.round(inv.grandTotal * 100) / 100,
        pos,
        rchrg: 'N',
        inv_typ: 'R',
        itms: b2bItems,
        partyName: inv.partyName,
        rawInvoice: inv,
      };

      if (!b2bMap.has(ctin)) {
        b2bMap.set(ctin, []);
      }
      b2bMap.get(ctin)!.push(b2bInv);

      b2bCount++;
      b2bTaxable += inv.subtotalTaxable;
      b2bCgst += inv.totalCgst;
      b2bSgst += inv.totalSgst;
      b2bIgst += inv.totalIgst;
      b2bTotalTax += inv.totalTax;
      b2bGrandTotal += inv.grandTotal;
    } else if (isInterState && inv.grandTotal > B2CL_THRESHOLD) {
      // 2. Table 5: B2C Large (Inter-state unregistered > 2.5 Lakhs)
      const b2clItems: { num: number; itm_det: { rt: number; txval: number; iamt: number; csamt: number } }[] = [];
      let itemSeq = 1;

      rateItemMap.forEach((vals, rt) => {
        b2clItems.push({
          num: itemSeq++,
          itm_det: {
            rt,
            txval: Math.round(vals.txval * 100) / 100,
            iamt: Math.round(vals.iamt * 100) / 100,
            csamt: 0,
          },
        });
      });

      if (!b2clGroupsMap.has(pos)) {
        b2clGroupsMap.set(pos, []);
      }
      b2clGroupsMap.get(pos)!.push({
        inum: inv.invoiceNo.trim(),
        idt: portalDate,
        val: Math.round(inv.grandTotal * 100) / 100,
        itms: b2clItems,
        partyName: inv.partyName,
      });

      b2clCount++;
      b2clTaxable += inv.subtotalTaxable;
      b2clIgst += inv.totalIgst;
      b2clGrandTotal += inv.grandTotal;
    } else {
      // 3. Table 7: B2C Small (Intra-state OR Inter-state <= 2.5 Lakhs)
      const sply_ty: 'INTRA' | 'INTER' = isInterState ? 'INTER' : 'INTRA';

      rateItemMap.forEach((vals, rt) => {
        const b2csKey = `${sply_ty}_${pos}_${rt}`;
        if (!b2csMap.has(b2csKey)) {
          b2csMap.set(b2csKey, {
            sply_ty,
            pos,
            typ: 'OE',
            rt,
            txval: 0,
            camt: 0,
            samt: 0,
            iamt: 0,
            csamt: 0,
            stateName: getStateNameByCode(pos),
          });
        }
        const b2csEntry = b2csMap.get(b2csKey)!;
        b2csEntry.txval += Math.round(vals.txval * 100) / 100;
        b2csEntry.camt += Math.round(vals.camt * 100) / 100;
        b2csEntry.samt += Math.round(vals.samt * 100) / 100;
        b2csEntry.iamt += Math.round(vals.iamt * 100) / 100;
      });

      b2csCount++;
      b2csTaxable += inv.subtotalTaxable;
      b2csCgst += inv.totalCgst;
      b2csSgst += inv.totalSgst;
      b2csIgst += inv.totalIgst;
      b2csTotalTax += inv.totalTax;
      b2csGrandTotal += inv.grandTotal;
    }
  });

  // Convert B2B map to array
  const b2bGroups: Gstr1B2BCustomerGroup[] = [];
  b2bMap.forEach((invList, ctin) => {
    b2bGroups.push({
      ctin,
      cpty: '',
      cfs: 'R',
      inv: invList,
    });
  });

  // Convert B2CL map to array
  const b2clGroups: Gstr1B2CLGroup[] = [];
  b2clGroupsMap.forEach((invList, pos) => {
    b2clGroups.push({
      pos,
      inv: invList,
    });
  });

  // Convert B2CS map to array
  const b2csEntries: Gstr1B2CSEntry[] = Array.from(b2csMap.values()).map((e) => ({
    ...e,
    txval: Math.round(e.txval * 100) / 100,
    camt: Math.round(e.camt * 100) / 100,
    samt: Math.round(e.samt * 100) / 100,
    iamt: Math.round(e.iamt * 100) / 100,
  }));

  // Convert HSN map to array and renumber
  let hsnSeq = 1;
  const hsnItems: Gstr1HsnItem[] = Array.from(hsnMap.values()).map((h) => ({
    ...h,
    num: hsnSeq++,
    qty: Math.round(h.qty * 100) / 100,
    txval: Math.round(h.txval * 100) / 100,
    val: Math.round(h.val * 100) / 100,
    camt: Math.round(h.camt * 100) / 100,
    samt: Math.round(h.samt * 100) / 100,
    iamt: Math.round(h.iamt * 100) / 100,
  }));

  // Table 13: Document Summary
  let docFrom = 'INV-001';
  let docTo = 'INV-001';
  if (allInvoiceNumbers.length > 0) {
    docFrom = allInvoiceNumbers[0];
    docTo = allInvoiceNumbers[allInvoiceNumbers.length - 1];
  }

  const docSummary: Gstr1DocIssue = {
    doc_det: [
      {
        doc_num: 1,
        doc_typ: 'Invoices for outward supply',
        docs: [
          {
            num: 1,
            from: docFrom,
            to: docTo,
            totnum: allInvoiceNumbers.length,
            canc: 0,
            net_issue: allInvoiceNumbers.length,
          },
        ],
      },
    ],
  };

  const hsnTotalTaxable = hsnItems.reduce((acc, h) => acc + h.txval, 0);
  const hsnTotalTax = hsnItems.reduce((acc, h) => acc + h.camt + h.samt + h.iamt, 0);
  const hsnTotalVal = hsnItems.reduce((acc, h) => acc + h.val, 0);

  const grandTaxable = b2bTaxable + b2clTaxable + b2csTaxable;
  const grandCgst = b2bCgst + b2csCgst;
  const grandSgst = b2bSgst + b2csSgst;
  const grandIgst = b2bIgst + b2clIgst + b2csIgst;
  const grandTotalTax = grandCgst + grandSgst + grandIgst;
  const grandInvoiceValue = b2bGrandTotal + b2clGrandTotal + b2csGrandTotal;

  // Format Filing Period Label
  const monthNum = parseInt(filingPeriod.slice(0, 2), 10);
  const yearNum = parseInt(filingPeriod.slice(2), 10);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = monthNames[monthNum - 1] || 'Month';
  const periodLabel = `${monthLabel} ${yearNum}`;

  // Financial Year e.g. "2025-26"
  let fyStart = yearNum;
  if (monthNum < 4) fyStart = yearNum - 1;
  const financialYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

  return {
    filingPeriod,
    periodLabel,
    financialYear,
    sellerGstin: sellerInfo.gstin || '',
    sellerName: sellerInfo.name || '',
    b2bGroups,
    b2clGroups,
    b2csEntries,
    hsnItems,
    docSummary,

    b2bInvoiceCount: b2bCount,
    b2bTaxable: Math.round(b2bTaxable * 100) / 100,
    b2bCgst: Math.round(b2bCgst * 100) / 100,
    b2bSgst: Math.round(b2bSgst * 100) / 100,
    b2bIgst: Math.round(b2bIgst * 100) / 100,
    b2bTotalTax: Math.round(b2bTotalTax * 100) / 100,
    b2bGrandTotal: Math.round(b2bGrandTotal * 100) / 100,

    b2clInvoiceCount: b2clCount,
    b2clTaxable: Math.round(b2clTaxable * 100) / 100,
    b2clIgst: Math.round(b2clIgst * 100) / 100,
    b2clGrandTotal: Math.round(b2clGrandTotal * 100) / 100,

    b2csCount,
    b2csTaxable: Math.round(b2csTaxable * 100) / 100,
    b2csCgst: Math.round(b2csCgst * 100) / 100,
    b2csSgst: Math.round(b2csSgst * 100) / 100,
    b2csIgst: Math.round(b2csIgst * 100) / 100,
    b2csTotalTax: Math.round(b2csTotalTax * 100) / 100,
    b2csGrandTotal: Math.round(b2csGrandTotal * 100) / 100,

    hsnTotalTaxable: Math.round(hsnTotalTaxable * 100) / 100,
    hsnTotalTax: Math.round(hsnTotalTax * 100) / 100,
    hsnTotalVal: Math.round(hsnTotalVal * 100) / 100,

    grandTaxable: Math.round(grandTaxable * 100) / 100,
    grandCgst: Math.round(grandCgst * 100) / 100,
    grandSgst: Math.round(grandSgst * 100) / 100,
    grandIgst: Math.round(grandIgst * 100) / 100,
    grandTotalTax: Math.round(grandTotalTax * 100) / 100,
    grandInvoiceValue: Math.round(grandInvoiceValue * 100) / 100,
    totalInvoiceCount: invoices.length,
  };
}

interface Gstr1BLCInvoiceItem {
  inum: string;
  idt: string;
  val: number;
  itms: {
    num: number;
    itm_det: {
      rt: number;
      txval: number;
      iamt: number;
      csamt: number;
    };
  }[];
  partyName?: string;
}

/**
 * Builds the official Government GST Offline Tool compliant JSON payload
 */
export function buildGstr1JsonPayload(
  summary: Gstr1TableSummary,
  previousTurnover: number = 0
): Gstr1JsonSchema {
  const payload: Gstr1JsonSchema = {
    gstin: summary.sellerGstin.trim().toUpperCase(),
    fp: summary.filingPeriod,
    version: 'GST3.1.4',
    hash: 'hash',
    gt: previousTurnover || summary.grandInvoiceValue,
    cur_gt: summary.grandInvoiceValue,
  };

  // 1. B2B Table
  if (summary.b2bGroups.length > 0) {
    payload.b2b = summary.b2bGroups.map((g) => ({
      ctin: g.ctin,
      cpty: '',
      cfs: 'R',
      inv: g.inv.map((i) => ({
        inum: i.inum,
        idt: i.idt,
        val: i.val,
        pos: i.pos,
        rchrg: i.rchrg || 'N',
        inv_typ: i.inv_typ || 'R',
        itms: i.itms.map((itm) => ({
          num: itm.num,
          itm_det: {
            rt: itm.itm_det.rt,
            txval: itm.itm_det.txval,
            iamt: itm.itm_det.iamt,
            camt: itm.itm_det.camt,
            samt: itm.itm_det.samt,
            csamt: itm.itm_det.csamt || 0,
          },
        })),
      })),
    }));
  }

  // 2. B2CL Table
  if (summary.b2clGroups.length > 0) {
    payload.b2cl = summary.b2clGroups.map((g) => ({
      pos: g.pos,
      inv: g.inv.map((i) => ({
        inum: i.inum,
        idt: i.idt,
        val: i.val,
        itms: i.itms.map((itm) => ({
          num: itm.num,
          itm_det: {
            rt: itm.itm_det.rt,
            txval: itm.itm_det.txval,
            iamt: itm.itm_det.iamt,
            csamt: itm.itm_det.csamt || 0,
          },
        })),
      })),
    }));
  }

  // 3. B2CS Table
  if (summary.b2csEntries.length > 0) {
    payload.b2cs = summary.b2csEntries.map((e) => ({
      sply_ty: e.sply_ty,
      pos: e.pos,
      typ: 'OE',
      rt: e.rt,
      txval: e.txval,
      camt: e.camt,
      samt: e.samt,
      iamt: e.iamt,
      csamt: 0,
    }));
  }

  // 4. Table 12 HSN Summary
  if (summary.hsnItems.length > 0) {
    payload.hsn = {
      data: summary.hsnItems.map((h) => ({
        num: h.num,
        hsn_sc: h.hsn_sc,
        desc: h.desc,
        uqc: h.uqc,
        qty: h.qty,
        val: h.val,
        txval: h.txval,
        iamt: h.iamt,
        camt: h.camt,
        samt: h.samt,
        csamt: 0,
      })),
    };
  }

  // 5. Table 13 Document Summary
  payload.doc_issue = summary.docSummary;

  return payload;
}

/**
 * Downloads standard JSON file directly importable on GST Portal
 */
export function downloadGstr1JsonFile(
  summary: Gstr1TableSummary,
  previousTurnover: number = 0
): void {
  const payload = buildGstr1JsonPayload(summary, previousTurnover);
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GSTR1_${summary.sellerGstin}_${summary.filingPeriod}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates CSV content formatted for GST Offline Tool
 */
export function generateGstr1CsvText(summary: Gstr1TableSummary): string {
  let csv = `GSTR-1 RECONCILIATION SUMMARY REPORT\n`;
  csv += `Taxpayer GSTIN,${summary.sellerGstin}\n`;
  csv += `Trade Name,${summary.sellerName}\n`;
  csv += `Return Period,${summary.periodLabel} (${summary.filingPeriod})\n`;
  csv += `Financial Year,${summary.financialYear}\n\n`;

  // 1. Table 4: B2B Invoices
  csv += `--- TABLE 4: B2B INVOICES (REGISTERED TAXPAYERS) ---\n`;
  csv += `GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Place Of Supply,Reverse Charge,Invoice Type,Rate,Taxable Value,CGST,SGST,IGST,Cess\n`;

  summary.b2bGroups.forEach((group) => {
    group.inv.forEach((inv) => {
      inv.itms.forEach((itm) => {
        csv += `"${group.ctin}","${inv.partyName || ''}","${inv.inum}","${inv.idt}",${inv.val},"${inv.pos}","N","Regular",${itm.itm_det.rt}%,${itm.itm_det.txval},${itm.itm_det.camt},${itm.itm_det.samt},${itm.itm_det.iamt},0\n`;
      });
    });
  });

  csv += `\n--- TABLE 7: B2C SMALL (AGGREGATED SUPPLIES) ---\n`;
  csv += `Type,Place of Supply,Rate,Taxable Value,CGST Amount,SGST Amount,IGST Amount,Cess Amount\n`;

  summary.b2csEntries.forEach((e) => {
    csv += `"${e.typ} - ${e.sply_ty}","${e.pos} - ${e.stateName || ''}",${e.rt}%,${e.txval},${e.camt},${e.samt},${e.iamt},0\n`;
  });

  csv += `\n--- TABLE 12: HSN-WISE SUMMARY OF OUTWARD SUPPLIES ---\n`;
  csv += `HSN Code,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax,Central Tax,State Tax,Cess\n`;

  summary.hsnItems.forEach((h) => {
    csv += `"${h.hsn_sc}","${h.desc}","${h.uqc}",${h.qty},${h.val},${h.txval},${h.iamt},${h.camt},${h.samt},0\n`;
  });

  csv += `\n--- TABLE 13: DOCUMENTS ISSUED ---\n`;
  csv += `Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled,Net Issued\n`;
  summary.docSummary.doc_det.forEach((d) => {
    d.docs.forEach((doc) => {
      csv += `"${d.doc_typ}","${doc.from}","${doc.to}",${doc.totnum},${doc.canc},${doc.net_issue}\n`;
    });
  });

  csv += `\n--- CONSOLIDATED TAX LIABILITY TOTALS ---\n`;
  csv += `Total Invoices,${summary.totalInvoiceCount}\n`;
  csv += `Total Taxable Value,${summary.grandTaxable}\n`;
  csv += `Total CGST,${summary.grandCgst}\n`;
  csv += `Total SGST,${summary.grandSgst}\n`;
  csv += `Total IGST,${summary.grandIgst}\n`;
  csv += `Total Output Tax Liability,${summary.grandTotalTax}\n`;
  csv += `Total Gross Invoice Value,${summary.grandInvoiceValue}\n`;

  return csv;
}

/**
 * Downloads CSV Report file
 */
export function downloadGstr1CsvFile(summary: Gstr1TableSummary): void {
  const csvText = generateGstr1CsvText(summary);
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GSTR1_Offline_Summary_${summary.sellerGstin}_${summary.filingPeriod}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
