# Resume-Powered Interview Prep

Static interview-prep app with AI question generation through NVIDIA (default), OpenRouter, or OpenCode Zen.

## NVIDIA models and API key

The app selects NVIDIA and `nvidia/nemotron-3-super-120b-a12b` by default. Choose another provider from the AI toolbar. Its live model list is loaded using the configured server key or the provider key entered in Settings for the current page session. If live discovery is unavailable, the built-in model list remains available.

API key fields are in **Settings**, not the AI toolbar; Settings opens only when clicked. Provider keys are never saved in browser storage. On a static site, a user-entered key stays in memory only until that page is closed or refreshed. When the local Node server detects a provider key from `.env` or the hosting environment, it fills the selected provider's password-masked field while Settings is open. Use the Show/Hide control to reveal or mask it. Saving a key while using the local Node app updates `.env` without duplicate provider entries.

For local use, create an ignored `.env` file in the project root:

```env
NVIDIA_API_KEY=your-nvidia-key
OPENROUTER_API_KEY=your-openrouter-key
OPENCODE_API_KEY=your-opencode-zen-key
PROXY_ACCESS_TOKEN=your-long-random-proxy-token
```

The included Node.js 20+ server prefers provider keys in `.env`, then falls back to process environment variables. It detects configured server keys without revealing their values to the app. The resume is sent to the currently selected provider when generating questions.

## Run the app with the NVIDIA proxy

```powershell
node server.js
```

Open `http://localhost:8787`. The server hosts the static app and proxies `/api/nvidia/*`, `/api/openrouter/*`, and `/api/opencode/*` requests to the matching provider, avoiding browser CORS restrictions. Server-side keys are never included in files served to the browser. Private project files such as `.env` and `server.js` are not served. Provider keys can be saved to `.env` only from a local app origin when the server is bound to loopback.

VS Code Live Server on `http://localhost:5500` cannot read or write `.env` by itself. You can keep using it while `node server.js` runs on port 8787: on localhost, the app automatically discovers that local proxy, which can save keys into `.env`. The proxy's default CORS allowlist includes localhost and 127.0.0.1 on port 5500. If the Node proxy is not running, Settings holds a user-provided key in page memory only; it is discarded on refresh or close and never written to browser storage.

When `proxyBase` is empty, the app automatically checks the current host's `/api/settings` route and uses `/api` if it finds this proxy. This supports VM deployments that serve the site and proxy from the same origin without adding a proxy URL to the static config.

On a VM, run the Node server behind HTTPS using a reverse proxy such as Caddy or Nginx. Configure the service with provider API keys and `PROXY_ACCESS_TOKEN`. When binding to a non-loopback interface, the server requires a proxy token; configure the same token in Settings. Restrict `ALLOWED_ORIGINS` to your app origin. Never expose the Node process without HTTPS and an access token when using server-side provider keys.

## Build and deploy the static site

Run `sh scripts/build-static.sh` to create the deploy-ready `dist/` directory. The script uses only standard shell file-copy commands: no Node.js, package installation, bundler, or build dependency is required. Upload or copy the contents of `dist/` to any static web host, web server, or VM with a static-file server. The build contains only `index.html`, `css/`, `js/`, and `data/`; it deliberately excludes `server.js`, `.env`, and all provider credentials. The GitHub Pages workflow builds and publishes this `dist/` directory.

Static hosting cannot read GitHub Environment secrets at runtime. The workflow must not inject provider keys into `dist/`: anything included in a static artifact can be downloaded by every site visitor. GitHub Actions secrets can be used privately only by deploying them to a backend/proxy server, then setting `proxyBase` in `data/config.json` to that server's HTTPS `/api` URL and configuring its `ALLOWED_ORIGINS` for the Pages origin. Without a backend, each user can enter their own provider key in Settings for the current page session; the key is not persisted, and direct browser requests may still be blocked by provider CORS rules.

For an own server that supports Node.js, use the full project and run `node server.js`; it reads provider keys from `.env` or server environment variables and provides the protected AI proxy. The static `dist/` build alone does not have `.env` or proxy support, but it can be served by any static server.
