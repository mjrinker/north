export type AuthMethod = 'jwt' | 'api_key' | 'none';

export interface AuthResult {
  userId: string | null;
  authMethod: AuthMethod;
}

const VALID_API_KEYS = new Set(
  (process.env.API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean),
);

function extractBearer(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function extractApiKey(request: Request): string | null {
  return request.headers.get('x-api-key');
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export async function authenticate(request: Request): Promise<AuthResult> {
  const bearer = extractBearer(request);
  if (bearer) {
    const payload = decodeJwtPayload(bearer);
    if (payload && typeof payload.sub === 'string') {
      return { userId: payload.sub, authMethod: 'jwt' };
    }
    if (payload && typeof payload.id === 'string') {
      return { userId: payload.id, authMethod: 'jwt' };
    }
    return { userId: null, authMethod: 'none' };
  }

  const apiKey = extractApiKey(request);
  if (apiKey && VALID_API_KEYS.has(apiKey)) {
    return { userId: '__api__', authMethod: 'api_key' };
  }

  return { userId: null, authMethod: 'none' };
}
