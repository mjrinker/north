// Cursor + offset pagination helpers.
//
// Two pagination styles, on a single connection query:
//   - Cursor:   `first` + `after` (opaque cursor from previous page's `endCursor`).
//     Cursors encode the last item's sort value and id so pages stay stable.
//   - Offset:   `offset` + `limit`.
//
// Cursor format: base64url(JSON.stringify([sortValue, id]))

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
  totalCount: number;
}

export function encodeCursor(sortValue: string | number, id: string): string {
  return Buffer.from(JSON.stringify([sortValue, id])).toString('base64url');
}

export function decodeCursor(cursor: string): { sortValue: string | number; id: string } | null {
  try {
    const [sortValue, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof id !== 'string') return null;
    return { sortValue, id };
  } catch {
    return null;
  }
}

export function clampPageSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(n)));
}

// Resolve pagination mode + effective page size.
export function resolvePage(args: {
  first?: number | null;
  after?: string | null;
  offset?: number | null;
  limit?: number | null;
}): { after?: string; offset: number; limit: number } | { error: string } {
  const hasCursor = args.after !== undefined && args.after !== null;
  const hasOffset = (args.offset !== undefined && args.offset !== null) || (args.limit !== undefined && args.limit !== null);

  if (hasCursor && (args.offset !== undefined && args.offset !== null)) {
    return { error: "Use either cursor pagination ('first'/'after') or offset pagination ('offset'/'limit'), not both." };
  }

  if (hasCursor) {
    return { after: args.after as string, offset: 0, limit: clampPageSize(args.first ?? DEFAULT_PAGE_SIZE) };
  }

  return {
    after: undefined,
    offset: Math.max(0, args.offset ?? 0),
    limit: clampPageSize(args.limit ?? (args.first ?? DEFAULT_PAGE_SIZE)),
  };
}

function quote(v: string | number): string {
  return typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`;
}

function sortValueOf(row: any, orderCol: string): string | number {
  return row[orderCol] ?? '';
}

function cursorOf(row: any, orderCol: string): { sortValue: string | number; id: string } {
  return { sortValue: sortValueOf(row, orderCol), id: row.id };
}

// PostgREST `.or()` filter narrowing to rows AFTER a cursor when ordered by
// `orderCol` (id is the stable tie-breaker in the same direction).
// Represents: (col = X AND id > Y) OR col > X
export function afterOr(orderCol: string, ascending: boolean, c: { sortValue: string | number; id: string }): string {
  const cmp = ascending ? 'gt' : 'lt';
  return `and(${orderCol}.eq.${quote(c.sortValue)},id.${cmp}.${quote(c.id)}),${orderCol}.${cmp}.${quote(c.sortValue)}`;
}

// Reverse of afterOr, used to detect hasPreviousPage.
export function beforeOr(orderCol: string, ascending: boolean, c: { sortValue: string | number; id: string }): string {
  const cmp = ascending ? 'lt' : 'gt';
  return `and(${orderCol}.eq.${quote(c.sortValue)},id.${cmp}.${quote(c.id)}),${orderCol}.${cmp}.${quote(c.sortValue)}`;
}

type SupaQuery = any;

// Runs a paginated query.
//
// `db` is the Supabase client. `build` receives a fresh, unfiltered query builder
// (e.g. db.from('entries')) and returns it WITH the resource filters applied (but
// NO order/range/cursor). `orderCol` is the sort column; `ascending` is applied to
// both the column and the id tie-breaker. `toNode` maps a DB row to a GraphQL node.
export async function runPage<Row, Node>(
  db: any,
  table: string,
  build: (q: SupaQuery) => SupaQuery,
  orderCol: string,
  ascending: boolean,
  args: { first?: number | null; after?: string | null; offset?: number | null; limit?: number | null },
  toNode: (row: Row) => Node,
): Promise<Connection<Node> | { error: string }> {
  const page = resolvePage(args);
  if ('error' in page) return { error: page.error };
  const { after, offset, limit } = page;

  const countResult = await build(db.from(table).select('id', { count: 'exact', head: true }));
  const totalCount = countResult.count ?? 0;

  let pageQuery: SupaQuery = build(db.from(table).select('*'));
  if (after) {
    const c = decodeCursor(after);
    if (!c) return { error: 'Invalid cursor.' };
    pageQuery = pageQuery.or(afterOr(orderCol, ascending, c));
  }

  // Fetch one extra row to detect hasNextPage.
  const result = await pageQuery.order(orderCol, { ascending }).order('id', { ascending }).range(offset, offset + limit);
  const rows: any[] = result.data ?? [];
  const pageRows = rows.slice(0, limit);
  const nodes: Node[] = pageRows.map((r) => toNode(r as Row));
  const hasNextPage = rows.length > limit;

  let hasPreviousPage = offset > 0;
  if (!hasPreviousPage && pageRows.length > 0) {
    const c = cursorOf(pageRows[0], orderCol);
    const probed = await build(db.from(table).select('id').or(beforeOr(orderCol, ascending, c)))
      .order(orderCol, { ascending })
      .order('id', { ascending })
      .range(0, 1);
    hasPreviousPage = ((probed.data ?? []) as any[]).length > 0;
  }

  const startCursor = pageRows.length > 0 ? encodeCursor(sortValueOf(pageRows[0], orderCol), pageRows[0].id) : null;
  const endCursor = pageRows.length > 0 ? encodeCursor(sortValueOf(pageRows[pageRows.length - 1], orderCol), pageRows[pageRows.length - 1].id) : null;

  return {
    nodes,
    pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor },
    totalCount,
  };
}