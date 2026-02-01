import { ApiError } from "./errors";
import type { ProjectRef } from "./types";

export function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("invalid_request", `${field} is required`, { field });
  }
  return value.trim();
}

export function validateProjectRef(ref: ProjectRef | undefined | null): void {
  if (ref == null) {
    throw new ApiError("invalid_request", "projectRef is required", { field: "projectRef" });
  }
  if (typeof ref === "string") {
    assertNonEmptyString(ref, "projectRef");
    return;
  }
  const hasFullName = typeof ref.fullName === "string" && ref.fullName.trim().length > 0;
  const hasId = typeof ref.id === "string" && ref.id.trim().length > 0;
  const hasTag = typeof ref.tag === "string" && ref.tag.trim().length > 0;
  if (!hasFullName && !hasId && !hasTag) {
    throw new ApiError("invalid_request", "projectRef must include fullName, id, or tag", {
      field: "projectRef",
    });
  }
}

export function validateCreateProjectRequest(req: any): void {
  assertNonEmptyString(req?.name, "name");
  assertNonEmptyString(req?.tag, "tag");
  assertNonEmptyString(req?.id, "id");
  assertNonEmptyString(req?.dimension, "dimension");
  assertNonEmptyString(req?.category, "category");
}

export function validateCreateEntityRequest(req: any): void {
  validateProjectRef(req?.projectRef);
  assertNonEmptyString(req?.entityTypeId, "entityTypeId");
}

export function validatePatchMarkerRequest(req: any): void {
  assertNonEmptyString(req?.path, "path");
  assertNonEmptyString(req?.marker, "marker");
  assertNonEmptyString(req?.content, "content");
}

export function validatePatchSectionRequest(req: any): void {
  assertNonEmptyString(req?.path, "path");
  assertNonEmptyString(req?.heading, "heading");
  assertNonEmptyString(req?.content, "content");
}
