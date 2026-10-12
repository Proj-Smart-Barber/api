import { createHash } from "node:crypto";

function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${k}:${canonicalStringify(obj[k])}`);
  return `{${entries.join(",")}}`;
}

export function canonicalOperationHash(payload: unknown): string {
  const canonical = canonicalStringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}
