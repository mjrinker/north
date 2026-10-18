import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  client = createClient(url, key);
  return client;
}

// Upserts keyed on `id` run with the service-role key, so an id belonging to
// another user would otherwise be overwritten (and re-assigned). Refuse unless
// the row is new or already owned by `userId`.
export async function assertOwnedOrNew(db: SupabaseClient, table: string, id: string, userId: string): Promise<void> {
  const { data, error } = await db.from(table).select('user_id').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (data && (data as { user_id: string }).user_id !== userId) throw new Error('Forbidden');
}

// Escapes LIKE wildcards so `.ilike(col, escapeLike(v))` is a case-insensitive
// exact match (emails routinely contain `_`).
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}
