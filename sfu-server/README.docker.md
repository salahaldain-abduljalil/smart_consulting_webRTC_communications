Docker Compose for mediasoup SFU + coturn + nginx (wss)

This folder contains a Docker Compose stack to run a local mediasoup SFU, a coturn TURN server, and nginx reverse proxy with TLS termination.

Files added
- Dockerfile - builds the mediasoup SFU server container (native build dependencies included)
- docker-compose.yml - brings up mediasoup, coturn and nginx
- nginx/nginx.conf - proxy configuration for wss (expects certs at nginx/certs)
- nginx/certs/README.txt - instructions for self-signed certs

Quick start (Linux / WSL2 / Docker recommended)

1. Create environment file `.env` in `sfu-server/` with at least:

```
SFU_SECRET=some-long-random-secret
TURN_SECRET=another-secret-for-turn
TURN_REALM=example.com
MEDIASOUP_ANNOUNCED_IP=your.public.ip.or.hostname
WORKER_COUNT=1
```

2. Create TLS certs for nginx (for dev you can create self-signed):

```bash
cd sfu-server/nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj "/CN=localhost"
```

3. Build and start the stack:

```bash
cd sfu-server
docker-compose up --build
```

4. Verify:
- nginx listens on 443 and proxies `/ws/` to the mediasoup container.
- coturn listens on 3478 (UDP/TCP) and will serve as TURN server for clients.
- mediasoup listens on 4000 and on UDP RTP ports 10000-10100.

Notes & limitations
- The mediasoup native build can be heavy; prefer running this on Linux or WSL2. On Windows Docker Desktop with WSL2 backend should work.
- For production: secure the TURN server (use long random static auth secret or better a long-term credentials mechanism), configure TLS certificates via a trusted CA, tune mediasoup worker/ports and persist room mapping in a shared store.

Next steps I can do for you
- Add a docker-compose override with volumes for logs and monitoring.
- Add an example `nginx` TLS config for Let's Encrypt (certbot) automation.
- Wire Laravel to know the public nginx domain (set MEDIASOUP_ANNOUNCED_IP and appropriate env vars).
