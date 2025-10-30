Mediasoup SFU server scaffold

This directory contains a minimal mediasoup SFU server scaffold used for local testing and development.

Important notes
- mediasoup is a native module and requires building native binaries. Use Node.js LTS and follow mediasoup installation docs.
- This scaffold is intentionally minimal. For production you must add proper authentication, TLS, TURN/STUN configuration, and horizontal scaling.

Quick start (local, dev):

1. Install dependencies (run in project `sfu-server` folder):

```powershell
cd sfu-server
npm install
```

2. Start the server:

```powershell
npm start
```

The server listens on port 4000 by default. The frontend client in this repo expects the SFU on ws://localhost:4000.

Integrating with frontend
- The frontend provides a minimal `resources/js/meeting/sfu/mediasoupClient.js` which implements a simple WebSocket request/response API used by the demo hook.
- For robust behavior, replace this with `mediasoup-client` and follow the mediasoup client examples (create send/recv transports, produce, consume, handle rtpParameters properly).

Production recommendations
- Use TURN servers to support clients behind symmetric NATs.
- Add TLS (wss/https) and authentication for signaling.
- Run multiple mediasoup workers and a router per worker; use a load balancer and a signaling layer that maps rooms to workers.
- Persist state (rooms, participants) in a DB or shared store.

References
- https://mediasoup.org/
- mediasoup server examples: https://github.com/versatica/mediasoup/tree/master/examples

