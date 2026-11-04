/**
 * Import the old Google Form ("Community Meeting (Responses)") into the app's
 * meeting_records collection, so MIS / PM / Director can read and correct it.
 *
 *   node scripts/import-meeting-records.cjs <file.csv>                 dry run (writes nothing)
 *   node scripts/import-meeting-records.cjs <file.csv> --apply         write to the database in .env.local
 *   node scripts/import-meeting-records.cjs <file.csv> --apply --uri mongodb://127.0.0.1:27017 --db janman_test
 *
 * Safe to run again: every row has a stable key, so a second run adds nothing.
 * Imported rows carry no CM (the form never recorded who filled it in).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require(path.join(__dirname, "..", "node_modules", "mongodb"));

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--uri" && args[args.indexOf(a) - 1] !== "--db");
const APPLY = args.includes("--apply");
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
if (!file) { console.error("usage: node scripts/import-meeting-records.cjs <file.csv> [--apply] [--uri URI --db NAME]"); process.exit(1); }

/* Community names as typed on the form → app community codes. */
const COMMUNITY = {
  "naya kalijaan tola": "kalijaan_naya_tola",
  "kalijaan": "singhia_tola", // "Kalijaan" on its own is read as Kalijaan 2 / Singhia Tola
  "anup nagar": "dhangar_tola",
  "shree ram tola": "khatal_patti",
  "baxaghat": "buxa_ghat",
  "rajendranagar": "maha_dalit_tola",
  "shanti kabar": "shanti_kabra",
  "raza tola": "ambedkar_nagar", // read as Raja Tola / Ambedkar Nagar
  "housing board": "refugee_colony",
  "bargeshnagar": "damka_tola",
  "loot mohalla": "loot_mohalla",
  "kheruganj": "kheruganj",
};
const slugify = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

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
const mdy = (s) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.trim()); return m ? { y: +m[3], mo: +m[1], d: +m[2], rest: s.trim().slice(m[0].length).trim() } : null; };
const pad = (n) => String(n).padStart(2, "0");
const toDate = (s) => { const p = mdy(s); return p ? `${p.y}-${pad(p.mo)}-${pad(p.d)}` : null; };
function toInstant(s) { // M/D/YYYY H:MM:SS in India time → UTC Date
  const p = mdy(s); if (!p) return null;
  const t = /^(\d{1,2}):(\d{2}):(\d{2})/.exec(p.rest) || [0, "0", "0", "0"];
  return new Date(`${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(+t[1])}:${t[2]}:${t[3]}+05:30`);
}
const links = (s) => [...new Set(s.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)))];

(async () => {
  const env = {};
  for (const l of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  const uri = opt("--uri") || env.MONGODB_URI, dbName = opt("--db") || env.MONGODB_DB || "janman_survey";

  const table = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (name) => head.findIndex((h) => h.startsWith(name));
  const C = { ts: col("timestamp"), date: col("meeting date"), comm: col("name of community"), type: col("type of meeting"), topic: col("topic"), att: col("attendance"), n: col("total participants"), photo: col("group photo"), rem: col("remarks") };
  if (Object.values(C).some((i) => i < 0)) { console.error("CSV columns not recognised:", head); process.exit(1); }

  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 20000 }).connect();
  const db = client.db(dbName);
  const settlements = Object.fromEntries((await db.collection("settlements").find({}).toArray()).map((s) => [s.code, s.label]));

  const problems = [], docs = [], keys = new Set();
  table.slice(1).forEach((r, i) => {
    const line = i + 2, commRaw = (r[C.comm] || "").trim(), typeRaw = (r[C.type] || "").trim();
    const code = COMMUNITY[commRaw.toLowerCase()];
    const date = toDate(r[C.date] || ""), submittedAt = toInstant(r[C.ts] || "");
    const n = Number((r[C.n] || "").trim());
    if (!code || !settlements[code]) return problems.push(`row ${line}: community “${commRaw}” has no matching community in the app`);
    if (!date) return problems.push(`row ${line}: bad meeting date “${r[C.date]}”`);
    if (!submittedAt || isNaN(submittedAt)) return problems.push(`row ${line}: bad timestamp “${r[C.ts]}”`);
    if (!typeRaw) return problems.push(`row ${line}: no meeting type`);
    if (!Number.isInteger(n) || n < 0) return problems.push(`row ${line}: participants “${r[C.n]}” is not a number`);
    const importKey = crypto.createHash("sha1").update([r[C.ts], date, commRaw, typeRaw].join("|")).digest("hex").slice(0, 24);
    if (keys.has(importKey)) return problems.push(`row ${line}: duplicate of an earlier row (same time, date, community, type)`);
    keys.add(importKey);
    docs.push({
      meetingDate: date, settlementCode: code, communityName: settlements[code],
      typeKey: slugify(typeRaw), typeLabel: typeRaw, topic: (r[C.topic] || "").trim() || "(not written)",
      attendanceLinks: links(r[C.att] || ""), totalParticipants: n, photoLinks: links(r[C.photo] || ""),
      remarks: (r[C.rem] || "").trim() || undefined, source: "import", importKey, submittedAt,
      history: [{ at: new Date(), by: "Import", note: "Imported from the Google Form responses" }],
      createdAt: submittedAt, updatedAt: new Date(),
    });
  });

  const existing = await db.collection("meeting_records").countDocuments({ importKey: { $in: [...keys] } });
  const byType = {}, byComm = {};
  for (const d of docs) { byType[d.typeLabel] = (byType[d.typeLabel] || 0) + 1; byComm[d.communityName] = (byComm[d.communityName] || 0) + 1; }
  console.log(`target: ${new URL(uri.replace("mongodb+srv", "https").replace(/^mongodb:/, "http:")).host} / ${dbName}`);
  console.log(`rows in file: ${table.length - 1} | valid: ${docs.length} | already imported: ${existing} | to add: ${docs.length - existing}`);
  console.log("participants (valid rows):", docs.reduce((a, d) => a + d.totalParticipants, 0));
  console.log("by type:", byType); console.log("by community:", byComm);
  if (problems.length) { console.log("PROBLEMS (these rows are skipped):"); problems.forEach((p) => console.log("  -", p)); }

  if (!APPLY) { console.log("\nDRY RUN — nothing written. Add --apply to import."); await client.close(); return; }

  const now = new Date();
  await db.collection("meeting_records").createIndex({ importKey: 1 }, { unique: true, partialFilterExpression: { importKey: { $type: "string" } } });
  await db.collection("lookups").createIndex({ list: 1, key: 1 }, { unique: true });
  const types = [...new Set(docs.map((d) => d.typeLabel))];
  for (const [i, label] of types.entries()) {
    await db.collection("lookups").updateOne({ list: "meeting_form_type", key: slugify(label) }, { $setOnInsert: { list: "meeting_form_type", key: slugify(label), label, active: true, order: i, createdAt: now } }, { upsert: true });
  }
  const res = await db.collection("meeting_records").bulkWrite(docs.map((d) => ({ updateOne: { filter: { importKey: d.importKey }, update: { $setOnInsert: d }, upsert: true } })), { ordered: false });
  console.log(`\nIMPORTED ${res.upsertedCount} new meeting reports (${docs.length - res.upsertedCount} were already there).`);
  console.log("total meeting reports now in database:", await db.collection("meeting_records").countDocuments({}));
  await client.close();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
