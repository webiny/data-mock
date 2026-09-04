import { basename, join } from "node:path";

export const LOCAL_IMAGES_DIR = join(process.cwd(), ".webiny", "images");

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function isSafeLocalFileName(fileName: string): boolean {
  if (!fileName || fileName.length === 0) {
    return false;
  }
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return false;
  }
  return fileName === basename(fileName);
}

export function resolveLocalFilePath(fileName: string): string {
  return join(LOCAL_IMAGES_DIR, fileName);
}

export function guessLocalFileContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
