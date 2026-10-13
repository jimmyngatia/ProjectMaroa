"use strict";
/* Overview page. Loading, parsing and shared helpers live in data.js. */

const UI = { sort: "agree", textQ: "all", theme: "", word: "", search: "", limit: 20, cmpQ: "not_automatic", cmpBy: "rel_group", filters: { age_range: "", rel_group: "", involve_group: "" } };
const filtered = () => RAW.filter(r => Object.entries(UI.filters).every(([k, v]) => !v || r[k] === v));

/* ======================================================================
   RENDER: sections
   ====================================================================== */
function renderAll() {
  const rs = filtered();
  $("#filterNote").textContent = rs.length === RAW.length ? `${RAW.length} responses` : `Showing ${rs.length} of ${RAW.length} responses`;
  const banner = $("#banner");
  banner.innerHTML = (SOURCE === "sample data" ? `<div class="warn"><b>Sample data.</b> These answers are made up, to show you how the page works.</div>` : "");
  renderOverview(rs);
  renderWho(rs);
  renderStance(rs);
  renderChoices(rs);
  renderCompareTable();
  updateText();
}

function renderOverview(rs) {
  const dur = rs.map(r => parseFloat(r.duration_sec)).filter(v => v > 0);
  const qids = META.map(m => m.id);
  const answered = rs.map(r => qids.filter(id => (r[id] || "") !== "").length / qids.length);
  const bonus = rs.filter(r => META.filter(m => m.bonus).some(m => (r[m.id] || "").trim())).length;
  const fu = rs.filter(r => ["Yes", "Maybe"].includes(r.followup_willing)).length;
  const dates = rs.map(r => new Date(r.submitted_at)).filter(d => !isNaN(d)).sort((a, b) => a - b);
  const fmtD = d => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const cards = [
    { v: rs.length, l: "responses" },
    { v: dur.length ? (median(dur) / 60).toFixed(1) + " min" : "–", l: "median time to finish" },
    { v: pct(mean(answered)), l: "of questions answered on average" },
    { v: rs.length ? pct(bonus / rs.length) : "–", l: "did the bonus round" },
    { v: fu, l: "open to a follow-up conversation" },
  ];
  if (dates.length) cards.push({ v: dates.length > 1 && fmtD(dates[0]) !== fmtD(dates.at(-1)) ? `${fmtD(dates[0])} – ${fmtD(dates.at(-1))}` : fmtD(dates[0]), l: "response dates" });
  $("#cards").innerHTML = cards.map(c => `<div class="stat"><div class="stat-n">${esc(c.v)}</div><div class="stat-l">${esc(c.l)}</div></div>`).join("");
  $("#findings").innerHTML = findings(rs).map(f => `<li${f.warn ? ' class="warn"' : ""}>${f.t}</li>`).join("");
}

function findings(rs) {
  const out = [];
  if (!rs.length) return [{ warn: true, t: "No responses match these filters." }];
  if (rs.length < 10) out.push({ warn: true, t: `Only ${rs.length} response${rs.length === 1 ? "" : "s"} so far. Treat everything here as early hints, not conclusions.` });
  const dur = rs.map(r => parseFloat(r.duration_sec)).filter(v => v > 0);
  const fast = dur.filter(d => d < 90).length;
  if (dur.length >= 5 && fast / dur.length >= 0.2) out.push({ warn: true, t: `${pct(fast / dur.length)} finished in under 90 seconds, which may mean rushed answers. Read the written responses with that in mind.` });

  const sc = SCALES.map(m => ({ m, st: scaleStats(rs, m.id) })).filter(x => x.st.n >= 3);
  if (sc.length) {
    const top = [...sc].sort((a, b) => b.st.agree - a.st.agree)[0];
    out.push({ t: `<b>Strongest agreement:</b> ${pct(top.st.agree)} agree that “${esc(top.m.short)}”.` });
    const low = [...sc].sort((a, b) => a.st.agree - b.st.agree)[0];
    if (low !== top) out.push({ t: `<b>Least agreement:</b> only ${pct(low.st.agree)} agree that “${esc(low.m.short)}”.` });
    const split = [...sc].sort((a, b) => Math.min(b.st.agree, b.st.dis) - Math.min(a.st.agree, a.st.dis))[0];
    if (Math.min(split.st.agree, split.st.dis) >= 0.2) out.push({ t: `<b>Most divided:</b> “${esc(split.m.short)}” (${pct(split.st.agree)} agree, ${pct(split.st.dis)} disagree). This is a good topic for a follow-up conversation.` });
  }

  [["readiness_areas", "Most-chosen area to consider before dating"], ["top_qualities", "Most valued quality in a partner"], ["boundaries_matter", "Boundary people rank highest"], ["why_fail", "Most-cited reason relationships fail"], ["church_missing", "Biggest gap in what the Church and CUs teach"]].forEach(([id, lead]) => {
    const st = choiceStats(rs, BY_ID[id]);
    if (st.n >= 3 && st.items[0].count) out.push({ t: `<b>${esc(lead)}:</b> ${esc(st.items[0].label)} (${pct(st.items[0].pct)}), followed by ${esc(st.items[1].label)} (${pct(st.items[1].pct)}).` });
  });

  const cp = scaleStats(rs, "church_prepares");
  if (cp.n >= 3) out.push({ t: `<b>Church preparation:</b> ${pct(cp.agree)} say the Church and CUs prepare young people “well” or “very well”; ${pct(cp.dis)} say “not at all” or “poorly” (average ${cp.mean.toFixed(1)} out of 5).` });

  const items = textItems(rs, "all");
  if (items.length >= 5) {
    const t3 = themeCounts(items).slice(0, 3).filter(t => t.count);
    if (t3.length) out.push({ t: `<b>Most common themes in written answers:</b> ${t3.map(t => `${esc(t.name)} (${pct(t.count / items.length)})`).join(", ")}.` });
  }

  let best = null;
  ["rel_group", "involve_group", "age_range"].forEach(g => {
    const groups = [...new Set(rs.map(r => r[g]).filter(Boolean))];
    SCALES.forEach(m => {
      const gs = groups.map(name => { const st = scaleStats(rs.filter(r => r[g] === name), m.id); return { name, st }; }).filter(x => x.st.n >= MIN_N);
      if (gs.length < 2) return;
      gs.sort((a, b) => b.st.mean - a.st.mean);
      const d = gs[0].st.mean - gs.at(-1).st.mean;
      if (d >= 0.6 && (!best || d > best.d)) best = { d, m, hi: gs[0], lo: gs.at(-1) };
    });
  });
  if (best) out.push({ t: `<b>Biggest difference between groups:</b> on “${esc(best.m.short)}”, <i>${esc(best.hi.name)}</i> average ${best.hi.st.mean.toFixed(1)} versus ${best.lo.st.mean.toFixed(1)} for <i>${esc(best.lo.name)}</i> (1 = strongly disagree, 5 = strongly agree). See <a href="#sec-compare">Compare groups</a>.` });
  return out;
}

function renderWho(rs) {
  $("#who").innerHTML = WHO.map(id => {
    const m = BY_ID[id], st = choiceStats(rs, m);
    return `<div class="card"><h3>${esc(m.short)}</h3><p class="n-note">${st.n} answered</p>${bars(st.items.filter(i => i.count || m.options.includes(i.label)))}${otherList(rs, m)}</div>`;
  }).join("");
}

function otherList(rs, m) {
  const o = otherTexts(rs, m);
  return o.length ? `<details><summary>Other answers (${o.length})</summary><ul>${o.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : "";
}

function renderStance(rs) {
  $("#legend").innerHTML = legend(AGREE);
  let rows = SCALES.map(m => ({ m, st: scaleStats(rs, m.id) }));
  if (UI.sort === "agree") rows.sort((a, b) => (b.st.agree ?? -1) - (a.st.agree ?? -1));
  else if (UI.sort === "split") rows.sort((a, b) => Math.min(b.st.agree ?? 0, b.st.dis ?? 0) - Math.min(a.st.agree ?? 0, a.st.dis ?? 0));
  $("#stance").innerHTML = rows.map(({ m, st }) => `<div class="stance-row"><div class="stance-q">${esc(m.short)}</div>${st.n ? stackBar(st, AGREE) : `<p class="empty">No answers yet</p>`}<div class="stance-meta">${st.n ? `${pct(st.agree)} agree · ${pct(st.dis)} disagree · average ${st.mean.toFixed(1)} of 5 · ${st.n} answered` : ""}</div></div>`).join("");
  const cp = BY_ID.church_prepares, cs = scaleStats(rs, "church_prepares");
  $("#church").innerHTML = `<h3>${esc(cp.short)}</h3><div class="legend">${legend(PREP)}</div>${cs.n ? stackBar(cs, PREP) : `<p class="empty">No answers yet</p>`}<div class="stance-meta">${cs.n ? `${pct(cs.agree)} well or very well · ${pct(cs.dis)} not at all or poorly · average ${cs.mean.toFixed(1)} of 5 · ${cs.n} answered` : ""}</div>`;
}

function renderChoices(rs) {
  const ms = [BY_ID.dating_purpose, ...MULTIS, BY_ID.followup_willing];
  $("#choices").innerHTML = ms.map(m => {
    const st = choiceStats(rs, m);
    return `<div class="card"><h3>${esc(m.short)}</h3><p class="n-note">${st.n} answered${m.type === "multi" ? " · people could pick several" : ""}</p>${st.n ? bars(st.items.filter(i => i.count || m.options.includes(i.label))) : `<p class="empty">No answers yet</p>`}${otherList(rs, m)}</div>`;
  }).join("");
}

/* ---------- compare groups ---------- */
function initCompare() {
  const qs = [...SCALES, BY_ID.church_prepares, BY_ID.dating_purpose, ...MULTIS];
  $("#cmpQ").innerHTML = qs.map(m => `<option value="${m.id}">${esc(m.short)}</option>`).join("");
  $("#cmpQ").value = UI.cmpQ;
  $("#cmpBy").innerHTML = Object.entries(GROUPS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("#cmpBy").value = UI.cmpBy;
}

function renderCompareTable() {
  const m = BY_ID[UI.cmpQ], g = UI.cmpBy, box = $("#compare");
  const names = [...new Set(RAW.map(r => one(r[g])).filter(Boolean))];
  const get = (r) => one(r[g]);
  if (!names.length) { box.innerHTML = `<p class="empty">No data to compare yet.</p>`; return; }
  const sub = (name) => RAW.filter(r => get(r) === name);

  if (m.type === "scale") {
    const labels = labelsFor(m);
    const rows = names.map(name => ({ name, st: scaleStats(sub(name), m.id) })).sort((a, b) => b.st.n - a.st.n);
    box.innerHTML = `<div class="legend">${legend(labels)}</div><div class="tablewrap"><table><thead><tr><th>Group</th><th>Answered</th><th>Average (1–5)</th><th>${m.rating ? "Well / very well" : "Agree"}</th><th>Spread</th></tr></thead><tbody>${rows.map(({ name, st }) => `<tr class="${st.n < MIN_N ? "low" : ""}"><td>${esc(name)}${st.n < MIN_N ? " (low n)" : ""}</td><td>${st.n}</td><td>${st.n ? st.mean.toFixed(1) : "–"}</td><td>${pct(st.agree)}</td><td>${st.n ? stackBar(st, labels, "mini") : ""}</td></tr>`).join("")}</tbody></table></div>`;
    return;
  }
  const overall = choiceStats(RAW, m).items.filter(i => i.count || m.options.includes(i.label));
  const cols = names.map(name => ({ name, st: choiceStats(sub(name), m) })).sort((a, b) => b.st.n - a.st.n);
  box.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Option</th>${cols.map(c => `<th class="${c.st.n < MIN_N ? "low" : ""}">${esc(c.name)}<br><small>${c.st.n} answered${c.st.n < MIN_N ? " (low n)" : ""}</small></th>`).join("")}</tr></thead><tbody>${overall.map(o => `<tr><td>${esc(o.label)}</td>${cols.map(c => { const it = c.st.items.find(i => i.label === o.label); const p = it ? it.pct : 0; return `<td class="heat ${c.st.n < MIN_N ? "low" : ""}" style="background:color-mix(in srgb, var(--primary) ${Math.round(p * 75)}%, transparent);color:${p > 0.55 ? "var(--on-primary)" : "var(--ink)"}">${pct(p)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div><p class="n-note" style="margin-top:12px">Each column shows the share of that group who picked the option. Darker means more.</p>`;
}

/* ---------- written answers ---------- */
function initText() {
  $("#tq").innerHTML = `<option value="all">All written questions</option>` + TEXTS.map(t => `<option value="${t.id}">${esc(t.short)}</option>`).join("");
  $("#tq").value = UI.textQ;
}

function highlight(text, re) {
  if (!re) return esc(text);
  let out = "", last = 0;
  text.replace(re, (m, ...a) => { const idx = a.find(x => typeof x === "number"); out += esc(text.slice(last, idx)) + "<mark>" + esc(m) + "</mark>"; last = idx + m.length; return m; });
  return out + esc(text.slice(last));
}

function updateText() {
  const rs = filtered();
  const items = textItems(rs, UI.textQ);
  const themes = themeCounts(items);
  $("#themes").innerHTML = items.length ? themes.map(t => `<button type="button" class="theme ${UI.theme === t.name ? "active" : ""}" data-theme="${esc(t.name)}"><span>${esc(t.name)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${items.length ? (t.count / items.length * 100).toFixed(1) : 0}%"></span></span><b>${pct(items.length ? t.count / items.length : 0)}</b></button>`).join("") + `<p class="n-note" style="margin-top:10px">Share of the ${items.length} written answers that mention each theme.</p>` : `<p class="empty">No written answers yet.</p>`;
  $("#words").innerHTML = wordCounts(items).map(([w, n]) => `<button type="button" class="chip ${UI.word === w ? "active" : ""}" data-word="${esc(w)}">${esc(w)}<small>${n}</small></button>`).join("") || `<span class="empty">Words appear once several people have written answers.</span>`;

  const theme = THEMES.find(t => t.name === UI.theme);
  const parts = [];
  if (theme) parts.push(theme.re.source);
  if (UI.word) parts.push("\\b" + UI.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*");
  if (UI.search) parts.push(UI.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const hl = parts.length ? new RegExp(parts.join("|"), "gi") : null;
  const matches = items.filter(i => (!theme || theme.re.test(i.text)) && (!UI.word || new RegExp("\\b" + UI.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(i.text)) && (!UI.search || i.text.toLowerCase().includes(UI.search.toLowerCase())));
  const active = [UI.theme, UI.word && `“${UI.word}”`, UI.search && `“${UI.search}”`].filter(Boolean);
  $("#qhead").textContent = `${matches.length} answer${matches.length === 1 ? "" : "s"}${active.length ? " matching " + active.join(" + ") : ""}`;
  $("#quotes").innerHTML = matches.slice(0, UI.limit).map(i => {
    const who = [i.r.age_range, i.r.rel_group].filter(Boolean).join(" · ");
    return `<blockquote class="quote"><div class="q-meta">${esc(BY_ID[i.id].short)}${who ? " · " + esc(who) : ""}</div><p>${highlight(i.text, hl && new RegExp(hl.source, "gi"))}</p></blockquote>`;
  }).join("") || `<p class="empty">Nothing matches yet.</p>`;
  $("#more").hidden = matches.length <= UI.limit;
}

/* ---------- export ---------- */
function downloadCsv() {
  const rs = filtered(), out = [["question", "item", "measure", "value", "n_answered"]];
  SCALES.concat(BY_ID.church_prepares).forEach(m => { const s = scaleStats(rs, m.id); out.push([m.short, "", "average (1-5)", s.mean?.toFixed(2) ?? "", s.n], [m.short, "", m.rating ? "% well/very well" : "% agree", s.agree != null ? (s.agree * 100).toFixed(0) : "", s.n], [m.short, "", m.rating ? "% not at all/poorly" : "% disagree", s.dis != null ? (s.dis * 100).toFixed(0) : "", s.n]); });
  [BY_ID.dating_purpose, ...MULTIS, ...WHO.map(id => BY_ID[id])].forEach(m => { const s = choiceStats(rs, m); s.items.forEach(i => out.push([m.short, i.label, "% of respondents", (i.pct * 100).toFixed(0), s.n])); });
  const items = textItems(rs, "all");
  themeCounts(items).forEach(t => out.push(["Written answers", t.name, "% mentioning theme", items.length ? (t.count / items.length * 100).toFixed(0) : "", items.length]));
  const csv = out.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "survey-key-numbers.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}


/* ======================================================================
   PAGE HOOKS + EVENTS
   ====================================================================== */
const PAGE = {
  init() {
    UI.filters = { age_range: "", rel_group: "", involve_group: "" };
    UI.textQ = "all"; UI.theme = ""; UI.word = ""; UI.search = ""; UI.limit = 20;
    $("#tsearch").value = "";
    [["age_range", "All ages", BY_ID.age_range.options], ["rel_group", "Everyone", ["Single", "In a relationship", "Married"]], ["involve_group", "Everyone", ["Actively involved", "Less involved", "Other"]]].forEach(([k, all, order]) => {
      const present = [...new Set(RAW.map(r => r[k]).filter(Boolean))];
      const vals = [...order.filter(o => present.includes(o)), ...present.filter(p => !order.includes(p))];
      $("#f_" + k).innerHTML = `<option value="">${all}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join("");
    });
    initCompare();
    initText();
  },
  render: renderAll,
};

["age_range", "rel_group", "involve_group"].forEach(k => { $("#f_" + k).onchange = (e) => { UI.filters[k] = e.target.value; UI.limit = 20; renderAll(); }; });
$("#sortStance").onchange = (e) => { UI.sort = e.target.value; renderStance(filtered()); };
$("#cmpQ").onchange = (e) => { UI.cmpQ = e.target.value; renderCompareTable(); };
$("#cmpBy").onchange = (e) => { UI.cmpBy = e.target.value; renderCompareTable(); };
$("#tq").onchange = (e) => { UI.textQ = e.target.value; UI.theme = ""; UI.word = ""; UI.limit = 20; updateText(); };
$("#tsearch").oninput = (e) => { UI.search = e.target.value.trim(); UI.limit = 20; updateText(); };
$("#tclear").onclick = () => { UI.theme = ""; UI.word = ""; UI.search = ""; UI.limit = 20; $("#tsearch").value = ""; updateText(); };
$("#more").onclick = () => { UI.limit += 20; updateText(); };
$("#themes").onclick = (e) => { const b = e.target.closest("[data-theme]"); if (b) { UI.theme = UI.theme === b.dataset.theme ? "" : b.dataset.theme; UI.limit = 20; updateText(); } };
$("#words").onclick = (e) => { const b = e.target.closest("[data-word]"); if (b) { UI.word = UI.word === b.dataset.word ? "" : b.dataset.word; UI.limit = 20; updateText(); } };
$("#btnPrint").onclick = () => window.print();
$("#btnCsv").onclick = downloadCsv;

startData(PAGE);
