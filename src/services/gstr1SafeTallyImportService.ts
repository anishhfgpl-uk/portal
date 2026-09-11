import { Invoice, SellerInfo } from '../types';
import { buildSalesRequest, parseInvoices, requestTally } from './gstr1TallyImportService';

export interface SafeTallyImportResult {
  invoices: Invoice[];
  rawCount: number;
  chunks: number;
  period: string;
}

function parsePeriod(period: string) {
  return { month: Number(period.slice(0, 2)), year: Number(period.slice(2)) };
}

function tallyDate(date: Date) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()}-${names[date.getMonth()]}-${date.getFullYear()}`;
}

function keyOf(inv: Invoice) {
  return `${inv.invoiceNo.trim().toLowerCase()}|${inv.invoiceDate}|${inv.tallyGuid || inv.tallyMasterId || ''}`;
}

/**
 * Safe Tally importer: never asks Tally for a large month/year report in one shot.
 * It reads small sequential date windows so TallyPrime stays responsive and no
 * concurrent report requests are sent to port 9000.
 */
export async function importGstr1SalesSafely(
  period: string,
  seller: SellerInfo,
  tallyUrl = 'http://127.0.0.1:9000',
  chunkDays = 7,
): Promise<SafeTallyImportResult> {
  const { month, year } = parsePeriod(period);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const all: Invoice[] = [];
  const seen = new Set<string>();
  let chunks = 0;

  for (let cursor = new Date(first); cursor <= last; ) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + chunkDays - 1);
    if (end > last) end.setTime(last.getTime());

    const xml = await requestTally(buildSalesRequest(tallyDate(cursor), tallyDate(end)), tallyUrl);
    chunks++;
    if (xml) {
      const parsed = parseInvoices(xml, seller);
      for (const inv of parsed) {
        const key = keyOf(inv);
        if (!seen.has(key)) {
          seen.add(key);
          all.push(inv);
        }
      }
    }

    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { invoices: all, rawCount: all.length, chunks, period };
}

/**
 * Full financial-year importer. It uses the same safe 7-day sequential strategy
 * for every month and is intentionally serial to prevent TallyPrime from hanging.
 */
export async function importGstr1FinancialYearSafely(
  financialYearStart: number,
  seller: SellerInfo,
  tallyUrl = 'http://127.0.0.1:9000',
): Promise<SafeTallyImportResult> {
  const all: Invoice[] = [];
  const seen = new Set<string>();
  let chunks = 0;

  for (let month = 4; month <= 12; month++) {
    const period = `${String(month).padStart(2, '0')}${financialYearStart}`;
    const result = await importGstr1SalesSafely(period, seller, tallyUrl);
    chunks += result.chunks;
    for (const inv of result.invoices) {
      const key = keyOf(inv);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(inv);
      }
    }
  }
  for (let month = 1; month <= 3; month++) {
    const period = `${String(month).padStart(2, '0')}${financialYearStart + 1}`;
    const result = await importGstr1SalesSafely(period, seller, tallyUrl);
    chunks += result.chunks;
    for (const inv of result.invoices) {
      const key = keyOf(inv);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(inv);
      }
    }
  }

  return { invoices: all, rawCount: all.length, chunks, period: `${financialYearStart}-${financialYearStart + 1}` };
}
