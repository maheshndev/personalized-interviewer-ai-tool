"use strict";

/* ==================================================================
   Keyboard shortcuts
================================================================== */
window.addEventListener("keydown", e => {
  const tag = e.target.tagName;
  const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  if (e.key === "/" && !typing) { e.preventDefault(); document.getElementById("searchBox").focus(); return; }
  if (typing) return;
  if (e.key === "Escape") expandAll(false);
  else if (e.key.toLowerCase() === "r") randomQ();
  else if (e.key.toLowerCase() === "e") expandAll(true);
  else if (e.key.toLowerCase() === "c") expandAll(false);
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
loadAIConfig().finally(() => loadAIModels());
document.getElementById("aiModel").addEventListener("change", () => { window.manualModel = document.getElementById("aiModel").value; });

/* No resume -> default to the full question bank so all questions show. */
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

(async () => {
  const ok = await loadBankFromFiles();
  if (ok) pruneSelections(); /* only prune once the bank is loaded (avoid wiping bank progress) */
  render();
})();