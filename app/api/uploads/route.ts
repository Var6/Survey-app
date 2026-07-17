import { json, handleError, requireUser } from "@/lib/api";
import { r2Configured, buildKey, putObject } from "@/lib/r2";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_PREFIX = ["receipts", "avatars", "consent", "uploads"];

export async function POST(req: Request) {
  try {
    await requireUser();
    if (!r2Configured()) {
      return json({ error: "Image storage (R2) is not configured in .env.local" }, 503);
    }

    const form = await req.formData();
    const file = form.get("file");
    const rawPrefix = String(form.get("prefix") || "uploads");
    const prefix = ALLOWED_PREFIX.includes(rawPrefix) ? rawPrefix : "uploads";

    if (!(file instanceof File)) {
      return json({ error: "No file provided" }, 400);
    }
    if (!file.type.startsWith("image/")) {
      return json({ error: "Only image files are allowed" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: "File too large (max 8 MB)" }, 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const key = buildKey(prefix, file.name || "image");
    const res = await putObject(key, buf, file.type);
    return json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
