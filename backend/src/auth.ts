import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const BCRYPT_ROUNDS = 10;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be set');
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export type AuthMethod = 'jwt' | 'api_key' | 'none';

export interface AuthResult {
  userId: string | null;
  authMethod: AuthMethod;
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function extractApiKey(request: Request): string | null {
  return request.headers.get('x-api-key');
}

async function resolveApiKey(apiKey: string): Promise<string | null> {
  let db;
  try {
    db = getDb();
  } catch {
    return null;
  }
  try {
    const { data, error } = await db
      .from('api_keys')
      .select('user_id')
      .eq('api_key', apiKey)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { user_id: string }).user_id;
  } catch {
    return null;
  }
}

export async function authenticate(request: Request): Promise<AuthResult> {
  const bearer = extractBearer(request);
  if (bearer) {
    try {
      const { payload } = await jwtVerify(bearer, getSecret());
      if (typeof payload.sub === 'string') {
        return { userId: payload.sub, authMethod: 'jwt' };
      }
    } catch {
      return { userId: null, authMethod: 'none' };
    }
  }

  const apiKey = extractApiKey(request);
  if (apiKey) {
    const userId = await resolveApiKey(apiKey);
    if (userId) {
      try {
        const db = getDb();
        await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('api_key', apiKey);
      } catch {}
      return { userId, authMethod: 'api_key' };
    }
  }

  return { userId: null, authMethod: 'none' };
}
