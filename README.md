<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d3bf3c56-6160-4d5b-bf18-5f052fe7b86d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Production Tally connection

Architecture:

`Browser -> Portal backend -> https://tally-bridge.anish-tech.online -> office Cloudflare Tunnel -> 127.0.0.1:8787 -> Tally Prime 127.0.0.1:9000`

The browser never receives the bridge token. The portal backend sends `TALLY_BRIDGE_TOKEN` server-to-server.

### Office connector

Download `public/Anish-Tally-Connector-Installer.ps1` from the deployed portal and run PowerShell as Administrator.

The installer:
- installs the authenticated local bridge as a Windows Scheduled Task;
- forwards `127.0.0.1:8787` to Tally Prime `127.0.0.1:9000`;
- reuses the existing Cloudflare Tunnel instead of creating a new tunnel;
- does not require a second Cloudflare login;
- checks both the local bridge and the public bridge health endpoint.

The office PC must keep Tally Prime running with its HTTP/XML server enabled on port 9000 and the existing Cloudflare Tunnel service running.

### Hosted environment

Set these production environment variables on the host:

`TALLY_BRIDGE_URL=https://tally-bridge.anish-tech.online`
`TALLY_BRIDGE_TOKEN=<the same token entered in the office installer>`

Do not put the token in frontend code or Git.

### Render

A `render.yaml` deployment definition is included. After connecting this repository to Render, create the `TALLY_BRIDGE_TOKEN` secret and deploy. The health endpoint is `/api/health`.

### Portal URL

The production server serves the portal at `/portal/` and redirects `/` to `/portal/`.
