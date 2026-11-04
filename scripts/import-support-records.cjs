/**
 * Import the old "Community Support & Follow-up (Document Supports)" Google
 * Sheet into the app, matching each row to an open case by community + name.
 *
 *   node scripts/import-support-records.cjs <file.csv>                dry run: shows exactly what would happen, writes nothing
 *   node scripts/import-support-records.cjs <file.csv> --apply        write to the database in .env.local
 *   node scripts/import-support-records.cjs --attribute [--apply]     give earlier imported meeting / camp / support
 *                                                                     records the CM assigned to their community
 *   add  --uri mongodb://127.0.0.1:27017 --db janman_test  to use another database
 *
 * Safe to run again: each row has a stable key, and a case is only acted on
 * for rows added in that run.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const APPLY = args.includes("--apply");
const ATTRIBUTE = args.includes("--attribute");
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--uri" && args[i - 1] !== "--db");

const env = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.MONGODB_URI = opt("--uri") || env.MONGODB_URI;
process.env.MONGODB_DB = opt("--db") || env.MONGODB_DB || "janman_survey";

const { createJiti } = require(path.join(ROOT, "node_modules", "jiti"));
const jiti = createJiti(__filename, { fsCache: false, moduleCache: false, alias: { "@": ROOT } });

(async () => {
  const host = new URL(process.env.MONGODB_URI.replace("mongodb+srv", "https").replace(/^mongodb:/, "http:")).host;
  console.log(`target: ${host} / ${process.env.MONGODB_DB}   mode: ${APPLY ? "APPLY (writes)" : "DRY RUN (writes nothing)"}`);
  const imp = jiti(path.join(ROOT, "lib/support/importer.ts"));

  if (ATTRIBUTE) {
    const r = await imp.attributeRecordsToCms({ apply: APPLY });
    console.log("\nRecords that get a CM (the one CM assigned to their community):");
    for (const [cm, n] of Object.entries(r.perCm)) console.log(`  ${cm}: ${n.meetings} meeting, ${n.camps} camp, ${n.support} support`);
    console.log("Left with the office (community has no CM, or several):", r.leftWithOffice);
    if (!APPLY) console.log("\nDRY RUN — nothing written. Add --apply.");
    process.exit(0);
  }

  if (!file) { console.error("usage: node scripts/import-support-records.cjs <file.csv> [--apply]"); process.exit(1); }
  const rep = await imp.importSupportSheet(fs.readFileSync(file, "utf8"), { apply: APPLY, by: "Google Sheet import" });
  const pct = (n) => `${n} (${Math.round((n / Math.max(rep.valid, 1)) * 100)}%)`;
  console.log(`\nrows in file: ${rep.rows} | valid: ${rep.valid} | already imported: ${rep.alreadyImported} | to add: ${rep.toAdd}`);
  console.log(`matched to an open case, exact name, one household ("linked"): ${pct(rep.linked)}`);
  console.log(`close or several possible households ("suggested", a person confirms): ${pct(rep.suggested)}`);
  console.log(`no household found, kept as a record only ("unlinked"): ${pct(rep.unlinked)}`);
  console.log(`\nCases the sheet shows as FINISHED → will be closed: ${rep.casesToClose.length}`);
  rep.casesToClose.slice(0, 8).forEach((c) => console.log(`   ${c.caseCode} ${c.household}  ${c.docs}  (${c.on})`));
  console.log(`Cases with some support but not finished → stay open with a note: ${rep.casesPartial.length}`);
  rep.casesPartial.slice(0, 8).forEach((c) => console.log(`   ${c.caseCode} ${c.household}  done: ${c.have} | needs: ${c.need}`));
  console.log(`\nCM shown on the record: ${rep.withCm} have one, ${rep.withoutCm} do not`, rep.cmByName);
  console.log("by community:", rep.byCommunity);
  if (rep.suggestionSamples.length) { console.log("\nSuggestions waiting for MIS / PM to confirm (sample):"); rep.suggestionSamples.forEach((s) => console.log("  -", s)); }
  if (rep.warnings.length) { console.log(`\nWARNINGS (${rep.warnings.length}):`); rep.warnings.slice(0, 15).forEach((w) => console.log("  -", w)); }
  if (rep.problems.length) { console.log(`\nPROBLEMS — these rows are skipped (${rep.problems.length}):`); rep.problems.forEach((p) => console.log("  -", p)); }
  if (rep.applied) console.log(`\nAPPLIED: ${rep.applied.inserted} records added, ${rep.applied.closed} cases closed, ${rep.applied.progressNotes} cases got a progress note.`);
  else console.log("\nDRY RUN — nothing written. Add --apply to import.");
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.stack || e.message); process.exit(1); });
