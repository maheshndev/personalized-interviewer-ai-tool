"use strict";

/* Injects the NVIDIA API key into data/config.json.
   Priority: process.env.NVIDIA_API_KEY (GitHub Actions secret) > .env file.
   The committed config.json keeps apiKey empty so no secret lives in git. */

const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const env = {};
  try {
    const txt = fs.readFileSync(file, "utf8");
    txt.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      env[m[1]] = val;
    });
  } catch (e) { /* no .env present */ }
  return env;
}

const root = path.join(__dirname, "..");
const cfgPath = path.join(root, "data", "config.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

const envKey = (process.env.NVIDIA_API_KEY || "").trim();
const envFile = (loadEnv(path.join(root, ".env")).NVIDIA_API_KEY || "").trim();
const key = envKey || envFile;

if (envKey) {
  cfg.apiKey = envKey;
  console.log("config.json: apiKey injected from GitHub Actions env (NVIDIA_API_KEY).");
} else if (envFile) {
  cfg.apiKey = envFile;
  console.log("config.json: apiKey injected from local .env file.");
} else {
  cfg.apiKey = "";
  console.log("config.json: no NVIDIA_API_KEY found (env or .env) — apiKey left empty.");
}

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");