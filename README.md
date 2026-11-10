# RetailFlow Frontend

React, TypeScript, and Vite client for the local RetailFlow POS simulator.

## Run

```sh
npm install
npm run dev
```

The frontend binds to `127.0.0.1:5001` and calls the API at `127.0.0.1:5002`.
Override the API origin with `VITE_API_BASE_URL` in `.env.local` when needed.

## Local data mode

[`src/config.ts`](src/config.ts) defaults `isMock` to `true`. `VITE_IS_MOCK`
overrides the mode at Vite startup/build time. The mode selects the API endpoint;
role choices, authentication sessions, and business data come from the API in
both modes.

- Mock mode uses `VITE_MOCK_API_BASE_URL`, or the local loopback API during
  development. Production mock deployments must set a dedicated test API origin.
- Live mode requires `VITE_REAL_API_BASE_URL`; it never falls back to the mock
  endpoint. Both URL settings are origins, such as
  `http://127.0.0.1:5002`, because the client appends `/api/v1` routes.
- Vite settings are public build-time configuration, not secrets. Rebuild the
  frontend after changing a deployed mode or endpoint.

The local API still uses synthetic accounts and a local PGlite database. Its
demo-role login is a server-managed simulator, not a production identity
provider. See the [data-mode and architecture guide](../DATA_MODE_AND_ARCHITECTURE.md).

The canonical app architecture and threat model are maintained in the sibling
backend repository: [architecture](../retailflow-backend/docs/architecture.md)
and [threat model](../retailflow-backend/docs/security/threat-model.md).

## Checks

```sh
npm run format:check
npm run lint
npm test -- --coverage
npm run test:e2e
npm run build
npm audit
```

Catalog photos are bundled locally. Their Unsplash source URLs and license are
listed in [public/images/SOURCES.md](public/images/SOURCES.md).

The role picker uses synthetic accounts. This client is a learning demo, not a
production authentication or payment interface. See the workspace README for
the security and legal-use boundaries.
