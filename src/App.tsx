import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NewInvoiceView } from './components/NewInvoiceView';
import { SavedInvoicesView } from './components/SavedInvoicesView';
import { PartyMasterView } from './components/PartyMasterView';
import { ItemMasterView } from './components/ItemMasterView';
import { TallyDiagnosticHub } from './components/TallyDiagnosticHub';
import { PrintInvoiceModal } from './components/PrintInvoiceModal';
import { XmlPasteModal } from './components/XmlPasteModal';
import { SettingsModal } from './components/SettingsModal';
import { CompanyProfileView } from './components/CompanyProfileView';
import { Gstr1ReportView } from './components/Gstr1ReportView';

import { Party, StockItem, Invoice, SellerInfo, TallyConfig, ImportStatusState } from './types';
import {
  testTallyConnection,
  fetchDebtorsFromTally,
  fetchStockItemsFromTally,
} from './services/tallyService';
import { getStateCodeByName } from './utils/gstUtils';

// Seed sample company data (Default: Anish Technologies)
const INITIAL_COMPANIES: SellerInfo[] = [
  {
    id: 'comp-anish-tech',
    name: 'ANISH TECHNOLOGIES PVT LTD',
    tradeName: 'Anish Tech & Hardware Solutions',
    gstin: '07AABCA1234F1Z5',
    state: 'Delhi',
    stateCode: '07',
    address: 'Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
    phone: '+91 98110 23456',
    email: 'contact@anishtechnologies.com',
    bankName: 'HDFC Bank Ltd',
    bankAccountNo: '50200018945612',
    bankIfsc: 'HDFC0000123',
    bankBranch: 'Okhla Phase-III, New Delhi',
    upiId: 'anish@hdfcbank',
    isDefault: true,
  },
  {
    id: 'comp-apex-solutions',
    name: 'APEX INDUSTRIAL SOLUTIONS',
    tradeName: 'Apex Spares & Engineering',
    gstin: '27AABCA9876E1Z2',
    state: 'Maharashtra',
    stateCode: '27',
    address: 'B-14, MIDC Central Road, Andheri East, Mumbai - 400093',
    phone: '+91 98200 55443',
    email: 'accounts@apexsolutions.in',
    bankName: 'ICICI Bank Ltd',
    bankAccountNo: '102938475601',
    bankIfsc: 'ICIC0001029',
    bankBranch: 'Andheri East, Mumbai',
    upiId: 'apex@icici',
    isDefault: false,
  },
];

const SAMPLE_PARTIES: Party[] = [
  {
    id: 'p-1',
    name: 'Sharma Electronics & Hardware',
    state: 'Delhi',
    state_code: '07',
    gstin: '07AAACS1429B1ZB',
    address: 'Shop No. 12, Chandni Chowk Market',
    city: 'New Delhi',
    pin: '110006',
    mobile: '9810112233',
    pan: 'AAACS1429B',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'p-2',
    name: 'Maharashtra Industrial Spares Corp',
    state: 'Maharashtra',
    state_code: '27',
    gstin: '27AABCM8921D1ZT',
    address: 'B-14 MIDC Industrial Area, Andheri East',
    city: 'Mumbai',
    pin: '400093',
    mobile: '9820055443',
    pan: 'AABCM8921D',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'p-3',
    name: 'Bangalore Tech Park Supplies',
    state: 'Karnataka',
    state_code: '29',
    gstin: '29AAACD4567K1Z8',
    address: 'Tower B, Outer Ring Road, Bellandur',
    city: 'Bengaluru',
    pin: '560103',
    mobile: '9945012345',
    pan: 'AAACD4567K',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'p-4',
    name: 'Gupta Enterprises (Cash Sale)',
    state: 'Delhi',
    state_code: '07',
    gstin: '',
    address: 'Laxmi Nagar Commercial Complex',
    city: 'Delhi',
    pin: '110092',
    mobile: '9871122334',
    pan: '',
    registration_type: 'Unregistered',
    country: 'India',
  },
];

const SAMPLE_ITEMS: StockItem[] = [
  {
    id: 'item-1',
    name: 'Dell 24" UltraSharp IPS Monitor (U2422H)',
    hsn: '85285200',
    gst: 18,
    unit: 'Nos',
    rate: 18500,
    description: 'FHD 1080p, 60Hz, sRGB 99%, Type-C / HDMI / DisplayPort',
  },
  {
    id: 'item-2',
    name: 'Logitech MX Master 3S Wireless Mouse',
    hsn: '84716060',
    gst: 18,
    unit: 'Nos',
    rate: 8200,
    description: 'Quiet clicks, 8K DPI sensor, Bluetooth + Logi Bolt receiver',
  },
  {
    id: 'item-3',
    name: 'CAT-6 UTP High-Speed Network Cable (305m Roll)',
    hsn: '85444990',
    gst: 18,
    unit: 'Roll',
    rate: 6800,
    description: 'Pure copper 23 AWG 550MHz gigabit ethernet roll',
  },
  {
    id: 'item-4',
    name: 'Heavy Duty Metal Rack Shelf 6ft',
    hsn: '94032090',
    gst: 18,
    unit: 'Set',
    rate: 4500,
    description: 'Powder-coated industrial warehouse storage rack',
  },
  {
    id: 'item-5',
    name: 'Annual IT Maintenance & Tech Support Contract',
    hsn: '998313',
    gst: 18,
    unit: 'Nos',
    rate: 25000,
    description: 'Software updates, firewall monitoring, remote & on-site support',
  },
];

const SAMPLE_INVOICES_SEED: Invoice[] = [
  {
    id: 'inv-seed-1',
    invoiceNo: 'AT/25-26/001',
    invoiceDate: new Date().toISOString().slice(0, 10),
    partyName: 'Sharma Electronics & Hardware',
    gstin: '07AAACS1429B1ZB',
    pan: 'AAACS1429B',
    mobile: '9810112233',
    partyState: 'Delhi',
    stateCode: '07',
    pinCode: '110006',
    city: 'New Delhi',
    completeAddress: 'Shop No. 12, Chandni Chowk Market, New Delhi - 110006',
    registrationType: 'Regular',
    sellerName: 'ANISH TECHNOLOGIES PVT LTD',
    sellerGstin: '07AABCA1234F1Z5',
    sellerState: 'Delhi',
    sellerStateCode: '07',
    sellerAddress: 'Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
    sellerPhone: '+91 98110 23456',
    isInterState: false,
    items: [
      {
        id: 'row-1',
        name: 'Dell 24" UltraSharp IPS Monitor (U2422H)',
        hsn: '85285200',
        qty: 2,
        unit: 'NOS-NUMBERS',
        rate: 18500,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 37000,
        cgstAmount: 3330,
        sgstAmount: 3330,
        igstAmount: 0,
        totalAmount: 43660,
      },
      {
        id: 'row-2',
        name: 'Logitech MX Master 3S Wireless Mouse',
        hsn: '84716060',
        qty: 3,
        unit: 'NOS-NUMBERS',
        rate: 8200,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 24600,
        cgstAmount: 2214,
        sgstAmount: 2214,
        igstAmount: 0,
        totalAmount: 29028,
      },
    ],
    subtotalTaxable: 61600,
    totalCgst: 5544,
    totalSgst: 5544,
    totalIgst: 0,
    totalTax: 11088,
    roundOff: 0,
    grandTotal: 72688,
    amountInWords: 'INR Seventy-Two Thousand Six Hundred Eighty-Eight Only',
    notes: 'Thank you for your business.',
    tallySyncStatus: 'synced',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-seed-2',
    invoiceNo: 'AT/25-26/002',
    invoiceDate: new Date().toISOString().slice(0, 10),
    partyName: 'Maharashtra Industrial Spares Corp',
    gstin: '27AABCM8921D1ZT',
    pan: 'AABCM8921D',
    mobile: '9820055443',
    partyState: 'Maharashtra',
    stateCode: '27',
    pinCode: '400093',
    city: 'Mumbai',
    completeAddress: 'B-14 MIDC Industrial Area, Andheri East, Mumbai - 400093',
    registrationType: 'Regular',
    sellerName: 'ANISH TECHNOLOGIES PVT LTD',
    sellerGstin: '07AABCA1234F1Z5',
    sellerState: 'Delhi',
    sellerStateCode: '07',
    sellerAddress: 'Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
    sellerPhone: '+91 98110 23456',
    isInterState: true,
    items: [
      {
        id: 'row-3',
        name: 'CAT-6 UTP High-Speed Network Cable (305m Roll)',
        hsn: '85444990',
        qty: 10,
        unit: 'ROL-ROLLS',
        rate: 6800,
        discountPercent: 5,
        gstRate: 18,
        taxableAmount: 64600,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 11628,
        totalAmount: 76228,
      },
      {
        id: 'row-4',
        name: 'Heavy Duty Metal Rack Shelf 6ft',
        hsn: '94032090',
        qty: 4,
        unit: 'SET-SETS',
        rate: 4500,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 18000,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 3240,
        totalAmount: 21240,
      },
    ],
    subtotalTaxable: 82600,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 14868,
    totalTax: 14868,
    roundOff: 0,
    grandTotal: 97468,
    amountInWords: 'INR Ninety-Seven Thousand Four Hundred Sixty-Eight Only',
    notes: 'Interstate supply under IGST.',
    tallySyncStatus: 'synced',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-seed-3',
    invoiceNo: 'AT/25-26/003',
    invoiceDate: new Date().toISOString().slice(0, 10),
    partyName: 'Gupta Enterprises (Cash Sale)',
    gstin: '',
    pan: '',
    mobile: '9871122334',
    partyState: 'Delhi',
    stateCode: '07',
    pinCode: '110092',
    city: 'Delhi',
    completeAddress: 'Laxmi Nagar Commercial Complex, Delhi',
    registrationType: 'Unregistered',
    sellerName: 'ANISH TECHNOLOGIES PVT LTD',
    sellerGstin: '07AABCA1234F1Z5',
    sellerState: 'Delhi',
    sellerStateCode: '07',
    sellerAddress: 'Plot No. 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
    sellerPhone: '+91 98110 23456',
    isInterState: false,
    items: [
      {
        id: 'row-5',
        name: 'Logitech MX Master 3S Wireless Mouse',
        hsn: '84716060',
        qty: 2,
        unit: 'NOS-NUMBERS',
        rate: 8200,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 16400,
        cgstAmount: 1476,
        sgstAmount: 1476,
        igstAmount: 0,
        totalAmount: 19352,
      },
    ],
    subtotalTaxable: 16400,
    totalCgst: 1476,
    totalSgst: 1476,
    totalIgst: 0,
    totalTax: 2952,
    roundOff: 0,
    grandTotal: 19352,
    amountInWords: 'INR Nineteen Thousand Three Hundred Fifty-Two Only',
    notes: 'Retail counter cash supply (B2CS).',
    tallySyncStatus: 'not_synced',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-seed-4',
    invoiceNo: 'APEX/25-26/101',
    invoiceDate: new Date().toISOString().slice(0, 10),
    partyName: 'Bangalore Tech Park Supplies',
    gstin: '29AAACD4567K1Z8',
    pan: 'AAACD4567K',
    mobile: '9945012345',
    partyState: 'Karnataka',
    stateCode: '29',
    pinCode: '560103',
    city: 'Bengaluru',
    completeAddress: 'Tower B, Outer Ring Road, Bellandur, Bengaluru - 560103',
    registrationType: 'Regular',
    sellerName: 'APEX INDUSTRIAL SOLUTIONS',
    sellerGstin: '27AABCA9876E1Z2',
    sellerState: 'Maharashtra',
    sellerStateCode: '27',
    sellerAddress: 'B-14, MIDC Central Road, Andheri East, Mumbai - 400093',
    sellerPhone: '+91 98200 55443',
    isInterState: true,
    items: [
      {
        id: 'row-apex-1',
        name: 'Annual IT Maintenance & Tech Support Contract',
        hsn: '998313',
        qty: 4,
        unit: 'NOS-NUMBERS',
        rate: 25000,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 100000,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 18000,
        totalAmount: 118000,
      },
      {
        id: 'row-apex-2',
        name: 'Dell 24" UltraSharp IPS Monitor (U2422H)',
        hsn: '85285200',
        qty: 2,
        unit: 'NOS-NUMBERS',
        rate: 18500,
        discountPercent: 5,
        gstRate: 18,
        taxableAmount: 35150,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 6327,
        totalAmount: 41477,
      },
    ],
    subtotalTaxable: 135150,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 24327,
    totalTax: 24327,
    roundOff: 0,
    grandTotal: 159477,
    amountInWords: 'INR One Lakh Fifty-Nine Thousand Four Hundred Seventy-Seven Only',
    notes: 'Apex Mumbai to Bangalore Interstate supply.',
    tallySyncStatus: 'synced',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-seed-5',
    invoiceNo: 'APEX/25-26/102',
    invoiceDate: new Date().toISOString().slice(0, 10),
    partyName: 'Maharashtra Industrial Spares Corp',
    gstin: '27AABCM8921D1ZT',
    pan: 'AABCM8921D',
    mobile: '9820055443',
    partyState: 'Maharashtra',
    stateCode: '27',
    pinCode: '400093',
    city: 'Mumbai',
    completeAddress: 'B-14 MIDC Industrial Area, Andheri East, Mumbai - 400093',
    registrationType: 'Regular',
    sellerName: 'APEX INDUSTRIAL SOLUTIONS',
    sellerGstin: '27AABCA9876E1Z2',
    sellerState: 'Maharashtra',
    sellerStateCode: '27',
    sellerAddress: 'B-14, MIDC Central Road, Andheri East, Mumbai - 400093',
    sellerPhone: '+91 98200 55443',
    isInterState: false,
    items: [
      {
        id: 'row-apex-3',
        name: 'Heavy Duty Metal Rack Shelf 6ft',
        hsn: '94032090',
        qty: 10,
        unit: 'SET-SETS',
        rate: 4500,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 45000,
        cgstAmount: 4050,
        sgstAmount: 4050,
        igstAmount: 0,
        totalAmount: 53100,
      },
    ],
    subtotalTaxable: 45000,
    totalCgst: 4050,
    totalSgst: 4050,
    totalIgst: 0,
    totalTax: 8100,
    roundOff: 0,
    grandTotal: 53100,
    amountInWords: 'INR Fifty-Three Thousand One Hundred Only',
    notes: 'Intra-state Maharashtra B2B supply.',
    tallySyncStatus: 'not_synced',
    createdAt: new Date().toISOString(),
  },
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('new-invoice');

  // Master Data
  const [parties, setParties] = useState<Party[]>(() => {
    const saved = localStorage.getItem('tally_parties');
    return saved ? JSON.parse(saved) : SAMPLE_PARTIES;
  });

  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem('tally_stock_items');
    return saved ? JSON.parse(saved) : SAMPLE_ITEMS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('tally_invoices');
    return saved ? JSON.parse(saved) : SAMPLE_INVOICES_SEED;
  });

  const [companies, setCompanies] = useState<SellerInfo[]>(() => {
    const saved = localStorage.getItem('tally_companies');
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [sellerInfo, setSellerInfo] = useState<SellerInfo>(() => {
    const saved = localStorage.getItem('tally_seller_info');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) return parsed;
      } catch (e) {}
    }
    return INITIAL_COMPANIES[0];
  });

  const [tallyConfig, setTallyConfig] = useState<TallyConfig>(() => {
    const saved = localStorage.getItem('tally_config');
    return saved
      ? JSON.parse(saved)
      : {
          tallyUrl: 'http://localhost:9000',
          tallyPort: 9000,
          companyName: '',
          defaultVoucherType: 'Sales',
          proxyMode: true,
        };
  });

  // Tally Health & Status
  const [tallyStatus, setTallyStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [importStatus, setImportStatus] = useState<ImportStatusState>({
    message: 'Tally connection ready',
    type: 'normal',
  });
  const [isImportingDebtors, setIsImportingDebtors] = useState<boolean>(false);
  const [isImportingItems, setIsImportingItems] = useState<boolean>(false);

  // Modals
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [isXmlPasteOpen, setIsXmlPasteOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('tally_parties', JSON.stringify(parties));
  }, [parties]);

  useEffect(() => {
    localStorage.setItem('tally_stock_items', JSON.stringify(stockItems));
  }, [stockItems]);

  useEffect(() => {
    localStorage.setItem('tally_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('tally_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('tally_seller_info', JSON.stringify(sellerInfo));
  }, [sellerInfo]);

  useEffect(() => {
    localStorage.setItem('tally_config', JSON.stringify(tallyConfig));
  }, [tallyConfig]);

  // Initial connection check on mount
  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setTallyStatus('checking');
    setImportStatus({
      message: 'Checking Tally Prime port 9000...',
      type: 'loading',
    });

    const isConnected = await testTallyConnection(tallyConfig);
    if (isConnected) {
      setTallyStatus('online');
      setImportStatus({
        message: '🟢 Tally Prime HTTP server is Online on port 9000',
        type: 'success',
      });
    } else {
      setTallyStatus('offline');
      setImportStatus({
        message: '🔴 Tally Prime Offline (Check Port 9000 / F1 Settings / Bridge)',
        type: 'error',
      });
    }
  };

  // Import Debtors Handler
  const handleImportDebtorsFromTally = async () => {
    setIsImportingDebtors(true);
    setImportStatus({
      message: 'Fetching Sundry Debtors from Tally Prime...',
      type: 'loading',
    });

    try {
      const imported = await fetchDebtorsFromTally(tallyConfig);
      if (imported.length > 0) {
        // Merge with existing parties by name
        setParties((prev) => {
          const names = new Set(prev.map((p) => p.name.toLowerCase()));
          const newEntries = imported.filter((p) => !names.has(p.name.toLowerCase()));
          return [...prev, ...newEntries];
        });

        setTallyStatus('online');
        setImportStatus({
          message: `✅ Imported ${imported.length} Debtors from Tally Prime!`,
          type: 'success',
        });
      } else {
        setImportStatus({
          message: 'No Sundry Debtors found in currently open Tally company.',
          type: 'normal',
        });
      }
    } catch (err: any) {
      setTallyStatus('offline');
      setImportStatus({
        message: `Debtor Import Failed: ${err.message}`,
        type: 'error',
      });
      // Offer to switch to diagnostics
      if (confirm('Debtor Import Failed: Tally se connection nahi ho raha.\n\nKya aap Tally Fix & Diagnostic Hub kholna chahte hain?')) {
        setActiveTab('tally-sync');
      }
    } finally {
      setIsImportingDebtors(false);
    }
  };

  // Import Items Handler
  const handleImportItemsFromTally = async () => {
    setIsImportingItems(true);
    setImportStatus({
      message: 'Fetching Stock Items from Tally Prime...',
      type: 'loading',
    });

    try {
      const imported = await fetchStockItemsFromTally(tallyConfig);
      if (imported.length > 0) {
        setStockItems((prev) => {
          const names = new Set(prev.map((i) => i.name.toLowerCase()));
          const newEntries = imported.filter((i) => !names.has(i.name.toLowerCase()));
          return [...prev, ...newEntries];
        });

        setTallyStatus('online');
        setImportStatus({
          message: `✅ Imported ${imported.length} Stock Items from Tally Prime!`,
          type: 'success',
        });
      } else {
        setImportStatus({
          message: 'No Stock Items found in currently open Tally company.',
          type: 'normal',
        });
      }
    } catch (err: any) {
      setTallyStatus('offline');
      setImportStatus({
        message: `Stock Item Import Failed: ${err.message}`,
        type: 'error',
      });
      if (confirm('Stock Item Import Failed: Tally se connection nahi ho raha.\n\nKya aap Tally Fix & Diagnostic Hub kholna chahte hain?')) {
        setActiveTab('tally-sync');
      }
    } finally {
      setIsImportingItems(false);
    }
  };

  // Save invoice
  const handleSaveInvoice = (invoice: Invoice) => {
    setInvoices((prev) => [invoice, ...prev.filter((i) => i.id !== invoice.id)]);
  };

  const handleUpdateInvoice = (invoice: Invoice) => {
    setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? invoice : i)));
  };

  const handleDeleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Company Profile Handlers
  const handleSelectCompany = (company: SellerInfo) => {
    setSellerInfo(company);
    setTallyConfig((prev) => ({
      ...prev,
      companyName: company.name,
    }));
    const matchingCount = invoices.filter(
      (inv) =>
        (inv.sellerGstin && inv.sellerGstin.toLowerCase() === (company.gstin || '').toLowerCase()) ||
        (inv.sellerName && inv.sellerName.toLowerCase() === company.name.toLowerCase())
    ).length;

    setImportStatus({
      message: `🏢 Active Firm switched to "${company.name}". Data, GSTIN (${company.gstin || 'N/A'}), and GSTR-1 refreshed (${matchingCount} invoices).`,
      type: 'success',
    });
  };

  const handleAddCompany = (company: SellerInfo) => {
    setCompanies((prev) => [company, ...prev]);
    handleSelectCompany(company);
  };

  const handleUpdateCompany = (company: SellerInfo) => {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === company.id || c.name === company.name ? company : c
      )
    );
    if (
      sellerInfo.id === company.id ||
      sellerInfo.name === company.name
    ) {
      setSellerInfo(company);
    }
  };

  const handleDeleteCompany = (id: string) => {
    setCompanies((prev) => {
      const filtered = prev.filter((c) => (c.id || c.name) !== id);
      if (filtered.length > 0 && (sellerInfo.id === id || sellerInfo.name === id)) {
        setSellerInfo(filtered[0]);
      }
      return filtered;
    });
  };

  // Party handlers
  const handleAddParty = (party: Party) => {
    setParties((prev) => [party, ...prev]);
  };
  const handleUpdateParty = (party: Party) => {
    setParties((prev) => prev.map((p) => (p.id === party.id ? party : p)));
  };
  const handleDeleteParty = (id: string) => {
    if (confirm('Are you sure you want to delete this party?')) {
      setParties((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Item handlers
  const handleAddItem = (item: StockItem) => {
    setStockItems((prev) => [item, ...prev]);
  };
  const handleUpdateItem = (item: StockItem) => {
    setStockItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  };
  const handleDeleteItem = (id: string) => {
    if (confirm('Are you sure you want to delete this stock item?')) {
      setStockItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Load sample dataset
  const handleLoadSampleData = () => {
    setParties(SAMPLE_PARTIES);
    setStockItems(SAMPLE_ITEMS);

    // Create a demo invoice if empty
    if (invoices.length === 0) {
      const demoInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNo: 'INV-1001',
        invoiceDate: new Date().toISOString().slice(0, 10),
        partyName: 'Sharma Electronics & Hardware',
        gstin: '07AAACS1429B1ZB',
        pan: 'AAACS1429B',
        mobile: '9810112233',
        partyState: 'Delhi',
        stateCode: '07',
        pinCode: '110006',
        city: 'New Delhi',
        completeAddress: 'Shop No. 12, Chandni Chowk Market, New Delhi - 110006',
        registrationType: 'Regular',
        sellerName: sellerInfo.name,
        sellerGstin: sellerInfo.gstin,
        sellerState: sellerInfo.state,
        sellerStateCode: sellerInfo.stateCode,
        sellerAddress: sellerInfo.address,
        sellerPhone: sellerInfo.phone,
        isInterState: false,
        items: [
          {
            id: 'row-1',
            name: 'Dell 24" UltraSharp IPS Monitor (U2422H)',
            hsn: '85285200',
            qty: 2,
            unit: 'Nos',
            rate: 18500,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 37000,
            cgstAmount: 3330,
            sgstAmount: 3330,
            igstAmount: 0,
            totalAmount: 43660,
          },
          {
            id: 'row-2',
            name: 'Logitech MX Master 3S Wireless Mouse',
            hsn: '84716060',
            qty: 3,
            unit: 'Nos',
            rate: 8200,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 24600,
            cgstAmount: 2214,
            sgstAmount: 2214,
            igstAmount: 0,
            totalAmount: 29028,
          },
        ],
        subtotalTaxable: 61600,
        totalCgst: 5544,
        totalSgst: 5544,
        totalIgst: 0,
        totalTax: 11088,
        roundOff: 0,
        grandTotal: 72688,
        amountInWords: 'INR Seventy-Two Thousand Six Hundred Eighty-Eight Only',
        notes: 'Thank you for your business. Please make payments within 30 days.',
        tallySyncStatus: 'not_synced',
        createdAt: new Date().toISOString(),
      };
      setInvoices([demoInvoice]);
    }

    alert('✅ Sample Debtors, Stock Items, and Invoices loaded successfully!');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans antialiased text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* 1. Left Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tallyStatus={tallyStatus}
        importStatus={importStatus}
        onImportDebtors={handleImportDebtorsFromTally}
        onImportItems={handleImportItemsFromTally}
        onTestConnection={handleTestConnection}
        isImportingDebtors={isImportingDebtors}
        isImportingItems={isImportingItems}
        partyCount={parties.length}
        itemCount={stockItems.length}
        savedInvoiceCount={invoices.length}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Global Header */}
        <Header
          activeTab={activeTab}
          sellerState={sellerInfo.state}
          setSellerState={(st) =>
            setSellerInfo((prev) => ({
              ...prev,
              state: st,
              stateCode: getStateCodeByName(st) || '07',
            }))
          }
          sellerName={sellerInfo.name}
          sellerGstin={sellerInfo.gstin}
          tallyStatus={tallyStatus}
          onTestConnection={handleTestConnection}
          onOpenXmlPaste={() => setIsXmlPasteOpen(true)}
          onLoadSampleData={handleLoadSampleData}
          onOpenSettings={() => setIsSettingsOpen(true)}
          companies={companies}
          currentCompany={sellerInfo}
          onSelectCompany={handleSelectCompany}
          onOpenCompanyProfile={() => setActiveTab('company-profile')}
        />

        {/* View Router */}
        <main className="flex-1 pb-16">
          {activeTab === 'new-invoice' && (
            <NewInvoiceView
              parties={parties}
              stockItems={stockItems}
              sellerState={sellerInfo.state}
              sellerName={sellerInfo.name}
              sellerGstin={sellerInfo.gstin}
              sellerAddress={sellerInfo.address}
              sellerPhone={sellerInfo.phone}
              onSaveInvoice={handleSaveInvoice}
              onPrintInvoice={(inv) => setPrintingInvoice(inv)}
              onShowTallySync={() => setActiveTab('tally-sync')}
              tallyStatus={tallyStatus}
            />
          )}

          {activeTab === 'company-profile' && (
            <CompanyProfileView
              companies={companies}
              currentCompany={sellerInfo}
              onSelectCompany={handleSelectCompany}
              onAddCompany={handleAddCompany}
              onUpdateCompany={handleUpdateCompany}
              onDeleteCompany={handleDeleteCompany}
              tallyConfig={tallyConfig}
            />
          )}

          {(activeTab === 'saved-invoices' || activeTab === 'invoice-list') && (
            <SavedInvoicesView
              invoices={invoices}
              onPrintInvoice={(inv) => setPrintingInvoice(inv)}
              onDeleteInvoice={handleDeleteInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onBulkUpdateInvoices={(updatedList) => setInvoices(updatedList)}
              onNewInvoiceClick={() => setActiveTab('new-invoice')}
              onOpenXmlPaste={() => setIsXmlPasteOpen(true)}
              onAddParties={(newP) => {
                setParties((prev) => {
                  const names = new Set(prev.map((p) => p.name.toLowerCase()));
                  return [...prev, ...newP.filter((p) => !names.has(p.name.toLowerCase()))];
                });
              }}
              onAddItems={(newI) => {
                setStockItems((prev) => {
                  const names = new Set(prev.map((i) => i.name.toLowerCase()));
                  return [...prev, ...newI.filter((i) => !names.has(i.name.toLowerCase()))];
                });
              }}
              sellerInfo={sellerInfo}
              companies={companies}
              onSelectCompany={handleSelectCompany}
              tallyConfig={tallyConfig}
              tallyStatus={tallyStatus}
              onTestConnection={handleTestConnection}
            />
          )}

          {activeTab === 'party-master' && (
            <PartyMasterView
              parties={parties}
              onAddParty={handleAddParty}
              onUpdateParty={handleUpdateParty}
              onDeleteParty={handleDeleteParty}
              onImportFromTally={handleImportDebtorsFromTally}
              onOpenXmlPaste={() => setIsXmlPasteOpen(true)}
              onLoadSampleParties={() => setParties(SAMPLE_PARTIES)}
              isImporting={isImportingDebtors}
            />
          )}

          {activeTab === 'item-master' && (
            <ItemMasterView
              stockItems={stockItems}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onImportFromTally={handleImportItemsFromTally}
              onOpenXmlPaste={() => setIsXmlPasteOpen(true)}
              onLoadSampleItems={() => setStockItems(SAMPLE_ITEMS)}
              isImporting={isImportingItems}
            />
          )}

          {activeTab === 'gstr-1' && (
            <Gstr1ReportView
              invoices={invoices}
              sellerInfo={sellerInfo}
              companies={companies}
              onSelectCompany={handleSelectCompany}
              onUpdateInvoices={(updatedList) => setInvoices(updatedList)}
              onNewInvoiceClick={() => setActiveTab('new-invoice')}
            />
          )}

          {activeTab === 'tally-sync' && (
            <TallyDiagnosticHub
              config={tallyConfig}
              onUpdateConfig={setTallyConfig}
              tallyStatus={tallyStatus}
              onTestConnection={handleTestConnection}
            />
          )}
        </main>
      </div>

      {/* 3. Global Print Invoice Modal */}
      <PrintInvoiceModal
        invoice={printingInvoice}
        onClose={() => setPrintingInvoice(null)}
      />

      {/* 4. Direct XML Paste Modal */}
      <XmlPasteModal
        isOpen={isXmlPasteOpen}
        onClose={() => setIsXmlPasteOpen(false)}
        onImportDebtors={(newParties) => {
          setParties((prev) => {
            const names = new Set(prev.map((p) => p.name.toLowerCase()));
            return [...prev, ...newParties.filter((p) => !names.has(p.name.toLowerCase()))];
          });
        }}
        onImportItems={(newItems) => {
          setStockItems((prev) => {
            const names = new Set(prev.map((i) => i.name.toLowerCase()));
            return [...prev, ...newItems.filter((i) => !names.has(i.name.toLowerCase()))];
          });
        }}
        onImportCompanies={(newCompanies) => {
          newCompanies.forEach((comp) => {
            const exists = companies.find((c) => c.name.toLowerCase() === comp.name.toLowerCase());
            if (exists) {
              handleUpdateCompany({ ...comp, id: exists.id });
            } else {
              handleAddCompany(comp);
            }
          });
          if (newCompanies.length > 0) {
            handleSelectCompany(newCompanies[0]);
          }
        }}
        onImportInvoices={(importedInvoices, extractedParties, extractedItems) => {
          const existingMap = new Map<string, Invoice>();
          invoices.forEach((inv) => existingMap.set(inv.invoiceNo.trim().toLowerCase(), inv));

          const toAdd: Invoice[] = [];
          importedInvoices.forEach((inv) => {
            const key = inv.invoiceNo.trim().toLowerCase();
            if (!existingMap.has(key)) {
              toAdd.push(inv);
              existingMap.set(key, inv);
            }
          });

          setInvoices((prev) => [...toAdd, ...prev]);

          if (extractedParties && extractedParties.length > 0) {
            setParties((prev) => {
              const names = new Set(prev.map((p) => p.name.toLowerCase()));
              return [...prev, ...extractedParties.filter((p) => !names.has(p.name.toLowerCase()))];
            });
          }

          if (extractedItems && extractedItems.length > 0) {
            setStockItems((prev) => {
              const names = new Set(prev.map((i) => i.name.toLowerCase()));
              return [...prev, ...extractedItems.filter((i) => !names.has(i.name.toLowerCase()))];
            });
          }
        }}
        sellerInfo={sellerInfo}
      />

      {/* 5. System Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sellerInfo={sellerInfo}
        onUpdateSellerInfo={setSellerInfo}
        tallyConfig={tallyConfig}
        onUpdateTallyConfig={setTallyConfig}
      />
    </div>
  );
}
