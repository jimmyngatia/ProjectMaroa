"use strict";

/* ======================================================================
   SETUP: paste the same Apps Script URL you used in script.js
   (this one file is shared by every analysis page)
   ====================================================================== */
const CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbyFOlZ5EP5LzcC77cK1JjYfervyuKeHUvGV97hKNCOWHrk_jTqV6v4zV9aG5byAoueE7A/exec",
};

/* ======================================================================
   QUESTION INFO (matches the ids in script.js; unknown columns are ignored)
   ====================================================================== */
const AGREE = ["Strongly disagree", "Disagree", "Not sure", "Agree", "Strongly agree"];
const PREP = ["Not at all", "Poorly", "Somewhat", "Well", "Very well"];

const META = [
  { id: "age_range", type: "single", short: "Age range", options: ["18–20", "21–23", "24–26", "27–30", "31 and above", "Prefer not to say"] },
  { id: "current_role", type: "single", short: "What best describes you", options: ["University/college student", "Employed", "Self-employed", "In ministry", "Currently not working"] },
  { id: "christian_involvement", type: "single", short: "Christian involvement", options: ["Active in a local church", "Active in Christian Union/campus ministry", "Active in both", "Occasionally involved", "I identify as Christian but am not actively involved"] },
  { id: "relationship_status", type: "single", short: "Relationship status", options: ["Single and not looking", "Single and open to a relationship", "Dating", "In a serious relationship", "Engaged", "Married", "Prefer not to say"] },

  { id: "christian_meaning", type: "text", short: "What makes a relationship Christian" },
  { id: "not_automatic", type: "scale", short: "Two Christians dating isn't automatically a Christian relationship" },
  { id: "dating_purpose", type: "single", short: "Main purpose of Christian dating", options: ["Discerning whether to marry this person", "Growing in Christ together", "Companionship and emotional support", "Preparing for marriage", "There's no single purpose"] },
  { id: "marriage_direction", type: "scale", short: "Dating should always point toward marriage" },

  { id: "readiness_areas", type: "multi", short: "Areas to consider before a relationship", options: ["Spiritual maturity", "Emotional maturity", "Financial responsibility", "Education/career", "Character", "Physical attraction", "Family background", "Ministry/calling", "Communication ability", "Personal healing from past experiences"] },
  { id: "loneliness_pushes", type: "scale", short: "Loneliness pushes people into relationships too early" },

  { id: "top_qualities", type: "multi", short: "Most important qualities in a partner (top 3)", options: ["Genuine faith in Christ", "Character", "Emotional maturity", "Communication", "Physical attraction", "Shared values", "Similar life goals", "Ministry commitment", "Financial responsibility", "Education/intellectual compatibility", "Family background", "Sense of humour/personality"] },
  { id: "attraction_matters", type: "scale", short: "Physical attraction should be a major factor" },
  { id: "ministry_similar", type: "scale", short: "Partners need similar ministry callings" },
  { id: "red_flags", type: "text", short: "Red flags" },

  { id: "wait_for_sign", type: "scale", short: "Wait for a clear sign from God before pursuing someone" },
  { id: "guidance_vs_emotions", type: "text", short: "God's guidance vs. emotions" },

  { id: "friendship_first", type: "scale", short: "Friendship should come before romance" },
  { id: "same_community", type: "scale", short: "Good to pursue someone in your own church or CU" },
  { id: "early_private", type: "scale", short: "Keep early-stage relationships fairly private" },

  { id: "boundaries_matter", type: "multi", short: "Boundaries that matter most before marriage", options: ["Physical touch", "Time alone together", "Late-night calls and texts", "Emotional dependence", "Private messaging and social media", "Where couples spend time", "Finances"] },
  { id: "accountability", type: "scale", short: "Couples should have mentors or accountability partners" },

  { id: "why_fail", type: "multi", short: "Why Christian relationships fail (top 2)", options: ["Poor communication", "Different expectations", "Not being ready", "Crossing physical boundaries", "Spiritual immaturity", "Little outside counsel", "Unhealed past hurts", "Mismatched life goals"] },
  { id: "heartbreak", type: "text", short: "Handling heartbreak" },

  { id: "before_marriage_topics", type: "multi", short: "Topics to discuss before engagement or marriage", options: ["Faith and spiritual life", "Children", "Finances", "Careers", "Education", "Family relationships", "Where to live", "Ministry", "Communication", "Conflict resolution", "Health/disability", "Sexual expectations", "Gender roles", "Household responsibilities"] },

  { id: "church_prepares", type: "scale", rating: true, short: "How well the Church and CUs prepare young people for relationships" },
  { id: "church_missing", type: "multi", short: "What the Church and CUs don't teach enough", options: ["Readiness and singleness", "Choosing a partner", "Boundaries and purity", "Communication", "Handling breakups", "Marriage preparation", "Sexuality", "Mental and emotional health", "Conflict and red flags"] },

  { id: "wish_taught", type: "text", short: "What I wish I'd been taught" },
  { id: "rarely_discussed", type: "text", short: "Rarely discussed topics" },
  { id: "one_lesson", type: "text", bonus: true, short: "One overlooked lesson (bonus)" },
  { id: "healthy_looks_like", type: "text", bonus: true, short: "What a healthy relationship looks like (bonus)" },
  { id: "balance_life", type: "text", bonus: true, short: "Balancing life and a partner (bonus)" },
  { id: "followup_willing", type: "single", short: "Open to a follow-up conversation", options: ["Yes", "Maybe", "No"] },
];
const BY_ID = Object.fromEntries(META.map(m => [m.id, m]));
const SCALES = META.filter(m => m.type === "scale" && !m.rating);
const MULTIS = META.filter(m => m.type === "multi");
const TEXTS = META.filter(m => m.type === "text");
const SINGLES = META.filter(m => m.type === "single");
const WHO = ["age_range", "current_role", "christian_involvement", "relationship_status"];
const MIN_N = 5;

const GROUPS = {
  rel_group: "Relationship (single / in a relationship / married)",
  rel_stage: "Relationship stage (single / dating / serious or engaged / married)",
  involve_group: "Church involvement (active / less involved)",
  involve_level: "Church involvement (active / occasional / not active)",
  involve_where: "Where they're involved (church / CU / both / not regularly)",
  age_group: "Age (18–23 / 24 and over)",
  age_range: "Age range",
  relationship_status: "Relationship status (detailed)",
  christian_involvement: "Involvement (detailed)",
  current_role: "Role",
};

/* Keyword themes for the written answers: a starting map, not a verdict. */
const THEMES = [
  { name: "Prayer and seeking God's will", re: /\b(pray\w*|fast\w*|god'?s will|seek\w* god|guidance|discern\w*|leading)\b/i },
  { name: "Scripture", re: /\b(bible|scripture\w*|biblical|word of god|verse\w*)\b/i },
  { name: "Communication and honesty", re: /\b(communicat\w*|honest\w*|open(ness)?|transparen\w*|listen\w*|conversation\w*|talk\w*)\b/i },
  { name: "Character and maturity", re: /\b(character|matur\w*|integrity|humil\w*|humble|patien\w*|responsib\w*|self-?control|kindness)\b/i },
  { name: "Healing and past hurts", re: /\b(heal\w*|trauma\w*|wound\w*|hurt\w*|insecur\w*|baggage|self-?worth|identity|brokenness)\b/i },
  { name: "Boundaries and purity", re: /\b(boundar\w*|purity|pure|physical|sex\w*|touch\w*|intimacy|chast\w*|temptation|lust)\b/i },
  { name: "Accountability and counsel", re: /\b(accountab\w*|mentor\w*|counsel\w*|elders?|pastor\w*|advice|wise|trusted)\b/i },
  { name: "Marriage and intentionality", re: /\b(marriage|marry\w*|husband|wife|covenant|intentional\w*|purpose\w*)\b/i },
  { name: "Friendship", re: /\b(friend\w*)\b/i },
  { name: "Readiness and timing", re: /\b(ready|readiness|timing|season|wait\w*|singleness|rush\w*)\b/i },
  { name: "Shared values and calling", re: /\b(compatib\w*|values?|goals?|vision|equally yoked|unequally|calling|ministry)\b/i },
  { name: "Unhealthy behaviour (red flags)", re: /\b(control\w*|manipulat\w*|abus\w*|toxic|disrespect\w*|pressur\w*|lies|lying|jealous\w*|anger|violen\w*|porn\w*|addict\w*)\b/i },
  { name: "Emotions vs. God's voice", re: /\b(emotion\w*|feelings?|peace|infatuat\w*|desire\w*|attraction)\b/i },
  { name: "Money and career", re: /\b(financ\w*|money|career|job|provide\w*|stable|stability)\b/i },
  { name: "Family and church community", re: /\b(family|parents?|church|community)\b/i },
];

const STOP = new Set(("about above after again also always among another because been before being both cannot could does doing done each even ever every from have having here into just like make many more most much must never only other over really should since some such than that their them then there these they thing things this those through very want well were what when where which while will with without would your yourself relationship relationships christian christians someone people person").split(" "));

/* ======================================================================
   STATE + HELPERS
   ====================================================================== */
let RAW = [];
let SOURCE = "";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x == null || isNaN(x) ? "–" : Math.round(x * 100) + "%");
const num = (v) => { const n = parseInt(v, 10); return n >= 1 && n <= 5 ? n : null; };
const one = (v) => (v ? (String(v).startsWith("Other") ? "Other" : String(v)) : "");
const list = (v) => (v ? String(v).split(/;\s*/).map(s => s.trim()).filter(Boolean).map(s => (s.startsWith("Other") ? "Other" : s)) : []);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function labelsFor(m) { return m.rating ? PREP : AGREE; }

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function toRows(table) {
  const ids = table[0].map(h => String(h).trim().replace(/^\d+b?_/, ""));
  return table.slice(1).map(r => {
    const o = {};
    ids.forEach((id, i) => { o[id] = String(r[i] ?? "").trim(); });
    return o;
  });
}

function derive(r) {
  SINGLES.forEach(m => {
    const v = r[m.id] || "";
    if (/^Other/.test(v)) r["__o_" + m.id] = v.replace(/^Other:?\s*/, "");
    r[m.id] = one(v);
  });
  const s = r.relationship_status || "";
  const inv = r.christian_involvement || "";
  const age = r.age_range || "";
  r.rel_group = /^Single/.test(s) ? "Single" : /^(Dating|In a serious|Engaged)/.test(s) ? "In a relationship" : s === "Married" ? "Married" : "";
  r.rel_stage = /^Single/.test(s) ? "Single" : s === "Dating" ? "Dating" : /^(In a serious|Engaged)/.test(s) ? "Serious or engaged" : s === "Married" ? "Married" : "";
  r.involve_group = /^Active/.test(inv) ? "Actively involved" : /^(Occasionally|I identify)/.test(inv) ? "Less involved" : inv ? "Other" : "";
  r.involve_level = /^Active/.test(inv) ? "Actively involved" : inv === "Occasionally involved" ? "Occasionally involved" : /^I identify/.test(inv) ? "Not actively involved" : inv ? "Other" : "";
  r.involve_where = inv === "Active in a local church" ? "Local church" : inv === "Active in Christian Union/campus ministry" ? "Christian Union/campus" : inv === "Active in both" ? "Both" : /^(Occasionally|I identify)/.test(inv) ? "Not regularly active" : inv ? "Other" : "";
  r.age_group = /^(18|21)/.test(age) ? "18–23" : /^(24|27|31)/.test(age) ? "24 and over" : "";
}

/* ======================================================================
   STATS
   ====================================================================== */
function scaleStats(rs, id) {
  const vals = rs.map(r => num(r[id])).filter(v => v != null);
  const n = vals.length, counts = [0, 0, 0, 0, 0];
  vals.forEach(v => counts[v - 1]++);
  const mu = mean(vals);
  return { n, counts, mean: mu, agree: n ? (counts[3] + counts[4]) / n : null, dis: n ? (counts[0] + counts[1]) / n : null };
}

function choiceStats(rs, m) {
  const isMulti = m.type === "multi";
  const answered = rs.filter(r => (isMulti ? list(r[m.id]).length : r[m.id]));
  const n = answered.length, c = {};
  (m.options || []).forEach(o => { c[o] = 0; });
  answered.forEach(r => (isMulti ? new Set(list(r[m.id])) : [r[m.id]]).forEach(o => { c[o] = (c[o] || 0) + 1; }));
  const items = Object.entries(c).map(([label, count]) => ({ label, count, pct: n ? count / n : 0 })).sort((a, b) => b.pct - a.pct);
  return { n, items, answered };
}

function otherTexts(rs, m) {
  if (m.type === "multi") {
    return rs.flatMap(r => String(r[m.id] || "").split(/;\s*(?=Other)/)).filter(s => /^Other:/.test(s)).map(s => s.replace(/^Other:\s*/, "").trim()).filter(Boolean);
  }
  return rs.map(r => r["__o_" + m.id]).filter(Boolean);
}

function textItems(rs, qid) {
  const ids = qid === "all" ? TEXTS.map(t => t.id) : [qid];
  const out = [];
  rs.forEach(r => ids.forEach(id => { const t = (r[id] || "").trim(); if (t.length >= 3) out.push({ id, text: t, r }); }));
  return out;
}

function themeCounts(items) {
  return THEMES.map(t => ({ ...t, count: items.filter(i => t.re.test(i.text)).length })).sort((a, b) => b.count - a.count);
}

function wordCounts(items) {
  const c = {};
  items.forEach(i => new Set((i.text.toLowerCase().match(/[a-z']{4,}/g) || []).filter(w => !STOP.has(w))).forEach(w => { c[w] = (c[w] || 0) + 1; }));
  return Object.entries(c).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 30);
}

/* ======================================================================
   RENDER: shared pieces
   ====================================================================== */
function bars(items) {
  return `<div class="bars">${items.map(i => `<div class="bar-row"><div class="bar-label">${esc(i.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${(i.pct * 100).toFixed(1)}%"></div></div><div class="bar-val">${pct(i.pct)}<small>${i.count}</small></div></div>`).join("")}</div>`;
}

function stackBar(st, labels, cls = "stack") {
  return `<div class="${cls}">${st.counts.map((c, i) => { const p = st.n ? c / st.n : 0; return `<span class="seg s${i + 1}" style="width:${(p * 100).toFixed(1)}%" title="${esc(labels[i])}: ${pct(p)}">${p >= 0.09 ? Math.round(p * 100) : ""}</span>`; }).join("")}</div>`;
}

function legend(labels) {
  return labels.map((l, i) => `<span><i class="s${i + 1}"></i>${esc(l)}</span>`).join("");
}

/* ======================================================================
   SAMPLE DATA: made-up answers with a few patterns built in, so you can
   preview every page before real responses arrive.
   ====================================================================== */
function sampleData(n = 90) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pickW = (a, w) => { let t = rnd() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < a.length; i++) { t -= w[i]; if (t <= 0) return a[i]; } return a[a.length - 1]; };
  const phrases = [
    "Putting Christ at the centre, praying together and seeking God's will before big decisions.",
    "Honest communication and being open about your struggles from the start.",
    "Clear boundaries with physical touch, and accountability from trusted mentors.",
    "Being healed from past hurts before entering a relationship, so you don't carry baggage into it.",
    "Character matters more than attraction. Watch how they treat other people.",
    "Wait until you are spiritually and emotionally mature, not just lonely.",
    "Friendship first, then being intentional about marriage.",
    "Controlling behaviour, lying or pressure to cross boundaries are red flags.",
    "Read Scripture together and let the Bible shape your standards.",
    "Talk to your pastor or a mentor before things get serious.",
    "Heartbreak is painful but God is still faithful. Give yourself time to heal.",
    "Shared calling and values, plus financial responsibility, make a difference.",
    "Peace and patience, not just strong feelings, usually point to God's leading.",
    "Churches rarely talk about breakups, mental health or what to do when it ends.",
    "Don't rush. Timing and readiness matter more than we admit.",
  ];
  const multiPick = (m, k, boost = {}) => m.options.map(o => [o, rnd() - (boost[o] || 0)]).sort((a, b) => a[1] - b[1]).slice(0, k).map(x => x[0]);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = {};
    r.age_range = pickW(BY_ID.age_range.options, [.18, .3, .22, .2, .05, .05]);
    const young = r.age_range === "18–20" || r.age_range === "21–23";
    r.current_role = young ? pickW(BY_ID.current_role.options, [.6, .15, .05, .05, .15]) : pickW(BY_ID.current_role.options, [.1, .45, .15, .2, .1]);
    r.christian_involvement = pickW(BY_ID.christian_involvement.options, [.3, .15, .25, .18, .12]);
    const active = /^Active/.test(r.christian_involvement);
    const stW = active ? (young ? [.12, .2, .2, .3, .08, 0, .03] : [.05, .12, .12, .28, .15, .25, .03]) : (young ? [.35, .3, .2, .07, 0, 0, .08] : [.25, .2, .15, .1, .05, .2, .05]);
    r.relationship_status = pickW(BY_ID.relationship_status.options, stW);
    const dating = r.relationship_status === "Dating";
    const serious = /^(In a serious|Engaged)/.test(r.relationship_status);
    const married = r.relationship_status === "Married";
    const adj = {
      wait_for_sign: active ? 0.9 : -0.2,
      marriage_direction: serious || married ? 0.8 : young ? -0.4 : 0.2,
      not_automatic: young ? 0.7 : -0.3,
      friendship_first: dating || serious ? 0.7 : 0,
      early_private: active ? 0.8 : -0.2,
      accountability: active ? 0.7 : -0.2,
      church_prepares: active ? 0.5 : -0.6,
    };
    const boost = {
      readiness_areas: active ? { "Spiritual maturity": 0.5 } : {},
      top_qualities: Object.assign(active ? { "Genuine faith in Christ": 0.6 } : {}, married ? { "Financial responsibility": 0.4 } : {}),
      boundaries_matter: dating || serious ? { "Physical touch": 0.4, "Time alone together": 0.3 } : {},
      why_fail: dating || serious ? { "Crossing physical boundaries": 0.5 } : { "Not being ready": 0.3 },
      church_missing: young ? { "Mental and emotional health": 0.5, "Handling breakups": 0.3 } : {},
    };
    META.forEach((m, idx) => {
      if (r[m.id] !== undefined) return;
      if (m.type === "single") r[m.id] = m.id === "dating_purpose" ? pickW(m.options, active ? [.3, .35, .1, .2, .05] : [.15, .1, .4, .2, .15]) : pick(m.options);
      else if (m.type === "scale") r[m.id] = String(Math.min(5, Math.max(1, Math.round(3 + (rnd() + rnd() - 1) * 2.4 + ((idx % 5) - 2) * 0.35 + (adj[m.id] || 0)))));
      else if (m.type === "multi") r[m.id] = multiPick(m, m.id === "top_qualities" ? 3 : m.id === "why_fail" ? 2 : 1 + Math.floor(rnd() * 4), boost[m.id] || {}).join("; ");
      else if (rnd() < (m.bonus ? 0.4 : 0.75)) {
        const x = rnd();
        const p = active && x < 0.35 ? pick([phrases[0], phrases[8], phrases[9]]) : (dating || serious) && x < 0.35 ? pick([phrases[2], phrases[1]]) : young && x < 0.3 ? pick([phrases[13], phrases[10]]) : pick(phrases);
        r[m.id] = p + (rnd() < 0.4 ? " " + pick(phrases) : "");
      } else r[m.id] = "";
    });
    r.duration_sec = String(Math.round(120 + rnd() * 480));
    r.submitted_at = new Date(Date.now() - rnd() * 9 * 86400000).toISOString();
    rows.push(r);
  }
  return rows;
}

/* ======================================================================
   LOADING: shared by every analysis page.
   Each page calls startData({ init(), render() }) once at the bottom.
   Loaded data is kept in this browser tab (sessionStorage), so moving
   between analysis pages doesn't ask you to load it again.
   ====================================================================== */
function setMsg(t, err) { const m = $("#loadMsg"); if (m) { m.textContent = t; m.classList.toggle("err", !!err); } }

function mountLoader() {
  $("#load").innerHTML = `
    <div id="loadStatus" class="status" hidden>
      <span id="statusText"></span>
      <button type="button" class="btn small" id="changeData">Load different data</button>
    </div>
    <div id="loadCards">
      <h2>Load your responses</h2>
      <p class="note">Pick one. Nothing you load here is sent anywhere except your own Google Sheet. Once loaded, every analysis page in this tab uses the same data.</p>
      <div class="grid3">
        <div class="loadcard">
          <h3>Live from your sheet</h3>
          <p class="note">Uses your Apps Script link and passcode (set in <code>Code.gs</code>).</p>
          <input type="password" id="key" class="field" placeholder="Passcode" autocomplete="off" aria-label="Passcode">
          <button type="button" class="btn primary" id="btnLive">Load responses</button>
        </div>
        <div class="loadcard">
          <h3>Upload a CSV</h3>
          <p class="note">In Google Sheets: <em>File → Download → Comma-separated values (.csv)</em>.</p>
          <label class="btn secondary filebtn">Choose CSV file
            <input type="file" id="file" accept=".csv,text/csv" hidden>
          </label>
        </div>
        <div class="loadcard">
          <h3>Try sample data</h3>
          <p class="note">Made-up answers with a few patterns built in, so you can see what every page does.</p>
          <button type="button" class="btn secondary" id="btnSample">Show sample</button>
        </div>
      </div>
      <p id="loadMsg" class="msg" role="status"></p>
    </div>`;
}

function loadRows(rows, source, page, restoring) {
  const clean = rows.filter(r => Object.values(r).some(v => v !== ""));
  if (!clean.length) { setMsg("That file has no responses yet.", true); return; }
  const snapshot = restoring ? null : JSON.stringify({ source, rows: clean });
  RAW = clean;
  RAW.forEach(derive);
  SOURCE = source;
  $("#loadCards").hidden = true;
  $("#loadStatus").hidden = false;
  $("#statusText").textContent = `Loaded ${RAW.length} response${RAW.length === 1 ? "" : "s"} from ${source}.`;
  $("#dash").hidden = false;
  const sn = $("#snav"); if (sn) sn.hidden = false;
  setMsg("");
  if (page.init) page.init();
  page.render();
  if (!restoring) {
    try { sessionStorage.setItem("survey_data", snapshot); } catch (e) { /* too big or blocked: fine, just load again on the next page */ }
    try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ }
  }
}

async function loadLive(page) {
  const key = $("#key").value.trim();
  if (!CONFIG.ENDPOINT || CONFIG.ENDPOINT.startsWith("PASTE_")) return setMsg("Add your Apps Script URL at the top of data.js first.", true);
  if (!key) return setMsg("Enter your passcode.", true);
  setMsg("Loading…");
  try {
    const res = await fetch(`${CONFIG.ENDPOINT}?action=export&key=${encodeURIComponent(key)}`);
    const j = await res.json();
    if (!j.ok) throw new Error(j.error === "Not authorised" ? "wrong passcode, or ANALYSIS_KEY isn't set in Code.gs" : j.error || "request failed");
    if (!j.rows) throw new Error("the script hasn't been updated yet. Paste the new Code.gs and deploy a new version");
    if (!j.rows.length) return setMsg("The sheet has no responses yet.");
    loadRows(toRows([j.headers, ...j.rows]), "your Google Sheet", page);
  } catch (e) {
    setMsg(`Couldn't load: ${e.message}. You can also download the sheet as CSV and upload it instead.`, true);
  }
}

function startData(page) {
  mountLoader();
  $("#btnLive").onclick = () => loadLive(page);
  $("#key").onkeydown = (e) => { if (e.key === "Enter") loadLive(page); };
  $("#btnSample").onclick = () => loadRows(sampleData(), "sample data", page);
  $("#file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const table = parseCSV(await f.text());
      if (table.length < 2) return setMsg("That file has no responses yet.", true);
      loadRows(toRows(table), `file “${f.name}”`, page);
    } catch (err) { setMsg("Couldn't read that file. Make sure it's the CSV downloaded from your sheet.", true); }
    e.target.value = "";
  };
  $("#changeData").onclick = () => {
    $("#loadCards").hidden = false; $("#loadStatus").hidden = true; $("#dash").hidden = true;
    const sn = $("#snav"); if (sn) sn.hidden = true;
  };
  try {
    const s = JSON.parse(sessionStorage.getItem("survey_data") || "null");
    if (s && s.rows && s.rows.length) loadRows(s.rows, s.source, page, true);
  } catch (e) { /* nothing saved */ }
}