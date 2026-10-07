"use strict";

/* ==================================================================
   NVIDIA / OpenRouter / OpenCode AI question generation
================================================================== */
const AI_CONFIG_DEFAULTS = {
  defaultProvider: "nvidia",
  defaultModel: "nvidia/nemotron-3-super-120b-a12b",
  providers: {
    nvidia: {
      name: "NVIDIA",
      apiBase: "https://integrate.api.nvidia.com/v1",
      models: [{ id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron Super 120B" }]
    },
    openrouter: {
      name: "OpenRouter",
      apiBase: "https://openrouter.ai/api/v1",
      models: [
        { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
        { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" }
      ]
    },
    opencode: {
      name: "OpenCode Zen",
      apiBase: "https://opencode.ai/zen/v1",
      models: [{ id: "big-pickle", name: "Big Pickle" }]
    }
  },
  questionCount: 50,
  ai: {
    temperature: 0.4,
    topP: 0.95,
    maxTokens: 8192,
    reasoningBudget: 4096,
    thinking: true,
    attempts: 2
  }
};

let AI_PROVIDERS = AI_CONFIG_DEFAULTS.providers;
let DEFAULT_PROVIDER = AI_CONFIG_DEFAULTS.defaultProvider;
let DEFAULT_MODEL = AI_CONFIG_DEFAULTS.defaultModel;
let AI_QS_TARGET = AI_CONFIG_DEFAULTS.questionCount;
let AI_PARAMS = Object.assign({}, AI_CONFIG_DEFAULTS.ai);
let AI_PROXY_BASE = "";
let SERVER_PROVIDER_KEYS = {};
const SESSION_PROVIDER_KEYS = Object.create(null);

function clearPersistedAIKeys() {
  [LS.apiKey, "ppp.apiKey.nvidia", "ppp.apiKey.openrouter", "ppp.apiKey.opencode"]
    .forEach(key => localStorage.removeItem(key));
}

function applyAIConfig(cfg) {
  if (!cfg) return;
  if (cfg.defaultProvider && AI_PROVIDERS[cfg.defaultProvider]) DEFAULT_PROVIDER = String(cfg.defaultProvider);
  if (cfg.defaultModel) DEFAULT_MODEL = String(cfg.defaultModel);
  if (cfg.questionCount) AI_QS_TARGET = Number(cfg.questionCount) || 50;
  if (cfg.proxyBase != null) AI_PROXY_BASE = String(cfg.proxyBase).replace(/\/+$/, "");
  if (cfg.ai && typeof cfg.ai === "object") AI_PARAMS = Object.assign({}, AI_PARAMS, cfg.ai);
  if (Array.isArray(cfg.bankFiles) && cfg.bankFiles.length) BANK_FILES = cfg.bankFiles;
  if (cfg.apiBase) AI_PROVIDERS.nvidia.apiBase = String(cfg.apiBase).replace(/\/+$/, "");
  if (Array.isArray(cfg.models) && cfg.models.length) AI_PROVIDERS.nvidia.models = cfg.models.slice();
  Object.keys(cfg.providers || {}).forEach(id => {
    if (!AI_PROVIDERS[id] || !cfg.providers[id]) return;
    AI_PROVIDERS[id] = Object.assign({}, AI_PROVIDERS[id], cfg.providers[id]);
    if (Array.isArray(cfg.providers[id].models)) AI_PROVIDERS[id].models = cfg.providers[id].models.slice();
  });
}

const CONFIG_FILES = ["data/config.json", "config.json"];

/* Load data/config.json at startup; keep the inline defaults if it can't be read. */
async function loadAIConfig() {
  for (const url of CONFIG_FILES) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) continue;
      applyAIConfig(await resp.json());
      return true;
    } catch (e) { /* try next file / keep defaults */ }
  }
  return false;
}

async function discoverSameOriginAIProxy() {
  if (AI_PROXY_BASE || location.protocol === "file:") return false;
  try {
    const response = await fetch(new URL("/api/settings", location.origin), { cache: "no-store" });
    if (response.ok) {
      const settings = await response.json();
      if (settings && settings.providers && typeof settings.providers === "object") {
        AI_PROXY_BASE = "/api";
        return true;
      }
    }
  } catch (e) {
    /* A static local dev server may not host the API; try the local Node proxy below. */
  }
  const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  if (location.protocol !== "http:" || !localHosts.includes(location.hostname)) return false;
  const proxyOrigin = new URL(location.origin);
  proxyOrigin.port = "8787";
  const proxyBase = proxyOrigin.origin + "/api";
  try {
    const response = await fetch(proxyBase + "/settings", { cache: "no-store" });
    if (!response.ok) return false;
    const settings = await response.json();
    if (!settings || !settings.providers || typeof settings.providers !== "object") return false;
    AI_PROXY_BASE = proxyBase;
    return true;
  } catch (e) {
    return false;
  }
}

async function apiFetch(provider, path, init) {
  const config = AI_PROVIDERS[provider];
  if (!config) throw new Error("Unsupported AI provider: " + provider);
  const directUrl = config.apiBase + path;
  const proxyUrl = AI_PROXY_BASE ? AI_PROXY_BASE + "/" + provider + path : "";
  const proxyInit = Object.assign({}, init, { headers: Object.assign({}, init.headers || {}) });
  const proxyToken = aiProxyToken();
  if (proxyUrl && proxyToken) proxyInit.headers["X-Proxy-Token"] = proxyToken;
  try {
    if (proxyUrl) {
      return await fetch(proxyUrl, proxyInit);
    }
    return await fetch(directUrl, init);
  } catch (e) {
    if (e.name === "AbortError") throw e;
    if (!AI_PROXY_BASE) {
      throw new Error(T("aiProxyNotConfigured", { provider: config.name, error: e.message }));
    }
    throw new Error(T("aiProxyNetworkError", { provider: config.name, error: e.message }));
  }
}

let aiAbort = null;
let aiGenerating = false;

function selectedAIProvider() {
  const select = document.getElementById("aiProvider");
  return select && AI_PROVIDERS[select.value] ? select.value : DEFAULT_PROVIDER;
}

function aiApiKey(provider) {
  return SESSION_PROVIDER_KEYS[provider] || "";
}

function aiProxyToken() {
  return localStorage.getItem("ppp.proxyToken") || "";
}

function selectedAIModel(provider) {
  const select = document.getElementById("aiModel");
  return select && select.value ? select.value : localStorage.getItem("ppp.aiModel." + provider) || (provider === DEFAULT_PROVIDER ? DEFAULT_MODEL : AI_PROVIDERS[provider].models[0].id);
}

async function saveAIKey() {
  const provider = document.getElementById("settingsProvider").value;
  const input = document.getElementById("settingsApiKey");
  const key = input.value.trim();
  if (!key) {
    setAIState(T("aiApiKeyEmpty"), true);
    return;
  }
  const saveStatus = document.getElementById("settingsStatus");
  const saveButton = document.getElementById("saveAIKeyButton");
  let savedToEnv = false;
  saveStatus.textContent = T("aiKeySaving", { provider: AI_PROVIDERS[provider].name });
  saveButton.disabled = true;
  try {
    const settingsCanWriteEnv = document.getElementById("settingsApiKeyGroup").dataset.saveToEnv === "true";
    if (AI_PROXY_BASE && settingsCanWriteEnv) {
      const response = await fetch(AI_PROXY_BASE + "/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "HTTP " + response.status);
      }
      delete SESSION_PROVIDER_KEYS[provider];
      input.value = "";
      savedToEnv = true;
      await loadServerProviderSettings();
    } else {
      SESSION_PROVIDER_KEYS[provider] = key;
      input.value = "";
      saveStatus.textContent = T("aiKeySavedForSession", { provider: AI_PROVIDERS[provider].name });
    }
    await loadAIModels(provider);
    await updateSettingsStatus();
    if (savedToEnv) saveStatus.textContent = T("aiKeySavedToEnv", { provider: AI_PROVIDERS[provider].name });
  } catch (e) {
    saveStatus.textContent = T("aiKeySaveFailed", { error: e.message });
  } finally {
    saveButton.disabled = false;
  }
}

function saveAIProxyToken() {
  const input = document.getElementById("settingsProxyToken");
  const token = input.value.trim();
  if (!token) {
    setAIState(T("aiProxyTokenEmpty"), true);
    return;
  }
  localStorage.setItem("ppp.proxyToken", token);
  input.value = "";
  document.getElementById("settingsStatus").textContent = T("aiProxyTokenSaved");
  loadAIModels();
}

function clearAIProxyToken() {
  localStorage.removeItem("ppp.proxyToken");
  document.getElementById("settingsStatus").textContent = T("aiProxyTokenCleared");
  loadAIModels();
}

function clearAIKey() {
  const provider = document.getElementById("settingsProvider").value;
  delete SESSION_PROVIDER_KEYS[provider];
  renderProviderSettings();
  loadAIModels(provider);
}

function onAIModelChange() {
  localStorage.setItem("ppp.aiModel." + selectedAIProvider(), document.getElementById("aiModel").value);
}

function onAIProviderChange() {
  const provider = selectedAIProvider();
  localStorage.setItem("ppp.aiProvider", provider);
  renderProviderModels(provider);
  loadAIModels(provider);
}

function niceModelName(id) {
  const base = String(id).replace(/^nvidia\//, "").replace(/[-_]/g, " ").trim();
  return base.replace(/\b\w/g, c => c.toUpperCase());
}

function renderModelOptions(models, defId) {
  const sel = document.getElementById("aiModel");
  const current = defId || (models[0] && models[0].id);
  let list = models.slice();
  if (defId && !list.some(m => m.id === defId)) list.unshift({ id: defId, name: niceModelName(defId) });
  sel.innerHTML = list.map(m =>
    '<option value="' + esc(m.id) + '"' + (m.id === current ? " selected" : "") + '>' + esc(m.name) + "</option>"
  ).join("");
  sel.value = current;
}

let aiModelLoadId = 0;

function renderProviderModels(provider) {
  const config = AI_PROVIDERS[provider];
  const saved = localStorage.getItem("ppp.aiModel." + provider);
  renderModelOptions(config.models, saved || (provider === DEFAULT_PROVIDER ? DEFAULT_MODEL : config.models[0].id));
}

/* Load the active provider's model catalog, retaining its saved choice. */
async function loadAIModels(provider) {
  provider = provider || selectedAIProvider();
  const config = AI_PROVIDERS[provider];
  const loadId = ++aiModelLoadId;
  const model = localStorage.getItem("ppp.aiModel." + provider) || (provider === DEFAULT_PROVIDER ? DEFAULT_MODEL : config.models[0].id);
  const fallback = () => renderModelOptions(config.models, model);
  const apiKey = aiApiKey(provider);
  fallback();
  if (!apiKey && !SERVER_PROVIDER_KEYS[provider] && !AI_PROXY_BASE) {
    setAIState(T("aiApiKeyMissing", { provider: config.name }), true);
    return;
  }
  try {
    const headers = {};
    if (apiKey) headers.Authorization = "Bearer " + apiKey;
    const res = await apiFetch(provider, "/models", { headers });
    if (!res.ok) {
      let message = "HTTP " + res.status;
      try {
        const result = await res.json();
        message = (result.error && (result.error.message || result.error)) || message;
      } catch (e) { /* keep status */ }
      throw new Error(String(message).slice(0, 300));
    }
    const j = await res.json();
    const models = Array.isArray(j.data) ? j.data.filter(m => m && m.id).map(m => ({ id: String(m.id), name: String(m.name || niceModelName(m.id)) })) : [];
    if (!models.length) throw new Error(T("aiModelsUnavailable"));
    if (loadId !== aiModelLoadId) return;
    const known = {};
    config.models.forEach(m => known[m.id] = m.name);
    models.forEach(m => { if (known[m.id]) m.name = known[m.id]; });
    models.sort((a, b) => a.name.localeCompare(b.name));
    config.models = models;
    if (provider !== selectedAIProvider()) return;
    renderModelOptions(models, model);
    setAIState(T("aiModelsLoaded", { provider: config.name }));
  } catch (e) {
    if (loadId !== aiModelLoadId) return;
    setAIState(T("aiModelsFallback", { provider: config.name, error: e.message }), true);
  }
}

function initializeAIControls() {
  const savedProvider = localStorage.getItem("ppp.aiProvider");
  const providerSelect = document.getElementById("aiProvider");
  providerSelect.value = savedProvider && AI_PROVIDERS[savedProvider] ? savedProvider : DEFAULT_PROVIDER;
  const modelSelect = document.getElementById("aiModel");
  renderProviderModels(providerSelect.value);
  modelSelect.addEventListener("change", onAIModelChange);
  document.getElementById("settingsProvider").value = providerSelect.value;
  document.getElementById("settingsProvider").addEventListener("change", renderProviderSettings);
  renderProviderSettings();
  document.getElementById("settingsDialog").addEventListener("close", () => {
    document.getElementById("settingsStatus").textContent = "";
    document.getElementById("settingsApiKey").value = "";
  });
}

async function loadServerProviderSettings() {
  await discoverSameOriginAIProxy();
  if (!AI_PROXY_BASE) return false;
  try {
    const response = await fetch(AI_PROXY_BASE + "/settings", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const settings = await response.json();
    SERVER_PROVIDER_KEYS = settings.providers || {};
    document.getElementById("settingsApiKeyGroup").dataset.saveToEnv = String(Boolean(settings.canSaveKeys));
    const needsToken = Object.keys(SERVER_PROVIDER_KEYS).some(id => SERVER_PROVIDER_KEYS[id] && settings.proxyTokenRequired);
    document.getElementById("proxyTokenSetting").classList.toggle("hidden", !needsToken);
    return true;
  } catch (e) {
    SERVER_PROVIDER_KEYS = {};
    document.getElementById("settingsApiKeyGroup").dataset.saveToEnv = "false";
    const proxyOrigin = new URL(AI_PROXY_BASE, location.href).origin;
    document.getElementById("proxyTokenSetting").classList.toggle("hidden", proxyOrigin === location.origin);
    return false;
  }
}

async function updateSettingsStatus() {
  const provider = document.getElementById("settingsProvider").value;
  await loadServerProviderSettings();
  if (provider !== document.getElementById("settingsProvider").value) return;
  const serverKey = Boolean(SERVER_PROVIDER_KEYS[provider]);
  const keyInput = document.getElementById("settingsApiKey");
  let keyDisplayError = "";
  if (document.getElementById("settingsDialog").open) {
    if (serverKey && document.getElementById("settingsApiKeyGroup").dataset.saveToEnv === "true") {
      try {
        const response = await fetch(AI_PROXY_BASE + "/settings/keys/" + encodeURIComponent(provider), { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const result = await response.json();
        if (provider === document.getElementById("settingsProvider").value) keyInput.value = result.key || "";
      } catch (e) {
        keyDisplayError = T("aiServerKeyDisplayFailed", { error: e.message });
      }
    } else {
      keyInput.value = aiApiKey(provider);
    }
  } else {
    keyInput.value = "";
  }
  document.getElementById("serverKeyStatus").classList.toggle("hidden", !serverKey);
  document.getElementById("settingsApiKeyHelp").textContent =
    document.getElementById("settingsApiKeyGroup").dataset.saveToEnv === "true"
      ? T("aiKeyWillSaveToEnv")
      : T("aiKeySavedInBrowser");
  const key = aiApiKey(provider);
  document.getElementById("settingsStatus").textContent = serverKey
    ? keyDisplayError || T("aiServerKeyAvailable", { provider: AI_PROVIDERS[provider].name })
    : key ? T("aiKeySavedForSession", { provider: AI_PROVIDERS[provider].name }) : T("aiApiKeyMissing", { provider: AI_PROVIDERS[provider].name });
}

function renderProviderSettings() {
  const provider = document.getElementById("settingsProvider").value;
  const config = AI_PROVIDERS[provider];
  const hasKey = Boolean(aiApiKey(provider));
  document.getElementById("providerSettings").innerHTML =
    '<div id="serverKeyStatus" class="hidden rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">' +
      esc(T("aiServerKeyAvailable", { provider: config.name })) +
    '</div>' +
    '<div id="settingsApiKeyGroup" class="space-y-2">' +
      '<label class="block text-xs font-semibold text-slate-400" for="settingsApiKey">' + esc(T("aiKeyPlaceholder", { provider: config.name })) + '</label>' +
      '<div class="flex gap-2">' +
        '<input id="settingsApiKey" type="password" autocomplete="new-password" placeholder="' + esc(T("aiKeyPlaceholder", { provider: config.name })) + '" class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">' +
        '<button type="button" id="toggleAIKeyVisibility" onclick="toggleAIKeyVisibility()" class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold" aria-pressed="false">' + esc(L("showApiKey")) + '</button>' +
      '</div>' +
      '<p id="settingsApiKeyHelp" class="text-xs text-slate-500"></p>' +
      '<div class="flex justify-end gap-2">' +
        '<button type="button" id="saveAIKeyButton" onclick="saveAIKey()" class="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold">' + esc(L("saveKey")) + '</button>' +
        (hasKey ? '<button type="button" onclick="clearAIKey()" class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold">' + esc(L("clearKey")) + '</button>' : '') +
      '</div>' +
    '</div>';
  updateSettingsStatus();
}

function openSettings() {
  const dialog = document.getElementById("settingsDialog");
  document.getElementById("settingsProvider").value = selectedAIProvider();
  if (!dialog.open) dialog.showModal();
  renderProviderSettings();
}

function toggleAIKeyVisibility() {
  const input = document.getElementById("settingsApiKey");
  const button = document.getElementById("toggleAIKeyVisibility");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.textContent = L(visible ? "hideApiKey" : "showApiKey");
  button.setAttribute("aria-pressed", String(visible));
}

/* --- prompt builder: personalizes from the resume --- */
function aiPrompt(resume) {
  return fill(APP.templates.ai.user, { count: AI_QS_TARGET, resume });
}

/* --- streaming SSE helper --- */
async function aiStream(body, provider, apiKey, opts) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = location.href;
    headers["X-Title"] = document.title;
  }
  const res = await apiFetch(provider, "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: opts.signal
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); msg = (j.error && (j.error.message || j.error)) || msg; } catch (e) { /* keep status */ }
    throw new Error(String(msg).slice(0, 300));
  }
  if (!res.body) {
    const result = await res.json();
    const content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
    if (typeof content !== "string") throw new Error(T("aiEmptyList"));
    return { text: content, reasoning: "" };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", text = "", reasoning = "";
  const consumeEvent = chunk => {
    const data = chunk.replace(/\r/g, "").split("\n")
      .filter(line => /^data:/i.test(line.trim()))
      .map(line => line.replace(/^data:\s*/i, ""));
    if (!data.length) return;
    const payload = data.join("\n").trim();
    if (payload === "[DONE]") return;
    const result = JSON.parse(payload);
    if (result.error) throw new Error(String(result.error.message || result.error).slice(0, 300));
    const delta = result.choices && result.choices[0] && result.choices[0].delta || {};
    if (delta.reasoning_content) {
      reasoning += delta.reasoning_content;
      if (opts.onReasoning) opts.onReasoning(delta.reasoning_content);
    }
    if (delta.content) {
      text += delta.content;
      if (opts.onDelta) opts.onDelta(delta.content);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    buf += decoder.decode(value || new Uint8Array(), { stream: !done });
    for (;;) {
      const boundary = /\r?\n\r?\n/.exec(buf);
      if (!boundary) break;
      const chunk = buf.slice(0, boundary.index);
      buf = buf.slice(boundary.index + boundary[0].length);
      consumeEvent(chunk);
    }
    if (done) break;
  }
  if (buf.trim()) consumeEvent(buf);
  return { text, reasoning };
}

/* --- chat with graceful fallback for models that reject NVIDIA extras --- */
async function aiChat(messages, opts) {
  const provider = opts.provider || selectedAIProvider();
  const config = AI_PROVIDERS[provider];
  const apiKey = aiApiKey(provider);
  if (!apiKey && !SERVER_PROVIDER_KEYS[provider] && !AI_PROXY_BASE) {
    throw new Error(T("aiApiKeyMissing", { provider: config.name }));
  }
  const body = {
    model: opts.model,
    messages,
    temperature: AI_PARAMS.temperature != null ? AI_PARAMS.temperature : 0.4,
    top_p: AI_PARAMS.topP != null ? AI_PARAMS.topP : 0.95,
    max_tokens: AI_PARAMS.maxTokens != null ? AI_PARAMS.maxTokens : 8192,
    stream: true
  };
  if (provider === "nvidia") {
    body.chat_template_kwargs = AI_PARAMS.thinking !== false ? { enable_thinking: true } : {};
    body.reasoning_budget = AI_PARAMS.reasoningBudget != null ? AI_PARAMS.reasoningBudget : 4096;
  }
  const attempts = AI_PARAMS.attempts || 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await aiStream(body, provider, apiKey, opts);
    } catch (e) {
      const unsupported = /400|reasoning|budget|template|invalid|parameter/i.test(e.message);
      if (provider === "nvidia" && attempt === 0 && unsupported && (body.chat_template_kwargs || body.reasoning_budget != null)) {
        delete body.chat_template_kwargs;
        delete body.reasoning_budget;
        continue;
      }
      throw e;
    }
  }
}

/* --- extract a JSON array from (possibly streamed, fenced) text --- */
function extractJSON(text) {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("[");
  const b = t.lastIndexOf("]");
  if (a === -1 || b <= a) throw new Error("No JSON array found in the AI output.");
  return JSON.parse(t.slice(a, b + 1));
}

/* --- generate personalized questions from the resume via AI --- */
async function generateAIQuestions(opts) {
  const resume = (opts.resume || resumeText || "").trim();
  if (!resume) throw new Error(T("aiNoResume"));
  const provider = opts.provider || selectedAIProvider();
  const model = opts.model || selectedAIModel(provider);
  const controller = new AbortController();
  aiAbort = controller;
  const messages = [
    { role: "system", content: APP.templates.ai.system },
    { role: "user", content: aiPrompt(resume) }
  ];
  const { text } = await aiChat(messages, {
    provider,
    model,
    signal: controller.signal,
    onDelta: d => opts.onDelta && opts.onDelta(d),
    onReasoning: d => opts.onReasoning && opts.onReasoning(d)
  });
  const arr = extractJSON(text);
  if (!Array.isArray(arr) || !arr.length) throw new Error(T("aiEmptyList"));
  return arr;
}

/* --- UI flow: generate, stream preview, store into My Questions --- */
function toggleAI() {
  if (aiGenerating) {
    if (aiAbort) aiAbort.abort();
    aiGenerating = false;
    document.getElementById("aiBtn").textContent = L("generateAI");
    setAIState(T("aiCancelled"));
    render();
    return;
  }
  runAIGeneration();
}

async function runAIGeneration() {
  const btn = document.getElementById("aiBtn");
  const pre = document.getElementById("aiPreview");
  aiGenerating = true;
  btn.innerHTML = '<span class="inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin"></span><span class="ml-1.5">' + L("cancel") + "</span>";
  pre.classList.remove("hidden");
  pre.innerHTML = '<div class="flex items-center gap-2 text-[11px] text-slate-300"><span class="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-600 border-t-violet-400 animate-spin"></span><span>' + fill(APP.empty.aiGenerating, { count: AI_QS_TARGET }) + "</span></div>";
  setAIState(T("aiGenerating"));
  activeTab = "ai";
  render();
  try {
    const arr = await generateAIQuestions({});
    aiQs = arr.map((q, i) => {
      const question = String(q.question || "").trim();
      if (!question) return null;
      const tags = mergeTags(question + " " + String(q.answer || ""), q.tags);
      return { id: i + 1, key: "a" + (i + 1), question, answer: String(q.answer || "").trim(), tags, section: APP.templates.personalized.aiSection, kind: "ai" };
    }).filter(Boolean);
    localStorage.setItem(LS.ai, JSON.stringify(aiQs));
    activeTab = "ai";
    render();
    setAIState(T("aiReady", { n: aiQs.length }));
    if (aiQs.length < AI_QS_TARGET) {
      pre.innerHTML = '<div class="text-[11px] text-amber-400">Only <b>' + aiQs.length + "</b> of " + AI_QS_TARGET + " questions were returned — try regenerating.</div>";
      toast(T("aiShortToast", { n: aiQs.length, target: AI_QS_TARGET }), true);
    } else {
      pre.innerHTML = '<div class="text-[11px] text-emerald-400"><b>' + aiQs.length + "</b> AI questions ready — shown in the <b>" + L("tabAI") + "</b> tab.</div>";
      toast(T("aiDone", { n: aiQs.length }));
    }
    btn.textContent = L("regenerate");
  } catch (e) {
    setAIState(T("aiFailed", { error: e.message }), true);
    pre.innerHTML = '<div class="text-[11px] text-rose-400">' + esc(e.message) + "</div>";
    toast(T("aiFailed", { error: e.message }), true);
    btn.textContent = L("generateAI");
  } finally {
    aiGenerating = false;
    aiAbort = null;
    render();
  }
}

function mergeTags(text, aiTags) {
  const defs = skillDefs.length ? skillDefs : detectSkills(resumeText);
  const ids = tagFromText(text, defs);
  const extras = (Array.isArray(aiTags) ? aiTags : [])
    .map(t => String(t).toLowerCase().trim())
    .filter(t => t && ids.indexOf(t) === -1 && defs.some(s => s.id === t));
  return ids.concat(extras).slice(0, 5);
}

function setAIState(msg, warn) {
  const el = document.getElementById("aiStatus");
  el.textContent = msg;
  el.className = "text-xs font-normal tracking-normal " + (warn ? "text-rose-400" : "text-emerald-400");
}

function clearAI() {
  aiQs = [];
  localStorage.removeItem(LS.ai);
  const pre = document.getElementById("aiPreview");
  if (pre) pre.classList.add("hidden");
  render();
  toast(T("aiCleared"));
}