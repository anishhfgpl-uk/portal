import { IndianState, Party, StockItem } from '../types';

export const INDIAN_STATES: IndianState[] = [
  { name: 'Jammu & Kashmir', code: '01' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Punjab', code: '03' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'Haryana', code: '06' },
  { name: 'Delhi', code: '07' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Bihar', code: '10' },
  { name: 'Sikkim', code: '11' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Nagaland', code: '13' },
  { name: 'Manipur', code: '14' },
  { name: 'Mizoram', code: '15' },
  { name: 'Tripura', code: '16' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Assam', code: '18' },
  { name: 'West Bengal', code: '19' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Odisha', code: '21' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Gujarat', code: '24' },
  { name: 'Daman & Diu', code: '25' },
  { name: 'Dadra & Nagar Haveli', code: '26' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Andhra Pradesh', code: '28' },
  { name: 'Karnataka', code: '29' },
  { name: 'Goa', code: '30' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Kerala', code: '32' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Puducherry', code: '34' },
  { name: 'Andaman & Nicobar Islands', code: '35' },
  { name: 'Telangana', code: '36' },
  { name: 'Andhra Pradesh (New)', code: '37' },
  { name: 'Ladakh', code: '38' },
  { name: 'Other Territory', code: '97' },
];

export function getStateCodeByName(stateName: string): string {
  if (!stateName) return '';
  const match = INDIAN_STATES.find(
    s => s.name.toLowerCase() === stateName.trim().toLowerCase()
  );
  return match ? match.code : '';
}

export function getStateNameByCode(code: string): string {
  if (!code) return '';
  const padded = code.padStart(2, '0');
  const match = INDIAN_STATES.find(s => s.code === padded);
  return match ? match.name : '';
}

export function extractPanFromGstin(gstin: string): string {
  if (!gstin) return '';
  const clean = gstin.trim().toUpperCase();
  if (clean.length === 15) {
    return clean.substring(2, 12);
  }
  return '';
}

export function extractStateCodeFromGstin(gstin: string): string {
  if (!gstin) return '';
  const clean = gstin.trim();
  if (clean.length >= 2) {
    const code = clean.substring(0, 2);
    if (/^\d{2}$/.test(code)) {
      return code;
    }
  }
  return '';
}

export function numberToIndianWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  if (isNaN(num)) return '';

  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  let rupees = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return (tens[t] + ' ' + (u > 0 ? units[u] : '')).trim();
  }

  function convertThreeDigits(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (h > 0) {
      res += units[h] + ' Hundred';
      if (rem > 0) res += ' and ';
    }
    if (rem > 0) {
      res += convertTwoDigits(rem);
    }
    return res.trim();
  }

  let words = '';

  const crores = Math.floor(rupees / 10000000);
  rupees %= 10000000;

  const lakhs = Math.floor(rupees / 100000);
  rupees %= 100000;

  const thousands = Math.floor(rupees / 1000);
  rupees %= 1000;

  const remaining = rupees;

  if (crores > 0) {
    words += convertTwoDigits(crores) + ' Crore ';
  }
  if (lakhs > 0) {
    words += convertTwoDigits(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    words += convertTwoDigits(thousands) + ' Thousand ';
  }
  if (remaining > 0) {
    words += convertThreeDigits(remaining) + ' ';
  }

  words = words.trim() + ' Rupees';

  if (paise > 0) {
    words += ' and ' + convertTwoDigits(paise) + ' Paise';
  }

  return words + ' Only';
}

export function xmlEscape(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const SAMPLE_PARTIES: Party[] = [
  {
    id: 'party-1',
    name: 'Sharma Electronics & Hardware Pvt Ltd',
    address: 'Shop No. 12, Industrial Area Phase 2, Okhla',
    pin: '110020',
    mobile: '9811234567',
    gstin: '07AAAAA0000A1Z5',
    state: 'Delhi',
    state_code: '07',
    city: 'New Delhi',
    pan: 'AAAAA0000A',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'party-2',
    name: 'Gupta Traders & Sons',
    address: 'Plot 45, Sector 18, Commercial Market',
    pin: '201301',
    mobile: '9876543210',
    gstin: '09ABCDE1234F1Z8',
    state: 'Uttar Pradesh',
    state_code: '09',
    city: 'Noida',
    pan: 'ABCDE1234F',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'party-3',
    name: 'Mahalaxmi Enterprises',
    address: '204, Lamington Road, Grant Road East',
    pin: '400007',
    mobile: '9920011223',
    gstin: '27AABCM9876Q1ZG',
    state: 'Maharashtra',
    state_code: '27',
    city: 'Mumbai',
    pan: 'AABCM9876Q',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'party-4',
    name: 'Bangalore Tech Supplies',
    address: '56, 100ft Ring Road, BTM 2nd Stage',
    pin: '560076',
    mobile: '9448012345',
    gstin: '29AABCB5555L1Z2',
    state: 'Karnataka',
    state_code: '29',
    city: 'Bengaluru',
    pan: 'AABCB5555L',
    registration_type: 'Regular',
    country: 'India',
  },
  {
    id: 'party-5',
    name: 'Patel Trading Corporation',
    address: 'Shop 8, Ring Road Textile Market',
    pin: '395002',
    mobile: '9825099887',
    gstin: '24AAACP1122K1Z9',
    state: 'Gujarat',
    state_code: '24',
    city: 'Surat',
    pan: 'AAACP1122K',
    registration_type: 'Regular',
    country: 'India',
  }
];

export const SAMPLE_STOCK_ITEMS: StockItem[] = [
  {
    id: 'item-1',
    name: 'Dell OptiPlex 7090 Desktop Computer',
    hsn: '84713010',
    gst: 18,
    unit: 'Nos',
    rate: 45000,
    description: 'Core i7, 16GB RAM, 512GB SSD, Windows 11 Pro',
  },
  {
    id: 'item-2',
    name: 'HP LaserJet Pro M404dn Printer',
    hsn: '84433200',
    gst: 18,
    unit: 'Nos',
    rate: 28500,
    description: 'High speed auto-duplex laser printer',
  },
  {
    id: 'item-3',
    name: 'Schneider Electric 32A MCB 4-Pole',
    hsn: '85362030',
    gst: 18,
    unit: 'Pcs',
    rate: 1250,
    description: 'C-Curve Miniature Circuit Breaker',
  },
  {
    id: 'item-4',
    name: 'Havells Industrial Copper Wire 2.5 sq mm (90m)',
    hsn: '85444990',
    gst: 18,
    unit: 'Roll',
    rate: 2650,
    description: 'Flame retardant multi-strand copper cable',
  },
  {
    id: 'item-5',
    name: 'Corrugated Packaging Boxes (12x10x8 inch)',
    hsn: '48191010',
    gst: 12,
    unit: 'Box',
    rate: 45,
    description: '3-ply heavy duty brown carton box',
  },
  {
    id: 'item-6',
    name: 'Commercial Software License & Implementation Service',
    hsn: '998314',
    gst: 18,
    unit: 'Nos',
    rate: 15000,
    description: 'GST compliance software annual subscription',
  }
];
