export interface Party {
  id: string;
  name: string;
  address: string;
  pin: string;
  mobile: string;
  gstin: string;
  state: string;
  state_code: string;
  city: string;
  pan: string;
  registration_type: string;
  country: string;
  opening_balance?: number;
  credit_period?: number;
}

export interface StockItem {
  id: string;
  name: string;
  hsn: string;
  gst: number | string;
  unit?: string;
  rate?: number;
  description?: string;
  category?: string;
}

export interface InvoiceItemRow {
  id: string;
  itemId?: string;
  name: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string;
  sellerState: string;
  sellerStateCode: string;
  sellerGstin: string;
  sellerName: string;
  sellerAddress: string;
  sellerPhone: string;
  
  // Party details
  partyId?: string;
  partyName: string;
  gstin: string;
  mobile: string;
  partyState: string;
  stateCode: string;
  pinCode: string;
  city: string;
  completeAddress: string;
  pan: string;
  registrationType: string;
  
  // Line items
  items: InvoiceItemRow[];
  
  // Additional Charges & Expenses
  freightAmount?: number;
  freightGstRate?: number;
  freightTaxable?: number;
  freightGstAmount?: number;
  
  labourAmount?: number;
  labourGstRate?: number;
  labourTaxable?: number;
  labourGstAmount?: number;
  
  otherExpenseAmount?: number;
  otherExpenseLabel?: string;
  otherExpenseGstRate?: number;
  otherExpenseTaxable?: number;
  otherExpenseGstAmount?: number;
  
  totalAdditionalCharges?: number;
  totalAdditionalGst?: number;

  // Financials
  subtotalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  
  // Status
  isInterState: boolean;
  tallySyncStatus: 'synced' | 'pending' | 'failed' | 'not_synced';
  tallySyncMessage?: string;
  tallySyncDate?: string;
  tallyGuid?: string;
  tallyMasterId?: string;
  tallyVoucherType?: string;
  source?: 'portal' | 'tally_import';
  isDuplicateProtected?: boolean;
  createdAt: string;
  notes?: string;
}

export interface SyncReport {
  timestamp: string;
  importedCount: number;
  exportedCount: number;
  updatedCount: number;
  duplicatesPreventedCount: number;
  totalInPortal: number;
  totalInTally: number;
  importedInvoices: Invoice[];
  exportedInvoices: Invoice[];
  skippedInvoices: { invoiceNo: string; reason: string }[];
  discoveredParties: number;
  discoveredItems: number;
  errors: string[];
}

export interface SellerInfo {
  id?: string;
  name: string;
  tradeName?: string;
  mailingName?: string;
  gstin: string;
  state: string;
  stateCode: string;
  address: string;
  pincode?: string;
  country?: string;
  phone: string;
  mobile?: string;
  email?: string;
  website?: string;
  pan?: string;
  
  // Tally Prime Specific Accounting Details
  financialYearFrom?: string;
  booksBeginningFrom?: string;
  currencySymbol?: string;
  currencyFormalName?: string;
  tallyGuid?: string;
  tallyCompanyNumber?: string;

  // Banking Details
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
  isDefault?: boolean;
}

export interface TallyConfig {
  tallyUrl: string;
  tallyPort?: number;
  proxyMode?: boolean;
  autoSync?: boolean;
  companyName?: string;
  defaultVoucherType?: string;
  financialYear?: string;
}

export interface ImportStatusState {
  message: string;
  type: 'normal' | 'loading' | 'success' | 'error';
  timestamp?: string;
}

export interface IndianState {
  name: string;
  code: string;
}
