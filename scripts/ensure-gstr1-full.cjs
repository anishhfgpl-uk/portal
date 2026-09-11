const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'src/components/Gstr1ReportView.tsx');
const advancedPath = path.join(root, 'src/components/Gstr1AdvancedView.tsx');

function patch(file, replacements) {
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (to && s.includes(to)) continue;
    if (!s.includes(from)) {
      console.log(`Skipping missing/already-applied patch in ${path.relative(root, file)}`);
      continue;
    }
    s = s.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(file, s, 'utf8');
}

// Repair duplicate declarations left by an earlier non-idempotent run.
function normalizeReport(file) {
  let s = fs.readFileSync(file, 'utf8');
  const duplicateSource = '  const sourceInvoices = tallyInvoices ?? invoices;\n';
  const matches = s.match(/  const sourceInvoices = tallyInvoices \?\? invoices;\n/g) || [];
  if (matches.length > 1) {
    let seen = 0;
    s = s.replace(/  const sourceInvoices = tallyInvoices \?\? invoices;\n/g, () => (++seen === 1 ? duplicateSource : ''));
    fs.writeFileSync(file, s, 'utf8');
  }
}

normalizeReport(reportPath);

patch(reportPath, [
  [
    "import React, { useState, useMemo } from 'react';",
    "import React, { useState, useMemo, useEffect } from 'react';"
  ],
  [
    "import { getStateNameByCode } from '../utils/gstUtils';",
    "import { getStateNameByCode } from '../utils/gstUtils';\nimport { fetchAllSalesVouchersFromTally } from '../services/gstr1TallyAllService';\nimport { DEFAULT_TALLY_CONFIG } from '../services/tallyService';\n"
  ],
  [
    "const [companyFilterMode, setCompanyFilterMode] = useState<'active' | 'all'>('active');",
    "const [companyFilterMode, setCompanyFilterMode] = useState<'active' | 'all'>('active');\n  const [tallyInvoices, setTallyInvoices] = useState<Invoice[] | null>(null);\n  const [tallyLoading, setTallyLoading] = useState(false);\n  const [tallyMessage, setTallyMessage] = useState('');"
  ],
  [
    "  const currentFilingPeriodCode = `${String(selectedMonthNum).padStart(2, '0')}${selectedMonthYear}`;",
    "  const currentFilingPeriodCode = `${String(selectedMonthNum).padStart(2, '0')}${selectedMonthYear}`;\n\n  useEffect(() => {\n    let cancelled = false;\n    const loadAllTallySales = async () => {\n      setTallyLoading(true);\n      setTallyMessage('Loading all sales vouchers from Tally...');\n      try {\n        const rows = await fetchAllSalesVouchersFromTally(DEFAULT_TALLY_CONFIG, sellerInfo, fyStartYear);\n        if (!cancelled) {\n          setTallyInvoices(rows);\n          setTallyMessage(`Tally: ${rows.length.toLocaleString('en-IN')} sales vouchers loaded.`);\n        }\n      } catch (err) {\n        if (!cancelled) {\n          setTallyInvoices(null);\n          setTallyMessage('Tally fetch failed; showing existing portal invoices.');\n        }\n      } finally {\n        if (!cancelled) setTallyLoading(false);\n      }\n    };\n    loadAllTallySales();\n    return () => { cancelled = true; };\n  }, [sellerInfo.gstin, sellerInfo.name, fyStartYear]);\n\n  const sourceInvoices = tallyInvoices ?? invoices;"
  ],
  [
    "    const companyInvoices = invoices.filter((inv) => {",
    "    const companyInvoices = sourceInvoices.filter((inv) => {"
  ],
  [
    "  }, [invoices, companyFilterMode, sellerInfo.gstin, sellerInfo.name, periodFilterMode, selectedMonthNum, selectedMonthYear]);",
    "  }, [sourceInvoices, companyFilterMode, sellerInfo.gstin, sellerInfo.name, periodFilterMode, selectedMonthNum, selectedMonthYear]);"
  ],
  [
    "      <div className=\"p-6 space-y-6 flex-1\">",
    "      <div className=\"p-6 space-y-6 flex-1\">\n        {tallyMessage && (\n          <div className={`px-4 py-2 rounded-lg border text-xs ${tallyLoading ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>\n            {tallyMessage}\n          </div>\n        )}"
  ]
]);

patch(advancedPath, [
  [
    "import { buildGstr1JsonPayload } from '../services/gstr1Service';\n",
    "import { formatToGstPortalDate } from '../services/gstr1Service';\n"
  ],
  [
    "const row = { inum:i.invoiceNo, idt:i.invoiceDate, val:i.grandTotal, pos, rchrg:'N', inv_typ:'R', itms:",
    "const row = { inum:i.invoiceNo, idt:formatToGstPortalDate(i.invoiceDate), val:i.grandTotal, pos, rchrg:'N', inv_typ:'R', itms:"
  ],
  [
    "  const base = useMemo(() => buildGstr1JsonPayload({} as any), []);\n",
    ""
  ]
]);

console.log('GSTR-1 full module + complete Tally voucher loading ensured.');
