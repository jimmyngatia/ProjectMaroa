"use strict";
/* Patterns page: deeper analysis. Loading and shared helpers live in data.js. */

/* ======================================================================
   1. STATISTICS (no libraries needed)
   ====================================================================== */
const LF = [0];
function lf(n) { for (let i = LF.length; i <= n; i++) LF[i] = LF[i - 1] + Math.log(i); return LF[n]; }
function hyp(a, r1, c1, N) {
  return Math.exp(lf(r1) + lf(N - r1) + lf(c1) + lf(N - c1) - lf(N) - lf(a) - lf(r1 - a) - lf(c1 - a) - lf(N - r1 - c1 + a));
}
/* Fisher's exact test (two-sided) for a 2x2 table [[a,b],[c,d]]: reliable even for small groups. */
function fisher(a, b, c, d) {
  const r1 = a + b, c1 = a + c, N = a + b + c + d;
  const lo = Math.max(0, r1 + c1 - N), hi = Math.min(r1, c1), p0 = hyp(a, r1, c1, N);
  let p = 0;
  for (let x = lo; x <= hi; x++) { const px = hyp(x, r1, c1, N); if (px <= p0 * (1 + 1e-7)) p += px; }
  return Math.min(1, p);
}
function lgamma(z) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 300; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-13) break; }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-13) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
const chi2p = (x, df) => gammaQ(df / 2, x / 2);

/* Benjamini-Hochberg: adjusts p-values for running many comparisons at once. */
function bh(ps) {
  const m = ps.length, idx = ps.map((_, i) => i).sort((i, j) => ps[i] - ps[j]), q = new Array(m);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) { const i = idx[k]; prev = Math.min(prev, ps[i] * m / (k + 1)); q[i] = prev; }
  return q;
}
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const fmtStat = (name, v) => (v < 0.001 ? `${name} < 0.001` : `${name} = ${v.toFixed(3)}`);
const P0 = (x) => Math.round(x * 100);

/* ======================================================================
   2. VARIABLES: everything we can slice by or compare
   ====================================================================== */
const MIN_GROUP = 5;

const DEMO = [
  { key: "age_range", label: "Age range", family: "age", values: BY_ID.age_range.options.filter(o => o !== "Prefer not to say"), phrase: v => `are aged ${v}` },
  { key: "age_group", label: "Age group", family: "age", values: ["18–23", "24 and over"], phrase: v => `are aged ${v}` },
  { key: "rel_stage", label: "Relationship stage", family: "rel", values: ["Single", "Dating", "Serious or engaged", "Married"], phrase: v => ({ "Single": "are single", "Dating": "are dating", "Serious or engaged": "are in a serious relationship or engaged", "Married": "are married" })[v] },
  { key: "involve_level", label: "Church involvement (level)", family: "involve", values: ["Actively involved", "Occasionally involved", "Not actively involved"], phrase: v => ({ "Actively involved": "are actively involved in a church or CU", "Occasionally involved": "are only occasionally involved in church or CU", "Not actively involved": "identify as Christian but aren't actively involved" })[v] },
  { key: "involve_where", label: "Where they're involved", family: "involve", values: ["Local church", "Christian Union/campus", "Both", "Not regularly active"], phrase: v => ({ "Local church": "are active in a local church", "Christian Union/campus": "are active in a Christian Union or campus ministry", "Both": "are active in both a church and a CU", "Not regularly active": "are not regularly active in church or CU" })[v] },
  { key: "current_role", label: "Role", family: "role", values: BY_ID.current_role.options, phrase: v => ({ "University/college student": "are university or college students", "Employed": "are employed", "Self-employed": "are self-employed", "In ministry": "are in ministry", "Currently not working": "are not currently working" })[v] },
];
DEMO.forEach(d => { d.group = "About the respondent"; d.get = r => (d.values.includes(r[d.key]) ? r[d.key] : null); });

let VARS = [], VBY = {}, OUT = [], AUTO = [];
const SEG = { age_range: new Set(), rel_stage: new Set(), involve_level: new Set(), involve_where: new Set(), current_role: new Set() };
const PUI = { foundLimit: 12, xRow: "involve_level", xCol: "rel_stage", k: 3 };

function textOf(r) {
  if (r.__txt === undefined) { const t = TEXTS.map(m => r[m.id] || "").join(" ").trim(); r.__txt = t.length >= 3 ? t : null; }
  return r.__txt;
}

function buildModel() {
  VARS = [...DEMO];
  SCALES.concat(BY_ID.church_prepares).forEach(m => {
    const vals = m.rating ? ["Poorly", "Somewhat", "Well"] : ["Disagree", "Not sure", "Agree"];
    VARS.push({ key: "s:" + m.id, label: m.short, group: "Agree / disagree statements", values: vals, get: r => { const v = num(r[m.id]); return v == null ? null : v <= 2 ? vals[0] : v === 3 ? vals[1] : vals[2]; } });
  });
  [BY_ID.dating_purpose, BY_ID.followup_willing].forEach(m => {
    VARS.push({ key: "q:" + m.id, label: m.short, group: "Pick-one questions", values: m.options, get: r => (m.options.includes(r[m.id]) ? r[m.id] : null) });
  });
  MULTIS.forEach(m => m.options.forEach(o => {
    VARS.push({ key: `m:${m.id}:${o}`, label: `${m.short}: ${o}`, group: "Pick-list choices", values: ["Chose", "Didn't choose"], get: r => { const l = list(r[m.id]); return l.length ? (l.includes(o) ? "Chose" : "Didn't choose") : null; } });
  }));
  THEMES.forEach(t => {
    VARS.push({ key: "t:" + t.name, label: `Mentions “${t.name}” in written answers`, group: "Themes in written answers", values: ["Mentioned", "Didn't mention"], get: r => { const x = textOf(r); return x == null ? null : t.re.test(x) ? "Mentioned" : "Didn't mention"; } });
  });
  VBY = Object.fromEntries(VARS.map(v => [v.key, v]));

  /* Yes/no outcomes we test each group against */
  OUT = [];
  const add = (key, label, family, cat, test) => OUT.push({ key, label, family, cat, test });
  SCALES.forEach(m => {
    add(`${m.id}:agree`, `agree that “${m.short}”`, "q:" + m.id, "beliefs", r => { const v = num(r[m.id]); return v == null ? null : v >= 4; });
    add(`${m.id}:disagree`, `disagree that “${m.short}”`, "q:" + m.id, "beliefs", r => { const v = num(r[m.id]); return v == null ? null : v <= 2; });
  });
  add("church:well", "say the Church and CUs prepare young people well", "q:church_prepares", "beliefs", r => { const v = num(r.church_prepares); return v == null ? null : v >= 4; });
  add("church:poorly", "say the Church and CUs prepare young people poorly", "q:church_prepares", "beliefs", r => { const v = num(r.church_prepares); return v == null ? null : v <= 2; });
  BY_ID.dating_purpose.options.forEach(o => add("purpose:" + o, `pick “${o}” as the main purpose of dating`, "q:dating_purpose", "choices", r => (r.dating_purpose ? r.dating_purpose === o : null)));
  add("followup", "be open to a follow-up conversation (Yes or Maybe)", "q:followup", "choices", r => (r.followup_willing ? ["Yes", "Maybe"].includes(r.followup_willing) : null));
  MULTIS.forEach(m => m.options.forEach(o => add(`${m.id}:${o}`, `choose “${o}” under “${m.short}”`, "q:" + m.id, "choices", r => { const l = list(r[m.id]); return l.length ? l.includes(o) : null; })));
  THEMES.forEach(t => add("theme:" + t.name, `mention “${t.name}” in their written answers`, "q:theme", "words", r => { const x = textOf(r); return x == null ? null : t.re.test(x); }));
  DEMO.filter(d => d.key !== "age_range").forEach(d => d.values.forEach(v => add(`demo:${d.key}:${v}`, d.phrase(v).replace(/^are /, "be "), d.family, "status", r => { const x = d.get(r); return x == null ? null : x === v; })));
  OUT.forEach(o => { o.vals = Int8Array.from(RAW, r => { const t = o.test(r); return t == null ? -1 : t ? 1 : 0; }); });

  /* Test every group against everyone else, on every outcome */
  AUTO = [];
  DEMO.forEach(d => d.values.forEach(v => {
    const mem = Int8Array.from(RAW, r => { const x = d.get(r); return x == null ? -1 : x === v ? 1 : 0; });
    if (mem.reduce((a, x) => a + (x === 1 ? 1 : 0), 0) < MIN_GROUP) return;
    const skip = new Set([d.family]);
    if (d.family === "age") skip.add("role");   // "students are younger" tells us nothing new
    if (d.family === "role") skip.add("age");
    runTests(mem, skip).forEach(t => { t.pred = { d, v, phrase: d.phrase(v) }; AUTO.push(t); });
  }));
  const q = bh(AUTO.map(t => t.p));
  AUTO.forEach((t, i) => { t.q = q[i]; });
}

/* mem: 1 = in the group, 0 = everyone else, -1 = unknown */
function runTests(mem, skipFamilies) {
  const out = [];
  OUT.forEach(o => {
    if (skipFamilies.has(o.family)) return;
    let a = 0, b = 0, c = 0, d = 0;
    const v = o.vals;
    for (let i = 0; i < mem.length; i++) {
      const g = mem[i], y = v[i];
      if (g < 0 || y < 0) continue;
      if (g) { if (y) a++; else b++; } else if (y) c++; else d++;
    }
    const nIn = a + b, nRest = c + d;
    if (nIn < MIN_GROUP || nRest < MIN_GROUP || a + c < 3 || b + d < 3) return;
    out.push({ o, a, b, c, d, nIn, nRest, p1: a / nIn, p2: c / nRest, diff: a / nIn - c / nRest, p: fisher(a, b, c, d) });
  });
  return out;
}

const strength = (t) => (t.q < 0.1 ? { cls: "likely", txt: "Likely real" } : t.p < 0.05 ? { cls: "watch", txt: "Worth watching" } : { cls: "hint", txt: "Hint" });

function duo(t, who) {
  return `<div class="duo">
    <div class="duo-row"><span>${esc(who || "This group")} <small>n=${t.nIn}</small></span><div class="bar-track"><div class="bar-fill" style="width:${P0(t.p1)}%"></div></div><b>${P0(t.p1)}%</b></div>
    <div class="duo-row"><span>Everyone else <small>n=${t.nRest}</small></span><div class="bar-track"><div class="bar-fill alt" style="width:${P0(t.p2)}%"></div></div><b>${P0(t.p2)}%</b></div>
  </div>`;
}

/* ======================================================================
   3. PATTERNS WE FOUND
   ====================================================================== */
function selectPatterns() {
  const cat = $("#fCat").value, mode = $("#fMode").value;
  let list = AUTO.filter(t => Math.abs(t.diff) >= 0.12 && t.p < 0.2);
  if (cat !== "all") list = list.filter(t => t.o.cat === cat);
  if (mode === "likely") list = list.filter(t => t.q < 0.1);
  list.sort((a, b) => a.p - b.p || Math.abs(b.diff) - Math.abs(a.diff));
  const once = new Set(), seen = {};
  return list.filter(t => {
    const k = t.pred.d.key + "|" + (t.o.cat === "beliefs" ? t.o.family : t.o.key);
    if (once.has(k)) return false;
    once.add(k);
    seen[t.o.key] = (seen[t.o.key] || 0) + 1;
    return seen[t.o.key] <= 2;
  });
}

function sentence(t, subject) {
  return `${subject} <b>${t.diff > 0 ? "more" : "less"} likely</b> to ${esc(t.o.label)}`;
}

function renderFound() {
  const groups = DEMO.reduce((n, d) => n + d.values.length, 0);
  $("#foundNote").textContent = `We compared ${groups} groups (by age, relationship stage, church life and role) against everyone else across ${OUT.length} possible answers: ${AUTO.length} comparisons in all. By luck alone, about ${Math.round(AUTO.length * 0.05)} of them would look “significant”, which is why the labels below adjust for that.`;
  const list = selectPatterns();
  $("#found").innerHTML = list.length ? list.slice(0, PUI.foundLimit).map(t => {
    const s = strength(t);
    return `<article class="pattern"><span class="tag ${s.cls}">${s.txt}</span><p class="pattern-s">${sentence(t, `People who ${esc(t.pred.phrase)} are`)}.</p>${duo(t)}<p class="pattern-meta">${t.diff > 0 ? "+" : ""}${P0(t.diff)} points · ${fmtStat("p", t.p)} · adjusted ${fmtStat("q", t.q)}</p></article>`;
  }).join("") : `<p class="empty">No clear patterns yet${RAW.length < 40 ? ". This is normal with few responses; patterns need numbers to show up." : " for this filter. Try “Everything” or “Best patterns”."}</p>`;
  $("#foundMore").hidden = list.length <= PUI.foundLimit;
}

/* ======================================================================
   4. EXPLORE A GROUP
   ====================================================================== */
const SEG_ROWS = [
  ["age_range", "Age"], ["rel_stage", "Relationship"], ["involve_level", "Church involvement"], ["involve_where", "Where"], ["current_role", "Role"],
];

function renderSegChips() {
  $("#segChips").innerHTML = SEG_ROWS.map(([key, title]) => {
    const d = DEMO.find(x => x.key === key);
    return `<div class="chiprow"><span class="chiprow-t">${esc(title)}</span><div class="chips">${d.values.map(v => `<button type="button" class="chip ${SEG[key].has(v) ? "active" : ""}" data-k="${key}" data-v="${esc(v)}" aria-pressed="${SEG[key].has(v)}">${esc(v)}</button>`).join("")}</div></div>`;
  }).join("") + `<button type="button" class="btn small" id="segClear">Clear all</button>`;
}

function segMember(r) {
  let unknown = false;
  for (const [key, set] of Object.entries(SEG)) {
    if (!set.size) continue;
    const v = DEMO.find(d => d.key === key).get(r);
    if (v == null) { unknown = true; continue; }
    if (!set.has(v)) return 0;
  }
  return unknown ? -1 : 1;
}

function segName() {
  return SEG_ROWS.filter(([k]) => SEG[k].size).map(([k]) => [...SEG[k]].join(" or ")).join(" + ");
}

function renderSegOut() {
  const box = $("#segOut");
  const chosen = SEG_ROWS.filter(([k]) => SEG[k].size);
  if (!chosen.length) { box.innerHTML = `<p class="empty">Tap one or more choices above to build a group.</p>`; return; }
  const mem = Int8Array.from(RAW, segMember);
  const nIn = mem.reduce((a, x) => a + (x === 1 ? 1 : 0), 0);
  const head = `<div class="card"><h3>${esc(segName())}</h3><p class="n-note">${nIn} ${nIn === 1 ? "person" : "people"} (${P0(nIn / RAW.length)}% of everyone who answered)</p>`;
  if (nIn < MIN_GROUP) { box.innerHTML = head + `<p class="empty">That's too few people to compare reliably (we need at least ${MIN_GROUP}). Try fewer choices, or choose “any of these” by selecting a second option in a row.</p></div>`; return; }

  const skip = new Set(chosen.map(([k]) => DEMO.find(d => d.key === k).family));

  /* who they are */
  const prof = DEMO.filter(d => !skip.has(d.family) && d.key !== "age_range").map(d => {
    const cnt = (isIn) => { const c = {}; let n = 0; RAW.forEach((r, i) => { if (mem[i] !== (isIn ? 1 : 0)) return; const v = d.get(r); if (v == null) return; c[v] = (c[v] || 0) + 1; n++; }); return { c, n }; };
    const g = cnt(true), rest = cnt(false);
    return `<div class="card"><h3>${esc(d.label)}</h3><p class="n-note">${g.n} in this group answered</p><div class="duo-table">${d.values.map(v => `<div class="duo-row"><span>${esc(v)}</span><div class="bar-track"><div class="bar-fill" style="width:${g.n ? P0((g.c[v] || 0) / g.n) : 0}%"></div></div><b>${g.n ? P0((g.c[v] || 0) / g.n) : 0}%</b><em>${rest.n ? P0((rest.c[v] || 0) / rest.n) : 0}% others</em></div>`).join("")}</div></div>`;
  }).join("");

  /* how they answer differently */
  const tests = runTests(mem, skip);
  const q = bh(tests.map(t => t.p));
  tests.forEach((t, i) => { t.q = q[i]; });
  tests.sort((a, b) => a.p - b.p || Math.abs(b.diff) - Math.abs(a.diff));
  const seen = {};
  const diffs = tests.filter(t => Math.abs(t.diff) >= 0.12 && t.p < 0.25).filter(t => { seen[t.o.key] = 1; return true; }).slice(0, 12);
  const diffHtml = diffs.length ? diffs.map(t => { const s = strength(t); return `<article class="pattern"><span class="tag ${s.cls}">${s.txt}</span><p class="pattern-s">${sentence(t, "This group is")}.</p>${duo(t)}<p class="pattern-meta">${t.diff > 0 ? "+" : ""}${P0(t.diff)} points · ${fmtStat("p", t.p)}</p></article>`; }).join("") : `<p class="empty">No clear differences from everyone else yet.</p>`;

  /* their top picks */
  const picks = MULTIS.map(m => {
    const inRows = RAW.filter((_, i) => mem[i] === 1), outRows = RAW.filter((_, i) => mem[i] === 0);
    const a = choiceStats(inRows, m), b = choiceStats(outRows, m);
    if (!a.n) return "";
    const top = (s) => s.items.filter(i => i.count).slice(0, 3).map(i => `${esc(i.label)} (${P0(i.pct)}%)`).join(", ") || "–";
    return `<tr><td>${esc(m.short)}</td><td>${top(a)}<br><small>n=${a.n}</small></td><td>${top(b)}<br><small>n=${b.n}</small></td></tr>`;
  }).join("");

  box.innerHTML = head + `</div>
    <h3 class="subh">Who they are</h3><div class="grid2">${prof || `<p class="empty">Choose fewer groups to see who else is in this group.</p>`}</div>
    <h3 class="subh">How they answer differently</h3><p class="note">Compared with everyone else. Exploratory: more tests means more chance of a lucky result, so favour the “Likely real” and “Worth watching” ones.</p>${diffHtml}
    <h3 class="subh">Their top picks</h3><div class="card tablewrap"><table><thead><tr><th>Question</th><th>This group's top 3</th><th>Everyone else's top 3</th></tr></thead><tbody>${picks}</tbody></table></div>`;
}

/* ======================================================================
   5. COMPARE TWO QUESTIONS
   ====================================================================== */
function varOptions() {
  const groups = {};
  VARS.forEach(v => (groups[v.group] = groups[v.group] || []).push(v));
  return Object.entries(groups).map(([g, vs]) => `<optgroup label="${esc(g)}">${vs.map(v => `<option value="${esc(v.key)}">${esc(v.label)}</option>`).join("")}</optgroup>`).join("");
}

function renderCross() {
  const vr = VBY[PUI.xRow], vc = VBY[PUI.xCol], box = $("#crossOut");
  if (!vr || !vc) return;
  if (vr === vc) { box.innerHTML = `<p class="empty">Pick two different questions.</p>`; return; }
  let R = vr.values, C = vc.values;
  const cnt = R.map(() => C.map(() => 0));
  let N = 0;
  RAW.forEach(r => { const a = vr.get(r), b = vc.get(r); if (a == null || b == null) return; const i = R.indexOf(a), j = C.indexOf(b); if (i < 0 || j < 0) return; cnt[i][j]++; N++; });
  const keepR = R.map((_, i) => cnt[i].some(x => x)), keepC = C.map((_, j) => cnt.some(row => row[j]));
  const rowsI = R.map((_, i) => i).filter(i => keepR[i]), colsJ = C.map((_, j) => j).filter(j => keepC[j]);
  if (!N || rowsI.length < 2 || colsJ.length < 2) { box.innerHTML = `<p class="empty">Not enough people answered both questions to compare them yet (${N} so far).</p>`; return; }
  const rt = rowsI.map(i => colsJ.reduce((a, j) => a + cnt[i][j], 0)), ct = colsJ.map(j => rowsI.reduce((a, i) => a + cnt[i][j], 0));
  const mode = $("#xShow").value;

  const head = `<tr><th></th>${colsJ.map(j => `<th>${esc(C[j])}</th>`).join("")}<th>Total</th></tr>`;
  const body = rowsI.map((i, ri) => `<tr class="${rt[ri] < MIN_GROUP ? "low" : ""}"><td><b>${esc(R[i])}</b></td>${colsJ.map((j, cj) => {
    const o = cnt[i][j];
    const frac = mode === "col" ? (ct[cj] ? o / ct[cj] : 0) : (rt[ri] ? o / rt[ri] : 0);
    const main = mode === "n" ? o : P0(frac) + "%";
    const shade = mode === "n" ? Math.min(1, o / Math.max(1, ...cnt.flat())) : frac;
    return `<td class="heat" style="background:color-mix(in srgb, var(--primary) ${Math.round(shade * 75)}%, transparent);color:${shade > 0.55 ? "var(--on-primary)" : "var(--ink)"}">${main}${mode === "n" ? "" : `<br><small>${o}</small>`}</td>`;
  }).join("")}<td class="heat">${rt[ri]}</td></tr>`).join("");
  const foot = `<tr><td><b>Total</b></td>${ct.map(c => `<td class="heat">${c}</td>`).join("")}<td class="heat">${N}</td></tr>`;

  /* statistics */
  let chi = 0, lowExp = 0;
  const cells = [];
  rowsI.forEach((i, ri) => colsJ.forEach((j, cj) => {
    const e = rt[ri] * ct[cj] / N, o = cnt[i][j];
    chi += (o - e) ** 2 / e;
    if (e < 5) lowExp++;
    cells.push({ r: R[i], c: C[j], o, e, res: (o - e) / Math.sqrt(e) });
  }));
  const df = (rowsI.length - 1) * (colsJ.length - 1);
  const p = rowsI.length === 2 && colsJ.length === 2 ? fisher(cnt[rowsI[0]][colsJ[0]], cnt[rowsI[0]][colsJ[1]], cnt[rowsI[1]][colsJ[0]], cnt[rowsI[1]][colsJ[1]]) : chi2p(chi, df);
  const V = Math.sqrt(chi / (N * (Math.min(rowsI.length, colsJ.length) - 1)));
  const link = V < 0.1 ? "almost no link" : V < 0.2 ? "a weak link" : V < 0.35 ? "a moderate link" : "a strong link";
  const chance = p < 0.01 ? "very unlikely to be chance" : p < 0.05 ? "unlikely to be chance" : p < 0.15 ? "possible but uncertain (could be chance)" : "could easily be chance";
  const lowNote = lowExp / cells.length > 0.2 || N < 30 ? ` <b>Many cells hold very few people, so treat this as a hint.</b>` : "";
  const over = cells.filter(c => c.res >= 1.5 && c.o >= 3).sort((a, b) => b.res - a.res).slice(0, 3);
  const under = cells.filter(c => c.res <= -1.5 && c.e >= 3).sort((a, b) => a.res - b.res).slice(0, 2);
  const lines = [
    ...over.map(c => `More than expected: <b>${esc(c.r)}</b> and <b>${esc(c.c)}</b> go together (${c.o} ${c.o === 1 ? "person" : "people"} vs about ${c.e.toFixed(1)} expected).`),
    ...under.map(c => `Fewer than expected: <b>${esc(c.r)}</b> and <b>${esc(c.c)}</b> (${c.o} ${c.o === 1 ? "person" : "people"} vs about ${c.e.toFixed(1)} expected).`),
  ];
  box.innerHTML = `<p class="n-note">${N} people answered both questions.</p><div class="tablewrap"><table class="cross"><thead>${head}</thead><tbody>${body}${foot}</tbody></table></div>
    <p style="margin-top:14px"><b>What this says:</b> ${esc(vr.label)} and ${esc(vc.label)} show ${link} (strength ${V.toFixed(2)} on a 0–1 scale; ${fmtStat("p", p)}, which is ${chance}).${lowNote}</p>
    ${lines.length ? `<ul class="plain">${lines.map(l => `<li>${l}</li>`).join("")}</ul>` : ""}`;
}

/* ======================================================================
   6. BELIEFS THAT GO TOGETHER
   ====================================================================== */
function renderBeliefs() {
  const S = SCALES, n = S.length, M = S.map(() => Array(n).fill(null)), pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const xs = [], ys = [];
    RAW.forEach(r => { const a = num(r[S[i].id]), b = num(r[S[j].id]); if (a != null && b != null) { xs.push(a); ys.push(b); } });
    const r = xs.length >= 10 ? pearson(xs, ys) : null;
    if (r != null) { M[i][j] = M[j][i] = { r, n: xs.length }; pairs.push({ a: S[i], b: S[j], r, n: xs.length }); }
  }
  const box = $("#beliefs");
  if (!pairs.length) { box.innerHTML = `<p class="empty">Needs at least 10 people who answered both statements.</p>`; return; }
  const word = (r) => { const x = Math.abs(r); return x >= 0.5 ? "strongly" : x >= 0.3 ? "clearly" : "somewhat"; };
  const pos = pairs.filter(p => p.r >= 0.25).sort((a, b) => b.r - a.r).slice(0, 6);
  const neg = pairs.filter(p => p.r <= -0.25).sort((a, b) => a.r - b.r).slice(0, 4);
  const li = (p, same) => `<li>People who agree that <b>“${esc(p.a.short)}”</b> ${same ? "also tend to agree" : "tend to disagree"} that <b>“${esc(p.b.short)}”</b> <small>(${word(p.r)}, r = ${p.r.toFixed(2)}, ${p.n} people)</small></li>`;
  box.innerHTML = `<div class="grid2">
    <div class="card"><h3>Go together</h3>${pos.length ? `<ul class="plain">${pos.map(p => li(p, true)).join("")}</ul>` : `<p class="empty">No clear pairs yet.</p>`}</div>
    <div class="card"><h3>Pull in opposite directions</h3>${neg.length ? `<ul class="plain">${neg.map(p => li(p, false)).join("")}</ul>` : `<p class="empty">No clear opposites yet.</p>`}</div>
  </div>
  <details class="card"><summary>See the full table</summary><div class="tablewrap"><table class="cross"><thead><tr><th></th>${S.map((_, j) => `<th>${j + 1}</th>`).join("")}</tr></thead><tbody>${S.map((m, i) => `<tr><td>${i + 1}. ${esc(m.short)}</td>${S.map((_, j) => { const c = M[i][j]; if (i === j) return `<td class="heat">–</td>`; if (!c) return `<td class="heat low">?</td>`; const col = c.r >= 0 ? "var(--primary)" : "var(--c1)"; return `<td class="heat" style="background:color-mix(in srgb, ${col} ${Math.round(Math.min(1, Math.abs(c.r)) * 80)}%, transparent);color:${Math.abs(c.r) > 0.55 ? "var(--on-primary)" : "var(--ink)"}">${c.r.toFixed(2)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div><p class="n-note" style="margin-top:10px">Values run from −1 (opposite) to +1 (move together). Purple shades go together; amber shades pull apart.</p></details>`;
}

/* ======================================================================
   7. TYPES OF RESPONDENTS (k-means on the agree/disagree answers)
   ====================================================================== */
const sq = (a, b) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);

function kmeans(X, k) {
  const n = X.length, d = X[0].length;
  let best = null;
  for (let rep = 0; rep < 12; rep++) {
    let s = 7 + rep * 101;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cents = [X[Math.floor(rnd() * n)].slice()];
    while (cents.length < k) {
      const dist = X.map(x => Math.min(...cents.map(c => sq(x, c))));
      const tot = dist.reduce((a, b) => a + b, 0);
      let t = rnd() * tot, idx = 0;
      for (; idx < n - 1; idx++) { t -= dist[idx]; if (t <= 0) break; }
      cents.push(X[idx].slice());
    }
    const assign = new Array(n).fill(-1);
    for (let it = 0; it < 80; it++) {
      let changed = false;
      X.forEach((x, i) => { let bi = 0, bd = Infinity; cents.forEach((c, j) => { const dd = sq(x, c); if (dd < bd) { bd = dd; bi = j; } }); if (assign[i] !== bi) { assign[i] = bi; changed = true; } });
      for (let j = 0; j < k; j++) { const mem = X.filter((_, i) => assign[i] === j); if (mem.length) for (let t = 0; t < d; t++) cents[j][t] = mem.reduce((a, m) => a + m[t], 0) / mem.length; }
      if (!changed) break;
    }
    const inertia = X.reduce((a, x, i) => a + sq(x, cents[assign[i]]), 0);
    if (!best || inertia < best.inertia) best = { assign: assign.slice(), inertia };
  }
  return best;
}

function renderTypes() {
  const box = $("#types"), S = SCALES, k = PUI.k;
  const eligible = RAW.filter(r => S.filter(m => num(r[m.id]) != null).length >= Math.ceil(S.length * 0.7));
  if (eligible.length < Math.max(24, 8 * k)) { box.innerHTML = `<p class="empty">This needs at least ${Math.max(24, 8 * k)} people who answered most of the statements (so far ${eligible.length}). With fewer, the “types” would be mostly noise.</p>`; return; }
  const itemMean = S.map(m => mean(eligible.map(r => num(r[m.id])).filter(v => v != null)));
  const X = eligible.map(r => S.map((m, i) => { const v = num(r[m.id]); return v == null ? itemMean[i] : v; }));
  const { assign } = kmeans(X, k);
  const overall = S.map((_, i) => mean(X.map(x => x[i])));
  let clusters = Array.from({ length: k }, (_, c) => ({ idx: assign.map((a, i) => (a === c ? i : -1)).filter(i => i >= 0) })).filter(c => c.idx.length);
  clusters.sort((a, b) => b.idx.length - a.idx.length);
  clusters.forEach(c => { c.rows = c.idx.map(i => eligible[i]); c.mean = S.map((_, t) => mean(c.idx.map(i => X[i][t]))); });

  const cards = clusters.map((c, ci) => {
    const diffs = S.map((m, t) => ({ m, d: c.mean[t] - overall[t], v: c.mean[t] })).sort((a, b) => b.d - a.d);
    const more = diffs.filter(x => x.d >= 0.4).slice(0, 3), less = diffs.filter(x => x.d <= -0.4).slice(-3).reverse();
    const who = [["rel_stage", "relationship stage"], ["involve_level", "church involvement"], ["age_group", "age"]].map(([key]) => {
      const d = DEMO.find(x => x.key === key);
      const share = (rows) => { const known = rows.filter(r => d.get(r) != null); return { n: known.length, f: v => (known.length ? known.filter(r => d.get(r) === v).length / known.length : 0), cnt: v => known.filter(r => d.get(r) === v).length }; };
      const g = share(c.rows), all = share(eligible);
      return d.values.map(v => ({ v, g: g.f(v), a: all.f(v), c: g.cnt(v) })).filter(x => x.g - x.a >= 0.12 && x.c >= 3).map(x => `${esc(x.v)} (${P0(x.g)}% vs ${P0(x.a)}% overall)`);
    }).flat();
    return `<article class="card persona"><h3>Group ${ci + 1} <small>${c.idx.length} people · ${P0(c.idx.length / eligible.length)}%</small></h3>
      ${c.idx.length < MIN_GROUP ? `<p class="empty">Very small group. Ignore or try fewer groups.</p>` : ""}
      <p><b>Agrees more than most with:</b></p>${more.length ? `<ul class="plain">${more.map(x => `<li>${esc(x.m.short)} <small>(avg ${x.v.toFixed(1)} vs ${overall[S.indexOf(x.m)].toFixed(1)})</small></li>`).join("")}</ul>` : `<p class="empty">Nothing stands out.</p>`}
      <p><b>Agrees less than most with:</b></p>${less.length ? `<ul class="plain">${less.map(x => `<li>${esc(x.m.short)} <small>(avg ${x.v.toFixed(1)} vs ${overall[S.indexOf(x.m)].toFixed(1)})</small></li>`).join("")}</ul>` : `<p class="empty">Nothing stands out.</p>`}
      <p><b>Who tends to be in it:</b> ${who.length ? who.join("; ") : "no clear difference in age, relationship stage or church involvement."}</p></article>`;
  }).join("");

  const table = `<details class="card"><summary>See the numbers (average answer per group, 1 to 5)</summary><div class="tablewrap"><table class="cross"><thead><tr><th>Statement</th><th>Everyone</th>${clusters.map((_, i) => `<th>Group ${i + 1}</th>`).join("")}</tr></thead><tbody>${S.map((m, t) => `<tr><td>${esc(m.short)}</td><td class="heat">${overall[t].toFixed(1)}</td>${clusters.map(c => { const d = c.mean[t] - overall[t]; return `<td class="heat" style="background:color-mix(in srgb, ${d >= 0 ? "var(--primary)" : "var(--c1)"} ${Math.round(Math.min(1, Math.abs(d) / 1.2) * 70)}%, transparent);color:${Math.abs(d) > 0.8 ? "var(--on-primary)" : "var(--ink)"}">${c.mean[t].toFixed(1)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div></details>`;
  box.innerHTML = `<div class="grid2 personas">${cards}</div>${table}<p class="n-note">Based on ${eligible.length} people who answered at least 70% of the statements. Groups are a lens for thinking about “types”, not labels for individual people, and they can shift as more responses arrive.</p>`;
}

/* ======================================================================
   8. PAGE HOOKS, EVENTS, EXPORT
   ====================================================================== */
function renderBanner() {
  const parts = [];
  if (SOURCE === "sample data") parts.push(`<div class="warn"><b>Sample data.</b> These answers are made up, with a few patterns built in so you can see what this page can find.</div>`);
  if (RAW.length < 40) parts.push(`<div class="warn"><b>${RAW.length} responses so far.</b> Patterns become trustworthy with roughly 60 to 100 or more, especially for narrow groups such as “actively involved and in a serious relationship”. Until then, read everything here as hints.</div>`);
  $("#banner").innerHTML = parts.join("");
}

function downloadPatternsCsv() {
  const out = [["group", "outcome", "pct_in_group", "pct_everyone_else", "n_group", "n_else", "p_value", "adjusted_q"]];
  AUTO.filter(t => t.p < 0.2).sort((a, b) => a.p - b.p).forEach(t => out.push([`People who ${t.pred.phrase}`, t.o.label, P0(t.p1), P0(t.p2), t.nIn, t.nRest, t.p.toFixed(4), t.q.toFixed(4)]));
  const csv = out.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "survey-patterns.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

const PAGE = {
  init() {
    SEG_ROWS.forEach(([k]) => SEG[k].clear());
    PUI.foundLimit = 12;
    buildModel();
    $("#xRow").innerHTML = $("#xCol").innerHTML = varOptions();
    $("#xRow").value = PUI.xRow; $("#xCol").value = PUI.xCol;
    renderSegChips();
  },
  render() {
    renderBanner(); renderFound(); renderSegOut(); renderCross(); renderBeliefs(); renderTypes();
  },
};

$("#fCat").onchange = () => { PUI.foundLimit = 12; renderFound(); };
$("#fMode").onchange = () => { PUI.foundLimit = 12; renderFound(); };
$("#foundMore").onclick = () => { PUI.foundLimit += 12; renderFound(); };
$("#segChips").onclick = (e) => {
  if (e.target.id === "segClear") { SEG_ROWS.forEach(([k]) => SEG[k].clear()); }
  else { const b = e.target.closest("[data-k]"); if (!b) return; const s = SEG[b.dataset.k]; s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); }
  renderSegChips(); renderSegOut();
};
$("#xRow").onchange = (e) => { PUI.xRow = e.target.value; renderCross(); };
$("#xCol").onchange = (e) => { PUI.xCol = e.target.value; renderCross(); };
$("#xShow").onchange = renderCross;
$("#kSel").onchange = (e) => { PUI.k = parseInt(e.target.value, 10); renderTypes(); };
$("#btnPrint").onclick = () => window.print();
$("#btnCsv").onclick = downloadPatternsCsv;

startData(PAGE);