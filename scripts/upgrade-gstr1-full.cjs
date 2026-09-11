const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'components', 'Gstr1ReportView.tsx');
let s = fs.readFileSync(file, 'utf8');

const importLine = "import { Gstr1AdvancedView } from './Gstr1AdvancedView';";
if (!s.includes(importLine)) {
  const anchor = "import { getStateNameByCode } from '../utils/gstUtils';";
  s = s.replace(anchor, `${anchor}\n${importLine}`);
}

s = s.replace(
  "useState<'b2b' | 'b2cs' | 'b2cl' | 'hsn' | 'docs' | 'json' | 'guide'>('b2b')",
  "useState<'b2b' | 'b2cs' | 'b2cl' | 'hsn' | 'docs' | 'json' | 'advanced' | 'guide'>('b2b')"
);

const guideButton = `              <button\n                id="tab-guide"`;
const advancedButton = `              <button\n                id="tab-advanced"\n                onClick={() => setActiveTableTab('advanced')}\n                className={\`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 \${\n                  activeTableTab === 'advanced'\n                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'\n                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'\n                }\`}\n              >\n                <span>Full GSTR-1</span>\n                <span className="px-1.5 py-0.2 rounded-full bg-emerald-900/50 text-[10px] text-emerald-300">\n                  Notes • Export • Advance • Amend\n                </span>\n              </button>\n\n`;
if (!s.includes('id="tab-advanced"')) {
  if (!s.includes(guideButton)) throw new Error('Could not find GSTR guide tab anchor');
  s = s.replace(guideButton, advancedButton + guideButton);
}

const contentAnchor = "            {/* 6. JSON PAYLOAD INSPECTOR */}";
const advancedContent = `            {/* FULL GSTR-1 EXTENDED SECTIONS */}\n            {activeTableTab === 'advanced' && (\n              <Gstr1AdvancedView\n                invoices={filteredInvoices}\n                sellerInfo={sellerInfo}\n                period={currentFilingPeriodCode}\n              />\n            )}\n\n`;
if (!s.includes("activeTableTab === 'advanced'") || !s.includes('<Gstr1AdvancedView')) {
  if (!s.includes(contentAnchor)) throw new Error('Could not find JSON inspector anchor');
  s = s.replace(contentAnchor, advancedContent + contentAnchor);
}

fs.writeFileSync(file, s, 'utf8');
console.log('GSTR-1 full module wired into Gstr1ReportView.tsx');
