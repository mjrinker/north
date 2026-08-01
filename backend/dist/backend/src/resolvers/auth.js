import { createRemoteJWKSet, jwtVerify } from 'jose';
import { hashPassword, verifyPassword, createToken } from '../auth.js';
const googleJWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
async function verifyGoogleToken(idToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId)
        throw new Error('GOOGLE_CLIENT_ID not configured');
    const { payload } = await jwtVerify(idToken, googleJWKS, {
        issuer: ['accounts.google.com', 'https://accounts.google.com'],
        audience: clientId,
    });
    if (!payload.email || typeof payload.email !== 'string') {
        throw new Error('Google token missing email');
    }
    return { email: payload.email, sub: payload.sub };
}
async function findOrCreateGoogleUser(ctx, email) {
    const { data: existing } = await ctx.db.from('users').select('*').eq('email', email).maybeSingle();
    if (existing)
        return existing;
    const { data, error } = await ctx.db.from('users').insert({
        email: email.toLowerCase().trim(),
        password_hash: '',
    }).select('*').single();
    if (error)
        throw new Error(error.message);
    return data;
}
export const authResolvers = {
    Query: {
        me: async (_, __, ctx) => {
            if (!ctx.userId || ctx.userId === '__api__')
                return null;
            const { data, error } = await ctx.db.from('users').select('id, email, created_at').eq('id', ctx.userId).single();
            if (error)
                return null;
            return {
                id: data.id,
                email: data.email,
                createdAt: data.created_at,
            };
        },
    },
    Mutation: {
        signup: async (_, args, ctx) => {
            const email = args.email.trim().toLowerCase();
            if (!email || !args.password || args.password.length < 6) {
                throw new Error('Invalid email or password (min 6 chars)');
            }
            const existing = await ctx.db.from('users').select('id').eq('email', email).maybeSingle();
            if (existing.data)
                throw new Error('Email already registered');
            const passwordHash = await hashPassword(args.password);
            const { data, error } = await ctx.db.from('users').insert({
                email,
                password_hash: passwordHash,
            }).select('id, email, created_at').single();
            if (error)
                throw new Error(error.message);
            const user = data;
            const token = await createToken(user.id);
            return { token, user: { id: user.id, email: user.email, createdAt: user.created_at } };
        },
        login: async (_, args, ctx) => {
            const email = args.email.trim().toLowerCase();
            const { data, error } = await ctx.db.from('users').select('*').eq('email', email).single();
            if (error || !data)
                throw new Error('Invalid email or password');
            const user = data;
            if (!user.password_hash)
                throw new Error('This account uses Google Sign-In');
            const valid = await verifyPassword(args.password, user.password_hash);
            if (!valid)
                throw new Error('Invalid email or password');
            const token = await createToken(user.id);
            return { token, user: { id: user.id, email: user.email, createdAt: user.created_at } };
        },
        googleSignIn: async (_, args, ctx) => {
            const { email } = await verifyGoogleToken(args.idToken);
            const user = await findOrCreateGoogleUser(ctx, email);
            const token = await createToken(user.id);
            return { token, user: { id: user.id, email: user.email, createdAt: user.created_at } };
        },
    },
};
//# sourceMappingURL=auth.js.map