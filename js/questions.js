"use strict";

/* ==================================================================
   Personalized question generation
   Every question is built from the user's actual resume data.
================================================================== */
function skillAnswer(s) {
  if (s.a) return s.a + "\n\n- Then I'd connect this to a real project where I applied it, the trade-offs I weighed, and the measurable result.";
  return "- Where I used " + s.name + ": across my projects and daily ERP work.\n- I'd explain a concrete example: the problem, how I applied " + s.name + ", the trade-offs, and the outcome.\n- If asked to go deeper, I can write a small example on the spot.";
}
function cleanProjName(n) { return (n || "").replace(/\([^)]*\)/g, "").trim(); }

/* Estimate total years of experience from job date ranges. */
function computeYears(jobs) {
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const now = new Date();
  let months = 0;
  jobs.forEach(j => {
    const stamps = (j.dates || "").match(/([A-Za-z]{3,9})\s*(\d{4})/g) || [];
    const pts = stamps.map(s => {
      const m = s.match(/([A-Za-z]{3,9})\s*(\d{4})/);
      const mi = MONTHS.indexOf(m[1].toLowerCase());
      return { y: +m[2], m: mi < 0 ? 6 : mi };
    });
    if (pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      months += Math.max(0, (b.y - a.y) * 12 + (b.m - a.m));
    } else if (pts.length === 1) {
      months += Math.max(0, (now.getFullYear() - pts[0].y) * 12 + now.getMonth() - pts[0].m);
    }
  });
  return Math.round((months / 12) * 10) / 10;
}

function buildQuestions() {
  if (!resumeText.trim()) { personalQs = []; skillDefs = []; return; }
  const r = parseResume(resumeText);
  const defs = detectSkills(resumeText);
  skillDefs = defs;

  const qs = [];
  let id = 1;
  const add = (question, answer, tags, kind) => {
    const qid = id++;
    qs.push({ id: qid, key: "p" + qid, question, answer, tags: tags || [], section: "Personalized", kind: kind || "" });
  };

  const name = r.name || "a developer";
  const title = r.title.trim();
  const yearsExp = computeYears(r.jobs);
  const topSkills = defs.map(s => s.name).slice(0, 10);
  const topIds = defs.map(s => s.id).slice(0, 8);
  const topNames = defs.map(s => s.name).slice(0, 8).join(", ") || "the stack in my resume";
  const projNames = r.projects.map(p => cleanProjName(p.name)).filter(Boolean);
  const stack = defs.map(s => s.name).slice(0, 6).join(", ");

  /* --- Tell me about yourself: fully built from the resume --- */
  add("Tell me about yourself and why you're a good fit for this role.",
    "I'm **" + name + "**" + (title ? " — " + title : "") +
      (yearsExp ? ", with **" + yearsExp + " years** of professional experience" : "") + ".\n\n" +
      (r.summary ? "- " + r.summary + "\n" : "") +
      "- Key skills: " + (topSkills.join(", ") || "see my resume") + ".\n" +
      "- Most relevant experience: " + (projNames.join(", ") || "several production projects delivered end to end") + ".\n" +
      "- What drives me: building complete products, automating repetitive work, and shipping reliably.",
    topIds, "intro");

  /* --- One question per project, filled with its real data --- */
  r.projects.slice(0, 5).forEach(p => {
    const pname = cleanProjName(p.name);
    if (!pname) return;
    const bullets = (p.bullets || []).slice(0, 3);
    const tags = tagFromText(pname + " " + (p.tech || "") + " " + bullets.join(" "), defs);
    add('Tell me about your project "' + pname + '". What problem did it solve, and what was your role?',
      "**" + pname + "**\n\n" +
      (p.tech ? "- **Tech stack:** " + p.tech + "\n" : "") +
      (bullets.length ? bullets.map(b => "- " + b).join("\n") + "\n" : "") +
      (p.impact ? "- **Impact:** " + p.impact + "\n" : "") +
      "- My role: end-to-end ownership — schema, APIs, UI, and deployment where applicable.",
      tags, "project");
    const tech = (p.tech || "").trim();
    if (tech) {
      add('Why did you choose "' + tech.split(/[,\n]/)[0].trim() + '" for the project "' + pname + '"?',
        "- The requirement: " + (bullets[0] || "a clear business problem") + ".\n" +
        "- Why I chose it: right fit for the data model, ecosystem, and team familiarity.\n" +
        "- Trade-off I weighed: " + tech + " vs alternatives, and what it cost/gained us.",
        tags, "project");
    }
  });

  /* --- One question per job, using real company, dates, and deliverables --- */
  r.jobs.slice(0, 3).forEach(j => {
    if (!j.title) return;
    const org = j.company || j.title.split("|")[0] || "my company";
    const bullets = (j.bullets || []).slice(0, 4);
    const tags = tagFromText(j.title + " " + org + " " + (j.dates || "") + " " + bullets.join(" "), defs);
    add("Walk me through your experience at " + org.trim() + " (" + (j.dates || "dates on resume") + "). What did you own and deliver?",
      "At **" + org.trim() + "** I worked as " + j.title + (j.dates ? " (" + j.dates + ")" : "") + ".\n\n" +
      (bullets.map(b => "- " + b).join("\n") || "- Built and shipped features end to end.") +
      "\n\nI'd emphasize outcomes: automation, fewer errors, faster load, or scale handled.",
      tags, "job");
  });

  /* --- One question per skill from the resume --- */
  defs.forEach(s => {
    add("How have you used " + s.name + "? " + (s.q || "Give a concrete project example with trade-offs and results."),
      skillAnswer(s),
      [s.id], "skill");
  });

  /* --- Education and certifications from the resume --- */
  r.education.slice(0, 2).forEach(ed => {
    add("Walk me through your educational background: " + ed + ". How did it prepare you for a development career?",
      "- **" + ed + "**\n- I'd connect coursework and projects to the skills I use on the job.\n- I've kept learning through certifications and real product work.",
      topIds, "education");
  });
  r.certs.slice(0, 2).forEach(cert => {
    add("You hold " + cert + ". Why did you pursue it and how do you apply it?",
      "- I pursued it to close a specific skill gap.\n- I applied it immediately on a real project.\n- I'd explain what I learned and where I use it in daily work.",
      topIds, "cert");
  });

  /* --- Achievements, with real wording from the resume --- */
  r.achievements.slice(0, 3).forEach(a => {
    add("Tell me about an achievement you're proud of: " + a,
      "- **Context:** what the goal was.\n- **What I did:** the approach and the challenge.\n- **Result:** " + a + ".",
      topIds, "achievement");
  });

  /* --- HR / behavioral questions, personalized with real resume facts --- */
  const automation = (r.achievements.concat(r.summary ? [r.summary] : []))
    .find(a => /automat|manual|transactions|workflow|reduc|save/i.test(a));
  add("Describe a time you automated a workflow or reduced manual work.",
    (automation ? "- From my resume: " + automation + "\n" : "- I'd pick a specific automation I built.\n") +
    "- I'd frame it with STAR: Situation, Task, Action (what I automated and how), Result (hours/time saved, errors reduced).\n" +
    "- Concrete metric where possible.",
    topIds, "behavioral");

  add("Tell me about a difficult bug or production issue you resolved.",
    "I'd pick a real incident" + (projNames.length ? " from " + projNames[0] : "") + ":\n" +
    "- Diagnosed with logs/metrics to find the root cause.\n" +
    "- Fixed it safely with a rollback path, then added a regression test.\n" +
    "- Communicated clearly and documented the lesson.\n" +
    "- Emphasize impact: prevented recurrence and cut errors.",
    topIds, "behavioral");

  add("What are your strengths and weaknesses as a developer?",
    "**Strengths:**\n- " + (topSkills.slice(0, 3).join(", ") || "full-stack engineering") + " — applied in production, not just in tutorials.\n" +
    "- Full-stack ownership: schema to UI to deployment.\n" +
    "- Reliability focus: automation and fewer errors in production.\n\n" +
    "**Weaknesses:**\n- I can over-polish details; I time-box now.\n- I sometimes want to code before requirements are fully confirmed — I write requirements down first.",
    topIds, "behavioral");

  add("Where do you see yourself in five years?",
    "A **senior full stack engineer / technical lead** — still hands-on, but designing architecture and mentoring juniors. " +
    "I want to deepen my " + (topNames || "engineering") + " expertise and own products, not just ship tickets.",
    topIds, "behavioral");

  add("Why should we hire you over other candidates?",
    "- Proven full-stack range: " + (stack || "frontend to backend to deployment") + ".\n" +
    "- I ship complete features with measurable outcomes" + (projNames.length ? " like " + projNames.slice(0, 2).join(" and ") : "") + ".\n" +
    "- I automate and improve reliability, not just build features.",
    topIds, "behavioral");

  add("Do you have any questions for us?",
    "Yes:\n1. What does the first 90 days look like in this role?\n2. How does the team do code review and deployments?\n3. What is the biggest technical challenge in the next year?\n4. Is there room to own architecture and design decisions?",
    topIds, "behavioral");

  personalQs = qs;
}