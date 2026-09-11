import { Invoice, SellerInfo } from '../types';
import { importGstr1SalesFromTally, Gstr1TallyImportResult } from './gstr1TallyImportService';

const CACHE_VERSION = 'v2';

function cacheKey(period: string, seller: SellerInfo) {
  const gstin = (seller.gstin || seller.name || 'company').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `gstr1_tally_cache_${CACHE_VERSION}_${gstin}_${period}`;
}

export function clearGstr1TallyCache(period: string, seller: SellerInfo) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(cacheKey(period, seller));
}

export function getCachedGstr1Sales(period: string, seller: SellerInfo): Invoice[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(period, seller));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.invoices)) return null;
    return parsed.invoices as Invoice[];
  } catch {
    return null;
  }
}

function saveCache(period: string, seller: SellerInfo, result: Gstr1TallyImportResult) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(cacheKey(period, seller), JSON.stringify({
    version: CACHE_VERSION,
    period,
    sellerGstin: seller.gstin,
    importedAt: new Date().toISOString(),
    invoices: result.invoices,
  }));
}

export async function importGstr1SalesCached(
  period: string,
  seller: SellerInfo,
  tallyUrl = 'http://127.0.0.1:9000',
  forceRefresh = false,
): Promise<Gstr1TallyImportResult & { fromCache: boolean }> {
  if (!forceRefresh) {
    const cached = getCachedGstr1Sales(period, seller);
    if (cached) return { invoices: cached, rawCount: cached.length, period, fromCache: true };
  }

  // Exactly one selected-month Tally request. No parallel requests and no FY-wide fetch.
  const result = await importGstr1SalesFromTally(period, seller, tallyUrl);
  saveCache(period, seller, result);
  return { ...result, fromCache: false };
}
