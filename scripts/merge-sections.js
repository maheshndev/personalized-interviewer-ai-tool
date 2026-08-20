"use strict";
/* Merges data/new-sections.json (array of sections without ids) into data/questions.json,
   assigning ids sequentially after the last existing id. */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const bank = JSON.parse(fs.readFileSync(path.join(root, "data/questions.json"), "utf8"));
const extra = JSON.parse(fs.readFileSync(path.join(root, "data/new-sections.json"), "utf8"));

let nextId = 0;
for (const sec of bank.sections) {
  for (const q of sec.questions) {
    if (q.id > nextId) nextId = q.id;
  }
}

const existingTitles = new Set(bank.sections.map(s => s.title));
const dupTitles = extra.filter(s => existingTitles.has(s.title)).map(s => s.title);
if (dupTitles.length) {
  console.error("Duplicate section titles already in bank: " + dupTitles.join(", "));
  process.exit(1);
}

for (const sec of extra) {
  sec.questions = sec.questions.map(q => Object.assign({ id: ++nextId }, q));
  bank.sections.push(sec);
}

fs.writeFileSync(path.join(root, "data/questions.json"), JSON.stringify(bank, null, 2) + "\n");
console.log("merged " + extra.length + " sections, next id now " + nextId);