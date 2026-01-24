import { App } from "obsidian";

export type PatchMode = "lenient" | "strict";

export interface PatchMarkerRequest {
  path: string;
  marker: string;
  content: string;
  patchMode?: PatchMode;
  fallbackHeading?: string;
}

export interface PatchSectionRequest {
  path: string;
  heading: string;
  content: string;
  patchMode?: PatchMode;
}

export function patchTextByMarker(
  text: string,
  marker: string,
  content: string,
  patchMode: PatchMode,
  fallbackHeading?: string,
): { updated: boolean; text: string } {
  const markerToken = normalizeMarker(marker);
  const markerIdx = text.indexOf(markerToken);
  if (markerIdx >= 0) {
    const lineEnd = text.indexOf("\n", markerIdx);
    const insertStart = lineEnd >= 0 ? lineEnd + 1 : text.length;
    const nextMarker = findNextMarker(text, insertStart);
    const insertEnd = nextMarker >= 0 ? nextMarker : text.length;
    const nextText = [
      text.slice(0, insertStart),
      ensureTrailingNewline(content),
      text.slice(insertEnd),
    ].join("");
    return { updated: true, text: nextText };
  }

  if (patchMode === "strict") {
    return { updated: false, text };
  }

  if (fallbackHeading) {
    const headingPatch = patchTextByHeading(text, fallbackHeading, content, patchMode);
    if (headingPatch.updated) return headingPatch;
  }

  return {
    updated: true,
    text: appendHeading(text, fallbackHeading || "AI Notes", content),
  };
}

export function patchTextByHeading(
  text: string,
  heading: string,
  content: string,
  patchMode: PatchMode,
): { updated: boolean; text: string } {
  const headingText = normalizeHeadingText(heading);
  const headingRegex = new RegExp(`^#{1,6}\\s+${escapeRegExp(headingText)}\\s*$`, "m");
  const match = headingRegex.exec(text);
  if (!match || match.index == null) {
    if (patchMode === "strict") {
      return { updated: false, text };
    }
    return { updated: true, text: appendHeading(text, headingText, content) };
  }

  const headingLineStart = match.index;
  const headingLineEnd = text.indexOf("\n", headingLineStart);
  const sectionStart = headingLineEnd >= 0 ? headingLineEnd + 1 : text.length;
  const sectionEnd = findNextHeading(text, sectionStart);
  const nextText = [
    text.slice(0, sectionStart),
    ensureTrailingNewline(content),
    text.slice(sectionEnd),
  ].join("");
  return { updated: true, text: nextText };
}

export async function patchMarkerInFile(
  app: App,
  req: PatchMarkerRequest,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adapter: any = (app.vault as any).adapter;
  const patchMode = req.patchMode ?? "lenient";
  if (!(await adapter.exists(req.path))) {
    return { ok: false, error: `File not found: ${req.path}` };
  }
  const text = await adapter.read(req.path);
  const res = patchTextByMarker(text, req.marker, req.content, patchMode, req.fallbackHeading);
  if (!res.updated) {
    return { ok: false, error: "Marker or heading not found in strict mode." };
  }
  await adapter.write(req.path, res.text);
  return { ok: true };
}

export async function patchSectionInFile(
  app: App,
  req: PatchSectionRequest,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adapter: any = (app.vault as any).adapter;
  const patchMode = req.patchMode ?? "lenient";
  if (!(await adapter.exists(req.path))) {
    return { ok: false, error: `File not found: ${req.path}` };
  }
  const text = await adapter.read(req.path);
  const res = patchTextByHeading(text, req.heading, req.content, patchMode);
  if (!res.updated) {
    return { ok: false, error: "Heading not found in strict mode." };
  }
  await adapter.write(req.path, res.text);
  return { ok: true };
}

function normalizeMarker(marker: string): string {
  const trimmed = marker.trim();
  if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
    return trimmed;
  }
  return `<!-- ${trimmed} -->`;
}

function normalizeHeadingText(heading: string): string {
  return heading.replace(/^#+\s*/, "").trim();
}

function findNextMarker(text: string, start: number): number {
  const markerRegex = /<!--\s*AI:[A-Z_]+\s*-->/g;
  markerRegex.lastIndex = start;
  const match = markerRegex.exec(text);
  return match && match.index != null ? match.index : -1;
}

function findNextHeading(text: string, start: number): number {
  const headingRegex = /^#{1,6}\s+/gm;
  headingRegex.lastIndex = start;
  const match = headingRegex.exec(text);
  return match && match.index != null ? match.index : text.length;
}

function ensureTrailingNewline(content: string): string {
  const trimmed = content ?? "";
  return trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
}

function appendHeading(text: string, heading: string, content: string): string {
  const safeHeading = normalizeHeadingText(heading);
  const prefix = text.endsWith("\n") ? text : `${text}\n`;
  return `${prefix}\n## ${safeHeading}\n${ensureTrailingNewline(content)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
