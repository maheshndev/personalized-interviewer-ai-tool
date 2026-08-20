"use strict";

/* ==================================================================
   Persistence + question bank loading
================================================================== */
function saveResume(regenerate) {
  resumeText = document.getElementById("resumeBox").value;
  localStorage.setItem(LS.resume, resumeText);
  lastSavedAt = new Date();
  document.getElementById("resumeStatus").textContent = T("resumeSaved", { time: lastSavedAt.toLocaleTimeString() });
  if (regenerate) {
    buildQuestions();
    userRoles = detectRoles(resumeText);
    if (!roleSel.size && userRoles.length) {
      roleSel = new Set(userRoles);
      localStorage.setItem(LS.roles, JSON.stringify([...roleSel]));
    }
    pruneSelections();
    render();
    const rn = userRoles.map(id => (ROLE_DEFS.find(d => d.id === id) || {}).name).join(", ");
    toast(T("generatedN", { n: personalQs.length, role: rn ? T("roleDetected", { roles: rn }) : "" }));
  }
}

function pruneSelections() {
  const valid = new Set(personalQs.map(q => q.key).concat(aiQs.map(q => q.key)));
  const hasBank = bankQs.length > 0;
  if (hasBank) bankQs.forEach(q => valid.add(q.key));
  const prune = set => set.forEach(k => {
    /* Don't wipe bank progress while the bank isn't loaded yet (startup). */
    if (String(k).charAt(0) === "b" && !hasBank) return;
    if (!valid.has(k)) set.delete(k);
  });
  prune(prepared); prune(bookmarked); prune(review);
  localStorage.setItem(LS.prepared, JSON.stringify([...prepared]));
  localStorage.setItem(LS.bookmarked, JSON.stringify([...bookmarked]));
  localStorage.setItem(LS.review, JSON.stringify([...review]));
}

function clearResume() {
  if (resumeText && !confirm(APP.confirm.clearResume)) return;
  resumeText = "";
  document.getElementById("resumeBox").value = "";
  localStorage.removeItem(LS.resume);
  personalQs = [];
  aiQs = [];
  localStorage.removeItem(LS.ai);
  userRoles = [];
  skillDefs = bankQs.length ? detectSkills(bankQs.map(q => q.question).join(" ")) : [];
  selectedSkills = new Set([...selectedSkills].filter(id => skillDefs.some(s => s.id === id)));
  localStorage.setItem(LS.skills, JSON.stringify([...selectedSkills]));
  document.getElementById("resumeStatus").textContent = "";
  activeTab = "bank";
  render();
  toast(T("resumeCleared"));
}

function handleResumeFile(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById("resumeBox").value = String(reader.result);
    saveResume(true);
    toast(T("resumeLoaded"));
  };
  reader.readAsText(file);
  ev.target.value = "";
}

/* Turn a normalized question list into the app's bank with skill tags. */
function applyBank(items, name) {
  if (!items.length) { showNotice(T("bankNotFound"), "error"); return false; }
  const seed = resumeText.trim() ? resumeText : items.map(q => q.question).join(" ");
  const defs = skillDefs.length ? skillDefs : detectSkills(seed);
  if (!skillDefs.length && defs.length) skillDefs = defs;
  bankQs = items.map(q => ({
    id: q.id,
    key: "b" + q.id,
    question: q.question,
    answer: q.answer,
    section: q.section,
    tags: (Array.isArray(q.tags) && q.tags.length)
      ? q.tags.filter(t => defs.some(d => d.id === t))
      : tagFromText(q.question + " " + q.answer, defs)
  }));
  localStorage.setItem(LS.bank, JSON.stringify(items));
  if (activeTab === "bank") render();
  showNotice(T("bankLoadedN", { n: bankQs.length }), "ok");
  return true;
}

function loadBankText(text, name) {
  const parsed = parseQuestions(text);
  if (!parsed.questions.length) {
    showNotice(T("bankTextExpected"), "error");
    return false;
  }
  return applyBank(parsed.questions, name);
}

function loadBankJSON(json, name) {
  const items = flattenBank(json);
  if (!items.length) {
    showNotice(T("bankJSONExpected"), "error");
    return false;
  }
  return applyBank(items, name);
}

/* Try to auto-load the bank: HTTP fetch (GitHub Pages / local server),
   then fall back to a cached copy in localStorage (offline / file://). */
async function loadBankFromFiles() {
  for (const url of BANK_FILES) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text.trim()) continue;
      const ok = /\.json$/i.test(url) ? loadBankJSON(JSON.parse(text), url) : loadBankText(text, url);
      if (ok) return true;
    } catch (e) { /* file:// blocks fetch — keep trying / fall back */ }
  }
  const cached = safeParse(LS.bank, null);
  if (Array.isArray(cached) && cached.length) return applyBank(cached, T("cachedBank"));
  return false;
}

function handleBankFile(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result);
    let ok = false;
    if (/\.json$/i.test(file.name)) {
      try { ok = loadBankJSON(JSON.parse(text), file.name); }
      catch (e) { showNotice(T("invalidJSON", { error: e.message }), "error"); }
    } else {
      ok = loadBankText(text, file.name);
    }
    if (ok) toast(T("bankLoaded"));
  };
  reader.readAsText(file);
  ev.target.value = "";
}