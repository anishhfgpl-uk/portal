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
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Bridge-Token");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  );

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
      const isTimeout = fetchErr?.name === "AbortError";
      const displayUrl = bridgeUrl ? `${bridgeUrl}/tally` : localTallyUrl;

      return res.status(502).json({
        success: false,
        error: isTimeout
          ? `Connection to Tally bridge/office at ${displayUrl} timed out after 45s.`
          : `Failed to connect to Tally bridge/office at ${displayUrl}: ${fetchErr?.message || "Unknown error"}`,
        code: fetchErr?.code || (isTimeout ? "ETIMEDOUT" : "ECONNREFUSED"),
      });
    }
  };

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
      "<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>CompanyInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>";

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
