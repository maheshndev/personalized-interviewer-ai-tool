"use strict";

/* ==================================================================
   Data-driven UI text, templates, parser rules & shortcuts.
   data/app.json is loaded at startup; this inline copy is the
   offline/file:// fallback so the app always works.
================================================================== */
const APP_FALLBACK = {
  app: {
    name: "Resume-Powered Interview Prep",
    brand: "RPAI",
    subtitle: "Paste your resume → personalized questions & skills",
    privacyNote: "Your resume is sent to the selected AI provider when generating questions. Provider API keys are never saved in browser storage."
  },
  labels: {
    skills: "Skills", roles: "Roles", filters: "Filters",
    status: "Status", difficulty: "Difficulty", resume: "Resume",
    aiInterviewer: "AI Interviewer", all: "All", none: "None",
    clearFilters: "✕ Clear filters", generate: "⚡ Generate questions",
    clear: "Clear", generateAI: "⚡ Generate with AI", cancel: "Cancel",
    regenerate: "Regenerate", clearAI: "Clear AI", export: "↓ Export",
    reset: "Reset", random: "🎲 Random",
    expandAll: "Expand all", collapseAll: "Collapse all",
    showAllQuestions: "📄 Show all questions",
    tabPersonal: "My Questions", tabAI: "AI Questions", tabBank: "Question Bank",
    searchPlaceholder: "Search questions…  (/ to focus)",
    resumePlaceholder: "Paste your resume here (plain text or markdown). It saves automatically as you type; click Generate questions to rebuild your personalized set.",
    diff: "Diff", easy: "Easy", medium: "Medium", hard: "Hard",
    bookmark: "Bookmark", markReview: "Mark for review", copyQA: "Copy Q&A",
    markPrepared: "Mark prepared", tagDifficulty: "Tag difficulty",
    detectedFromResume: "Detected from your resume",
    saveKey: "Save key", clearKey: "Clear key", showApiKey: "Show", hideApiKey: "Hide",
    settings: "Settings", aiProvider: "AI provider", proxyToken: "Proxy access token", save: "Save",
    saveProxyToken: "Save proxy token", clearProxyToken: "Clear proxy token"
  },
  messages: {
    resumeSaved: "saved {time}",
    resultCount: "Showing {shown} of {total} questions",
    headerPreparing: "Preparing {name} — {skills} skills{roles} · {count} personalized questions",
    headerNoResume: "No resume yet — showing all {n} bank questions",
    resumeCleared: "Resume cleared.",
    resumeLoaded: "Resume loaded.",
    bankLoaded: "Question bank loaded.",
    bankNotFound: "No questions found in the file.",
    bankLoadedN: "Loaded question bank with <b>{n}</b> questions.",
    bankTextExpected: "No questions found in the file. Expected <code># Section</code> headers and <code>### Q1. Question</code>.",
    bankJSONExpected: "No questions found in the file. Expected a <code>{ sections: [{ title, questions: [...] }] }</code> shape.",
    invalidJSON: "Invalid JSON in the file: {error}",
    cachedBank: "cached question bank (localStorage)",
    generatedN: "{n} personalized questions generated{role} from your resume",
    roleDetected: " · role detected: {roles}",
    prepared: "Q{id} marked prepared",
    new: "Q{id} marked as new",
    bookmarked: "Bookmarked",
    unbookmarked: "Un-bookmarked",
    queuedReview: "Queued for review",
    removedReview: "Removed from review",
    difficultySet: "Q{id} difficulty set",
    copied: "Q{id} copied",
    copyFailed: "Copy failed",
    noQuestionsPick: "No questions to pick from",
    random: "Random: Q{id}",
    filtersCleared: "Filters cleared",
    nothingExport: "Nothing to export",
    exported: "Exported {n} questions",
    allReset: "All data reset",
    aiCancelled: "Cancelled",
    aiGenerating: "Generating…",
    aiReady: "{n} AI questions ready",
    aiShort: "AI returned only {n} of {target} questions",
    aiShortToast: "AI returned only {n} of {target} questions",
    aiDone: "AI generated {n} personalized questions",
    aiFailed: "AI generation failed: {error}",
    aiCleared: "AI questions cleared",
    aiNoResume: "Paste a resume first so questions can be personalized.",
    settingsHelp: "On the local Node app, keys are saved to the ignored .env file. On static hosting, keys remain in memory only until this page is closed or refreshed. Server-side keys are detected automatically.",
    aiApiKeyMissing: "{provider} API key is missing. Enter and save a key in Settings, or configure it on your app server.",
    aiApiKeyEmpty: "Enter an API key before saving.",
    aiProxyTokenEmpty: "Enter a proxy access token before saving.",
    aiKeyPlaceholder: "{provider} API key",
    aiModelsUnavailable: "The selected provider returned no models.",
    aiModelsLoaded: "{provider} models loaded.",
    aiModelsFallback: "Could not load {provider} models ({error}); using the built-in model list.",
    aiKeySavedForSession: "{provider} API key is available for this page session only; it is not saved in browser storage.",
    aiKeySaving: "Saving {provider} API key…",
    aiKeySavedToEnv: "{provider} API key saved to the project .env file.",
    aiKeySaveFailed: "Could not save the API key: {error}",
    aiKeyWillSaveToEnv: "Saving here writes the key to the local project's ignored .env file.",
    aiKeySavedInBrowser: "This key remains in page memory only until the page is closed or refreshed; it is not saved in browser storage.",
    aiKeyCleared: "{provider} API key removed from this page session.",
    aiServerKeyAvailable: "A server-side {provider} API key is configured.",
    aiServerKeyDisplayFailed: "Could not load the configured server key ({error}).",
    aiProxyTokenSaved: "Proxy access token saved in this browser.",
    aiProxyTokenCleared: "Proxy access token removed from this browser.",
    aiEmptyList: "The AI returned an empty question list.",
    aiProxyNotConfigured: "{provider} could not be reached directly ({error}). This host does not have an AI proxy configured, and provider APIs may block browser requests. Run server.js on your VM, or deploy it on an HTTPS host and set proxyBase in data/config.json to that proxy's /api URL. GitHub Pages cannot run the proxy itself.",
    aiProxyNetworkError: "{provider} proxy request failed ({error}). Check that the proxy is running, proxyBase points to its /api route, HTTPS is enabled, ALLOWED_ORIGINS includes this site, and the proxy token is correct."
  },
  confirm: {
    resetAll: "Reset resume, skills, and all progress? This cannot be undone.",
    clearResume: "Clear the saved resume and generated questions?"
  },
  empty: {
    skillsEmpty: "Add your resume above to detect skills.",
    rolesEmpty: "Pick a role to focus on its questions. Detected from your resume when present.",
    noMatch: "No questions match your filters.",
    personalEmpty: "No resume yet. Paste one on the left and hit <b>Generate questions</b>, or study the full question bank.",
    bankEmpty: "Question bank not loaded yet — it auto-loads when served over HTTP (GitHub Pages / local server).",
    aiEmpty: "No AI questions yet. Paste a resume, pick a model, then hit <b>Generate with AI</b> above.",
    generatingTitle: "Generating {count} personalized questions…",
    generatingHint: "This can take up to a minute — keep this tab open.",
    aiGenerating: "Generating {count} AI questions from your resume…"
  },
  export: {
    header: "# {kind} Questions ({n})\n\n",
    item: "### Q{id}. {question}\n\n{answer}\n\n---\n\n",
    kinds: {
      bookmarked: "Bookmarked", review: "Review Queue", prepared: "Prepared",
      personalized: "Personalized", ai: "AI-Generated", bank: "Bank"
    }
  },
  templates: {
    personalized: {
      section: "Personalized",
      aiSection: "AI Personalized",
      introQ: "Tell me about yourself and why you're a good fit for this role.",
      introA: "I'm **{name}**{title}{years}.\n\n{summary}- Key skills: {topSkills}.\n- Most relevant experience: {projects}.\n- What drives me: building complete products, automating repetitive work, and shipping reliably.",
      projectQ: "Tell me about your project \"{name}\". What problem did it solve, and what was your role?",
      projectA: "**{name}**\n\n{tech}{bullets}{impact}- My role: end-to-end ownership — schema, APIs, UI, and deployment where applicable.",
      projectWhyQ: "Why did you choose \"{tech}\" for the project \"{name}\"?",
      projectWhyA: "- The requirement: {requirement}.\n- Why I chose it: right fit for the data model, ecosystem, and team familiarity.\n- Trade-off I weighed: {tech} vs alternatives, and what it cost/gained us.",
      jobQ: "Walk me through your experience at {org} ({dates}). What did you own and deliver?",
      jobA: "At **{org}** I worked as {title}{dates}.\n\n{bullets}\n\nI'd emphasize outcomes: automation, fewer errors, faster load, or scale handled.",
      skillQ: "How have you used {name}? {question}",
      skillA: "{answer}\n\n- Then I'd connect this to a real project where I applied it, the trade-offs I weighed, and the measurable result.",
      skillAFallback: "- Where I used {name}: across my projects and daily ERP work.\n- I'd explain a concrete example: the problem, how I applied {name}, the trade-offs, and the outcome.\n- If asked to go deeper, I can write a small example on the spot.",
      eduQ: "Walk me through your educational background: {edu}. How did it prepare you for a development career?",
      eduA: "- **{edu}**\n- I'd connect coursework and projects to the skills I use on the job.\n- I've kept learning through certifications and real product work.",
      certQ: "You hold {cert}. Why did you pursue it and how do you apply it?",
      certA: "- I pursued it to close a specific skill gap.\n- I applied it immediately on a real project.\n- I'd explain what I learned and where I use it in daily work.",
      achievementQ: "Tell me about an achievement you're proud of: {achievement}",
      achievementA: "- **Context:** what the goal was.\n- **What I did:** the approach and the challenge.\n- **Result:** {achievement}.",
      autoQ: "Describe a time you automated a workflow or reduced manual work.",
      autoA: "{fromResume}- I'd frame it with STAR: Situation, Task, Action (what I automated and how), Result (hours/time saved, errors reduced).\n- Concrete metric where possible.",
      bugQ: "Tell me about a difficult bug or production issue you resolved.",
      bugA: "I'd pick a real incident{fromProject}:\n- Diagnosed with logs/metrics to find the root cause.\n- Fixed it safely with a rollback path, then added a regression test.\n- Communicated clearly and documented the lesson.\n- Emphasize impact: prevented recurrence and cut errors.",
      strengthsQ: "What are your strengths and weaknesses as a developer?",
      strengthsA: "**Strengths:**\n- {topSkills} — applied in production, not just in tutorials.\n- Full-stack ownership: schema to UI to deployment.\n- Reliability focus: automation and fewer errors in production.\n\n**Weaknesses:**\n- I can over-polish details; I time-box now.\n- I sometimes want to code before requirements are fully confirmed — I write requirements down first.",
      fiveYearsQ: "Where do you see yourself in five years?",
      fiveYearsA: "A **senior full stack engineer / technical lead** — still hands-on, but designing architecture and mentoring juniors. I want to deepen my {topNames} expertise and own products, not just ship tickets.",
      hireQ: "Why should we hire you over other candidates?",
      hireA: "- Proven full-stack range: {stack}.\n- I ship complete features with measurable outcomes{projects}.\n- I automate and improve reliability, not just build features.",
      questionsQ: "Do you have any questions for us?",
      questionsA: "Yes:\n1. What does the first 90 days look like in this role?\n2. How does the team do code review and deployments?\n3. What is the biggest technical challenge in the next year?\n4. Is there room to own architecture and design decisions?"
    },
    ai: {
      system: "You are an expert senior technical interviewer. You write interview questions personalized to a candidate's resume. Reply with valid JSON only.",
      user: "You are a senior technical interviewer preparing a candidate for a full-stack interview.\nRead the candidate's resume below, then write at least {count} interview questions PERSONALIZED to this candidate.\n\nEach question must use the candidate's real details (name, projects, job titles, technologies, achievements) wherever possible. Cover this mix:\n1. Self-introduction (\"Tell me about yourself\") tailored to their background\n2. One deep-dive per project (why they chose the stack, challenges, impact)\n3. One per job/role\n4. Technical deep-dives on their top skills (use their real skills)\n5. Behavioral/HR questions (STAR-based) tied to their real achievements\n6. A \"why hire you\" and \"questions for us\" wrap-up\n\nCandidate resume:\n\"\"\"\n{resume}\n\"\"\"\n\nReply with ONLY valid JSON — no markdown fences, no prose, nothing after the array — in this exact shape:\n[{\"question\":\"...\",\"answer\":\"...\",\"tags\":[\"skilltag1\",\"skilltag2\"]}]\n\nRules:\n- Return a COMPLETE array with {count} or more items; do NOT truncate or summarize — every question is a separate item.\n- answers: 2-4 sentences, conversational, written as if the candidate will say them in the interview, using real facts from the resume.\n- tags: lowercase skill tags from the resume (e.g. python, angular, sql, docker). Max 3 per question."
    }
  },
  parser: {
    resume: {
      work: "work|experience|employment",
      project: "project",
      summary: "summary|about|profile",
      skill: "skill",
      education: "education|degree",
      cert: "certif",
      achievement: "achiev",
      contact: "contact|email|phone|location"
    },
    fallbackSection: "General"
  },
  shortcuts: {
    "/": "search", "Escape": "collapse",
    "r": "random", "e": "expand", "c": "collapse"
  }
};

let APP = APP_FALLBACK;

/* Fill {placeholders} in a template string. */
function fill(tpl, vars) {
  if (!tpl) return tpl;
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
}

/* Label helper (labels section of app.json). */
function L(key) { return APP.labels[key] != null ? APP.labels[key] : key; }

/* Message helper (messages section of app.json), with fill(). */
function T(key, vars) { return fill(APP.messages[key] != null ? APP.messages[key] : key, vars); }

/* Compile a parser section keyword regex from app.json. */
function secRx(key) { return new RegExp((APP.parser.resume[key] || ""), "i"); }

/* Resolve "app.name", "labels.export", "empty.rolesEmpty" -> value from APP. */
function resolveI18n(path) {
  const parts = String(path || "").split(".");
  let v = APP;
  for (const p of parts) { if (v == null) return null; v = v[p]; }
  return typeof v === "string" ? v : null;
}

/* Apply data-i18n (textContent) and data-i18n-placeholder attributes from app.json. */
function applyAppText() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const v = resolveI18n(el.getAttribute("data-i18n"));
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const v = resolveI18n(el.getAttribute("data-i18n-placeholder"));
    if (v != null) el.setAttribute("placeholder", v);
  });
  const title = resolveI18n("app.name");
  if (title != null) document.title = title;
}

/* Separate JSON data files merged into APP at startup; keep the inline fallback offline. */
const APP_SOURCES = [
  "data/app.json",
  "data/labels.json",
  "data/messages.json",
  "data/confirm.json",
  "data/empty.json",
  "data/export.json",
  "data/templates.json",
  "data/parser.json",
  "data/shortcuts.json"
];

async function loadAppData() {
  for (const url of APP_SOURCES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (j && typeof j === "object") Object.assign(APP, j);
      }
    } catch (e) { /* offline — keep inline fallback */ }
  }
  applyAppText();
}