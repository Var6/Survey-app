import { json, handleError, requireUser } from "@/lib/api";
import { usersCol } from "@/lib/models";
import { publicUser } from "@/lib/serialize";
import { r2Configured, buildKey, putObject } from "@/lib/r2";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!r2Configured()) {
      return json({ error: "Image storage (R2) is not configured in .env.local" }, 503);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "No file provided" }, 400);
    if (!file.type.startsWith("image/")) {
      return json({ error: "Only image files are allowed" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: "File too large (max 5 MB)" }, 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const key = buildKey("avatars", file.name || `avatar-${user._id}.jpg`);
    const { url } = await putObject(key, buf, file.type);

    const users = await usersCol();
    await users.updateOne(
      { _id: user._id },
      { $set: { avatarUrl: url, avatarKey: key, updatedAt: new Date() } }
    );
    const updated = await users.findOne({ _id: user._id });
    return json({ user: publicUser(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
