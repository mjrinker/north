// Global ID helpers mirroring the backend (backend/src/ids.ts).
// Global IDs are base64("<TypeName>:<rawId>") — see /api-docs.

export function toGlobalId(type: string, id: string): string {
  return btoa(`${type}:${id}`);
}

export function fromGlobalId(globalId: string): { type: string; id: string } | null {
  if (!globalId) return null;
  try {
    const decoded = atob(globalId);
    const sep = decoded.indexOf(':');
    if (sep <= 0) return null;
    const type = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!type || !id) return null;
    return { type, id };
  } catch {
    return null;
  }
}

export function decodeId(globalId: string | null | undefined): string {
  if (globalId == null) return '';
  return fromGlobalId(globalId)?.id ?? globalId;
}

export function encodeId(type: string, id: string | null | undefined): string | null {
  if (id == null || id === '') return null;
  return toGlobalId(type, id);
}
