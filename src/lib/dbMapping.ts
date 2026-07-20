function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function mapKeys(obj: any, fn: (k: string) => string): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(v => mapKeys(v, fn));
  if (typeof obj !== 'object') return obj;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const mapped = fn(key);
    if (key === 'schedule' || key === 'metadata' || key === 'dependsOn') {
      result[mapped] = value;
    } else if (value instanceof Date) {
      result[mapped] = value.toISOString();
    } else if (Array.isArray(value) && key === 'goals') {
      result[mapped] = value;
    } else if (Array.isArray(value) && key === 'tags') {
      result[mapped] = value;
    } else if (typeof value === 'object' && value !== null && key !== 'schedule' && key !== 'metadata' && key !== 'dependsOn') {
      result[mapped] = mapKeys(value, fn);
    } else {
      result[mapped] = value;
    }
  }
  return result;
}

export function fromDbRow<T>(row: any, dateFields: string[] = []): T {
  if (!row) return row;
  const obj = mapKeys(row, toCamelCase);
  for (const field of dateFields) {
    if (obj[field] && typeof obj[field] === 'string') {
      obj[field] = new Date(obj[field]);
    }
  }
  return obj as T;
}

export function toDbRow(data: any, userId: string): any {
  const row = mapKeys(data, toSnakeCase);
  row.user_id = userId;
  return row;
}

export const tableForCollection: Record<string, string> = {
  habits: 'habits',
  entries: 'entries',
  notes: 'notes',
  identities: 'identities',
  settings: 'user_settings',
};

export const dateFieldsForTable: Record<string, string[]> = {
  habits: ['createdAt', 'updatedAt'],
  entries: ['updatedAt'],
  notes: ['createdAt'],
  identities: ['createdAt'],
};
