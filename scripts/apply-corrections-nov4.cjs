/**
 * One-off corrections confirmed by the team (4 Nov 2026). Dry run unless --apply.
 *   1. Delete the second Bargeshnagar women's meeting (sheet row 46, a duplicate of row 45).
 *   2. Move the 7 meeting reports typed "Kalijaan" to Naya Kalijaan Tola.
 *   3. Support sheet: the 3 rows with a blank status are Complete; close their case if it is then finished.
 * Backups of everything touched go to private/_tools/backups/.
 */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const APPLY = process.argv.includes("--apply");
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
process.env.MONGODB_URI = env.MONGODB_URI; process.env.MONGODB_DB = env.MONGODB_DB || "janman_survey";
const { createJiti } = require("jiti");
const jiti = createJiti(__filename, { fsCache: false, moduleCache: false, alias: { "@": ROOT } });
const { ObjectId } = require("mongodb");

(async () => {
  const models = jiti(path.join(ROOT, "lib/models.ts"));
  const { evaluateCase } = jiti(path.join(ROOT, "lib/support/evidence.ts"));
  const { closeCaseDirect } = jiti(path.join(ROOT, "lib/support/service.ts"));
  const mr = await models.meetingRecordsCol(), sr = await models.supportRecordsCol(), cases = await models.casesCol();
  console.log(`mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  const backup = { at: new Date().toISOString() };

  /* 1. duplicate Bargeshnagar report */
  const dupId = new ObjectId("6aeb08f4b34fcbfa9bd6676b");
  const dup = await mr.findOne({ _id: dupId });
  const keep = await mr.findOne({ _id: new ObjectId("6aeb08f4b34fcbfa9bd6676a") });
  if (!dup || dup.settlementCode !== "damka_tola" || dup.meetingDate !== "2026-10-25" || !keep) throw new Error("duplicate report not found as expected");
  backup.deletedMeeting = dup;
  console.log(`1. delete meeting ${dup.meetingDate} ${dup.communityName} filed ${dup.submittedAt.toISOString()} (keeps the one filed ${keep.submittedAt.toISOString()})`);

  /* 2. Kalijaan -> Naya Kalijaan Tola (meetings only; the one camp is left alone) */
  const toMove = await mr.find({ settlementCode: "singhia_tola", $or: [{ kind: { $exists: false } }, { kind: "meeting" }], source: "import" }).toArray();
  backup.movedMeetings = toMove.map((d) => ({ _id: d._id, settlementCode: d.settlementCode, communityName: d.communityName }));
  console.log(`2. move ${toMove.length} meeting reports ${toMove.map((d) => d.meetingDate).join(", ")} → Kalijaan Naya Tola`);
  if (toMove.length !== 7) throw new Error("expected 7 Kalijaan meeting reports");

  /* 3. blank-status support rows */
  const rows = await sr.find({ source: "import", beneficiaryName: { $in: ["Gudiya devi", "Yashoda devi", "Gouri devi"] }, status: "follow_up_required", supportDate: { $in: ["2026-09-16", "2026-09-22", "2026-09-20"] }, communityName: { $in: ["Rajendar Nagar/Mahadalit Tola", "Buxa Ghat"] } }).toArray();
  if (rows.length !== 3) throw new Error(`expected 3 support rows, found ${rows.length}`);
  backup.supportRows = rows;
  console.log(`3. mark Complete: ${rows.map((d) => `${d.beneficiaryName} (${d.supportTypeLabels}, ${d.linkStatus}${d.caseCode ? " " + d.caseCode : ""})`).join("; ")}`);
  const linked = rows.filter((d) => d.caseId);
  for (const d of linked) {
    const c = await cases.findOne({ _id: d.caseId });
    const others = await sr.find({ caseId: d.caseId, _id: { $ne: d._id } }).toArray();
    const v = evaluateCase(c, [...others, { ...d, status: "complete" }]);
    console.log(`   case ${c.caseId}: closed=${c.closed}, would close=${v.close}, have=[${v.have}] need=[${v.need}]`);
  }
  if (!APPLY) return console.log("\nDRY RUN — nothing written.");

  fs.mkdirSync(path.join(ROOT, "private/_tools/backups"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "private/_tools/backups/corrections-2026-11-04.json"), JSON.stringify(backup, null, 1));
  const now = new Date(), by = "Correction (team confirmed)";
  await mr.deleteOne({ _id: dupId });
  const labels = await models.settlementsCol().then((c) => c.findOne({ code: "kalijaan_naya_tola" }));
  const label = (labels && (labels.name || labels.label)) || "Kalijaan Naya Tola";
  for (const d of toMove) {
    await mr.updateOne({ _id: d._id }, { $set: { settlementCode: "kalijaan_naya_tola", communityName: label, updatedAt: now }, $push: { history: { at: now, by, note: `Community changed from “${d.communityName}” to “${label}” (team confirmed)` } } });
  }
  for (const d of rows) {
    const set = { status: "complete", updatedAt: now };
    if (d.caseId) set.verification = "verified";
    await sr.updateOne({ _id: d._id, status: "follow_up_required" }, { $set: set, $push: { history: { at: now, by, note: "Status was blank in the sheet; team confirmed it is Complete" } } });
    if (!d.caseId) continue;
    const c = await cases.findOne({ _id: d.caseId });
    if (c.closed) continue;
    const all = await sr.find({ caseId: d.caseId }).toArray();
    const v = evaluateCase(c, all);
    if (v.close) {
      const ok = await closeCaseDirect(c, { via: "import", by, at: new Date(`${d.supportDate}T12:00:00+05:30`), note: `Closed: ${v.have.join(", ")} marked Complete (status confirmed by the team)` });
      console.log(`   case ${c.caseId} closed: ${ok}`);
    } else console.log(`   case ${c.caseId} stays open (still needs: ${v.need.join(", ")})`);
  }
  console.log("done. backup: private/_tools/backups/corrections-2026-11-04.json");
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
