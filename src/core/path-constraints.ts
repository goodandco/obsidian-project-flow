import { sanitizePath } from "./path-sanitizer";

export function isSafeRelativePath(path: string): boolean {
  if (!path) return true;
  if (path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/").filter(Boolean);
  return !segments.some((seg) => seg === "." || seg === "..");
}

export function isPathWithinRoot(path: string, root: string): boolean {
  const safePath = sanitizePath(path);
  const safeRoot = sanitizePath(root);
  if (!safeRoot) return false;
  return safePath === safeRoot || safePath.startsWith(`${safeRoot}/`);
}
