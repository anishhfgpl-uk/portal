const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'src/components/Gstr1ReportView.tsx');
const advancedPath = path.join(root, 'src/components/Gstr1AdvancedView.tsx');

function patch(file, replacements) {
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (to !== '' && s.includes(to)) continue;
    if (!s.includes(from)) {
      if (to === '') continue;
      throw new Error(`GSTR1 patch anchor not found in ${path.relative(root, file)}: ${from.slice(0, 120)}`);
    }
    s = s.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(file, s, 'utf8');
}

patch(reportPath, [
  [
    "import { getStateNameByCode } from '../utils/gstUtils';",
    "import { getStateNameByCode } from '../utils/gstUtils';\nimport { Gstr1AdvancedView } from './Gstr1AdvancedView';"
  ],
  [
    "const [activeTableTab, setActiveTableTab] = useState<'b2b' | 'b2cs' | 'b2cl' | 'hsn' | 'docs' | 'json' | 'guide'>('b2b');",
    "const [activeTableTab, setActiveTableTab] = useState<'b2b' | 'b2cs' | 'b2cl' | 'hsn' | 'docs' | 'json' | 'guide' | 'advanced'>('b2b');"
  ],
  [
    "              <button\n                id=\"tab-guide\"",
    "              <button\n                id=\"tab-advanced\"\n                onClick={() => setActiveTableTab('advanced')}\n                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${\n                  activeTableTab === 'advanced'\n                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'\n                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'\n                }`}\n              >\n                <Sparkles className=\"w-3.5 h-3.5 text-emerald-400\" />\n                <span>Full GSTR-1</span>\n              </button>\n\n              <button\n                id=\"tab-guide\""
  ],
  [
    "          {/* Table Content Area */}\n          <div className=\"p-4\">",
    "          {/* Table Content Area */}\n          <div className=\"p-4\">\n            {activeTableTab === 'advanced' && (\n              <Gstr1AdvancedView\n                invoices={filteredInvoices}\n                sellerInfo={sellerInfo}\n                period={currentFilingPeriodCode}\n              />\n            )}"
  ]
]);

patch(advancedPath, [
  [
    "import { buildGstr1JsonPayload } from '../services/gstr1Service';\n",
    ""
  ],
  [
    "  const base = useMemo(() => buildGstr1JsonPayload({} as any), []);\n",
    ""
  ]
]);

console.log('GSTR-1 full module wiring ensured.');
