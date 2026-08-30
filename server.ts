import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Support XML and JSON body parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ type: "text/xml", limit: "50mb" }));

  // CORS headers for local testing
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy endpoint to send XML to Tally Prime without browser CORS / PNA restrictions
  app.post("/api/tally/request", async (req, res) => {
    try {
      const tallyUrl = req.body.url || "http://127.0.0.1:9000";
      const xmlBody = typeof req.body === "string" ? req.body : req.body.xml;

      if (!xmlBody || !xmlBody.trim()) {
        return res.status(400).json({
          success: false,
          error: "No XML body provided in request",
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const tallyResponse = await fetch(tallyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml;charset=UTF-8",
          },
          body: xmlBody,
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
        const isTimeout = fetchErr.name === "AbortError";
        return res.status(502).json({
          success: false,
          error: isTimeout
            ? `Connection to Tally at ${tallyUrl} timed out after 10s.`
            : `Failed to connect to Tally Prime at ${tallyUrl}: ${fetchErr.message}`,
          code: fetchErr.code || (isTimeout ? "ETIMEDOUT" : "ECONNREFUSED"),
          details: {
            targetUrl: tallyUrl,
            suggestion:
              "Check that Tally Prime is running, HTTP Server is enabled on port 9000, and a company is open.",
          },
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error during Tally request proxy",
      });
    }
  });

  // Tally connectivity test endpoint
  app.post("/api/tally/test", async (req, res) => {
    const tallyUrl = req.body.url || "http://127.0.0.1:9000";
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

      return res.json({
        online: true,
        status: response.status,
        url: tallyUrl,
        xmlSample: text.substring(0, 300),
      });
    } catch (error: any) {
      return res.json({
        online: false,
        url: tallyUrl,
        error: error.message,
        suggestion: "Ensure Tally Prime is open with F1 > Settings > Connectivity > HTTP Server enabled on Port 9000.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Professional Billing Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
