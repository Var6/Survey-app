import { json, handleError, requireUser, requireRoles, readJson } from "@/lib/api";
import { settlementsCol, surveysCol, ensureIndexes, type SettlementDoc } from "@/lib/models";
import { listSettlements, slugifyCode, suggestPrefix } from "@/lib/settlements";

export const runtime = "nodejs";

/** Everyone signed in can read the community list — the forms need it. */
export async function GET(req: Request) {
  try {
    await requireUser();
    const includeInactive =
      new URL(req.url).searchParams.get("includeInactive") === "1";
    const rows = await listSettlements({ includeInactive });

    // Household counts make it obvious which communities are in use.
    const surveys = await surveysCol();
    const counts = await surveys
      .aggregate<{ _id: string; n: number }>([
        { $group: { _id: "$settlementCode", n: { $sum: 1 } } },
      ])
      .toArray();
    const byCode = new Map(counts.map((c) => [c._id, c.n]));

    return json({
      settlements: rows.map((r) => ({
        id: String(r._id),
        code: r.code,
        label: r.label,
        hhPrefix: r.hhPrefix,
        active: r.active,
        order: r.order,
        surveyCount: byCode.get(r.code) || 0,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Create a community. Director, Programme Manager and MIS. */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("director", "programme_manager", "mis");
    await ensureIndexes();
    const body = await readJson<{ label?: string; hhPrefix?: string }>(req);

    const label = body.label?.trim();
    if (!label) return json({ error: "Community name is required" }, 400);

    const col = await settlementsCol();
    const existing = await listSettlements({ includeInactive: true });

    if (existing.some((s) => s.label.toLowerCase() === label.toLowerCase())) {
      return json({ error: "A community with this name already exists" }, 409);
    }

    // Code and prefix are permanent, so make them unique up front.
    let code = slugifyCode(label);
    if (!code) return json({ error: "Community name must contain letters or numbers" }, 400);
    if (existing.some((s) => s.code === code)) {
      let n = 2;
      while (existing.some((s) => s.code === `${code}_${n}`)) n++;
      code = `${code}_${n}`;
    }

    let prefix = (body.hhPrefix?.trim().toUpperCase() || suggestPrefix(label)).slice(0, 4);
    if (!/^[A-Z]{2,4}$/.test(prefix)) {
      return json({ error: "Household ID prefix must be 2–4 letters" }, 400);
    }
    if (existing.some((s) => s.hhPrefix === prefix)) {
      const base = prefix.slice(0, 2);
      let n = 1;
      while (existing.some((s) => s.hhPrefix === `${base}${n}`)) n++;
      prefix = `${base}${n}`;
    }

    const now = new Date();
    const doc: SettlementDoc = {
      code,
      label,
      hhPrefix: prefix,
      active: true,
      order: existing.length,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    };
    const res = await col.insertOne(doc);
    return json(
      {
        settlement: {
          id: String(res.insertedId),
          code,
          label,
          hhPrefix: prefix,
          active: true,
          order: doc.order,
          surveyCount: 0,
        },
      },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
