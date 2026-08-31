# Tally Bridge

This bridge is intended to run on the same Windows PC as TallyPrime. It receives portal requests and forwards XML to TallyPrime on `127.0.0.1:9000`.

## Important

Do not expose this bridge directly to the public internet without authentication and TLS. The production portal should use a secure private tunnel/VPN or authenticated relay to reach this machine.

The bridge listens on port 8787 by default and only binds to `127.0.0.1` for local testing. For a remote portal, bind it only to a private network/tunnel interface and configure `BRIDGE_TOKEN`.
