"use strict";
/* Adds tags (skill ids) and skills (skill names) to every question in data/questions.json
   by keyword-matching against data/skills.json (same \bkw\b logic as tagFromText). */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const skills = JSON.parse(fs.readFileSync(path.join(root, "data/skills.json"), "utf8"));
const bank = JSON.parse(fs.readFileSync(path.join(root, "data/questions.json"), "utf8"));

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function tagsFor(text) {
  const low = " " + text.toLowerCase() + " ";
  const found = [];
  for (const s of Object.values(skills)) {
    for (const k of s.kw) {
      if (new RegExp("\\b" + escRe(k.toLowerCase()) + "\\b").test(low)) { found.push({ id: s.id, name: s.name }); break; }
    }
  }
  found.sort((a, b) => a.name.localeCompare(b.name));
  const capped = found.slice(0, 4);
  return { tags: capped.map(x => x.id), skills: capped.map(x => x.name) };
}

let tagged = 0, total = 0;
for (const sec of bank.sections) {
  for (const q of sec.questions) {
    total++;
    const { tags, skills } = tagsFor(q.question + " " + q.answer);
    q.tags = tags;
    q.skills = skills;
    if (tags.length) tagged++;
  }
}

bank.count = total;
fs.writeFileSync(path.join(root, "data/questions.json"), JSON.stringify(bank, null, 2) + "\n");
console.log("tagged " + tagged + " / " + total + " questions");