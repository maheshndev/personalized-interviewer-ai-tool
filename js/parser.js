"use strict";

/* ==================================================================
   Resume parsing (markdown or plain text)
================================================================== */
function parseResume(text) {
  const data = { name: "", title: "", summary: "", skills: [], skillGroups: [], projects: [], jobs: [], education: [], certs: [], achievements: [] };
  let section = "";
  let inProject = null, inJob = null;
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^#\s+(.+?)\s*$/))) { data.name = m[1]; continue; }
    if ((m = line.match(/^#{3,}\s+(.+?)\s*$/))) {
      const t = m[1].trim();
      if (/work|experience|employment/i.test(section)) {
        const parts = t.split(/\s*[|–—]\s*/).filter(Boolean);
        inJob = { title: parts[1] || t, company: parts[0] || "", dates: parts[parts.length - 1] || "", bullets: [] };
        data.jobs.push(inJob);
      }
      else if (/project/i.test(section)) { inProject = { name: t, tech: "", bullets: [], impact: "" }; data.projects.push(inProject); }
      continue;
    }
    if ((m = line.match(/^#{2}\s+(.+?)\s*$/))) { section = m[1].toLowerCase(); inProject = null; inJob = null; continue; }
    const techLine = inProject && line.match(/^[-*]?\s*\*{0,2}Tech [Ss]tack:?\*{0,2}\s*(.+)$/);
    if (techLine) { inProject.tech = techLine[1].trim(); continue; }
    if ((m = line.match(/^[-*]\s+(.+?)\s*$/))) {
      const b = m[1];
      if (/summary|about|profile/i.test(section)) data.summary += (data.summary ? " " : "") + b;
      else if (/skill/i.test(section)) {
        const gm = b.match(/^\*{0,2}([^:*]+):?\*{0,2}\s*(.+)$/);
        if (gm) data.skillGroups.push({ group: gm[1], items: gm[2].split(",").map(s => s.trim()).filter(Boolean) });
        else data.skills.push(b.replace(/^\*\*/, "").replace(/\*\*$/, "").trim());
      }
      else if (/education|degree/i.test(section)) data.education.push(b);
      else if (/certif/i.test(section)) data.certs.push(b);
      else if (/achiev/i.test(section)) data.achievements.push(b);
      else if (inProject) {
        const tm = b.match(/^\*{0,2}Tech [Ss]tack:?\*{0,2}\s*(.+)$/);
        if (tm) inProject.tech = tm[1];
        else { const clean = b.replace(/^\*\*[^*]+:\*\*\s*/, ""); inProject.bullets.push(clean); if (/impact|reduc|increas|improv|speed|faster|%|transactions|load/i.test(b)) inProject.impact = clean; }
      }
      else if (inJob) inJob.bullets.push(b.replace(/^\*\*[^*]+:\*\*\s*/, ""));
      continue;
    }
    if (!inProject && !inJob) {
      if (/summary|about|profile/i.test(section)) data.summary += (data.summary ? " " : "") + line;
      else if (/contact|email|phone|location/i.test(section)) data.title = (data.title || "") + " " + line;
      else if (/education|degree/i.test(section)) data.education.push(line);
      else if (/certif/i.test(section)) data.certs.push(line);
      else if (/achiev/i.test(section)) data.achievements.push(line);
    }
  }
  const flat = data.skillGroups.reduce((a, g) => a.concat(g.items), []);
  data.skills = data.skills.concat(flat);
  data.skills = [...new Set(data.skills.map(s => s.trim()).filter(Boolean))];
  return data;
}

/* ==================================================================
   Question bank parsing (.md or .json)
================================================================== */
function parseQuestions(md) {
  const lines = md.split(/\r?\n/);
  const qs = [], order = [];
  let section = null, current = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === "---") continue;
    if (/^#{1,6}\s/.test(line)) {
      const sec = line.match(/^#\s+(?:[0-9]+\.\s*)?(.+?)\s*$/);
      if (sec) { if (current) qs.push(current); current = null; section = sec[1].trim(); if (section && order.indexOf(section) === -1) order.push(section); continue; }
      const q = line.match(/^###\s*Q?(\d+)\.\s*(.+?)\s*$/i);
      if (q) { if (current) qs.push(current); current = { id: parseInt(q[1], 10), question: q[2].trim(), section: section || "General", answer: "" }; }
      else { if (current) qs.push(current); current = null; }
      continue;
    }
    if (current) current.answer += line + "\n";
  }
  if (current) qs.push(current);
  return { questions: qs, order };
}

function flattenBank(json) {
  if (!json || !Array.isArray(json.sections)) return [];
  const items = [];
  json.sections.forEach(s => {
    (s.questions || []).forEach(q => items.push({
      id: q.id,
      question: q.question,
      answer: q.answer || "",
      section: s.title || "General"
    }));
  });
  return items;
}

/* ==================================================================
   Markdown -> HTML (mini renderer)
================================================================== */
function inline(md) {
  return esc(md)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMd(md) {
  const lines = md.trim().split(/\r?\n/);
  let html = "", list = false, para = "", inPre = false;
  const flushPara = () => { if (para.trim()) { html += "<p>" + inline(para.trim()) + "</p>"; para = ""; } };
  const closeList = () => { if (list) { html += "</ul>"; list = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^```/.test(line)) { flushPara(); closeList(); if (inPre) { html += "</code></pre>"; inPre = false; } else { html += "<pre><code>"; inPre = true; } continue; }
    if (inPre) { html += esc(line) + "\n"; continue; }
    if (!line) { flushPara(); closeList(); continue; }
    if (/^(#{1,6})\s/.test(line)) { flushPara(); closeList(); html += "<h4>" + inline(line.replace(/^#{1,6}\s*/, "")) + "</h4>"; continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); if (!list) { html += "<ul>"; list = true; } html += "<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>"; continue; }
    if (/^\d+\.\s+/.test(line)) { flushPara(); closeList(); html += "<p>" + inline(line) + "</p>"; continue; }
    closeList(); para += line + " ";
  }
  flushPara(); closeList();
  if (inPre) html += "</code></pre>";
  return html;
}