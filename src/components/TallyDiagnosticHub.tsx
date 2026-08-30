import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  HelpCircle,
  Copy,
  Download,
  Server,
  Zap,
  Check,
  ExternalLink,
  ShieldAlert,
  Code2,
  Sliders,
} from 'lucide-react';
import { TallyConfig } from '../types';
import { TALLY_XML_QUERIES, sendTallyRequest } from '../services/tallyService';

interface TallyDiagnosticHubProps {
  config: TallyConfig;
  onUpdateConfig: (config: TallyConfig) => void;
  tallyStatus: 'online' | 'offline' | 'checking';
  onTestConnection: () => void;
}

export const TallyDiagnosticHub: React.FC<TallyDiagnosticHubProps> = ({
  config,
  onUpdateConfig,
  tallyStatus,
  onTestConnection,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'solutions' | 'checklist' | 'console' | 'scripts'>('solutions');
  const [customUrl, setCustomUrl] = useState<string>(config.tallyUrl || 'http://localhost:9000');
  const [proxyMode, setProxyMode] = useState<boolean>(config.proxyMode !== false);

  // XML Console State
  const [selectedTemplate, setSelectedTemplate] = useState<string>('COMPANY_INFO');
  const [customXml, setCustomXml] = useState<string>(TALLY_XML_QUERIES.COMPANY_INFO);
  const [consoleResponse, setConsoleResponse] = useState<string>('');
  const [isExecutingXml, setIsExecutingXml] = useState<boolean>(false);
  const [consoleError, setConsoleError] = useState<string | null>(null);

  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const handleSaveConfig = () => {
    onUpdateConfig({
      ...config,
      tallyUrl: customUrl.trim(),
      proxyMode: proxyMode,
    });
    alert('Tally configuration saved!');
  };

  const handleTemplateChange = (key: string) => {
    setSelectedTemplate(key);
    if (key === 'COMPANY_INFO') setCustomXml(TALLY_XML_QUERIES.COMPANY_INFO);
    else if (key === 'DEBTOR_COLLECTION') setCustomXml(TALLY_XML_QUERIES.DEBTOR_COLLECTION);
    else if (key === 'STOCK_ITEM_COLLECTION') setCustomXml(TALLY_XML_QUERIES.STOCK_ITEM_COLLECTION);
    else if (key === 'SALES_VOUCHERS_COLLECTION') setCustomXml(TALLY_XML_QUERIES.SALES_VOUCHERS_COLLECTION);
  };

  const handleExecuteXml = async () => {
    setIsExecutingXml(true);
    setConsoleError(null);
    setConsoleResponse('');

    try {
      const result = await sendTallyRequest(customXml, {
        ...config,
        tallyUrl: customUrl,
        proxyMode: proxyMode,
      });
      setConsoleResponse(result.text);
    } catch (err: any) {
      setConsoleError(err.message);
    } finally {
      setIsExecutingXml(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  const nodeBridgeScript = `// tally-cors-bridge.js
// Run: node tally-cors-bridge.js
const http = require('http');

const PORT = 9001;
const TALLY_URL = 'http://127.0.0.1:9000';

const server = http.createServer((req, res) => {
  // Add CORS headers so browser can access Tally
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const tallyRes = await fetch(TALLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        body: body
      });
      const text = await tallyRes.text();
      res.writeHead(tallyRes.status, { 'Content-Type': 'text/xml' });
      res.end(text);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(\`🟢 Tally CORS Bridge running on http://localhost:\${PORT} -> forwarding to \${TALLY_URL}\`);
});`;

  const windowsBatScript = `@echo off
title Tally Prime CORS Bridge (Port 9001)
echo Starting Tally Prime CORS Bridge...
echo Browser se connect karne ke liye ready ho raha hai...
echo.
npx -y local-cors-proxy --proxyUrl http://localhost:9000 --port 9001 --proxyPartial ""
pause`;

  const downloadBatFile = () => {
    const blob = new Blob([windowsBatScript], { type: 'application/bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start_tally_bridge.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Live Connection Status Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                tallyStatus === 'online'
                  ? 'bg-emerald-100 text-emerald-700'
                  : tallyStatus === 'checking'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              <Activity className={`w-6 h-6 ${tallyStatus === 'checking' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-800 text-lg">Tally Prime HTTP Server Status</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    tallyStatus === 'online'
                      ? 'bg-emerald-100 text-emerald-800'
                      : tallyStatus === 'checking'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {tallyStatus === 'online' ? '🟢 Connected (Online)' : tallyStatus === 'checking' ? '🟡 Checking...' : '🔴 Offline / Unreachable'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Target endpoint: <span className="font-mono font-semibold text-slate-700">{customUrl}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onTestConnection}
              className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tallyStatus === 'checking' ? 'animate-spin' : ''}`} />
              <span>Test Connection Now</span>
            </button>
          </div>
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Tally Prime HTTP Server URL / Port
            </label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://localhost:9000 or http://127.0.0.1:9000"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Routing Mode
            </label>
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs">
              <input
                type="checkbox"
                id="proxy-mode-check"
                checked={proxyMode}
                onChange={(e) => setProxyMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              <label htmlFor="proxy-mode-check" className="font-semibold text-slate-700 cursor-pointer">
                Express Backend Proxy (Bypasses Browser CORS)
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              onClick={handleSaveConfig}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Save URL
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveSubTab('solutions')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'solutions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Fix Guide & Solutions (हल)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('checklist')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'checklist'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Tally Prime F1 Settings Checklist</span>
        </button>

        <button
          onClick={() => setActiveSubTab('scripts')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'scripts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>1-Click Bridge Scripts (Windows)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('console')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'console'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>XML Query Scratchpad</span>
        </button>
      </div>

      {/* Sub-Tab 1: Solutions & Error Explanation */}
      {activeSubTab === 'solutions' && (
        <div className="space-y-6">
          {/* Why Error Happens Card */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h4>Kyun Aata Hai "Debtor Import Failed / Tally Offline" Error?</h4>
            </div>
            <div className="text-xs text-rose-900 leading-relaxed space-y-1.5">
              <p>
                <strong>Reason 1 (Browser CORS Security):</strong> Modern browsers (Google Chrome, Microsoft Edge)
                security policy ke tahat kisi bhi web page ya <code className="bg-rose-100 px-1 rounded font-mono">file://</code> se local port <code className="bg-rose-100 px-1 rounded font-mono">http://localhost:9000</code> par direct fetch block kar dete hain, kyunki Tally Prime ka built-in server standard CORS headers return nahi karta.
              </p>
              <p>
                <strong>Reason 2 (Tally HTTP Server Off):</strong> Agar Tally Prime mein F1 Connectivity setting mein HTTP Server enable nahi hai ya Port 9000 open nahi hai.
              </p>
              <p>
                <strong>Reason 3 (Company Open Nahi Hai):</strong> Tally Prime khula hai par koi Company select nahi hai.
              </p>
            </div>
          </div>

          {/* 3 Guaranteed Ways to Fix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Method 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-sm mb-3">
                  1
                </div>
                <h5 className="font-bold text-slate-800 text-sm">Direct XML File Upload (100% Guaranteed)</h5>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Sabse aasan aur bina kisi port/network jhanjhat ke: Tally Prime se Debtors ya Items XML export karein (<kbd className="bg-slate-100 px-1 rounded">Alt+E</kbd>) aur yahan seedha drag-and-drop karein.
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-medium">
                ✅ Koi CORS nahi, zero setup required!
              </div>
            </div>

            {/* Method 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-extrabold text-sm mb-3">
                  2
                </div>
                <h5 className="font-bold text-slate-800 text-sm">Built-in Express Proxy / Node Bridge</h5>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Humare application ka built-in Express backend route <code className="bg-slate-100 px-1 font-mono text-[11px]">/api/tally/request</code> server-side se Tally Prime ko call karta hai, jisse browser CORS poori tarah bypass ho jata hai.
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-medium">
                ✅ Automatically enabled in this app!
              </div>
            </div>

            {/* Method 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-extrabold text-sm mb-3">
                  3
                </div>
                <h5 className="font-bold text-slate-800 text-sm">1-Click Windows BAT Script</h5>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Apne Windows PC par humara 1-click batch script download karke double click karein. Yeh localhost:9000 ko CORS-friendly proxy bana deta hai.
                </p>
              </div>
              <button
                onClick={downloadBatFile}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .BAT File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Tally Prime F1 Settings Checklist */}
      {activeSubTab === 'checklist' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <h4 className="font-bold text-slate-800 text-base">Tally Prime F1 Connectivity Step-by-Step Guide</h4>

          <div className="space-y-4">
            <div className="flex items-start space-x-3.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800">Open Tally Prime & Press F1: Help</p>
                <p className="text-slate-600">Top bar mein <span className="font-semibold text-blue-700">F1: Help</span> par click karein ya keyboard se <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs">F1</kbd> dabayein.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800">Navigate to Settings &gt; Connectivity</p>
                <p className="text-slate-600">Menu mein <span className="font-semibold text-blue-700">Settings</span> select karein, fir <span className="font-semibold text-blue-700">Connectivity</span> par enter karein.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800">Configure Client / Server Configuration</p>
                <p className="text-slate-600 font-mono bg-white p-2 rounded border border-slate-200 mt-1">
                  • TallyPrime acts as: <strong className="text-emerald-700">Both</strong> (ya Server)<br/>
                  • Enable ODBC: <strong className="text-emerald-700">Yes</strong><br/>
                  • Port: <strong className="text-emerald-700">9000</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                4
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800">Save & Restart Tally Prime</p>
                <p className="text-slate-600"><kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs">Ctrl + A</kbd> dabakar save karein. Tally aapse restart karne ko kahega, <span className="font-semibold text-emerald-700">Yes</span> karein.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                5
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800">Open Your Company</p>
                <p className="text-slate-600">Restart hone ke baad apni Company select karein. Ab Tally Prime Port 9000 par direct XML requests accept karne ke liye ready hai!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: 1-Click Bridge Scripts */}
      {activeSubTab === 'scripts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Windows Batch File */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-purple-600" />
                <span>Windows Batch (.BAT) Bridge</span>
              </h5>
              <button
                onClick={downloadBatFile}
                className="flex items-center space-x-1 px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre">
              {windowsBatScript}
            </pre>
            <p className="text-[11px] text-slate-500">
              Simply download and double click this file on your PC.
            </p>
          </div>

          {/* Node.js Bridge */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-emerald-600" />
                <span>Node.js Bridge Script</span>
              </h5>
              <button
                onClick={() => copyToClipboard(nodeBridgeScript, 'node')}
                className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-semibold transition cursor-pointer"
              >
                {copiedScript === 'node' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript === 'node' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-56">
              {nodeBridgeScript}
            </pre>
            <p className="text-[11px] text-slate-500">
              Run using <code className="bg-slate-100 px-1 rounded font-mono">node tally-cors-bridge.js</code>.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: XML Query Scratchpad */}
      {activeSubTab === 'console' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-bold text-slate-800 text-sm">Interactive Tally XML Requester</h4>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-semibold">Template:</span>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="COMPANY_INFO">Company Info Query</option>
                <option value="DEBTOR_COLLECTION">Debtor Collection (Sundry Debtors)</option>
                <option value="STOCK_ITEM_COLLECTION">Stock Item Collection</option>
                <option value="SALES_VOUCHERS_COLLECTION">Sales Vouchers (Daybook / Invoices)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Input XML */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Tally Request XML
              </label>
              <textarea
                rows={12}
                value={customXml}
                onChange={(e) => setCustomXml(e.target.value)}
                className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg border border-slate-800 outline-none resize-none leading-relaxed"
              />
              <button
                onClick={handleExecuteXml}
                disabled={isExecutingXml}
                className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isExecutingXml ? 'Sending to Tally Prime...' : 'Execute XML Query (Send)'}
              </button>
            </div>

            {/* Right: Response Output */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Tally XML Response Output
              </label>
              {consoleError ? (
                <div className="bg-rose-950 text-rose-300 font-mono text-xs p-3 rounded-lg border border-rose-800 h-72 overflow-y-auto whitespace-pre-wrap">
                  ❌ Error: {consoleError}
                </div>
              ) : (
                <textarea
                  readOnly
                  rows={12}
                  value={consoleResponse || 'Click "Execute XML Query" to see Tally Prime response...'}
                  className="w-full bg-slate-900 text-slate-300 font-mono text-xs p-3 rounded-lg border border-slate-800 outline-none resize-none leading-relaxed"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
