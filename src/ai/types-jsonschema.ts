export type JSONSchema7TypeName =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array";

export interface JSONSchema7 {
  type?: JSONSchema7TypeName | JSONSchema7TypeName[];
  description?: string;
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  enum?: Array<string | number | boolean | null>;
  items?: JSONSchema7;
  additionalProperties?: boolean;
  anyOf?: JSONSchema7[];
  oneOf?: JSONSchema7[];
}
