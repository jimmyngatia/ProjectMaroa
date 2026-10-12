"use strict";

/* ======================================================================
   1. SETUP: paste your Google Apps Script "Web app" URL here
   ====================================================================== */
const CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbyFOlZ5EP5LzcC77cK1JjYfervyuKeHUvGV97hKNCOWHrk_jTqV6v4zV9aG5byAoueE7A/exec",
};

/* ======================================================================
   2. QUESTIONS
   type: single | multi | scale | text
   other: true  -> adds an "Other" option with a text box
   max:   limit for multi-select
   bonus: true  -> only shown if the person opts in to the bonus round
   Each id becomes a column in your Google Sheet (numbered by order).
   ====================================================================== */
const AGREE = ["Strongly disagree", "Disagree", "Not sure", "Agree", "Strongly agree"];
const PREP = ["Not at all", "Poorly", "Somewhat", "Well", "Very well"];
const ALL = "Pick all that apply.";

const SCREENS = [
  { type: "intro" },

  /* ---- About you ---- */
  { id: "age_range", section: "About you", type: "single", q: "What's your age range?",
    options: ["18–20", "21–23", "24–26", "27–30", "31 and above", "Prefer not to say"] },
  { id: "current_role", section: "About you", type: "single", q: "What best describes you?",
    options: ["University/college student", "Employed", "Self-employed", "In ministry", "Currently not working"], other: true },
  { id: "christian_involvement", section: "About you", type: "single", q: "How would you describe your Christian involvement?",
    options: ["Active in a local church", "Active in Christian Union/campus ministry", "Active in both", "Occasionally involved", "I identify as Christian but am not actively involved"], other: true },
  { id: "relationship_status", section: "About you", type: "single", q: "What's your current relationship status?",
    options: ["Single and not looking", "Single and open to a relationship", "Dating", "In a serious relationship", "Engaged", "Married", "Prefer not to say"] },

  /* ---- What makes it Christian ---- */
  { id: "christian_meaning", section: "What makes it Christian", type: "text",
    q: "In your own words, what makes a relationship between two Christians genuinely Christian?",
    hint: "A sentence or two is plenty." },
  { id: "not_automatic", section: "What makes it Christian", type: "scale",
    q: "Two Christians dating is not automatically a Christian relationship." },
  { id: "dating_purpose", section: "What makes it Christian", type: "single",
    q: "What should be the main purpose of Christian dating?",
    options: ["Discerning whether to marry this person", "Growing in Christ together", "Companionship and emotional support", "Preparing for marriage", "There's no single purpose"], other: true },
  { id: "marriage_direction", section: "What makes it Christian", type: "scale",
    q: "Christian dating should always have marriage as its eventual direction." },

  /* ---- Readiness ---- */
  { id: "readiness_areas", section: "Readiness", type: "multi", hint: ALL,
    q: "Which areas of life should someone look at before entering a relationship?",
    options: ["Spiritual maturity", "Emotional maturity", "Financial responsibility", "Education/career", "Character", "Physical attraction", "Family background", "Ministry/calling", "Communication ability", "Personal healing from past experiences"], other: true },
  { id: "loneliness_pushes", section: "Readiness", type: "scale",
    q: "Loneliness or the desire for companionship often pushes Christians into relationships before they're ready." },

  /* ---- Choosing a partner ---- */
  { id: "top_qualities", section: "Choosing a partner", type: "multi", max: 3, hint: "Pick up to 3.",
    q: "Which three qualities matter most when choosing a Christian partner?",
    options: ["Genuine faith in Christ", "Character", "Emotional maturity", "Communication", "Physical attraction", "Shared values", "Similar life goals", "Ministry commitment", "Financial responsibility", "Education/intellectual compatibility", "Family background", "Sense of humour/personality"], other: true },
  { id: "attraction_matters", section: "Choosing a partner", type: "scale",
    q: "Physical attraction should be a major factor when choosing a partner." },
  { id: "ministry_similar", section: "Choosing a partner", type: "scale",
    q: "Two people need similar ministry interests or calling for a relationship to succeed." },
  { id: "red_flags", section: "Choosing a partner", type: "text",
    q: "What red flags should make a Christian reconsider a relationship?",
    hint: "List a few, or write a sentence." },

  /* ---- Seeking God's will ---- */
  { id: "wait_for_sign", section: "Seeking God's will", type: "scale",
    q: "A Christian should wait for a clear sign or confirmation from God before pursuing someone." },
  { id: "guidance_vs_emotions", section: "Seeking God's will", type: "text",
    q: "How can someone tell the difference between God's guidance and their own emotions or desires?" },

  /* ---- Approaching someone ---- */
  { id: "friendship_first", section: "Approaching someone", type: "scale",
    q: "Friendship should come before romance." },
  { id: "same_community", section: "Approaching someone", type: "scale",
    q: "It's a good idea to pursue someone within your own church or Christian Union." },
  { id: "early_private", section: "Approaching someone", type: "scale",
    q: "In the early stages, a relationship should be kept fairly private." },

  /* ---- Boundaries ---- */
  { id: "boundaries_matter", section: "Boundaries", type: "multi", hint: ALL,
    q: "Which boundaries matter most for Christian couples before marriage?",
    options: ["Physical touch", "Time alone together", "Late-night calls and texts", "Emotional dependence", "Private messaging and social media", "Where couples spend time", "Finances"], other: true },
  { id: "accountability", section: "Boundaries", type: "scale",
    q: "Couples should have mentors or accountability partners involved in their relationship." },

  /* ---- When things go wrong ---- */
  { id: "why_fail", section: "When things go wrong", type: "multi", max: 2, hint: "Pick up to 2.",
    q: "Why do Christian relationships sometimes fail even when both people love God?",
    options: ["Poor communication", "Different expectations", "Not being ready", "Crossing physical boundaries", "Spiritual immaturity", "Little outside counsel", "Unhealed past hurts", "Mismatched life goals"], other: true },
  { id: "heartbreak", section: "When things go wrong", type: "text",
    q: "How should Christians handle rejection, heartbreak or a relationship ending?" },

  /* ---- Towards marriage ---- */
  { id: "before_marriage_topics", section: "Towards marriage", type: "multi", hint: ALL,
    q: "Which issues should couples discuss before engagement or marriage?",
    options: ["Faith and spiritual life", "Children", "Finances", "Careers", "Education", "Family relationships", "Where to live", "Ministry", "Communication", "Conflict resolution", "Health/disability", "Sexual expectations", "Gender roles", "Household responsibilities"], other: true },

  /* ---- The Church ---- */
  { id: "church_prepares", section: "The church", type: "scale", labels: PREP,
    q: "How well do the Church and Christian Unions prepare young people for relationships?", hint: "Tap the number that fits best." },
  { id: "church_missing", section: "The church", type: "multi", hint: ALL,
    q: "What do they not teach enough about?",
    options: ["Readiness and singleness", "Choosing a partner", "Boundaries and purity", "Communication", "Handling breakups", "Marriage preparation", "Sexuality", "Mental and emotional health", "Conflict and red flags"], other: true },

  /* ---- Reflection ---- */
  { id: "wish_taught", section: "Reflection", type: "text",
    q: "What do you wish someone had taught you before you entered, or considered entering, a relationship?" },
  { id: "rarely_discussed", section: "Reflection", type: "text",
    q: "Is there anything about Christian relationships that Christians need to discuss but rarely do?" },

  { type: "gate" },

  /* ---- Bonus round (opt-in) ---- */
  { id: "one_lesson", bonus: true, section: "Bonus round", type: "text",
    q: "If you could teach Christian young people one overlooked lesson about relationships, what would it be?" },
  { id: "healthy_looks_like", bonus: true, section: "Bonus round", type: "text",
    q: "What would a truly Christ-centred, healthy and mature relationship look like?" },
  { id: "balance_life", bonus: true, section: "Bonus round", type: "text",
    q: "How should someone balance God, studies or career, ministry, family, friends and a partner?" },

  /* ---- Follow-up ---- */
  { id: "followup_willing", section: "One last thing", type: "followup",
    q: "Would you be open to a follow-up conversation about Christian relationships?" },
];

/* ======================================================================
   3. APP
   ====================================================================== */
const state = { i: 0, answers: {}, other: {}, wantBonus: null, started: Date.now(), timer: null, sending: false, demo: false };
const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const visible = () => SCREENS.filter(s => !s.bonus || state.wantBonus === true);

function go(delta) {
  clearTimeout(state.timer);
  const max = visible().length - 1;
  state.i = Math.max(0, Math.min(max, state.i + delta));
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function hasAnswer(s) {
  const v = state.answers[s.id];
  if (s.type === "multi") return Array.isArray(v) && v.length > 0;
  if (s.type === "scale") return typeof v === "number";
  if (s.type === "text") return typeof v === "string" && v.trim() !== "";
  return Boolean(v);
}

function render() {
  const list = visible();
  const s = list[state.i];
  const screen = $("#screen");
  screen.replaceChildren();
  screen.style.animation = "none"; void screen.offsetWidth; screen.style.animation = "";

  $("#top").hidden = s.type === "intro";
  $("#nav").hidden = s.type === "intro";
  $("#next").hidden = s.type === "gate";

  if (s.type === "intro") renderIntro(screen);
  else if (s.type === "gate") renderGate(screen);
  else {
    screen.append(el("span", "chip", s.section));
    const h = el("h1", "", s.q);
    h.tabIndex = -1;
    screen.append(h);
    if (s.hint || s.type === "scale") screen.append(el("p", "hint", s.hint || "How much do you agree?"));
    else screen.append(el("div", "q-gap"));
    if (s.type === "single" || s.type === "multi") renderChoice(screen, s);
    else if (s.type === "scale") renderScale(screen, s);
    else if (s.type === "text") renderText(screen, s);
    else if (s.type === "followup") renderFollowup(screen, s);
    h.focus({ preventScroll: true });
  }
  updateProgress(s, list);
  updateNav(s);
}

function updateProgress(s, list) {
  const qs = list.filter(x => x.id);
  const done = list.slice(0, state.i).filter(x => x.id).length;
  const pct = qs.length ? done / qs.length : 0;
  $("#fill").style.width = Math.round(pct * 100) + "%";
  $("#bar").setAttribute("aria-valuenow", Math.round(pct * 100));
  $("#section").textContent = s.section || "Almost done";
  $("#count").textContent = s.id ? `${done + 1} of ${qs.length}` : "";
  $("#cheer").textContent = pct < 0.25 ? "" : pct < 0.5 ? "A quarter done." : pct < 0.75 ? "Over halfway." : "Nearly there.";
}

function updateNav(s) {
  const next = $("#next");
  next.disabled = false;
  if (s.type === "followup") next.textContent = state.sending ? "Sending…" : "Send my answers";
  else next.textContent = hasAnswer(s) ? "Next" : "Skip";
}

/* ---------- intro / gate ---------- */
function renderIntro(root) {
  const box = el("div", "hero");
  box.append(el("h1", "", "Christian relationships"));
  box.append(el("p", "sub", "Perspectives, experiences and insights from Christian youth"));
  box.append(el("p", "", "This survey is about how young Christians think about dating, courtship, love, marriage, boundaries, ministry and the challenges that come with them."));
  box.append(el("p", "", "There are no right or wrong answers, and you don't need to give the \"correct\" Christian answer. Honest thoughts are what help most."));
  const ul = el("ul", "badges");
  ["About 5 minutes", "No name needed", "Skip anything you like"].forEach(t => ul.append(el("li", "", t)));
  box.append(ul);
  const start = el("button", "btn primary", "Start");
  start.type = "button";
  start.onclick = () => go(1);
  box.append(start);
  root.append(box);
}

function renderGate(root) {
  const box = el("div", "hero");
  box.append(el("span", "chip", "Almost done"));
  const h = el("h1", "", "Thank you. That's the main part done.");
  h.tabIndex = -1;
  box.append(h);
  box.append(el("p", "", "Want to go a little deeper? There are 3 optional written questions. They help a lot, but you can skip them."));
  const stack = el("div", "stack");
  const yes = el("button", "btn primary", "Yes, 3 more questions");
  const no = el("button", "btn secondary", "No, take me to the end");
  yes.type = no.type = "button";
  yes.onclick = () => { state.wantBonus = true; go(1); };
  no.onclick = () => { state.wantBonus = false; go(1); };
  stack.append(yes, no);
  box.append(stack);
  root.append(box);
  h.focus({ preventScroll: true });
}

/* ---------- single / multi choice ---------- */
function renderChoice(root, s) {
  const multi = s.type === "multi";
  const labels = s.other ? [...s.options, "Other"] : s.options;
  const wrap = el("div", "options");
  wrap.setAttribute("role", multi ? "group" : "radiogroup");
  wrap.setAttribute("aria-label", s.q);
  const note = el("p", "count-note");
  const otherBox = el("input", "field other-input");
  otherBox.type = "text";
  otherBox.maxLength = 200;
  otherBox.placeholder = "Please specify";
  otherBox.setAttribute("aria-label", "Other, please specify");
  otherBox.value = state.other[s.id] || "";
  otherBox.oninput = () => { state.other[s.id] = otherBox.value; };

  const isSel = (label) => multi ? (state.answers[s.id] || []).includes(label) : state.answers[s.id] === label;
  const refresh = () => {
    wrap.querySelectorAll(".opt").forEach(b => {
      const on = isSel(b.dataset.v);
      b.classList.toggle("sel", on);
      b.setAttribute("aria-checked", on);
    });
    otherBox.hidden = !isSel("Other");
    if (s.max) {
      const n = (state.answers[s.id] || []).length;
      note.textContent = `${n} of ${s.max} chosen`;
    }
    updateNav(s);
  };

  labels.forEach(label => {
    const b = el("button", "opt" + (multi ? " multi" : ""));
    b.type = "button";
    b.dataset.v = label;
    b.setAttribute("role", multi ? "checkbox" : "radio");
    b.append(el("span", "mark"), el("span", "", label));
    b.onclick = () => {
      if (multi) {
        const cur = state.answers[s.id] || [];
        if (cur.includes(label)) state.answers[s.id] = cur.filter(x => x !== label);
        else if (s.max && cur.length >= s.max) {
          b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge");
          return;
        } else state.answers[s.id] = [...cur, label];
        refresh();
        if (label === "Other" && isSel("Other")) otherBox.focus();
      } else {
        state.answers[s.id] = label;
        refresh();
        if (label === "Other") otherBox.focus();
        else { clearTimeout(state.timer); state.timer = setTimeout(() => go(1), 260); }
      }
    };
    wrap.append(b);
    if (label === "Other") wrap.append(otherBox);
  });
  root.append(wrap);
  if (s.max) root.append(note);
  refresh();
}

/* ---------- 1 to 5 agreement scale ---------- */
function renderScale(root, s) {
  const labels = s.labels || AGREE;
  const row = el("div", "scale");
  row.setAttribute("role", "radiogroup");
  row.setAttribute("aria-label", s.q);
  const readout = el("p", "readout");
  readout.setAttribute("aria-live", "polite");
  const set = (n) => {
    row.querySelectorAll(".dot").forEach(d => {
      const on = Number(d.dataset.n) === n;
      d.classList.toggle("sel", on);
      d.setAttribute("aria-checked", on);
    });
    readout.textContent = n ? labels[n - 1] : "";
  };
  for (let n = 1; n <= 5; n++) {
    const d = el("button", "dot", String(n));
    d.type = "button";
    d.dataset.n = n;
    d.setAttribute("role", "radio");
    d.setAttribute("aria-label", `${n}, ${labels[n - 1]}`);
    d.onclick = () => {
      state.answers[s.id] = n;
      set(n);
      updateNav(s);
      clearTimeout(state.timer);
      state.timer = setTimeout(() => go(1), 380);
    };
    row.append(d);
  }
  const ends = el("div", "ends");
  ends.append(el("span", "", labels[0]), el("span", "", labels[4]));
  root.append(row, ends, readout);
  set(state.answers[s.id] || 0);
}

/* ---------- open text ---------- */
function renderText(root, s) {
  const t = el("textarea", "field");
  t.maxLength = 2000;
  t.rows = 5;
  t.placeholder = "Type your thoughts here…";
  t.setAttribute("aria-label", s.q);
  t.value = state.answers[s.id] || "";
  t.oninput = () => { state.answers[s.id] = t.value; updateNav(s); };
  root.append(t);
}

/* ---------- follow-up + submit ---------- */
function renderFollowup(root, s) {
  const wrap = el("div", "options");
  wrap.setAttribute("role", "radiogroup");
  wrap.setAttribute("aria-label", s.q);
  const contact = el("input", "field");
  contact.type = "text";
  contact.maxLength = 200;
  contact.placeholder = "Email, phone or WhatsApp (optional)";
  contact.setAttribute("aria-label", "How should we reach you? Optional");
  contact.value = state.answers.followup_contact || "";
  contact.oninput = () => { state.answers.followup_contact = contact.value; };
  const contactLabel = el("p", "hint", "If you like, share how you'd prefer to be reached. This is optional.");
  contactLabel.style.margin = "18px 0 10px";

  const refresh = () => {
    wrap.querySelectorAll(".opt").forEach(b => {
      const on = state.answers[s.id] === b.dataset.v;
      b.classList.toggle("sel", on);
      b.setAttribute("aria-checked", on);
    });
    const show = ["Yes", "Maybe"].includes(state.answers[s.id]);
    contact.hidden = contactLabel.hidden = !show;
  };
  ["Yes", "Maybe", "No"].forEach(label => {
    const b = el("button", "opt");
    b.type = "button";
    b.dataset.v = label;
    b.setAttribute("role", "radio");
    b.append(el("span", "mark"), el("span", "", label));
    b.onclick = () => { state.answers[s.id] = label; refresh(); };
    wrap.append(b);
  });
  const hp = el("input", "hp");
  hp.type = "text"; hp.name = "website"; hp.tabIndex = -1; hp.autocomplete = "off";
  hp.setAttribute("aria-hidden", "true");
  root.append(wrap, contactLabel, contact, hp);
  const err = el("p", "error");
  err.id = "err";
  err.hidden = true;
  root.append(err);
  refresh();
}

function fmt(id, type) {
  const v = state.answers[id];
  if (v == null) return "";
  const other = (state.other[id] || "").trim();
  const map = (x) => (x === "Other" ? (other ? "Other: " + other : "Other") : x);
  if (Array.isArray(v)) return v.map(map).join("; ");
  if (type === "text") return v.trim();
  return typeof v === "number" ? v : map(v);
}

function buildPayload(honeypot) {
  const pad = (n) => String(n).padStart(2, "0");
  const out = {
    submitted_at: new Date().toISOString(),
    duration_sec: Math.round((Date.now() - state.started) / 1000),
  };
  let n = 0;
  SCREENS.forEach(s => {
    if (!s.id) return;
    n++;
    out[`${pad(n)}_${s.id}`] = fmt(s.id, s.type);
    if (s.id === "followup_willing") out[`${pad(n)}b_followup_contact`] = (state.answers.followup_contact || "").trim();
  });
  out.website = honeypot || "";
  return out;
}

async function submit() {
  if (state.sending) return;
  const err = $("#err");
  err.hidden = true;
  state.sending = true;
  updateNav(SCREENS.find(x => x.type === "followup"));
  $("#next").disabled = true;
  try {
    const payload = buildPayload(($(".hp") || {}).value);
    const url = CONFIG.ENDPOINT;
    if (!url || url.startsWith("PASTE_")) {
      state.demo = true;
      console.warn("Demo mode: no ENDPOINT set, so nothing was saved. Payload:", payload);
    } else {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    }
    renderThanks();
  } catch (e) {
    err.textContent = "We couldn't send your answers. Check your connection, then press Send again.";
    err.hidden = false;
    $("#next").disabled = false;
  } finally {
    state.sending = false;
    if (!$("#next").hidden && $("#nav").hidden === false) updateNav(SCREENS.find(x => x.type === "followup"));
  }
}

function renderThanks() {
  $("#top").hidden = true;
  $("#nav").hidden = true;
  const screen = $("#screen");
  screen.replaceChildren();
  const box = el("div", "hero");
  const h = el("h1", "", "Thank you for sharing your voice");
  h.tabIndex = -1;
  box.append(h);
  box.append(el("p", "", "Your perspective matters. There may not be one simple answer to many of these questions, and that is exactly why honest conversations are important."));
  box.append(el("p", "", "This project isn't about telling young Christians how relationships should work. It's about listening, learning, examining our assumptions, returning to Scripture, and thinking more deeply about what it means to love another person in a Christ-centred way."));
  if (state.demo) {
    box.append(el("p", "notice", "Test mode: nothing was saved because the Google Sheets link hasn't been added to script.js yet."));
  }
  screen.append(box);
  h.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

$("#back").onclick = () => go(-1);
$("#next").onclick = () => {
  const s = visible()[state.i];
  if (s.type === "followup") submit();
  else go(1);
};
render();
