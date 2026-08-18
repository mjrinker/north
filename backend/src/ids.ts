// Global ID helpers (Relay-style opaque IDs).
// A global ID is the base64 encoding of "<TypeName>:<rawId>", e.g.
//   Habit:23d82b83-f52a-40a6-8ebe-05126ebc2f55
//     -> SGFiaXQ6MjNkODJiODMtZjUyYS00MGE2LThlYmUtMDUxMjZlYmMyZjU1
import { Buffer } from 'node:buffer';

export function toGlobalId(type: string, id: string): string {
  return Buffer.from(`${type}:${id}`, 'utf8').toString('base64');
}

export interface ParsedGlobalId {
  type: string;
  id: string;
}

export function fromGlobalId(globalId: string): ParsedGlobalId | null {
  if (!globalId || !globalId.trim()) return null;
  try {
    const decoded = Buffer.from(globalId, 'base64').toString('utf8');
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

export function requireGlobalId(globalId: string, type: string): string {
  const parsed = fromGlobalId(globalId);
  if (!parsed || parsed.type !== type || !parsed.id) {
    throw new Error(`Invalid ${type} id`);
  }
  return parsed.id;
}

export function requireGlobalIdOptional(globalId: string | null | undefined, type: string): string | null {
  if (globalId == null || globalId === '') return null;
  return requireGlobalId(globalId, type);
}

// dependsOn is stored in the DB as { mode, habitIds: rawUuid[] }. We encode the
// contained habit ids to global ids at the API boundary and decode them back.
type DependsOnLike = { habitIds?: string[]; [k: string]: unknown };

export function encodeDependsOn(dependsOn: unknown): unknown {
  if (!dependsOn || typeof dependsOn !== 'object' || !Array.isArray((dependsOn as DependsOnLike).habitIds)) return dependsOn;
  return {
    ...(dependsOn as DependsOnLike),
    habitIds: (dependsOn as DependsOnLike).habitIds!.map((hid) => toGlobalId('Habit', hid)),
  };
}

export function decodeDependsOn(dependsOn: unknown): unknown {
  if (!dependsOn || typeof dependsOn !== 'object' || !Array.isArray((dependsOn as DependsOnLike).habitIds)) return dependsOn;
  return {
    ...(dependsOn as DependsOnLike),
    habitIds: (dependsOn as DependsOnLike).habitIds!.map((hid) => fromGlobalId(hid)?.id ?? hid),
  };
}

export function toGlobalIds(ids: string[] | null | undefined): string[] {
  return (ids ?? []).filter(Boolean).map((id) => toGlobalId('Habit', id));
}

export function decodeGlobalIds(ids: string[] | null | undefined): string[] {
  return (ids ?? []).filter(Boolean).map((id) => fromGlobalId(id)?.id ?? id);
}