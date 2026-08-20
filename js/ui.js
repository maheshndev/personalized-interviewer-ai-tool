"use strict";

/* Which cards are currently expanded — survives re-renders. */
let openKeys = new Set();

/* ==================================================================
   Sidebar: skills + filters
================================================================== */
function renderSkills() {
  const box = document.getElementById("skillList");
  if (!skillDefs.length) {
    box.innerHTML = '<p class="text-xs text-slate-500 py-1">Add your resume above to detect skills.</p>';
    document.getElementById("skillCount").textContent = "";
    return;
  }
  const pool = activePool();
  const counts = {};
  pool.forEach(q => (q.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
  document.getElementById("skillCount").textContent = "(" + skillDefs.length + ")";
  box.innerHTML = skillDefs.map(s => {
    const n = counts[s.id] || 0;
    const on = selectedSkills.has(s.id);
    return '<label class="flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer hover:bg-slate-800/60 ' + (on ? "text-slate-100" : "") + '">' +
      '<input type="checkbox" ' + (on ? "checked " : "") + 'onchange="toggleSkill(\'' + s.id + '\')" class="accent-blue-500 cursor-pointer shrink-0">' +
      '<span class="flex-1 truncate">' + esc(s.name) + '</span>' +
      '<span class="text-[10px] font-bold text-blue-400 bg-blue-500/10 rounded-full px-1.5 py-0.5 shrink-0">' + n + "</span></label>";
  }).join("");
}

function toggleSkill(id) {
  if (selectedSkills.has(id)) selectedSkills.delete(id); else selectedSkills.add(id);
  localStorage.setItem(LS.skills, JSON.stringify([...selectedSkills]));
  renderSkills();
  render();
}
function selectAllSkills(on) {
  selectedSkills = on ? new Set(skillDefs.map(s => s.id)) : new Set();
  localStorage.setItem(LS.skills, JSON.stringify([...selectedSkills]));
  renderSkills();
  render();
}

/* ---- Roles ---- */
function roleSkillSet(def) { return new Set(def.skills); }
function matchesRole(q) {
  if (!roleSel.size) return true;
  const qTags = new Set(q.tags || []);
  const qSec = (q.section || "").toLowerCase();
  for (const id of roleSel) {
    const def = ROLE_DEFS.find(d => d.id === id);
    if (!def) continue;
    if (def.skills.some(s => qTags.has(s))) return true;
    if (def.sections && def.sections.test(qSec)) return true;
  }
  return false;
}

function renderRoles() {
  const box = document.getElementById("roleList");
  const pool = activePool();
  const counts = {};
  ROLE_DEFS.forEach(def => {
    const sset = roleSkillSet(def);
    counts[def.id] = pool.filter(q =>
      (q.tags || []).some(t => sset.has(t)) || (def.sections && def.sections.test((q.section || "").toLowerCase()))
    ).length;
  });
  const detected = userRoles.length ? ' <span class="text-emerald-400" title="Detected from your resume">&#9679;</span>' : "";
  document.getElementById("roleCount").innerHTML = "(" + ROLE_DEFS.length + ")" + detected;
  box.innerHTML = ROLE_DEFS.map(def => {
    const n = counts[def.id] || 0;
    const on = roleSel.has(def.id);
    const fromResume = userRoles.indexOf(def.id) !== -1;
    return '<label class="flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer hover:bg-slate-800/60 ' + (on ? "text-slate-100" : "") + '">' +
      '<input type="checkbox" ' + (on ? "checked " : "") + 'onchange="toggleRole(\'' + def.id + '\')" class="accent-violet-500 cursor-pointer shrink-0">' +
      '<span class="flex-1 truncate">' + esc(def.name) + (fromResume ? ' <span class="text-emerald-400 text-[10px]">&#9679;</span>' : "") + '</span>' +
      '<span class="text-[10px] font-bold text-violet-400 bg-violet-500/10 rounded-full px-1.5 py-0.5 shrink-0">' + n + "</span></label>";
  }).join("");
}

function toggleRole(id) {
  if (roleSel.has(id)) roleSel.delete(id); else roleSel.add(id);
  localStorage.setItem(LS.roles, JSON.stringify([...roleSel]));
  renderRoles();
  render();
}
function selectAllRoles(on) {
  roleSel = on ? new Set(ROLE_DEFS.map(d => d.id)) : new Set();
  localStorage.setItem(LS.roles, JSON.stringify([...roleSel]));
  renderRoles();
  render();
}

function renderFilters() {
  const pool = activePool();
  const c = { new: 0, prepared: 0, bookmarked: 0, review: 0, e: 0, m: 0, h: 0, u: 0 };
  pool.forEach(q => {
    if (!prepared.has(q.key)) c.new++;
    if (prepared.has(q.key)) c.prepared++;
    if (bookmarked.has(q.key)) c.bookmarked++;
    if (review.has(q.key)) c.review++;
    const d = getDiff(q);
    if (d === "e") c.e++; else if (d === "m") c.m++; else if (d === "h") c.h++; else c.u++;
  });
  const statusItems = { new: "New", prepared: "Prepared", bookmarked: "\u2b50 Bookmarked", review: "\u21bb Review" };
  const diffItems = { e: "Easy", m: "Medium", h: "Hard", u: "Untagged" };
  const item = (group, key, label, n) => {
    const set = group === "status" ? statusSel : diffSel;
    const on = set.has(key);
    return '<label class="flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer hover:bg-slate-800/60 ' + (on ? "text-slate-100" : "") + '">' +
      '<input type="checkbox" ' + (on ? "checked " : "") + 'onchange="toggleFilter(\'' + group + '\',\'' + key + '\')" class="accent-blue-500 cursor-pointer shrink-0">' +
      '<span class="flex-1">' + label + '</span><span class="text-[10px] font-bold text-blue-400 bg-blue-500/10 rounded-full px-1.5 py-0.5 shrink-0">' + n + "</span></label>";
  };
  document.getElementById("statusList").innerHTML = Object.keys(statusItems).map(k => item("status", k, statusItems[k], c[k])).join("");
  document.getElementById("diffList").innerHTML = Object.keys(diffItems).map(k => item("diff", k, diffItems[k], c[k])).join("");
  const active = statusSel.size + diffSel.size + roleSel.size;
  document.getElementById("filterCount").textContent = active ? "(" + active + ")" : "";
  document.getElementById("clearFiltersBtn").style.display = active ? "" : "none";
}

function toggleFilter(group, key) {
  const set = group === "status" ? statusSel : diffSel;
  if (set.has(key)) set.delete(key); else set.add(key);
  renderFilters();
  render();
}
function clearFilters() {
  statusSel.clear(); diffSel.clear(); roleSel.clear();
  localStorage.setItem(LS.roles, JSON.stringify([]));
  renderFilters(); renderRoles(); render();
  toast("Filters cleared");
}

/* ==================================================================
   Filtering + sorting
================================================================== */
function activePool() { return activeTab === "personal" ? personalQs : activeTab === "ai" ? aiQs : bankQs; }
function matchesStatus(q) {
  if (!statusSel.size) return true;
  return (statusSel.has("new") && !prepared.has(q.key)) ||
         (statusSel.has("prepared") && prepared.has(q.key)) ||
         (statusSel.has("bookmarked") && bookmarked.has(q.key)) ||
         (statusSel.has("review") && review.has(q.key));
}
function matchesDiff(q) {
  if (!diffSel.size) return true;
  const d = getDiff(q);
  return (diffSel.has("u") && !d) || (!!d && diffSel.has(d));
}
function filtered() {
  let list = activePool();
  if (selectedSkills.size) list = list.filter(q => (q.tags || []).some(t => selectedSkills.has(t)));
  list = list.filter(matchesRole);
  if (activeTab === "bank" && activeSection !== "All") list = list.filter(q => q.section === activeSection);
  if (searchTerm) { const s = searchTerm; list = list.filter(q => (q.question + " " + q.answer).toLowerCase().includes(s)); }
  list = list.filter(matchesStatus).filter(matchesDiff);
  if (sortMode === "num") list = [...list].sort((a, b) => a.id - b.id);
  else if (sortMode === "numDesc") list = [...list].sort((a, b) => b.id - a.id);
  else if (sortMode === "section") list = [...list].sort((a, b) => (a.section || "").localeCompare(b.section || "") || a.id - b.id);
  else if (sortMode === "random") list = shuffle([...list]);
  return list;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ==================================================================
   Main rendering
================================================================== */
function updateHeader() {
  const sub = document.getElementById("appSubtitle");
  const live = document.getElementById("resumeLive");
  if (resumeText.trim()) {
    const r = parseResume(resumeText);
    const roleNames = userRoles.map(id => (ROLE_DEFS.find(d => d.id === id) || {}).name).filter(Boolean).join(", ");
    sub.textContent = "Preparing " + (r.name || "your resume") + " — " + skillDefs.length + " skills" +
      (roleNames ? " · " + roleNames : "") + " · " + (personalQs.length + aiQs.length) + " personalized questions";
    if (live) live.style.display = "";
  } else {
    sub.textContent = "No resume yet — showing all " + bankQs.length + " bank questions";
    if (live) live.style.display = "none";
  }
}

function render() {
  renderSkills();
  renderRoles();
  renderFilters();
  updateHeader();
  const list = filtered();
  const pool = activePool();
  document.getElementById("resultCount").textContent = "Showing " + list.length + " of " + pool.length + " questions";

  const tabCls = (on) => "tab text-xs font-bold px-3 py-2 rounded-lg " + (on ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 border border-slate-700");
  const tP = document.getElementById("tabPersonal");
  const tA = document.getElementById("tabAI");
  const tB = document.getElementById("tabBank");
  tP.className = tabCls(activeTab === "personal");
  tA.className = tabCls(activeTab === "ai");
  tB.className = tabCls(activeTab === "bank");
  tP.textContent = "My Questions (" + personalQs.length + ")";
  tA.textContent = "AI Questions (" + aiQs.length + ")";
  tB.textContent = "Question Bank (" + bankQs.length + ")";

  const chipsBox = document.getElementById("sectionChips");
  if (activeTab === "bank") {
    const secs = [];
    bankQs.forEach(q => { if (secs.indexOf(q.section) === -1) secs.push(q.section); });
    chipsBox.innerHTML = '<button class="text-xs px-2.5 py-1 rounded-full ' + (activeSection === "All" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700") + '" onclick="setSection(\'All\')">All</button>' +
      secs.map(s => '<button class="text-xs px-2.5 py-1 rounded-full ' + (activeSection === s ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700") + '" onclick="setSection(\'' + s.replace(/'/g, "\\'") + '\')">' + esc(s) + "</button>").join("");
  } else {
    chipsBox.innerHTML = "";
  }

  const box = document.getElementById("questionList");
  const prevScroll = window.scrollY || 0;
  if (!list.length) {
    box.innerHTML = emptyStateHtml(pool);
  } else {
    box.innerHTML = list.map(qCardHtml).join("");
  }
  applyOpenState();
  if (window.scrollTo && window.scrollY !== prevScroll) window.scrollTo(0, prevScroll);
  updateProgress();
  updateExpandBtn();
}

/* Re-open the cards the user had expanded before this render. */
function applyOpenState() {
  openKeys.forEach(k => {
    const card = document.querySelector('.q-card[data-key="' + k + '"]');
    if (card) { card.classList.add("open"); const a = card.querySelector(".answer"); if (a) a.classList.remove("hidden"); }
  });
}

function emptyStateHtml(pool) {
  const wrap = (icon, msg, extra) => '<div class="text-center py-16 text-slate-500"><div class="text-4xl mb-3">' + icon + "</div><p class='mb-4 px-6'>" + msg + "</p>" + (extra || "") + "</div>";
  if (pool.length) return wrap("\ud83d\udd0d", "No questions match your filters.");
  if (activeTab === "personal") {
    return wrap("\ud83d\udcc4",
      "No resume yet. Paste one on the left and hit <b>Generate questions</b>, or study the full question bank.",
      '<button class="text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2" onclick="switchTab(\'bank\')">\ud83d\udcc4 Show all questions</button>' +
      ' <button class="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-2" onclick="document.getElementById(\'bankFile\').click()">\ud83d\udce6 Load bank file</button>');
  }
  if (activeTab === "bank") {
    return wrap("\ud83d\udce6",
      "Question bank not loaded yet. Auto-loads over HTTP (GitHub Pages / local server), or pick the file:",
      '<button class="text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2" onclick="document.getElementById(\'bankFile\').click()">\ud83d\udce6 Load Question Bank (.md / .json)</button>');
  }
  return wrap("\ud83e\udd16",
    "No AI questions yet. Paste a resume, pick a model, then hit <b>Generate with AI</b> above.",
    '<button class="text-xs font-semibold bg-violet-600 hover:bg-violet-500 rounded-lg px-4 py-2" onclick="toggleAI()">\u26a1 Generate with AI</button>');
}

function setSection(key) { activeSection = key; render(); }

function qCardHtml(x) {
  const done = prepared.has(x.key), bk = bookmarked.has(x.key), rv = review.has(x.key), d = getDiff(x);
  const diffCls = d === "e" ? " text-emerald-400 border-emerald-500/40" : d === "m" ? " text-amber-400 border-amber-500/40" : d === "h" ? " text-rose-400 border-rose-500/40" : "";
  const tag = (x.tags || []).map(t => { const s = skillDefs.find(y => y.id === t); return s ? s.name : null; }).filter(Boolean).slice(0, 3).join(" · ");
  return '<div class="q-card rounded-xl border border-slate-800 bg-slate-900 mb-3 overflow-hidden ' + (bk ? "border-l-4 border-l-amber-400" : "") + '" data-key="' + x.key + '">' +
    '<div class="flex items-start gap-3 px-4 py-3 cursor-pointer select-none" onclick="toggleQ(\'' + x.key + '\')">' +
      '<div class="q-num shrink-0 w-8 h-8 rounded-lg border border-blue-500/60 bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">Q' + x.id + "</div>" +
      '<div class="flex-1 min-w-0">' +
        '<div class="font-semibold text-sm leading-snug">' + inline(x.question) + "</div>" +
        (tag ? '<div class="text-[11px] text-blue-400/80 mt-1">' + esc(tag) + "</div>" : "") +
      "</div>" +
      '<div class="shrink-0 flex items-center gap-1 text-slate-500 act">' +
        '<select class="act bg-slate-800 border ' + diffCls + ' text-[10px] rounded-full px-1.5 py-0.5 outline-none cursor-pointer" title="Tag difficulty" onclick="event.stopPropagation()" onchange="event.stopPropagation();setDiffQ(\'' + x.key + '\',this.value)">' +
          '<option value=""' + (!d ? " selected" : "") + '>&#9679; Diff</option>' +
          '<option value="e"' + (d === "e" ? " selected" : "") + '>Easy</option>' +
          '<option value="m"' + (d === "m" ? " selected" : "") + '>Medium</option>' +
          '<option value="h"' + (d === "h" ? " selected" : "") + '>Hard</option></select>' +
        '<button class="act text-sm" title="Bookmark" onclick="event.stopPropagation();toggleBookmark(\'' + x.key + '\')">' + (bk ? "\u2b50" : "\u2606") + "</button>" +
        '<button class="act text-sm" title="Mark for review" onclick="event.stopPropagation();toggleReview(\'' + x.key + '\')">' + (rv ? "\u21bb" : "\u21ba") + "</button>" +
        '<button class="act text-sm" title="Copy Q&A" onclick="event.stopPropagation();copyQA(\'' + x.key + '\')">\ud83d\udccb</button>' +
        '<button class="act-keep text-sm" title="Mark prepared" onclick="event.stopPropagation();togglePrepared(\'' + x.key + '\')">' + (done ? "\u2705" : "\u2610") + "</button>" +
      "</div>" +
    "</div>" +
    '<div class="answer hidden px-4 pb-4 ml-11 text-sm text-slate-300 border-t border-dashed border-slate-800 pt-3"><div class="markdown">' + renderMd(x.answer) + "</div></div>" +
  "</div>";
}

function toggleQ(key) {
  const card = document.querySelector('.q-card[data-key="' + key + '"]');
  if (!card) return;
  const wasOpen = card.classList.contains("open");
  if (wasOpen) { openKeys.delete(key); card.classList.remove("open"); card.querySelector(".answer").classList.add("hidden"); }
  else { openKeys.add(key); card.classList.add("open"); card.querySelector(".answer").classList.remove("hidden"); }
  updateExpandBtn();
}
function expandAll(open) {
  if (open) document.querySelectorAll(".q-card").forEach(c => { const k = c.getAttribute("data-key"); if (k) openKeys.add(k); });
  else openKeys.clear();
  document.querySelectorAll(".q-card").forEach(c => { c.classList.toggle("open", open); const a = c.querySelector(".answer"); if (a) a.classList.toggle("hidden", !open); });
  updateExpandBtn();
}
function toggleExpand() {
  const anyOpen = document.querySelectorAll(".q-card.open").length > 0;
  expandAll(!anyOpen);
}
function updateExpandBtn() {
  const open = document.querySelectorAll(".q-card.open").length > 0;
  document.getElementById("expandBtn").textContent = open ? "Collapse all" : "Expand all";
}

function togglePrepared(key) {
  const q = activePool().find(x => x.key === key); if (!q) return;
  if (prepared.has(key)) prepared.delete(key); else prepared.add(key);
  localStorage.setItem(LS.prepared, JSON.stringify([...prepared]));
  render();
  toast("Q" + q.id + (prepared.has(key) ? " marked prepared" : " marked as new"));
}
function toggleBookmark(key) {
  if (bookmarked.has(key)) bookmarked.delete(key); else bookmarked.add(key);
  localStorage.setItem(LS.bookmarked, JSON.stringify([...bookmarked]));
  render();
  toast(bookmarked.has(key) ? "Bookmarked" : "Un-bookmarked", !bookmarked.has(key));
}
function toggleReview(key) {
  if (review.has(key)) review.delete(key); else review.add(key);
  localStorage.setItem(LS.review, JSON.stringify([...review]));
  render();
  toast(review.has(key) ? "Queued for review" : "Removed from review", !review.has(key));
}
function setDiffQ(key, d) {
  const q = activePool().find(x => x.key === key); if (!q) return;
  setDiff(q, d);
  render();
  toast("Q" + q.id + " difficulty set");
}
function copyQA(key) {
  const q = activePool().find(x => x.key === key); if (!q) return;
  const text = "Q" + q.id + ". " + q.question + "\n\n" + q.answer.trim();
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => toast("Q" + q.id + " copied"))
    .catch(() => toast("Copy failed", true));
}
function randomQ() {
  const list = filtered();
  if (!list.length) { toast("No questions to pick from", true); return; }
  const q = list[Math.floor(Math.random() * list.length)];
  openKeys.clear();
  document.querySelectorAll(".q-card").forEach(c => { c.classList.remove("open"); const a = c.querySelector(".answer"); if (a) a.classList.add("hidden"); });
  const card = document.querySelector('.q-card[data-key="' + q.key + '"]');
  if (card) { openKeys.add(q.key); card.classList.add("open"); card.querySelector(".answer").classList.remove("hidden"); card.scrollIntoView({ behavior: "smooth", block: "start" }); }
  updateExpandBtn();
  toast("Random: Q" + q.id);
}
function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchTerm = document.getElementById("searchBox").value.toLowerCase(); render(); }, 120);
}
function setSort(v) { sortMode = v; render(); }

/* ==================================================================
   Tabs
================================================================== */
function switchTab(tab) {
  activeTab = tab;
  activeSection = "All";
  if (window.scrollTo) window.scrollTo(0, 0);
  render();
}

/* ==================================================================
   Progress / export / reset
================================================================== */
function updateProgress() {
  const total = activePool().length;
  const done = activePool().filter(q => prepared.has(q.key)).length;
  document.getElementById("progressLabel").textContent = done + " / " + total;
  document.getElementById("progressFill").style.width = total ? (done / total * 100) + "%" : "0%";
}

function exportList() {
  const list = filtered();
  if (!list.length) { toast("Nothing to export", true); return; }
  const kind = statusSel.has("bookmarked") ? "Bookmarked" : statusSel.has("review") ? "Review Queue" : statusSel.has("prepared") ? "Prepared" : activeTab === "personal" ? "Personalized" : activeTab === "ai" ? "AI-Generated" : "Bank";
  let out = "# " + kind + " Questions (" + list.length + ")\n\n";
  list.forEach(q => { out += "### Q" + q.id + ". " + q.question.replace(/\.$/, "") + ".\n\n" + q.answer.trim() + "\n\n---\n\n"; });
  const blob = new Blob([out], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (kind + "-questions.md").toLowerCase().replace(/\s+/g, "-");
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Exported " + list.length + " questions");
}

function resetAll() {
  if (!confirm("Reset resume, skills, and all progress? This cannot be undone.")) return;
  Object.values(LS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem("ppp.timer");
  resumeText = ""; selectedSkills = new Set(); roleSel = new Set(); userRoles = []; prepared = new Set(); bookmarked = new Set(); review = new Set(); diff = {};
  personalQs = []; aiQs = []; bankQs = []; skillDefs = []; statusSel = new Set(); diffSel = new Set();
  searchTerm = ""; sortMode = "num"; activeSection = "All"; activeTab = "bank"; openKeys.clear();
  document.getElementById("resumeBox").value = "";
  document.getElementById("resumeStatus").textContent = "";
  document.getElementById("searchBox").value = "";
  document.getElementById("sortSel").value = "num";
  document.getElementById("aiPreview").classList.add("hidden");
  document.getElementById("aiBtn").textContent = "Generate with AI";
  document.getElementById("aiStatus").textContent = "";
  document.getElementById("noticeArea").innerHTML = "";
  if (window.scrollTo) window.scrollTo(0, 0);
  render();
  loadBankFromFiles(); /* restore the bank fresh after the localStorage reset */
  toast("All data reset");
}