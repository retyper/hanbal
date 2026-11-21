/** Expand generated value templates without sharing mutable records or nested arrays. */
const copy = (value: unknown): unknown => Array.isArray(value) ? value.map(copy)
  : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) : value

/** Ordered rows retain every exported key; copying retains own undefined fields as well. */
export function expandManifest<T>(templates: readonly T[], rows: readonly (readonly [string, number])[]): Record<string, T> {
  return Object.fromEntries(rows.map(([key, template]) => [key, copy(templates[template])])) as Record<string, T>
}
