import { lookupsCol, ensureIndexes, type LookupDoc } from "./models";

/**
 * Configurable option lists (camp types, meeting types). Seeded once with
 * sensible defaults; MIS / PM / Director add more from the screen. Nothing
 * about the types is hard-coded in the camp or meeting code.
 */
const DEFAULTS: Record<LookupDoc["list"], string[]> = {
  camp_type: [
    "Health camp",
    "Eye-check camp",
    "Vaccination camp",
    "Documents / entitlement camp",
    "Awareness camp",
    "Other",
  ],
  meeting_type: [
    "Community meeting",
    "Women's group meeting",
    "Youth group meeting",
    "Awareness meeting",
    "Other",
  ],
};

export const slugify = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

export async function listLookups(list: LookupDoc["list"]): Promise<LookupDoc[]> {
  await ensureIndexes();
  const col = await lookupsCol();
  if ((await col.countDocuments({ list })) === 0) {
    const now = new Date();
    await col.bulkWrite(
      DEFAULTS[list].map((label, i) => ({
        updateOne: {
          filter: { list, key: slugify(label) },
          update: {
            $setOnInsert: { list, key: slugify(label), label, active: true, order: i, createdAt: now },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }
  return col.find({ list, active: true }).sort({ order: 1, label: 1 }).toArray();
}

export async function addLookup(
  list: LookupDoc["list"],
  labelRaw: string,
  createdBy: LookupDoc["createdBy"]
): Promise<LookupDoc> {
  const label = labelRaw.trim().replace(/\s+/g, " ").slice(0, 60);
  const key = slugify(label);
  if (label.length < 2 || !key) throw new Error("Enter a name for the type");
  await listLookups(list); // make sure defaults exist first
  const col = await lookupsCol();
  const last = await col.find({ list }).sort({ order: -1 }).limit(1).toArray();
  const now = new Date();
  await col.updateOne(
    { list, key },
    {
      $setOnInsert: { list, key, label, order: (last[0]?.order ?? 0) + 1, createdBy, createdAt: now },
      $set: { active: true },
    },
    { upsert: true }
  );
  return (await col.findOne({ list, key }))!;
}

export async function findLookup(list: LookupDoc["list"], key: string) {
  // Seeds the defaults on first use, so creating the very first camp or
  // meeting works even if nobody has opened the type dropdown yet.
  await listLookups(list);
  const col = await lookupsCol();
  return col.findOne({ list, key, active: true });
}
