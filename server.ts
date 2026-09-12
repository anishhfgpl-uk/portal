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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Tally proxy handler. Keep both /api and /app/api aliases because the portal
  // can be exposed at the domain root or mounted under /app by Cloudflare.
  const tallyRequestHandler = async (req: express.Request, res: express.Response) => {
    try {
      const body: any = req.body || {};
      const tallyUrl = body.url || "http://127.0.0.1:9000";
      const xmlBody = typeof body === "string" ? body : body.xml;

      if (!xmlBody || !String(xmlBody).trim()) {
        return res.status(400).json({ success: false, error: "No XML body provided in request" });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const tallyResponse = await fetch(tallyUrl, {
          method: "POST",
          headers: { "Content-Type": "text/xml;charset=UTF-8" },
          body: String(xmlBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseText = await tallyResponse.text();

        return res.status(200).json({
          success: true,
          status: tallyResponse.status,
          xml: responseText,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr?.name === "AbortError";
        return res.status(502).json({
          success: false,
          error: isTimeout
            ? `Connection to Tally at ${tallyUrl} timed out after 45s.`
            : `Failed to connect to Tally Prime at ${tallyUrl}: ${fetchErr?.message || "network error"}`,
          code: fetchErr?.code || (isTimeout ? "ETIMEDOUT" : "ECONNREFUSED"),
          details: { targetUrl: tallyUrl },
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Internal server error during Tally request proxy" });
    }
  };

  app.post("/api/tally/request", tallyRequestHandler);
  app.post("/app/api/tally/request", tallyRequestHandler);

  const tallyTestHandler = async (req: express.Request, res: express.Response) => {
    const tallyUrl = (req.body || {}).url || "http://127.0.0.1:9000";
    const testXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>CompanyInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(tallyUrl, {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=UTF-8" },
        body: testXml,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      return res.json({ online: true, status: response.status, url: tallyUrl, xmlSample: text.substring(0, 300) });
    } catch (error: any) {
      return res.json({ online: false, url: tallyUrl, error: error?.message, suggestion: "Ensure Tally Prime is running and HTTP Server is enabled on Port 9000." });
    }
  };

  app.post("/api/tally/test", tallyTestHandler);
  app.post("/app/api/tally/test", tallyTestHandler);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/", (_req, res) => res.redirect(302, "/portal/"));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (!req.path.startsWith("/portal") && !req.path.startsWith("/app")) return next();
      if (path.extname(req.path)) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Professional Billing Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
