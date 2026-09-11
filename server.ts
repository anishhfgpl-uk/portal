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

  // Tally proxy for explicit GSTR-1 exports. Keep this path separate from the
  // connection test so simply checking Tally never sends an XML export request.
  app.post("/api/tally/request", async (req, res) => {
    try {
      const tallyUrl = req.body.url || "http://127.0.0.1:9000";
      const xmlBody = typeof req.body === "string" ? req.body : req.body.xml;

      if (!xmlBody || !xmlBody.trim()) {
        return res.status(400).json({ success: false, error: "No XML body provided in request" });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const tallyResponse = await fetch(tallyUrl, {
          method: "POST",
          headers: { "Content-Type": "text/xml;charset=UTF-8" },
          body: xmlBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseText = await tallyResponse.text();
        return res.status(200).json({ success: true, status: tallyResponse.status, xml: responseText });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr.name === "AbortError";
        return res.status(502).json({
          success: false,
          error: isTimeout
            ? `Connection to Tally at ${tallyUrl} timed out after 20s.`
            : `Failed to connect to Tally Prime at ${tallyUrl}: ${fetchErr.message}`,
          code: fetchErr.code || (isTimeout ? "ETIMEDOUT" : "ECONNREFUSED"),
          details: { targetUrl: tallyUrl, suggestion: "Check that Tally Prime is running, HTTP Server is enabled on port 9000, and a company is open." },
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || "Internal server error during Tally request proxy" });
    }
  });

  // IMPORTANT: connection test is intentionally non-invasive. A GET to Tally's
  // HTTP endpoint confirms that the server is reachable without invoking Tally's
  // XML export engine, which can lock/crash a busy TallyPrime instance.
  app.post("/api/tally/test", async (req, res) => {
    const tallyUrl = String(req.body?.url || "http://127.0.0.1:9000").replace(/\/$/, "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(tallyUrl, {
        method: "GET",
        headers: { Accept: "text/plain, text/xml, */*" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      return res.json({
        online: response.ok,
        status: response.status,
        url: tallyUrl,
        response: text.substring(0, 300),
        xmlExportTested: false,
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      return res.json({
        online: false,
        url: tallyUrl,
        error: error.name === "AbortError" ? "Tally HTTP server did not respond within 3 seconds." : error.message,
        xmlExportTested: false,
        suggestion: "Ensure TallyPrime is open and HTTP Server is enabled on port 9000.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/", (_req, res) => res.redirect(302, "/portal/"));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (!req.path.startsWith("/portal")) return next();
      if (path.extname(req.path)) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Professional Billing Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
