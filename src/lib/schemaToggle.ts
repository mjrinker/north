export type SchemaVersion = 'old' | 'new';

let schema: SchemaVersion = 'old';

try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('schema_toggle') : null;
  if (saved === 'old' || saved === 'new') schema = saved;
} catch {}

export function getSchema(): SchemaVersion {
  return schema;
}

export function setSchema(v: SchemaVersion) {
  schema = v;
  try { localStorage.setItem('schema_toggle', v); } catch {}
}

export function toggleSchema(): SchemaVersion {
  const next = schema === 'old' ? 'new' : 'old';
  setSchema(next);
  return next;
}
