"use client";

import { apiFetch } from "./client";

/**
 * Client-side image compression for uploads.
 *
 * Field phones produce 4–12 MB photos while Vercel serverless functions
 * reject request bodies over ~4.5 MB, so every image is downscaled and
 * re-encoded as JPEG on the client before it is POSTed.
 */

const MAX_DIM = 1600; // longest edge after downscale
const TARGET_BYTES = 2 * 1024 * 1024; // stay well under the 4.5 MB limit

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    /* fall through to <img> decode */
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Downscale + re-encode an image as JPEG. Returns a File ready to upload.
 * Falls back to the original file when the browser cannot decode it
 * (e.g. exotic formats) or when compression would not make it smaller.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= TARGET_BYTES) return file;

  const src = await decode(file);
  if (!src) return file;

  const srcW = src.width;
  const srcH = src.height;
  if (!srcW || !srcH) return file;

  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ("close" in src) src.close();

  let quality = 0.82;
  let blob = await toBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await toBlob(canvas, quality);
  }
  if (!blob || blob.size >= file.size) return file;

  const name = (file.name || "image").replace(/\.[^.]*$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

/** Compress then upload an image to R2 via /api/uploads. */
export async function uploadImage(
  file: File,
  prefix: "receipts" | "avatars" | "consent" | "uploads"
): Promise<{ key: string; url: string }> {
  const compressed = await compressImage(file);
  const fd = new FormData();
  fd.append("file", compressed);
  fd.append("prefix", prefix);
  return apiFetch<{ key: string; url: string }>("/api/uploads", {
    method: "POST",
    body: fd,
  });
}
