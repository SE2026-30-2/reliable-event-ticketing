# React + Vite

## Buyer workflow checks

The checkout URL is `/checkout/:reservationId`. Both `/payment/result` and
`/payment-result` open the server-verified payment result. Email links can recover
owned reservations through the existing ticket API, including later API pages.

Run `npm ci`, `npm run lint`, `npm run test:unit`, and `npm run build` before
`npm run test:buyer:browser`. The browser suite uses mocked APIs and decodes the
ticket QR images with jsQR; it does not create real payments.

On Windows, run a separate preview server to avoid the web-server shutdown hang:

```powershell
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5189 --strictPort
```

Then, in another terminal:

```powershell
$env:BUYER_TEST_PORT = '5189'
$env:BUYER_REUSE_TEST_SERVER = '1'
npm run test:buyer:browser
```

Ticket QR images are generated locally with `qrcode`, using only server-issued
ticket payloads. They are not sent to an external QR image endpoint.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Docker reverse proxy

Run `docker compose up -d --build frontend` from the repository root and open
`http://localhost:5173`. Nginx forwards `/api/user` and `/api/user/...` to the
identity service, and `/api/...` plus `/.well-known/jwks.json` to the ticketing
service. The backend ports are exposed on the Docker host's loopback interface
for local access; remote clients should use the frontend origin.

Nginx limits API and JWKS requests to 10 requests per second per client IP,
with a burst of 30; excess requests receive HTTP 429. The limit is local to each
Nginx instance. Nginx replaces the incoming `X-Forwarded-For` header with its
direct peer's address; an additional proxy in front of Nginx needs an explicit
trusted-proxy configuration for per-client limits to work correctly.

The backend services also have their own rate limits. With their default settings,
requests proxied by Nginx share a backend limit bucket because the backend sees
the Nginx container IP. In particular, identity's registration and email recovery
limits are shared across clients. Ticketing can be configured to trust
`X-Forwarded-For`, but this is safe only when all access to that backend is
restricted to trusted proxies that overwrite the header.

For Vite development without Docker, copy `frontend/.env.example` to
`frontend/.env` and adjust the API URLs locally. The `.env` file is ignored by Git.

`VITE_USER_SERVICE_URL` and `VITE_TICKETING_SERVICE_URL` in the root `.env`
default to `http://localhost:5173`, the public Nginx origin for local use. Vite
embeds these values when the image is built, so rebuild the frontend after
changing them. For access from another device or a deployment, set both values
to the externally reachable frontend origin before building; `localhost` refers
to the device running the browser. Docker service names are internal and cannot
be resolved by the browser. Setting either URL to a different API origin directs
those requests away from this proxy.
