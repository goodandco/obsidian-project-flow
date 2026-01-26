import type { JSONSchema7 } from "./types-jsonschema";

export interface SchemaValidationError {
  path: string;
  message: string;
}

export function validateSchema(
  schema: JSONSchema7,
  value: unknown,
  path = "$",
  errors: SchemaValidationError[] = [],
): SchemaValidationError[] {
  if (!schema) return errors;
  const allowedTypes = schema.type
    ? Array.isArray(schema.type)
      ? schema.type
      : [schema.type]
    : [];

  if (allowedTypes.length > 0) {
    const ok = allowedTypes.some((t) => isType(t, value));
    if (!ok) {
      errors.push({ path, message: `Expected ${allowedTypes.join("|")}` });
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(value as any)) {
    errors.push({ path, message: `Value not in enum` });
  }

  if (schema.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const required = schema.required || [];
    required.forEach((key) => {
      if (!(key in obj)) {
        errors.push({ path: `${path}.${key}`, message: "Missing required field" });
      }
    });
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateSchema(propSchema, obj[key], `${path}.${key}`, errors);
        }
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, idx) => {
      validateSchema(schema.items as JSONSchema7, item, `${path}[${idx}]`, errors);
    });
  }

  return errors;
}

function isType(type: string, value: unknown): boolean {
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string") return typeof value === "string";
  if (type === "object") return value != null && typeof value === "object" && !Array.isArray(value);
  return true;
}
