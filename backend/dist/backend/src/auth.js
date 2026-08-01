import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
const BCRYPT_ROUNDS = 10;
function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET must be set');
    return new TextEncoder().encode(secret);
}
export function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}
export function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function createToken(userId) {
    return new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(getSecret());
}
const VALID_API_KEYS = new Set((process.env.API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean));
function extractBearer(request) {
    const auth = request.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
function extractApiKey(request) {
    return request.headers.get('x-api-key');
}
export async function authenticate(request) {
    const bearer = extractBearer(request);
    if (bearer) {
        try {
            const { payload } = await jwtVerify(bearer, getSecret());
            if (typeof payload.sub === 'string') {
                return { userId: payload.sub, authMethod: 'jwt' };
            }
        }
        catch {
            return { userId: null, authMethod: 'none' };
        }
    }
    const apiKey = extractApiKey(request);
    if (apiKey && VALID_API_KEYS.has(apiKey)) {
        return { userId: '__api__', authMethod: 'api_key' };
    }
    return { userId: null, authMethod: 'none' };
}
//# sourceMappingURL=auth.js.map