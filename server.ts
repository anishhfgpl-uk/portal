import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ type: "text/xml", limit: "50mb" }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
  const tallyProxy = async (req: any, res: any) => {
    try {
      const localTallyUrl = req.body?.url || "http://127.0.0.1:9000";
      const xmlBody = typeof req.body === "string" ? req.body : req.body?.xml;
      if (!xmlBody || !xmlBody.trim()) return res.status(400).json({ success: false, error: "No XML body provided in request" });

      // Hosted production portal -> secure office bridge -> TallyPrime localhost.
      const bridgeUrl = (process.env.TALLY_BRIDGE_URL || "").replace(/\/$/, "");
      const bridgeToken = process.env.TALLY_BRIDGE_TOKEN || "";
      const targetUrl = bridgeUrl ? `${bridgeUrl}/tally` : localTallyUrl;
      const headers: Record<string, string> = { "Content-Type": "text/xml;charset=UTF-8" };
      if (bridgeToken) headers["X-Bridge-Token"] = bridgeToken;

      const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 45000);
      try {
        const tallyResponse = await fetch(targetUrl, { method: "POST", headers, body: xmlBody, signal: controller.signal });
        clearTimeout(timeoutId);
        const responseText = await tallyResponse.text();

        if (bridgeUrl) {
          let bridgePayload: any = null;
          try { bridgePayload = JSON.parse(responseText); } catch {}
          if (!tallyResponse.ok || !bridgePayload?.ok) {
            return res.status(502).json({ success: false, error: bridgePayload?.error || `Office Tally connector returned HTTP ${tallyResponse.status}` });
          }
          return res.status(200).json({ success: true, status: bridgePayload.tallyStatus || tallyResponse.status, xml: bridgePayload.xml || "" });
        }

        return res.status(200).json({ success: true, status: tallyResponse.status, xml: responseText });      } catch (fetchErr: any) {
        clearTimeout(timeoutId); const isTimeout = fetchErr.name === "AbortError";
        return res.status(502).json({ success: false, error: isTimeout ? `Connection to Tally at ${tallyUrl} timed out after 45s.` : `Failed to connect to Tally Prime at ${tallyUrl}: ${fetchErr.message}`, code: fetchErr.code || (isTimeout ? "ETIMEDOUT" : "ECONNREFUSED") });
      }
    } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "Internal server error during Tally request proxy" }); }
  };
  app.post("/api/tally/request", tallyProxy);
  app.post("/app/api/tally/request", tallyProxy);
  app.post("/api/tally/test", async (req, res) => {
    const tallyUrl = req.body.url || "http://127.0.0.1:9000";
    const testXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>CompanyInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
    try { const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 5000); const response = await fetch(tallyUrl, { method: "POST", headers: { "Content-Type": "text/xml;charset=UTF-8" }, body: testXml, signal: controller.signal }); clearTimeout(timeoutId); return res.json({ online: true, status: response.status, url: tallyUrl, xmlSample: (await response.text()).substring(0, 300) }); }
    catch (error: any) { return res.json({ online: false, url: tallyUrl, error: error.message }); }
  });
  if (process.env.NODE_ENV !== "production") { const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares); }
  else { const distPath = path.join(process.cwd(), "dist"); app.use(express.static(distPath)); app.get("/", (_req, res) => res.redirect(302, "/portal/")); app.use((req, res, next) => { if (req.method !== "GET" && req.method !== "HEAD") return next(); if (!req.path.startsWith("/portal") && !req.path.startsWith("/app")) return next(); if (path.extname(req.path)) return next(); res.sendFile(path.join(distPath, "index.html")); }); }
  app.listen(PORT, "0.0.0.0", () => console.log(`Professional Billing Portal Server running on http://0.0.0.0:${PORT}`));
}
startServer();
