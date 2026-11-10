# RetailFlow Frontend

[Architecture guide](docs/architecture.md) — source map, workflows, contracts, data, security, and checks.

## Repository layout and Windows workflow

This is the RetailFlow React/Vite frontend repository. It keeps its own Git history, origin, package manifest, and lockfile; the API is the independent [retailflow-backend](https://github.com/gopichand-retail-apps/retailflow-backend) repository. Place the pair under one RetailFlow folder to use the supplied single-folder VS Code workspace.

Use Node **24.15.0** and npm with the committed lockfile. From this repository in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

The client is at http://127.0.0.1:5001; start the API separately. For both services in the complete Retail Apps workspace, use `./scripts/Start-Apps.ps1 -App RetailFlow` from the workspace root. Use `-EnvironmentName IT` only for the independent IT copies.

See the [app overview](docs/architecture.md#1-scope-users-and-repository-boundary) and [canonical architecture](docs/architecture.md). The architecture guide is included in this repository. No cross-app backend integration is added by this organization change.

React, TypeScript, and Vite client for the local RetailFlow POS simulator.

## Run

```sh
npm ci
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
provider. See the [data-mode and architecture guide](docs/architecture.md#10-build-checks-and-deployment).

The [repository architecture](docs/architecture.md) covers this frontend. The backend
[threat model](https://github.com/gopichand-retail-apps/retailflow-backend/blob/main/docs/security/threat-model.md) is maintained with the API.

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

## Vercel frontend configuration

Import this frontend's GitHub repository as its own Vercel project. Set **Root Directory** to the repository root (`./`), **Node.js Version** to **24.x**, and keep the checked-in [vercel.json](vercel.json). It selects Vite, dist output, and browser-route fallback with `npm ci` and `npm run build`. The SPA fallback excludes /api and /socket.io so missing backend routes do not return HTML.

Set `VITE_IS_MOCK=true` and `VITE_MOCK_API_BASE_URL` to an approved isolated HTTPS API **origin without /api/v1**. For the other selector, set `VITE_IS_MOCK=false` and `VITE_REAL_API_BASE_URL`. The [environment template](.env.vercel.example) lists exact names; it is documentation, not an automatically loaded production configuration. Replace its reserved .invalid host. Changing mode or endpoints requires a new build/deployment. Both selectors still call an API; neither creates a browser-only backend or real provider integration.

Production Vite assets do not contain the development proxy; requests use the configured absolute API URL. A hosted API needs independently verified identity, persistence, exact origin/CORS and session/CSRF settings. Existing APIs remain local-only; localhost in a deployed bundle would point at the visitor or build machine.

The configuration adds noindex, frame/content-type/referrer/permission protections and no-store for the active UI model. Headers and noindex do not provide access control. Keep preview deployment protection enabled and use synthetic data. Hosted routing, cookies, headers, and user workflows have **not** been verified; no deployment is performed.

Known release gaps: Demo-role login is disabled by NODE_ENV=production. Production identity, store isolation, recovery, and hosting remain open. The baseline has formatting and Windows path-test failures.
