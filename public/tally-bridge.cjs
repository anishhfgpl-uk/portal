const fs = require('fs');
const path = require('path');
const http = require('http');

// Load connector settings from the local .env file before reading process.env.
// This keeps the office bridge authenticated even when started by Task Scheduler.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const HOST = process.env.BRIDGE_HOST || '127.0.0.1';
const PORT = Number(process.env.BRIDGE_PORT || 8787);
const TALLY_URL = process.env.TALLY_URL || 'http://127.0.0.1:9000';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || '';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://anish-tech.online';
const MAX_BODY = 10 * 1024 * 1024;

const PORTAL_URL = (process.env.PORTAL_URL || 'https://anish-portal.onrender.com').replace(/\/$/, '');
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);

async function pollHostedPortal() {
  if (!BRIDGE_TOKEN) return;
  try {
    const response = await fetch(PORTAL_URL + '/api/tally/poll', {
      headers: { 'X-Bridge-Token': BRIDGE_TOKEN },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status === 204) return;
    if (!response.ok) return;
    const job = await response.json();
    if (!job?.id || !job?.xml) return;
    try {
      const tallyResponse = await fetch(TALLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        body: job.xml,
        signal: AbortSignal.timeout(15000)
      });
      const xml = await tallyResponse.text();
      await fetch(PORTAL_URL + '/api/tally/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': BRIDGE_TOKEN },
        body: JSON.stringify({ id: job.id, ok: true, status: tallyResponse.status, xml }),
        signal: AbortSignal.timeout(8000)
      });
    } catch (err) {
      await fetch(PORTAL_URL + '/api/tally/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': BRIDGE_TOKEN },
        body: JSON.stringify({ id: job.id, ok: false, error: String(err?.message || err) }),
        signal: AbortSignal.timeout(8000)
      }).catch(() => {});
    }
  } catch (_) {}
}

setInterval(pollHostedPortal, POLL_INTERVAL_MS);
setTimeout(pollHostedPortal, 1000);



function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Token, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!BRIDGE_TOKEN) return false;
  const header = req.headers['x-bridge-token'] || '';
  const auth = req.headers.authorization || '';
  return header === BRIDGE_TOKEN || auth === `Bearer ${BRIDGE_TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > MAX_BODY) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, {
      ok: true,
      service: 'tally-bridge',
      tallyUrl: TALLY_URL,
      auth: Boolean(BRIDGE_TOKEN)
    });
  }

  if (req.method !== 'POST' || req.url !== '/tally') {
    return send(res, 404, { ok: false, error: 'Not found' });
  }

  if (!authorized(req)) {
    return send(res, 401, { ok: false, error: 'Bridge token authentication is required' });
  }

  try {
    const raw = await readBody(req);
    const contentType = req.headers['content-type'] || '';
    let xml = raw;
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(raw || '{}');
      xml = parsed.xml || '';
    }

    if (!xml || !xml.trim()) return send(res, 400, { ok: false, error: 'XML is required' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(TALLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        body: xml,
        signal: controller.signal
      });
      const responseXml = await response.text();
      clearTimeout(timer);
      return send(res, 200, {
        ok: true,
        tallyStatus: response.status,
        xml: responseXml
      });
    } catch (err) {
      clearTimeout(timer);
      return send(res, 502, {
        ok: false,
        error: `Cannot connect to Tally at ${TALLY_URL}: ${err.message}`
      });
    }
  } catch (err) {
    return send(res, 400, { ok: false, error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Tally Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Forwarding to Tally: ${TALLY_URL}`);
  console.log(BRIDGE_TOKEN ? 'Bridge token authentication: ENABLED' : 'ERROR: Bridge token authentication is DISABLED; POST requests will be rejected');
});
