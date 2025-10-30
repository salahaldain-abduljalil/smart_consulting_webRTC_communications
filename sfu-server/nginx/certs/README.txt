
Place TLS certificate and key here as:

- server.crt
- server.key

For development you can create a self-signed cert:

openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj "/CN=localhost"

In production, use a valid certificate and keep the private key secure.
