export type ApiErrorCode =
  | "invalid_request"
  | "validation_error"
  | "not_found"
  | "compat_error";

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const msg = err instanceof Error ? err.message : "Unknown error";
  return new ApiError("validation_error", msg);
}
