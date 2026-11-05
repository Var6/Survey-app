/**
 * Import the old "Visited" Google Form export into the app's visit_records
 * collection, so MIS / PM / Director can read and correct it and each CM sees
 * their own visits.
 *
 *   node scripts/import-visit-records.cjs <file.csv>                 dry run (writes nothing)
 *   node scripts/import-visit-records.cjs <file.csv> --apply         write to the database in .env.local
 *   node scripts/import-visit-records.cjs <file.csv> --apply --uri mongodb://127.0.0.1:27017 --db janman_test
 *
 * Safe to run again: every row has a stable key, so a second run adds nothing.
 *
 * The form has one block of columns per kind of visit (school / Anganwadi /
 * health), and repeats header names ("Photo", "Remarks", "Name Of Tola"), so
 * columns are read by position after the header row is checked.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require(path.join(__dirname, "..", "node_modules", "mongodb"));

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--uri" && args[i - 1] !== "--db");
const APPLY = args.includes("--apply");
if (!file) { console.error("usage: node scripts/import-visit-records.cjs <file.csv> [--apply] [--uri URI --db NAME]"); process.exit(1); }

/* Tola names as typed on the form → app community codes (lower case, single spaces). */
const COMMUNITY = {
  "naya kalijaan tola": "kalijaan_naya_tola",
  "kalijaan": "singhia_tola", // "Kalijaan" on its own is read as Kalijaan 2 / Singhia Tola
  "kalijan": "singhia_tola",
  "anup nagar": "dhangar_tola",
  "anupnagar": "dhangar_tola",
  "shree ram tola": "khatal_patti",
  "sriram tola": "khatal_patti",
  "baxaghat": "buxa_ghat",
  "bakshaghat": "buxa_ghat",
  "rajendranagar": "maha_dalit_tola",
  "shanti kabar": "shanti_kabra",
  "raza tola": "ambedkar_nagar", // read as Raja Tola / Ambedkar Nagar
  "housing board": "refugee_colony",
  "bargeshnagar": "damka_tola",
  "loot mohalla": "loot_mohalla",
  "loot maholla": "loot_mohalla",
  "loot mohala": "loot_mohalla",
  "kheruganj": "kheruganj",
};
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

/* Column positions on the form (checked against the header row below). */
const C = {
  ts: 0, date: 1, cm: 2, tola: 3, visited: 4,
  stake: 5, schoolDisc: 6, schoolPhoto: 7, schoolRem: 8, school: 9, principal: 10, principalPhone: 11,
  asha: 12, anm: 13, ashaPhone: 14, anmPhone: 15, awcDisc: 16, awcTola: 17, awcPhoto: 18, awcTola2: 19, awcRem: 20,
  docTola: 21, doctor: 22, doctorPhone: 23, docDisc: 24, docPhoto: 25, docRem: 26,
};
const EXPECT = { 0: "timestamp", 1: "column 1", 2: "name of community", 3: "name of tola", 4: "visited", 5: "meet stakeholder", 9: "name of school", 12: "name of asha", 22: "name doctor" };

/* RFC 4180 CSV parser (quoted fields, embedded commas/newlines, "" escapes). */
function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const pad = (n) => String(n).padStart(2, "0");
const mdy = (s) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.trim()); return m ? { y: +m[3], mo: +m[1], d: +m[2], rest: s.trim().slice(m[0].length).trim() } : null; };
const toDate = (s) => { const p = mdy(s); return p && p.mo >= 1 && p.mo <= 12 && p.d >= 1 && p.d <= 31 ? `${p.y}-${pad(p.mo)}-${pad(p.d)}` : null; };
function toInstant(s) { // M/D/YYYY H:MM:SS in India time → UTC Date
  const p = mdy(s); if (!p) return null;
  const t = /^(\d{1,2}):(\d{2}):(\d{2})/.exec(p.rest) || [0, "0", "0", "0"];
  return new Date(`${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(+t[1])}:${t[2]}:${t[3]}+05:30`);
}
const links = (s) => [...new Set(s.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)))];
const text = (s) => (s || "").replace(/\s+/g, " ").trim();
const phone = (s) => { const t = text(s); return /^(n\/?a|na|none|nil|-+)$/i.test(t) ? "" : t; };
const long = (s) => (s || "").replace(/^\s*Remarks:\s*/i, "").trim();

(async () => {
  const env = {};
  for (const l of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  const uri = opt("--uri") || env.MONGODB_URI, dbName = opt("--db") || env.MONGODB_DB || "janman_survey";

  const table = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const head = table[0].map((h) => text(h).toLowerCase());
  for (const [i, want] of Object.entries(EXPECT)) {
    if (!(head[i] || "").startsWith(want)) { console.error(`CSV is not the Visited form: column ${Number(i) + 1} should start with “${want}” but is “${head[i]}”`); process.exit(1); }
  }

  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 20000 }).connect();
  const db = client.db(dbName);
  const settlements = Object.fromEntries((await db.collection("settlements").find({}).toArray()).map((s) => [s.code, s.label]));
  const cmUsers = await db.collection("users").find({ role: "cm" }, { projection: { name: 1, active: 1 } }).toArray();

  /** Exact name, else the form's name starts with exactly one CM's name ("Indrajeet Kumar" → Indrajeet). */
  const findCm = (typed) => {
    const t = norm(typed);
    const exact = cmUsers.filter((u) => norm(u.name) === t);
    if (exact.length === 1) return exact[0];
    const first = cmUsers.filter((u) => t.startsWith(norm(u.name) + " "));
    return first.length === 1 ? first[0] : null;
  };

  const problems = [], warnings = [], docs = [], keys = new Set();
  table.slice(1).forEach((r, i) => {
    const line = i + 2, g = (k) => r[C[k]] || "";
    const tolaRaw = text(g("tola")) || text(g("awcTola")) || text(g("awcTola2")) || text(g("docTola"));
    const parts = tolaRaw.split("/").map(norm).filter(Boolean);
    const codes = [...new Set(parts.map((p) => COMMUNITY[p]).filter(Boolean))];
    const code = codes[0];
    const date = toDate(g("date")), submittedAt = toInstant(g("ts"));
    const vt = norm(g("visited"));
    const visitedType = vt.startsWith("school") ? "school" : vt.startsWith("anganwadi") || vt.startsWith("aanganwadi") ? "anganwadi" : /health|hospital|doctor|clinic|phc|uphc/.test(vt) ? "health" : null;
    if (!visitedType) return problems.push(`row ${line}: “${g("visited")}” is not School, Anganwadi or a health facility`);
    if (!code || !settlements[code]) return problems.push(`row ${line}: tola “${tolaRaw}” has no matching community in the app`);
    if (!date) return problems.push(`row ${line}: bad visit date “${g("date")}”`);
    if (!submittedAt || isNaN(submittedAt)) return problems.push(`row ${line}: bad timestamp “${g("ts")}”`);
    if (codes.length > 1 || parts.length > 1) warnings.push(`row ${line}: tola “${tolaRaw}” names several places — saved under ${settlements[code]}; the original text is kept on the record for MIS to correct`);
    const ageDays = (submittedAt - new Date(`${date}T00:00:00+05:30`)) / 86400e3;
    if (ageDays > 30) warnings.push(`row ${line}: visit date ${date} is ${Math.round(ageDays)} days before it was filed — check the date`);
    if (ageDays < -1) warnings.push(`row ${line}: visit date ${date} is after the day it was filed`);

    const base = { visitDate: date, settlementCode: code, communityName: settlements[code], visitedType };
    let body;
    if (visitedType === "school") {
      body = { stakeholderNames: text(g("stake")), discussion: long(g("schoolDisc")), photoLinks: links(g("schoolPhoto")), remarks: long(g("schoolRem")), schoolName: text(g("school")), principalName: text(g("principal")), principalPhone: phone(g("principalPhone")) };
      if (!body.schoolName) return problems.push(`row ${line}: school visit with no school name`);
    } else if (visitedType === "anganwadi") {
      body = { discussion: long(g("awcDisc")), photoLinks: links(g("awcPhoto")), remarks: long(g("awcRem")), ashaName: text(g("asha")), ashaPhone: phone(g("ashaPhone")), anmName: text(g("anm")), anmPhone: phone(g("anmPhone")) };
      if (!body.ashaName && !body.anmName) return problems.push(`row ${line}: Anganwadi visit with no ASHA or ANM name`);
    } else {
      body = { discussion: long(g("docDisc")), photoLinks: links(g("docPhoto")), remarks: long(g("docRem")), doctorName: text(g("doctor")), doctorPhone: phone(g("doctorPhone")) };
      if (!body.doctorName) return problems.push(`row ${line}: health visit with no doctor name`);
    }
    const lost = [body.discussion, body.schoolName, body.principalName, body.ashaName, body.anmName, body.doctorName].find((t) => t && /\?{3,}/.test(t));
    if (lost) return problems.push(`row ${line}: text has “???” — the Hindi was lost when the file was saved; export the sheet again as CSV (UTF-8)`);
    if (!body.discussion) return problems.push(`row ${line}: nothing written under “what have you discussed”`);
    for (const k of ["principalPhone", "ashaPhone", "anmPhone", "doctorPhone"]) {
      if (body[k] && !/^(91)?\d{10}$/.test(body[k].replace(/\D/g, ""))) warnings.push(`row ${line}: ${k.replace("Phone", "")} phone “${body[k]}” is not a 10-digit number — imported as typed`);
    }
    for (const k of Object.keys(body)) if (body[k] === "") delete body[k];

    const cmTyped = text(g("cm"));
    const cmUser = findCm(cmTyped);
    const importKey = crypto.createHash("sha1").update(["visit", g("ts"), date, cmTyped.toLowerCase(), tolaRaw.toLowerCase(), visitedType].join("|")).digest("hex").slice(0, 24);
    if (keys.has(importKey)) return problems.push(`row ${line}: duplicate of an earlier row`);
    keys.add(importKey);
    docs.push({
      ...base, ...body,
      ...(codes.length > 1 || parts.length > 1 ? { tolaAsTyped: tolaRaw } : {}),
      cmName: cmUser ? cmUser.name : cmTyped, ...(cmUser ? { cmId: cmUser._id } : {}), _cmTyped: cmTyped,
      source: "import", importKey, submittedAt,
      history: [{ at: new Date(), by: "Import", note: "Imported from the Google Form responses" }],
      createdAt: submittedAt, updatedAt: new Date(),
    });
  });

  const existing = await db.collection("visit_records").countDocuments({ importKey: { $in: [...keys] } });
  const tally = (f) => docs.reduce((a, d) => { const k = f(d); a[k] = (a[k] || 0) + 1; return a; }, {});
  console.log(`target: ${new URL(uri.replace("mongodb+srv", "https").replace(/^mongodb:/, "http:")).host} / ${dbName}`);
  console.log(`rows in file: ${table.length - 1} | valid: ${docs.length} | already imported: ${existing} | to add: ${docs.length - existing}`);
  console.log("by kind:", tally((d) => d.visitedType));
  console.log("by community:", tally((d) => d.communityName));
  console.log("CM on the record (typed on form → app user):", tally((d) => `${d._cmTyped.trim()} → ${d.cmId ? d.cmName : "NOT MATCHED, shown as typed"}`));
  console.log("without a photo link:", docs.filter((d) => !d.photoLinks.length).length);
  if (warnings.length) { console.log(`WARNINGS (${warnings.length}) — imported anyway:`); warnings.forEach((w) => console.log("  -", w)); }
  if (problems.length) { console.log(`PROBLEMS — these rows are skipped (${problems.length}):`); problems.forEach((p) => console.log("  -", p)); }

  if (!APPLY) { console.log("\nDRY RUN — nothing written. Add --apply to import."); await client.close(); return; }

  await db.collection("visit_records").createIndex({ importKey: 1 }, { unique: true, partialFilterExpression: { importKey: { $type: "string" } } });
  const res = await db.collection("visit_records").bulkWrite(
    docs.map(({ _cmTyped, ...d }) => ({ updateOne: { filter: { importKey: d.importKey }, update: { $setOnInsert: d }, upsert: true } })),
    { ordered: false }
  );
  console.log(`\nAPPLIED: ${res.upsertedCount} records added, ${docs.length - res.upsertedCount} already there.`);
  await client.close();
})().catch((e) => { console.error("FAILED:", e.stack || e.message); process.exit(1); });
