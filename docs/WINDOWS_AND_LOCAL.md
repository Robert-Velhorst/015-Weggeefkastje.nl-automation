# Windows 11 local operation and Hetzner deployment

Workstation operation stays on loopback. Public deployment targets Hetzner; see the repository-root `DEPLOYMENT_TARGET.md` for the migration directive and acceptance gates.


## Standalone local installation

Use Node.js 24.22.0 LTS or Node.js 26.12.0 current stable, then run this once from PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

The installer restores the locked dependencies, builds the production frontend/backend, applies migrations and runs database diagnostics. It creates `.env` from safe loopback defaults only when the file does not exist.

Start and stop the application with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-windows.ps1
```

The server and worker run in hidden background processes. Their validated PIDs are stored under `data/runtime`; logs remain under `data/logs`. The stop script refuses to stop a PID whose command line does not match this application.

## Public deployment

Use the application container behind a reviewed HTTPS reverse proxy on the Hetzner host. Set the production `APP_BASE_URL`, `TRUST_PROXY=true`, and `COOKIE_SECURE=true` values, keep first-owner setup restricted, and open public ingress only after bootstrap. Do not expose a workstation process as a public service.

## Docker

`docker compose up --build` is a loopback-published local container deployment. Its Compose environment is explicitly development-mode because TLS terminates nowhere in that local topology. For public container operation, place the image behind a real HTTPS reverse proxy and provide production `APP_BASE_URL`, `TRUST_PROXY=true`, `COOKIE_SECURE=true`, and deliberate network-binding settings.
