"use strict";

/* ==================================================================
   Skill knowledge base (id, name, keywords, sample technical Q&A)
   data/skills.json is loaded at startup over HTTP; this inline map is
   the offline/file:// fallback so the app always works.
================================================================== */
let SKILL_MAP = {
  python:     { id: "python",     name: "Python",     kw: ["python"], q: "What are decorators, generators, and context managers in Python?", a: "Decorators wrap functions to add cross-cutting behavior (auth, logging). Generators yield lazily, so big data never loads fully into memory. Context managers (`with open(...)`) guarantee cleanup even on errors. I use all three daily in FastAPI/Flask and Frappe hooks." },
  javascript: { id: "javascript", name: "JavaScript", kw: ["javascript", "js"], q: "Explain closures, the event loop, and hoisting in JavaScript.", a: "Closures let an inner function keep access to its outer scope. The event loop pulls callbacks from the message queue only when the call stack is empty, which is how async works. Hoisting moves declarations to the top; `let`/`const` still sit in the temporal dead zone. This underpins everything I write in the browser." },
  typescript: { id: "typescript", name: "TypeScript", kw: ["typescript", "ts"], q: "How do generics and type narrowing make code safer?", a: "Generics let one function serve many types with full type-checking; narrowing (`typeof`, `instanceof`, discriminated unions) refines types inside branches. With strict mode, a whole class of runtime bugs becomes compile-time errors. I used it heavily in the Angular and Resume Lens apps." },
  angular:    { id: "angular",    name: "Angular",    kw: ["angular"], q: "How does change detection work in Angular?", a: "Angular re-checks bindings after events. OnPush limits checks to input changes or observable emissions, with manual `ChangeDetectorRef.markForCheck` when needed. I pair OnPush with BehaviorSubject + async pipe and got a 25% load-time gain on the sales app." },
  vue:        { id: "vue",        name: "Vue.js",     kw: ["vue", "vuejs", "vue.js"], q: "Composition API vs Options API — when would you choose each?", a: "Composition API (script setup) groups logic by feature with ref/reactive/computed and scales better for complex components. Options API is simpler for tiny components. I default to Composition API for anything non-trivial." },
  react:      { id: "react",      name: "React",      kw: ["react", "reactjs", "react.js"], q: "Explain reconciliation and why keys matter.", a: "React diffs the virtual DOM against the previous tree and patches only the changed nodes. Keys help it match elements across renders; stable keys prevent unnecessary remounts and state loss. I built a resume-vetting tool in React + TypeScript." },
  nodejs:     { id: "nodejs",     name: "Node.js",    kw: ["node", "nodejs", "node.js", "express"], q: "How does the Node.js event loop work?", a: "Node runs JavaScript on one thread while libuv handles I/O via the event loop (timers, poll, check phases). Blocking sync code stalls the loop, so I keep handlers async and push CPU-heavy work to worker threads or a queue. I build REST APIs on Express and Fastify." },
  fastapi:    { id: "fastapi",    name: "FastAPI",    kw: ["fastapi"], q: "What does FastAPI give you over Flask?", a: "Pydantic validation, automatic OpenAPI docs, and native async. Request/response models are typed and validated at the boundary, so bad payloads fail fast. I use it for clean, self-documenting services." },
  flask:      { id: "flask",      name: "Flask",      kw: ["flask"], q: "How do you structure a Flask app so it scales?", a: "Blueprints per domain, an app factory, and extensions for DB/auth, keeping business logic out of views. I applied this pattern on the e-commerce and HRMS modules so features could be added without tangled routes." },
  django:     { id: "django",     name: "Django",     kw: ["django"], q: "When does the Django ORM help, and when does it fight you?", a: "It maps classes to tables with migrations and a built-in admin — great for CRUD-heavy apps. On complex reporting queries it produces poor SQL, so I drop to raw SQL or views when the plan matters." },
  sql:        { id: "sql",        name: "SQL",        kw: ["sql", "mysql", "postgresql", "postgres", "mariadb"], q: "Write a query to find duplicates in a table.", a: "`SELECT col, COUNT(*) FROM t GROUP BY col HAVING COUNT(*) > 1;`. For ranked or deduped results I use window functions, and I always check the plan with EXPLAIN before trusting a query at scale." },
  mongodb:    { id: "mongodb",    name: "MongoDB",    kw: ["mongodb", "mongo", "nosql"], q: "When would you choose MongoDB over a relational database?", a: "Flexible documents, high write throughput, and horizontal scaling. I pick it when the document shape maps directly to the domain. For transactional integrity and complex joins, a relational DB wins." },
  redis:      { id: "redis",      name: "Redis",      kw: ["redis"], q: "How do you use Redis in a web app?", a: "Caching hot reads (sessions, config, computed results) with TTLs, plus queues via lists/streams and rate limiting. Invalidation is the hard part — I version keys and expire aggressively so stale data self-heals." },
  docker:     { id: "docker",     name: "Docker",     kw: ["docker"], q: "Dockerfile vs docker-compose vs Kubernetes?", a: "A Dockerfile defines one image; compose orchestrates containers on a single host; Kubernetes schedules across a cluster. I use multi-stage builds to keep images small and compose for repeatable local dev." },
  kubernetes: { id: "kubernetes", name: "Kubernetes", kw: ["kubernetes", "k8s"], q: "Explain Pods, Deployments, and Services.", a: "A Pod is the smallest schedulable unit. Deployments manage replica counts and rolling updates. Services give stable networking across a pod set, and Ingress routes external traffic. Together they make deployments self-healing." },
  aws:        { id: "aws",        name: "AWS",        kw: ["aws", "amazon web"], q: "How do you secure an EC2 instance?", a: "IAM roles instead of long-lived keys, security groups open only on needed ports, private subnets in a VPC, and encryption at rest. I deployed the ERP on EC2 behind Nginx with automated backups and tested restores." },
  git:        { id: "git",        name: "Git",        kw: ["git", "github", "gitlab", "version control"], q: "How do you resolve a merge conflict?", a: "I read both sides and resolve deliberately — never blindly. Feature branches, small PRs, and rebasing onto main keep conflicts rare. When they happen, a quick conversation with the other author usually clarifies intent." },
  linux:      { id: "linux",      name: "Linux",      kw: ["linux", "ubuntu", "bash", "shell"], q: "How do you diagnose a slow server?", a: "Top/free for CPU and memory, df for disk, journalctl for logs, and network checks for latency. I gather metrics, reproduce under load, find the bottleneck, fix it, and verify the improvement." },
  nginx:      { id: "nginx",      name: "Nginx",      kw: ["nginx"], q: "What is Nginx typically used for?", a: "Reverse proxy, TLS termination, static file serving, and load balancing. I put it in front of Gunicorn/Node to handle encryption and serve static assets without tying up app workers." },
  frappe:     { id: "frappe",     name: "Frappe / ERPNext", kw: ["frappe", "erpnext"], q: "How do you add a custom field to a DocType safely?", a: "Via the app's custom fields or a dedicated app's JSON, and controllers are overridden through hooks rather than core edits — so framework upgrades don't break my customization. Permissions are enforced at the DocType level." },
  html:       { id: "html",       name: "HTML & CSS", kw: ["html", "css", "tailwind", "bootstrap", "sass"], q: "Explain responsive design fundamentals.", a: "Fluid grids, flexible images, and media queries — or modern grid/flexbox. I use Tailwind for utility-first layout and always check accessibility: semantic tags, focus states, and contrast." },
  java:       { id: "java",       name: "Java / Spring", kw: ["java", "spring", "hibernate", "jpa"], q: "What is dependency injection in Spring?", a: "The container creates and injects beans instead of the class instantiating them — inversion of control. That makes components loosely coupled and easily testable with mocks." },
  php:        { id: "php",        name: "PHP",        kw: ["php", "laravel"], q: "How do PHP sessions and CSRF protection work?", a: "Sessions keep state across requests via a server-side store keyed by a cookie. CSRF tokens verify that form submissions originate from the same origin — I always validate tokens server-side on state-changing routes." },
  rest:       { id: "rest",       name: "REST APIs",  kw: ["rest", "api", "api design", "restful"], q: "How do you design a clean REST API?", a: "Resources as nouns, HTTP verbs for actions, correct status codes, pagination, versioning, and request validation. Writes that can be retried are made idempotent so clients can safely retry on timeout." },
  testing:    { id: "testing",    name: "Testing",    kw: ["jest", "pytest", "cypress", "testing", "test", "mocha", "selenium", "unittest"], q: "What makes a good unit test?", a: "Isolated, fast, deterministic, and focused on behavior, not implementation. I test the contract — given inputs produce expected outputs — and mock the boundaries like DB and HTTP." },
  cicd:       { id: "cicd",       name: "CI/CD",      kw: ["ci/cd", "cicd", "jenkins", "github actions", "gitlab ci", "pipeline", "deploy", "deployment"], q: "Describe a CI/CD pipeline you would set up.", a: "On push: lint, test, build, scan. Then deploy to staging, run smoke tests, and promote to production behind a feature flag. Rollback is a single command, and secrets live in the CI store, never in the repo." }
};

/* ==================================================================
   Role knowledge base
   Each role maps to the skill tags and/or section keywords it covers.
   data/roles.json is loaded at startup; this is the offline fallback.
================================================================== */
let ROLE_DEFS = [
  { id: "fullstack", name: "Full Stack", skills: ["javascript", "typescript", "html", "angular", "react", "vue", "python", "nodejs", "fastapi", "flask", "django", "java", "php", "rest", "sql", "mongodb", "redis", "git", "docker", "aws"], sections: /full.?stack|general|project/i },
  { id: "frontend", name: "Frontend", skills: ["javascript", "typescript", "html", "angular", "react", "vue"], sections: /html|css|javascript|angular|vue|react|frontend|web component/i },
  { id: "backend", name: "Backend", skills: ["python", "nodejs", "fastapi", "flask", "django", "java", "php", "rest", "sql", "mongodb", "redis"], sections: /python|node|java|php|backend|database|sql|nosql|redis|caching|api|server/i },
  { id: "devops", name: "DevOps / Cloud", skills: ["docker", "kubernetes", "aws", "linux", "nginx", "git", "cicd"], sections: /cloud|devops|docker|container|kubernetes|linux|ci\/cd|aws|deploy/i },
  { id: "database", name: "Database", skills: ["sql", "mongodb", "redis"], sections: /database|sql|nosql|mongodb|redis|caching/i },
  { id: "erp", name: "ERP / Frappe", skills: ["frappe"], sections: /frappe|erpnext|erp/i },
  { id: "testing", name: "QA / Testing", skills: ["testing"], sections: /testing|qa|quality/i },
  { id: "dsa", name: "DSA / Algorithms", skills: [], sections: /algorithm|data structure|problem solving|machine coding|coding challenge/i }
];

/* Which roles the user's resume points to (from title, summary, skills). */
function detectRoles(text) {
  if (!text.trim()) return [];
  const low = " " + text.toLowerCase() + " ";
  const r = parseResume(text);
  const hay = low + " " + (r.title || "") + " " + r.summary + " " + r.skills.join(" ") + " " + r.jobs.map(j => j.title).join(" ");
  return ROLE_DEFS
    .filter(def => {
      if (new RegExp("\\b" + escRe(def.name.toLowerCase()) + "\\b").test(hay)) return true;
      if (def.id === "fullstack" && /full.?stack/.test(hay)) return true;
      if (def.id === "frontend" && /front.?end/.test(hay)) return true;
      if (def.id === "backend" && /back.?end/.test(hay)) return true;
      if (def.id === "erp" && /erp|frappe|erpnext/.test(hay)) return true;
      if (def.id === "testing" && /qa|testing|test engineer|quality/.test(hay)) return true;
      if (def.id === "dsa" && /dsa|algorithm|data structure|problem solving|competitive programming/.test(hay)) return true;
      return def.skills.some(s => new RegExp("\\b" + escRe(s) + "\\b").test(low));
    })
    .map(d => d.id);
}

/* ==================================================================
   Skill detection
================================================================== */
function detectSkills(text) {
  if (!text.trim()) return [];
  const low = " " + text.toLowerCase() + " ";
  const map = new Map();
  for (const s of Object.values(SKILL_MAP)) {
    for (const k of s.kw) {
      if (new RegExp("\\b" + escRe(k.toLowerCase()) + "\\b").test(low)) {
        map.set(s.id, { id: s.id, name: s.name, kw: s.kw, q: s.q, a: s.a });
        break;
      }
    }
  }
  const r = parseResume(text);
  const known = new Set(map.keys());
  r.skills.forEach(s => {
    const id = normSkill(s);
    const name = s.replace(/\s+/g, " ").trim();
    if (!id || id.length < 2 || id.length > 40 || known.has(id)) return;
    if ([...map.values()].some(v => v.name.toLowerCase() === name.toLowerCase())) return;
    map.set(id, { id, name, kw: [name.toLowerCase()], q: null, a: null });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function tagFromText(text, defs) {
  if (!text) return [];
  const low = " " + text.toLowerCase() + " ";
  const ids = [];
  defs.forEach(s => {
    for (const k of s.kw) {
      if (new RegExp("\\b" + escRe(k.toLowerCase()) + "\\b").test(low)) { ids.push(s.id); break; }
    }
  });
  return ids;
}

/* ==================================================================
   Data-driven skill & role definitions (data/skills.json, data/roles.json)
   Loaded over HTTP; keeps the inline defaults when offline (file://).
================================================================== */
async function loadSkillData() {
  try {
    const res = await fetch("data/skills.json", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      if (j && typeof j === "object" && Object.keys(j).length) SKILL_MAP = j;
    }
  } catch (e) { /* offline — keep inline defaults */ }
  try {
    const res = await fetch("data/roles.json", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j) && j.length) {
        ROLE_DEFS = j.map(r => ({
          id: r.id,
          name: r.name,
          skills: Array.isArray(r.skills) ? r.skills : [],
          sections: r.sections ? new RegExp(r.sections, "i") : null
        }));
      }
    }
  } catch (e) { /* offline — keep inline defaults */ }
}