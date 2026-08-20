"use strict";

/* ==================================================================
   NVIDIA AI question generation (OpenAI-compatible API, streaming)
   Config lives in data/config.json (committed with an empty apiKey;
   the deploy workflow injects the real key from a GitHub Actions secret).
================================================================== */
const AI_CONFIG_DEFAULTS = {
  apiBase: "https://integrate.api.nvidia.com/v1",
  apiKey: "",
  defaultModel: "openai/gpt-oss-120b",
  questionCount: 50,
  proxies: [
    /* NVIDIA's API does not send CORS headers, so browsers block direct
       calls. We retry through public CORS proxies when direct fetch fails. */
    "https://corsproxy.io/?url=",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://api.allorigins.win/raw?url="
  ],
  models: [
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron Ultra 550B" },
    { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron Super 120B" },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
    { id: "google/gemma-4-31b-it", name: "Gemma 4 31B Instruct" },
    { id: "z-ai/glm-5.2", name: "GLM 5.2" },
    { id: "minimaxai/minimax-m3", name: "MiniMax M3" },
    { id: "stepfun-ai/step-3.7-flash", name: "Step 3.7 Flash" }
  ]
};

let AI_BASE = AI_CONFIG_DEFAULTS.apiBase;
let DEFAULT_API_KEY = AI_CONFIG_DEFAULTS.apiKey;
let DEFAULT_MODEL = AI_CONFIG_DEFAULTS.defaultModel;
let AI_QS_TARGET = AI_CONFIG_DEFAULTS.questionCount;
let CORS_PROXIES = AI_CONFIG_DEFAULTS.proxies.slice();
let AI_MODELS = AI_CONFIG_DEFAULTS.models.slice();

function applyAIConfig(cfg) {
  if (!cfg) return;
  if (cfg.apiBase) AI_BASE = String(cfg.apiBase);
  if (cfg.defaultModel) DEFAULT_MODEL = String(cfg.defaultModel);
  if (cfg.questionCount) AI_QS_TARGET = Number(cfg.questionCount) || 50;
  if (Array.isArray(cfg.bankFiles) && cfg.bankFiles.length) BANK_FILES = cfg.bankFiles;
  if (Array.isArray(cfg.proxies) && cfg.proxies.length) CORS_PROXIES = cfg.proxies.map(String);
  if (Array.isArray(cfg.models) && cfg.models.length) AI_MODELS = cfg.models.slice();
  DEFAULT_API_KEY = String(cfg.apiKey || "");
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

async function apiFetch(path, init) {
  const url = AI_BASE + path;
  try {
    const res = await fetch(url, init);
    return res; /* server responded (200/4xx/5xx) — let caller handle it */
  } catch (e) {
    /* TypeError "Failed to fetch" = CORS/network block -> retry via proxy */
    for (const base of CORS_PROXIES) {
      try {
        const res = await fetch(base + encodeURIComponent(url), init);
        if (res.ok) return res;
      } catch (e2) { /* try next proxy */ }
    }
    throw new Error("Network/CORS error reaching NVIDIA. The app retried via public CORS proxies but they failed too — check your connection or ad-blocker/VPN.");
  }
}

let aiAbort = null;
let aiGenerating = false;

function aiApiKey() {
  return localStorage.getItem(LS.apiKey) || DEFAULT_API_KEY || "";
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

/* Fetch the live model list from NVIDIA; fall back to the static list offline.
   Defaults to the configured model (openai/gpt-oss-120b) unless the user picked one. */
async function loadAIModels() {
  const manual = window.manualModel || "";
  const fallback = () => renderModelOptions(AI_MODELS, manual || DEFAULT_MODEL);
  const apiKey = aiApiKey();
  if (!apiKey) { fallback(); setAIState("API key not configured", true); return; }
  try {
    const res = await apiFetch("/models", {
      headers: { "Authorization": "Bearer " + apiKey }
    });
    if (!res.ok) { fallback(); return; }
    const j = await res.json();
    const ids = (j.data || []).map(m => m.id).filter(Boolean);
    if (!ids.length) { fallback(); return; }
    const known = {};
    AI_MODELS.forEach(m => known[m.id] = m.name);
    const list = ids.sort().map(id => ({ id, name: known[id] || niceModelName(id) }));
    renderModelOptions(list, manual || DEFAULT_MODEL);
  } catch (e) {
    fallback();
  }
}

/* --- prompt builder: personalizes from the resume --- */
function aiPrompt(resume) {
  return 'You are a senior technical interviewer preparing a candidate for a full-stack interview.\n' +
    'Read the candidate\'s resume below, then write at least ' + AI_QS_TARGET + ' interview questions PERSONALIZED to this candidate.\n\n' +
    'Each question must use the candidate\'s real details (name, projects, job titles, technologies, achievements) wherever possible. Cover this mix:\n' +
    '1. Self-introduction ("Tell me about yourself") tailored to their background\n' +
    '2. One deep-dive per project (why they chose the stack, challenges, impact)\n' +
    '3. One per job/role\n' +
    '4. Technical deep-dives on their top skills (use their real skills)\n' +
    '5. Behavioral/HR questions (STAR-based) tied to their real achievements\n' +
    '6. A "why hire you" and "questions for us" wrap-up\n\n' +
    'Candidate resume:\n"""\n' + resume + '\n"""\n\n' +
    'Reply with ONLY valid JSON — no markdown fences, no prose, nothing after the array — in this exact shape:\n' +
    '[{"question":"...","answer":"...","tags":["skilltag1","skilltag2"]}]\n\n' +
    'Rules:\n' +
    '- Return a COMPLETE array with ' + AI_QS_TARGET + ' or more items; do NOT truncate or summarize — every question is a separate item.\n' +
    '- answers: 2-4 sentences, conversational, written as if the candidate will say them in the interview, using real facts from the resume.\n' +
    '- tags: lowercase skill tags from the resume (e.g. python, angular, sql, docker). Max 3 per question.';
}

/* --- streaming SSE helper --- */
async function aiStream(body, apiKey, opts) {
  const res = await apiFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify(body),
    signal: opts.signal
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); msg = (j.error && (j.error.message || j.error)) || msg; } catch (e) { /* keep status */ }
    throw new Error(String(msg).slice(0, 300));
  }
  if (!res.body) { const txt = await res.text(); return { text: txt, reasoning: "" }; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", text = "", reasoning = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find(l => /^data:/i.test(l.trim()));
      if (!line) continue;
      const data = line.replace(/^data:\s*/i, "").trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const d = (j.choices && j.choices[0] && j.choices[0].delta) || {};
        if (d.reasoning_content) { reasoning += d.reasoning_content; if (opts.onReasoning) opts.onReasoning(d.reasoning_content); }
        if (d.content) { text += d.content; if (opts.onDelta) opts.onDelta(d.content); }
      } catch (e) { /* skip malformed chunk */ }
    }
  }
  return { text, reasoning };
}

/* --- chat with graceful fallback for models that reject NVIDIA extras --- */
async function aiChat(messages, opts) {
  const apiKey = aiApiKey();
  if (!apiKey) throw new Error("NVIDIA API key is missing.");
  const body = {
    model: opts.model,
    messages,
    temperature: 0.4,
    top_p: 0.95,
    max_tokens: 8192,
    chat_template_kwargs: { enable_thinking: true },
    reasoning_budget: 4096,
    stream: true
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await aiStream(body, apiKey, opts);
    } catch (e) {
      const unsupported = /400|reasoning|budget|template|invalid|parameter/i.test(e.message);
      if (attempt === 0 && unsupported) {
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
  if (!resume) throw new Error("Paste a resume first so questions can be personalized.");
  const model = opts.model || document.getElementById("aiModel").value;
  const controller = new AbortController();
  aiAbort = controller;
  const messages = [
    { role: "system", content: "You are an expert senior technical interviewer. You write interview questions personalized to a candidate's resume. Reply with valid JSON only." },
    { role: "user", content: aiPrompt(resume) }
  ];
  const { text } = await aiChat(messages, {
    model,
    signal: controller.signal,
    onDelta: d => opts.onDelta && opts.onDelta(d),
    onReasoning: d => opts.onReasoning && opts.onReasoning(d)
  });
  const arr = extractJSON(text);
  if (!Array.isArray(arr) || !arr.length) throw new Error("The AI returned an empty question list.");
  return arr;
}

/* --- UI flow: generate, stream preview, store into My Questions --- */
function toggleAI() {
  if (aiGenerating) {
    if (aiAbort) aiAbort.abort();
    aiGenerating = false;
    document.getElementById("aiBtn").textContent = "Generate with AI";
    setAIState("Cancelled");
    render();
    return;
  }
  runAIGeneration();
}

async function runAIGeneration() {
  const btn = document.getElementById("aiBtn");
  const pre = document.getElementById("aiPreview");
  aiGenerating = true;
  btn.innerHTML = '<span class="inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin"></span><span class="ml-1.5">Cancel</span>';
  pre.classList.remove("hidden");
  pre.innerHTML = '<div class="flex items-center gap-2 text-[11px] text-slate-300"><span class="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-600 border-t-violet-400 animate-spin"></span><span>Generating ' + AI_QS_TARGET + ' AI questions from your resume&hellip;</span></div>';
  setAIState("Generating\u2026");
  activeTab = "ai";
  render();
  try {
    const arr = await generateAIQuestions({});
    aiQs = arr.map((q, i) => {
      const question = String(q.question || "").trim();
      if (!question) return null;
      const tags = mergeTags(question + " " + String(q.answer || ""), q.tags);
      return { id: i + 1, key: "a" + (i + 1), question, answer: String(q.answer || "").trim(), tags, section: "AI Personalized", kind: "ai" };
    }).filter(Boolean);
    localStorage.setItem(LS.ai, JSON.stringify(aiQs));
    activeTab = "ai";
    render();
    setAIState(aiQs.length + " AI questions ready");
    if (aiQs.length < AI_QS_TARGET) {
      pre.innerHTML = '<div class="text-[11px] text-amber-400">Only <b>' + aiQs.length + "</b> of " + AI_QS_TARGET + " questions were returned — try regenerating.</div>";
      toast("AI returned only " + aiQs.length + " of " + AI_QS_TARGET + " questions", true);
    } else {
      pre.innerHTML = '<div class="text-[11px] text-emerald-400"><b>' + aiQs.length + "</b> AI questions ready — shown in the <b>AI Questions</b> tab.</div>";
      toast("AI generated " + aiQs.length + " personalized questions");
    }
    btn.textContent = "Regenerate";
  } catch (e) {
    setAIState("Error: " + e.message, true);
    pre.innerHTML = '<div class="text-[11px] text-rose-400">' + esc(e.message) + "</div>";
    toast("AI generation failed: " + e.message, true);
    btn.textContent = "Generate with AI";
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
  toast("AI questions cleared");
}