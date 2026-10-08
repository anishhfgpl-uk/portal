import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import crypto from "crypto";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ type: "text/xml", limit: "50mb" }));

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Bridge-Token");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Portal authentication: credentials stay server-side in Render environment variables.
  // Defaults are provided for first setup; set PORTAL_USER_ID and PORTAL_PASSWORD in Render to change them.
  const portalUserId = process.env.PORTAL_USER_ID || "admin";
  const portalPassword = process.env.PORTAL_PASSWORD || "admin123";
  const sessionSecret = process.env.PORTAL_SESSION_SECRET || process.env.TALLY_BRIDGE_TOKEN || "change-this-session-secret";
  const sessionCookie = "anish_portal_session";
  const sessionPayload = (userId: string) => Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString("base64url");
  const sessionSignature = (payload: string) => crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const makeSession = (userId: string) => {
    const payload = sessionPayload(userId);
    return payload + "." + sessionSignature(payload);
  };
  const safeEqual = (a: string, b: string) => {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  };
  const isAuthenticated = (req: any) => {
    const cookieHeader = String(req.headers.cookie || "");
    const match = cookieHeader.match(new RegExp("(?:^|;\\s*)" + sessionCookie + "=([^;]+)"));
    if (!match) return false;
    const token = decodeURIComponent(match[1]);
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return false;
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    if (!safeEqual(signature, sessionSignature(payload))) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return parsed?.userId === portalUserId;
    } catch {
      return false;
    }
  };

  app.post("/api/auth/login", (req, res) => {
    const userId = String(req.body?.userId || "");
    const password = String(req.body?.password || "");
    if (!safeEqual(userId, portalUserId) || !safeEqual(password, portalPassword)) {
      return res.status(401).json({ ok: false, error: "Invalid User ID or Password." });
    }
    const token = makeSession(userId);
    res.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=28800`);
    return res.json({ ok: true });
  });

  app.get("/api/auth/session", (req, res) => {
    return res.json({ authenticated: isAuthenticated(req) });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.setHeader("Set-Cookie", `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
    return res.json({ ok: true });
  });

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  );

  // Durable cloud storage is partitioned by company. Tally is never allowed to delete it.
  const cloudPool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 }) : null;
  let cloudTableReady: Promise<void> | null = null;
  const ensureCloudTable = async () => {
    if (!cloudPool) return;
    if (!cloudTableReady) cloudTableReady = cloudPool.query("CREATE TABLE IF NOT EXISTS portal_cloud_data (id TEXT PRIMARY KEY, snapshot JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").then(() => undefined);
    await cloudTableReady;
  };
  const cloudCompanyKey = (company: any) => {
    const gstin = String(company?.gstin || '').trim().toLowerCase();
    const guid = String(company?.tallyGuid || '').trim().toLowerCase();
    const name = String(company?.name || '').trim().toLowerCase();
    return (guid || gstin || name).replace(/[^a-z0-9]+/g, '-');
  };
  const emptyCompanyData = () => ({ company: null, parties: [], stockItems: [], invoices: [], tallyVouchers: [] });

  app.get("/api/cloud-data", async (_req, res) => {
    if (!cloudPool) return res.json({ exists: false, cloud: false, dataByCompany: {} });
    try {
      await ensureCloudTable();
      const result = await cloudPool.query("SELECT id, snapshot, updated_at FROM portal_cloud_data ORDER BY updated_at ASC");
      const dataByCompany: Record<string, any> = {};
      const companies: any[] = [];
      for (const row of result.rows) {
        if (row.id !== 'main') {
          const stored = row.snapshot || {};
          const key = cloudCompanyKey(stored.company) || row.id;
          const current = dataByCompany[key] || emptyCompanyData();
          dataByCompany[key] = { ...current, ...stored };
          dataByCompany[key].parties = Array.isArray(current.parties) ? [...current.parties, ...(stored.parties || [])] : (stored.parties || []);
          dataByCompany[key].stockItems = Array.isArray(current.stockItems) ? [...current.stockItems, ...(stored.stockItems || [])] : (stored.stockItems || []);
          dataByCompany[key].invoices = Array.isArray(current.invoices) ? [...current.invoices, ...(stored.invoices || [])] : (stored.invoices || []);
          dataByCompany[key].tallyVouchers = Array.isArray(current.tallyVouchers) ? [...current.tallyVouchers, ...(stored.tallyVouchers || [])] : (stored.tallyVouchers || []);
          if (dataByCompany[key].company?.name) companies.push(dataByCompany[key].company);
          continue;
        }
        const old = row.snapshot || {};
        const oldCompanies = Array.isArray(old.companies) ? old.companies : [];
        const fallbackCompany = old.sellerInfo || oldCompanies[0] || null;
        const sourceCompanies = oldCompanies.length ? oldCompanies : (fallbackCompany ? [fallbackCompany] : []);
        sourceCompanies.forEach((company: any) => {
          const key = cloudCompanyKey(company); if (!key) return;
          const gst = String(company?.gstin || '').trim().toLowerCase(), name = String(company?.name || '').trim().toLowerCase();
          const matchesInvoice = (inv: any) => (gst && String(inv?.sellerGstin || '').trim().toLowerCase() === gst) || (name && String(inv?.sellerName || '').trim().toLowerCase() === name);
          const current = dataByCompany[key] || emptyCompanyData();
          current.company = company;
          current.parties = (old.parties || []).map((p: any) => ({ ...p, companyKey: p.companyKey || key }));
          current.stockItems = (old.stockItems || []).map((i: any) => ({ ...i, companyKey: i.companyKey || key }));
          current.invoices = (old.invoices || []).filter(matchesInvoice).map((i: any) => ({ ...i, companyKey: i.companyKey || key }));
          current.tallyVouchers = (old.tallyVouchers || []).filter((v: any) => !v.companyKey || v.companyKey === key).map((v: any) => ({ ...v, companyKey: v.companyKey || key }));
          dataByCompany[key] = current;
          if (!companies.some((c) => cloudCompanyKey(c) === key)) companies.push(company);
        });
      }
      return res.json({ exists: companies.length > 0, cloud: true, companies, dataByCompany, updatedAt: result.at(-1)?.updated_at || null });
    } catch (error: any) {
      return res.status(503).json({ exists: false, cloud: true, dataByCompany: {}, error: error?.message || "Cloud storage unavailable" });
    }
  });

  app.put("/api/cloud-data", async (req, res) => {
    if (!cloudPool) return res.status(503).json({ ok: false, error: "Cloud database is not configured" });
    try {
      await ensureCloudTable();
      const companyKey = String(req.body?.companyKey || '').trim();
      const company = req.body?.company || null;
      if (!companyKey || !company?.name) return res.status(400).json({ ok: false, error: "companyKey and company are required" });
      // Never let a stale/partial browser state erase an already-saved company.
      // Merge incoming records into the existing company snapshot. Matching records
      // are updated; records missing from a partial request are preserved.
      const existingResult = await cloudPool.query("SELECT snapshot FROM portal_cloud_data WHERE id = $1", [companyKey]);
      const existing = existingResult.rows[0]?.snapshot || {};
      const incomingParties = Array.isArray(req.body?.parties) ? req.body.parties : [];
      const incomingItems = Array.isArray(req.body?.stockItems) ? req.body.stockItems : [];
      const incomingInvoices = Array.isArray(req.body?.invoices)
        ? req.body.invoices.map((i: any) => ({ ...i, companyKey: i.companyKey || companyKey }))
        : [];
      const incomingVouchers = Array.isArray(req.body?.tallyVouchers)
        ? req.body.tallyVouchers.map((v: any) => ({ ...v, companyKey: v.companyKey || companyKey }))
        : [];

      const mergeRecords = (previous: any[], incoming: any[], key: (row: any) => string) => {
        const map = new Map<string, any>();
        (Array.isArray(previous) ? previous : []).forEach((row: any) => {
          const k = key(row);
          if (k) map.set(k, row);
        });
        incoming.forEach((row: any) => {
          const k = key(row);
          if (k) map.set(k, row);
        });
        return Array.from(map.values());
      };

      const snapshot = {
        company,
        parties: mergeRecords(existing.parties, incomingParties, (p: any) => String(p.id || p.name || '').trim().toLowerCase()),
        stockItems: mergeRecords(existing.stockItems, incomingItems, (i: any) => String(i.id || i.name || '').trim().toLowerCase()),
        invoices: mergeRecords(existing.invoices, incomingInvoices, (i: any) => String(i.id || i.tallyGuid || i.tallyMasterId || i.invoiceNo || '').trim().toLowerCase()),
        tallyVouchers: mergeRecords(existing.tallyVouchers, incomingVouchers, (v: any) => String(v.id || v.tallyGuid || v.tallyMasterId || v.voucherNumber || '').trim().toLowerCase()),
      };
      await cloudPool.query("INSERT INTO portal_cloud_data (id, snapshot, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()", [companyKey, JSON.stringify(snapshot)]);
      return res.json({ ok: true, cloud: true, companyKey, updatedAt: new Date().toISOString() });
    } catch (error: any) {
      return res.status(503).json({ ok: false, error: error?.message || "Cloud save failed" });
    }
  });
  // Outbound office polling fallback: the office connector polls this hosted endpoint.
  const pendingBridgeRequests = new Map<string, { xml: string; resolve: (value: any) => void }>();
  const bridgeQueue: string[] = [];
  const bridgeTokenMatches = (req: any) => {
    const configured = process.env.TALLY_BRIDGE_TOKEN?.trim() || "";
    const supplied = String(req.headers["x-bridge-token"] || req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    return Boolean(configured && supplied && configured === supplied);
  };
  const getTallyTarget = () => {
    const localTallyUrl = "http://127.0.0.1:9000";
    const bridgeUrl = (process.env.TALLY_BRIDGE_URL || "https://tally-bridge.anish-tech.online").replace(/\/$/, "");
    return {
      localTallyUrl,
      bridgeUrl,
      targetUrl: bridgeUrl ? `${bridgeUrl}/tally` : localTallyUrl,
    };
  };

  const proxyTallyXml = async (xmlBody: string, req: any, res: any) => {
    if (!xmlBody || !xmlBody.trim()) {
      return res.status(400).json({ success: false, error: "No XML body provided in request" });
    }

    const { localTallyUrl, bridgeUrl, targetUrl } = getTallyTarget();

    // The office connector is protected by the Cloudflare Tunnel/private network.
    // No browser-side token is required for the hosted portal.
    const headers: Record<string, string> = {
      "Content-Type": "text/xml;charset=UTF-8",
    };

    // The bridge keeps its token only on the office connector. The hosted
    // server must forward the same secret server-to-server; it is never sent
    // from the browser.
    const bridgeToken =
      process.env.TALLY_BRIDGE_TOKEN?.trim() ||
      String(req.headers["x-bridge-token"] || req.body?.bridgeToken || "").trim();
    if (bridgeToken) {
      headers["X-Bridge-Token"] = bridgeToken;
      headers["Authorization"] = `Bearer ${bridgeToken}`;
    }


    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: xmlBody,
        signal: controller.signal,
      });

      const responseText = await response.text();
      clearTimeout(timeoutId);

      if (bridgeUrl) {
        let bridgePayload: any = null;
        try {
          bridgePayload = JSON.parse(responseText);
        } catch {}

        if (!response.ok || !bridgePayload?.ok) {
          return res.status(502).json({
            success: false,
            error:
              bridgePayload?.error ||
              `Office Tally connector returned HTTP ${response.status}`,
          });
        }

        return res.status(200).json({
          success: true,
          status: bridgePayload.tallyStatus || response.status,
          xml: bridgePayload.xml || "",
        });
      }

      return res.status(200).json({
        success: true,
        status: response.status,
        xml: responseText,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);

      const requestId = "tally-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      const bridgeResult = await new Promise<any>((resolve) => {
        pendingBridgeRequests.set(requestId, { xml: xmlBody, resolve });
        bridgeQueue.push(requestId);
        setTimeout(() => {
          const item = pendingBridgeRequests.get(requestId);
          if (item) {
            pendingBridgeRequests.delete(requestId);
            item.resolve({ ok: false, error: "Office connector did not respond within 55s." });
          }
        }, 55000);
      });

      if (bridgeResult?.ok && bridgeResult.xml) {
        return res.status(200).json({ success: true, status: bridgeResult.status || 200, xml: bridgeResult.xml, via: "office-poll" });
      }

      const isTimeout = fetchErr?.name === "AbortError";
      const displayUrl = bridgeUrl ? bridgeUrl + "/tally" : localTallyUrl;
      return res.status(502).json({
        success: false,
        error: bridgeResult?.error || (isTimeout
          ? "Connection to Tally bridge/office at " + displayUrl + " timed out after 45s and office fallback did not respond."
          : "Failed to connect to Tally bridge/office at " + displayUrl + ": " + (fetchErr?.message || "Unknown error")),
        code: fetchErr?.code || (isTimeout ? "ETIMEDOUT" : "ECONNREFUSED"),
      });
    }
  };

  app.get("/api/tally/poll", (req, res) => {
    if (!bridgeTokenMatches(req)) return res.status(401).json({ ok: false, error: "Bridge authentication required" });
    const id = bridgeQueue.shift();
    if (!id) return res.status(204).end();
    const item = pendingBridgeRequests.get(id);
    if (!item) return res.status(204).end();
    return res.json({ ok: true, id, xml: item.xml });
  });

  app.post("/api/tally/respond", (req, res) => {
    if (!bridgeTokenMatches(req)) return res.status(401).json({ ok: false, error: "Bridge authentication required" });
    const id = String(req.body?.id || "");
    const item = pendingBridgeRequests.get(id);
    if (!id || !item) return res.status(404).json({ ok: false, error: "Request not found or expired" });
    pendingBridgeRequests.delete(id);
    item.resolve({
      ok: Boolean(req.body?.ok),
      status: Number(req.body?.status || 200),
      xml: String(req.body?.xml || ""),
      error: String(req.body?.error || "")
    });
    return res.json({ ok: true });
  });

  const tallyProxy = async (req: any, res: any) => {
    try {
        const xmlBody =
        typeof req.body === "string" ? req.body : req.body?.xml;

      return proxyTallyXml(xmlBody, req, res);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Internal server error during Tally request proxy",
      });
    }
  };

  app.post("/api/tally/request", tallyProxy);
  app.post("/app/api/tally/request", tallyProxy);

  app.get("/api/tally/bridge-health", async (_req, res) => {
    const { bridgeUrl } = getTallyTarget();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(bridgeUrl + "/health", { method: "GET", signal: controller.signal });
      clearTimeout(timeoutId);
      const payload = await response.json().catch(() => null);
      return res.status(response.ok ? 200 : 502).json({ ok: response.ok && Boolean(payload?.ok), bridgeUrl, bridge: payload });
    } catch (error: any) {
      return res.status(502).json({ ok: false, bridgeUrl, error: error?.message || "Office bridge health check failed" });
    }
  });

  app.post("/api/tally/test", async (req, res) => {
    const testXml =
      "<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>";

    try {
      const { bridgeUrl } = getTallyTarget();

      // Hosted portal must test through the secure office bridge.
      if (bridgeUrl) {
        return proxyTallyXml(testXml, req, res);
      }

      const tallyUrl = req.body?.url || "http://127.0.0.1:9000";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(tallyUrl, {
          method: "POST",
          headers: { "Content-Type": "text/xml;charset=UTF-8" },
          body: testXml,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return res.json({
          online: response.ok,
          status: response.status,
          url: tallyUrl,
          xmlSample: (await response.text()).substring(0, 300),
        });
      } catch (error: any) {
        clearTimeout(timeoutId);
        return res.json({
          online: false,
          url: tallyUrl,
          error: error?.message || "Connection failed",
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        online: false,
        error: error?.message || "Tally test failed",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve the same built assets and SPA directly under /portal and /Portal.
    app.use(["/portal", "/Portal"], express.static(distPath));
    app.get("/", (_req, res) => res.redirect(302, "/portal/"));

    // Support the public portal path with the exact requested capitalization.
    // Keep the existing lowercase /portal path working as well.
    app.get(["/Portal", "/Portal/", "/portal", "/portal/"], (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (!req.path.startsWith("/Portal/") && !req.path.startsWith("/portal/") && !req.path.startsWith("/app")) return next();
      if (path.extname(req.path)) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Professional Billing Portal Server running on http://0.0.0.0:${PORT}`)
  );
}

startServer();
