"use strict";

/* ==================================================================
   Keyboard shortcuts (data-driven from data/app.json)
================================================================== */
window.addEventListener("keydown", e => {
  const tag = e.target.tagName;
  const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  const key = e.key;
  if (typing && key !== "/") return;
  const action = APP.shortcuts[key] || (key.length === 1 ? APP.shortcuts[key.toLowerCase()] : null);
  if (!action) return;
  if (action === "search") { e.preventDefault(); document.getElementById("searchBox").focus(); return; }
  if (typing) return;
  if (action === "collapse") expandAll(false);
  else if (action === "random") randomQ();
  else if (action === "expand") expandAll(true);
});

/* ==================================================================
   Init
================================================================== */
document.getElementById("resumeBox").value = resumeText;
document.getElementById("resumeBox").addEventListener("input", () => {
  /* Save as you type; rebuild questions only on the explicit Generate click. */
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveResume(false), 800);
});
/* Load skill/role definitions (data/skills.json, data/roles.json), UI text
   (data/app.json), filters and config before detection runs. Offline keeps defaults. */
(async () => {
  clearPersistedAIKeys();
  await loadAppData();
  await loadSkillData();
  loadFilterData();
  await loadAIConfig();
  initializeAIControls();
  await discoverSameOriginAIProxy();
  await loadServerProviderSettings();
  const aiProvider = selectedAIProvider();
  loadAIModels(aiProvider);

  if (resumeText.trim()) {
    buildQuestions();
    userRoles = detectRoles(resumeText);
    if (!roleSel.size && userRoles.length) {
      roleSel = new Set(userRoles);
      localStorage.setItem(LS.roles, JSON.stringify([...roleSel]));
    }
    activeTab = "personal";
  } else {
    activeTab = "bank";
  }

  render();

  const ok = await loadBankFromFiles();
  if (ok) pruneSelections(); /* only prune once the bank is loaded (avoid wiping bank progress) */
  render();
})();