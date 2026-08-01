import { getDb } from './db.js';
import { authenticate } from './auth.js';
export async function buildContext(initial) {
    const auth = await authenticate(initial.request);
    let db;
    try {
        db = getDb();
    }
    catch (e) {
        throw new Error(`Database not configured: ${e.message}`);
    }
    return { userId: auth.userId, db };
}
//# sourceMappingURL=context.js.map