"use strict";

/* ==================================================================
   Global state (persisted in localStorage)
================================================================== */
const LS = {
  resume: "ppp.resume",
  skills: "ppp.skills",
  roles: "ppp.roles",
  prepared: "ppp.prepared",
  bookmarked: "ppp.bookmarked",
  review: "ppp.review",
  diff: "ppp.diff",
  bank: "ppp.bank",
  ai: "ppp.ai",
  apiKey: "ppp.apiKey"
};

const $ = id => document.getElementById(id);
const safeParse = (k, fb) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; }
  catch (e) { return fb; }
};

let resumeText = localStorage.getItem(LS.resume) || "";
let selectedSkills = new Set(safeParse(LS.skills, []));
let roleSel = new Set(safeParse(LS.roles, []));
let userRoles = [];
let prepared = new Set(safeParse(LS.prepared, []));
let bookmarked = new Set(safeParse(LS.bookmarked, []));
let review = new Set(safeParse(LS.review, []));
let diff = safeParse(LS.diff, {});

let personalQs = [];
let aiQs = safeParse(LS.ai, []);
let bankQs = [];
let skillDefs = [];
let activeTab = "personal";
let activeSection = "All";
let searchTerm = "";
let statusSel = new Set();
let diffSel = new Set();
let sortMode = "num";
let lastSavedAt = null;

let searchTimer = null;
let saveTimer = null;
let toastTimer = null;

let BANK_FILES = [
  "data/questions.json",
  "questions.json",
  "Full_Stack_Developer_Interview_Questions.md",
  "Mahesh_Interview_Questions.md"
];