"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:8787,http://127.0.0.1:8787,http://localhost:5500,http://127.0.0.1:5500,http://localhost,http://127.0.0.1").split(",").map(value => value.trim()).filter(Boolean);
const ROOT = __dirname;
const PROVIDERS = {
  nvidia: { apiBase: "https://integrate.api.nvidia.com/v1", keyName: "NVIDIA_API_KEY" },
  openrouter: { apiBase: "https://openrouter.ai/api/v1", keyName: "OPENROUTER_API_KEY" },
  opencode: { apiBase: "https://opencode.ai/zen/v1", keyName: "OPENCODE_API_KEY" }
};
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function loadEnvFile(filePath) {
  let text;
  try { text = fs.readFileSync(filePath, "utf8"); }
  catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
  const values = {};
  text.replace(/^\uFEFF/, "").split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) return;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); }
      catch (e) { value = value.slice(1, -1); }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  });
  return values;
}

const LOCAL_ENV = loadEnvFile(path.join(ROOT, ".env"));
const PROVIDER_KEYS = {
  nvidia: LOCAL_ENV.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || "",
  openrouter: LOCAL_ENV.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "",
  opencode: LOCAL_ENV.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY || ""
};
const PROXY_ACCESS_TOKEN = LOCAL_ENV.PROXY_ACCESS_TOKEN || process.env.PROXY_ACCESS_TOKEN || "";
const LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "::1"];
if (!LOOPBACK_HOSTS.includes(HOST) && Object.values(PROVIDER_KEYS).some(Boolean) && !PROXY_ACCESS_TOKEN) {
  throw new Error("Set PROXY_ACCESS_TOKEN before exposing server-side provider keys on a non-loopback host.");
}

function tokenMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

function isLoopbackOrigin(origin) {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.replace(/^\[|\]$/g, "");
    return LOOPBACK_HOSTS.includes(hostname);
  } catch (e) {
    return false;
  }
}

function isAllowedLocalOrigin(origin) {
  return isLoopbackOrigin(origin) && ALLOWED_ORIGINS.includes(origin);
}

function saveProviderKey(provider, key) {
  const envPath = path.join(ROOT, ".env");
  let lines = [];
  try { lines = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/); }
  catch (e) {
    if (e.code !== "ENOENT") throw e;
  }

  const keyName = PROVIDERS[provider].keyName;
  const updated = [];
  let replaced = false;
  lines.forEach(line => {
    const assignment = line.match(/^\s*(?:export\s+)?([\w]+)\s*=/);
    if (!assignment || assignment[1] !== keyName) {
      updated.push(line);
    } else if (!replaced) {
      updated.push(keyName + "=" + JSON.stringify(key));
      replaced = true;
    }
  });
  if (!replaced) {
    while (updated.length && updated[updated.length - 1] === "") updated.pop();
    if (updated.length) updated.push("");
    updated.push(keyName + "=" + JSON.stringify(key));
  }
  fs.writeFileSync(envPath, updated.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
  PROVIDER_KEYS[provider] = key;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, HTTP-Referer, X-Title, X-Proxy-Token");
    res.setHeader("Access-Control-Max-Age", "600");
    return true;
  }
  return false;
}

function sendError(res, status, message) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ error: message }));
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return sendError(res, 405, "Method not allowed.");
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch (e) { return sendError(res, 400, "Invalid file path."); }
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return sendError(res, 403, "File path is not allowed.");
  const pathParts = relative.split(path.sep);
  const publicFile = relative === "index.html" || ["css", "js", "data"].includes(pathParts[0]);
  if (!publicFile || pathParts.some(part => part.startsWith("."))) return sendError(res, 404, "File not found.");

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) return sendError(res, 404, "File not found.");
    const sendFile = (body, contentType) => {
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    if (filePath === path.join(ROOT, "data", "config.json")) {
      fs.readFile(filePath, "utf8", (readError, text) => {
        if (readError) return sendError(res, 500, "Could not read app configuration.");
        try {
          const config = JSON.parse(text);
          if (!config.proxyBase) config.proxyBase = "/api";
          sendFile(JSON.stringify(config, null, 2) + "\n", CONTENT_TYPES[".json"]);
        } catch (e) {
          sendError(res, 500, "App configuration is invalid JSON.");
        }
      });
      return;
    }
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") return res.end();
    stream.on("error", () => sendError(res, 500, "Could not read requested file."));
    stream.pipe(res);
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body exceeds 1 MiB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  if (!setCors(req, res)) return sendError(res, 403, "Origin is not allowed by this proxy.");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  let pathname;
  try { pathname = new URL(req.url, "http://localhost").pathname; }
  catch (e) { return sendError(res, 400, "Invalid request path."); }

  if (!pathname.startsWith("/api/")) return serveStatic(req, res, pathname);

  if (pathname === "/api/settings" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({
      providers: Object.fromEntries(Object.keys(PROVIDERS).map(id => [id, Boolean(PROVIDER_KEYS[id])])),
      proxyTokenRequired: !LOOPBACK_HOSTS.includes(HOST) && Object.values(PROVIDER_KEYS).some(Boolean),
      canSaveKeys: LOOPBACK_HOSTS.includes(HOST)
    }));
  }

  const providerKeyMatch = pathname.match(/^\/api\/settings\/keys\/(nvidia|openrouter|opencode)$/);
  if (providerKeyMatch && req.method === "GET") {
    if (!LOOPBACK_HOSTS.includes(HOST) || !isAllowedLocalOrigin(req.headers.origin)) {
      return sendError(res, 403, "Provider keys can only be viewed from an allowed local app origin.");
    }
    const provider = providerKeyMatch[1];
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ provider, key: PROVIDER_KEYS[provider] }));
  }

  if (pathname === "/api/settings/keys" && req.method === "POST") {
    if (!LOOPBACK_HOSTS.includes(HOST) || !isAllowedLocalOrigin(req.headers.origin)) {
      return sendError(res, 403, "Saving provider keys is available only from a local app origin.");
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
      return sendError(res, 415, "Content-Type must be application/json.");
    }
    let rawSettings;
    try {
      rawSettings = (await readBody(req)).toString("utf8");
    } catch (e) {
      const tooLarge = e.message.includes("exceeds");
      return sendError(res, tooLarge ? 413 : 400, tooLarge ? e.message : "Could not read request body.");
    }
    let settings;
    try {
      settings = JSON.parse(rawSettings);
    } catch (e) {
      return sendError(res, 400, "Request body must be valid JSON.");
    }
    const { provider, key } = settings || {};
    if (!Object.prototype.hasOwnProperty.call(PROVIDERS, provider)) {
      return sendError(res, 400, "Unsupported AI provider.");
    }
    if (typeof key !== "string" || !key.trim() || key.length > 4096 || /[\r\n\0]/.test(key)) {
      return sendError(res, 400, "Enter a valid provider API key.");
    }
    try {
      saveProviderKey(provider, key.trim());
    } catch (e) {
      console.error("Could not save provider key:", e.message);
      return sendError(res, 500, "Could not save the provider key to .env.");
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ saved: true, provider }));
  }

  const match = pathname.match(/^\/api\/(nvidia|openrouter|opencode)\/(models|chat\/completions)$/);
  if (!match) return sendError(res, 404, "Unknown provider API route.");

  const [, provider, resource] = match;
  const expectedMethod = resource === "models" ? "GET" : "POST";
  if (req.method !== expectedMethod) return sendError(res, 405, "Method not allowed.");

  const headers = {};
  const clientAuthorization = req.headers.authorization;
  const localProxy = LOOPBACK_HOSTS.includes(HOST);
  const proxyAuthenticated = localProxy || tokenMatches(req.headers["x-proxy-token"], PROXY_ACCESS_TOKEN);
  const serverKey = proxyAuthenticated ? PROVIDER_KEYS[provider] : "";
  const authorization = serverKey ? "Bearer " + serverKey : clientAuthorization;
  if (!authorization) {
    const message = PROVIDER_KEYS[provider] && !proxyAuthenticated
      ? "A valid PROXY_ACCESS_TOKEN is required to use the server-side provider key."
      : PROVIDERS[provider].keyName + " is not configured on the proxy; set it in .env, the server environment, or enter a key in Settings.";
    return sendError(res, 401, message);
  }
  if (authorization) headers.Authorization = authorization;
  if (resource === "chat/completions") {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
      return sendError(res, 415, "Content-Type must be application/json.");
    }
    headers["Content-Type"] = "application/json";
    if (provider === "openrouter") {
      if (req.headers["http-referer"]) headers["HTTP-Referer"] = req.headers["http-referer"];
      if (req.headers["x-title"]) headers["X-Title"] = req.headers["x-title"];
    }
  }

  let body;
  try {
    body = resource === "chat/completions" ? await readBody(req) : undefined;
  } catch (e) {
    return sendError(res, 413, e.message);
  }

  const controller = new AbortController();
  req.on("aborted", () => controller.abort());
  try {
    const upstream = await fetch(PROVIDERS[provider].apiBase + "/" + resource, {
      method: req.method,
      headers,
      body,
      signal: controller.signal
    });
    const responseHeaders = {
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("content-type") || "application/json"
    };
    res.writeHead(upstream.status, responseHeaders);
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
  } catch (e) {
    if (e.name === "AbortError") return;
    sendError(res, 502, "Could not reach the upstream AI provider.");
  }
});

server.listen(PORT, HOST, () => {
  console.log("AI API proxy listening on " + HOST + ":" + PORT);
});
