/**
 * Seed a LOCAL test database with one account per role, so the app can be run
 * and signed into with no internet and without touching production data.
 *
 *   mongod --dbpath ~/.janman-test-db                 # terminal 1
 *   npm run test:seed                                 # terminal 2
 *   npm run test:dev                                  # then open localhost:3000
 *
 * Refuses to run against anything that is not a local MongoDB.
 */
const path = require("path");
const bcrypt = require(path.join(__dirname, "..", "node_modules", "bcryptjs"));
const { MongoClient } = require(path.join(__dirname, "..", "node_modules", "mongodb"));

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB = process.env.MONGODB_DB || "janman_test";
const PASSWORD = process.env.TEST_PASSWORD || "Test@1234";

// Safety rail: never let this script point at Atlas or any remote cluster.
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URI)) {
  console.error(
    `Refusing to seed: MONGODB_URI must be a local MongoDB.\n  got: ${URI}\n` +
      `  expected something like mongodb://127.0.0.1:27017`
  );
  process.exit(1);
}

const SETTLEMENTS = [
  { code: "refugee_colony", label: "Housing Board", hhPrefix: "REF" },
  { code: "loot_mohalla", label: "Loot Mohalla", hhPrefix: "LOO" },
  { code: "singhia_tola", label: "Kalijaan 2/Singhia Tola", hhPrefix: "SIN" },
  { code: "buxa_ghat", label: "Buxa Ghat", hhPrefix: "BUX" },
  { code: "maha_dalit_tola", label: "Rajendar Nagar/Mahadalit Tola", hhPrefix: "MHD" },
  { code: "kalijaan_naya_tola", label: "Kalijaan Naya Tola", hhPrefix: "KAL" },
  { code: "khatal_patti", label: "Sriram Tola", hhPrefix: "SRI" },
  { code: "dhangar_tola", label: "Anoop Nagar/Dhangar Tola", hhPrefix: "DHA" },
  { code: "ambedkar_nagar", label: "Raja Tola/Ambedkar Nagar", hhPrefix: "AMB" },
  { code: "damka_tola", label: "Bargeshnagar", hhPrefix: "DAM" },
  { code: "shanti_kabra", label: "Shanti Kabra", hhPrefix: "SHA" },
  { code: "kheruganj", label: "Kheruganj", hhPrefix: "KHE" },
];

const USERS = [
  { role: "mis", name: "Test MIS", email: "mis@test.local" },
  { role: "director", name: "Test Director", email: "director@test.local" },
  { role: "programme_manager", name: "Test Programme Manager", email: "pm@test.local" },
  { role: "accountant", name: "Test Accountant", email: "finance@test.local" },
  { role: "cm", name: "Test Mobiliser", email: "cm@test.local", mobiliserCode: "M01" },
];

(async () => {
  const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
  const db = client.db(DB);
  console.log(`seeding ${URI}/${DB}`);

  // Project — community mobilisers need one.
  const projects = db.collection("projects");
  let project = await projects.findOne({ name: "Purnea Urban Initiative" });
  if (!project) {
    const now = new Date();
    const r = await projects.insertOne({
      name: "Purnea Urban Initiative",
      currency: "INR",
      totalFunds: 0,
      spentFunds: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    project = { _id: r.insertedId };
    console.log("  project created");
  }

  // Communities
  const settlements = db.collection("settlements");
  await settlements.createIndex({ code: 1 }, { unique: true });
  for (const [i, s] of SETTLEMENTS.entries()) {
    const now = new Date();
    await settlements.updateOne(
      { code: s.code },
      { $set: { ...s, active: true, order: i, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
  }
  console.log(`  ${SETTLEMENTS.length} communities ready`);

  // One account per role, password reset every run so it is always known.
  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const u of USERS) {
    const now = new Date();
    await users.updateOne(
      { email: u.email },
      {
        $set: {
          role: u.role,
          name: u.name,
          email: u.email,
          passwordHash: hash,
          mobiliserCode: u.mobiliserCode,
          projectId: u.role === "cm" ? project._id : undefined,
          communities: [],
          active: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }

  console.log("\nsign in with any of these — password: " + PASSWORD);
  for (const u of USERS) console.log(`  ${u.role.padEnd(18)} ${u.email}`);
  await client.close();
})().catch((e) => {
  console.error("seed failed:", e.message);
  process.exit(1);
});
