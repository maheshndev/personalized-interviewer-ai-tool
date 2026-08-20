"use strict";

/* ==================================================================
   Personalized question generation
   Every question is built from the user's actual resume data.
================================================================== */
function skillAnswer(s) {
  const P = APP.templates.personalized;
  if (s.a) return fill(P.skillA, { answer: s.a });
  return fill(P.skillAFallback, { name: s.name });
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
  const P = APP.templates.personalized;

  const qs = [];
  let id = 1;
  const add = (question, answer, tags, kind) => {
    const qid = id++;
    qs.push({ id: qid, key: "p" + qid, question, answer, tags: tags || [], section: P.section, kind: kind || "" });
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
  add(P.introQ,
    fill(P.introA, {
      name, title: title ? " — " + title : "", years: yearsExp ? ", with **" + yearsExp + " years** of professional experience" : "",
      summary: r.summary ? "- " + r.summary + "\n" : "",
      topSkills: topSkills.join(", ") || "see my resume",
      projects: projNames.join(", ") || "several production projects delivered end to end"
    }),
    topIds, "intro");

  /* --- One question per project, filled with its real data --- */
  r.projects.slice(0, 5).forEach(p => {
    const pname = cleanProjName(p.name);
    if (!pname) return;
    const bullets = (p.bullets || []).slice(0, 3);
    const tags = tagFromText(pname + " " + (p.tech || "") + " " + bullets.join(" "), defs);
    add(fill(P.projectQ, { name: pname }),
      fill(P.projectA, {
        name: pname,
        tech: p.tech ? "- **Tech stack:** " + p.tech + "\n" : "",
        bullets: bullets.length ? bullets.map(b => "- " + b).join("\n") + "\n" : "",
        impact: p.impact ? "- **Impact:** " + p.impact + "\n" : ""
      }),
      tags, "project");
    const tech = (p.tech || "").trim();
    if (tech) {
      add(fill(P.projectWhyQ, { tech: tech.split(/[,\n]/)[0].trim(), name: pname }),
        fill(P.projectWhyA, { requirement: bullets[0] || "a clear business problem", tech }),
        tags, "project");
    }
  });

  /* --- One question per job, using real company, dates, and deliverables --- */
  r.jobs.slice(0, 3).forEach(j => {
    if (!j.title) return;
    const org = j.company || j.title.split("|")[0] || "my company";
    const bullets = (j.bullets || []).slice(0, 4);
    const tags = tagFromText(j.title + " " + org + " " + (j.dates || "") + " " + bullets.join(" "), defs);
    add(fill(P.jobQ, { org: org.trim(), dates: j.dates || "dates on resume" }),
      fill(P.jobA, {
        org: org.trim(), title: j.title, dates: j.dates ? " (" + j.dates + ")" : "",
        bullets: bullets.map(b => "- " + b).join("\n") || "- Built and shipped features end to end."
      }),
      tags, "job");
  });

  /* --- One question per skill from the resume --- */
  defs.forEach(s => {
    add(fill(P.skillQ, { name: s.name, question: s.q || "Give a concrete project example with trade-offs and results." }),
      skillAnswer(s),
      [s.id], "skill");
  });

  /* --- Education and certifications from the resume --- */
  r.education.slice(0, 2).forEach(ed => {
    add(fill(P.eduQ, { edu: ed }), fill(P.eduA, { edu: ed }), topIds, "education");
  });
  r.certs.slice(0, 2).forEach(cert => {
    add(fill(P.certQ, { cert }), P.certA, topIds, "cert");
  });

  /* --- Achievements, with real wording from the resume --- */
  r.achievements.slice(0, 3).forEach(a => {
    add(fill(P.achievementQ, { achievement: a }), fill(P.achievementA, { achievement: a }), topIds, "achievement");
  });

  /* --- HR / behavioral questions, personalized with real resume facts --- */
  const automation = (r.achievements.concat(r.summary ? [r.summary] : []))
    .find(a => /automat|manual|transactions|workflow|reduc|save/i.test(a));
  add(P.autoQ,
    fill(P.autoA, { fromResume: automation ? "- From my resume: " + automation + "\n" : "- I'd pick a specific automation I built.\n" }),
    topIds, "behavioral");

  add(P.bugQ,
    fill(P.bugA, { fromProject: projNames.length ? " from " + projNames[0] : "" }),
    topIds, "behavioral");

  add(P.strengthsQ,
    fill(P.strengthsA, { topSkills: topSkills.slice(0, 3).join(", ") || "full-stack engineering" }),
    topIds, "behavioral");

  add(P.fiveYearsQ,
    fill(P.fiveYearsA, { topNames: topNames || "engineering" }),
    topIds, "behavioral");

  add(P.hireQ,
    fill(P.hireA, {
      stack: stack || "frontend to backend to deployment",
      projects: projNames.length ? " like " + projNames.slice(0, 2).join(" and ") : ""
    }),
    topIds, "behavioral");

  add(P.questionsQ, P.questionsA, topIds, "behavioral");

  personalQs = qs;
}