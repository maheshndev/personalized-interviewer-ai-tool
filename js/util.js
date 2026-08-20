"use strict";

/* Small shared helpers. Loaded first (used by every other module). */

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normSkill(s) {
  return s.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

function toast(msg, warn) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "fixed left-1/2 bottom-6 -translate-x-1/2 " +
    (warn ? "border-amber-500" : "border-emerald-500") +
    " bg-slate-800 text-slate-100 text-sm px-4 py-2 rounded-xl shadow-2xl z-[60] transition-all duration-300 max-w-[90vw]";
  requestAnimationFrame(() => t.classList.add("opacity-100"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("opacity-100");
    t.classList.add("opacity-0");
  }, 2600);
}

function showNotice(html, type) {
  const el = document.getElementById("noticeArea");
  el.innerHTML = '<div class="text-xs rounded-xl px-4 py-3 mb-4 ' +
    (type === "error"
      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
      : type === "ok"
        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
        : "bg-amber-500/10 border border-amber-500/30 text-amber-400") + '">' + html + "</div>";
  if (type === "ok") setTimeout(() => { el.innerHTML = ""; }, 6000);
}

function getDiff(q) { return diff[q.key] || ""; }
function setDiff(q, d) {
  if (d) diff[q.key] = d; else delete diff[q.key];
  localStorage.setItem(LS.diff, JSON.stringify(diff));
}