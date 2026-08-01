import type { YogaInitialContext } from 'graphql-yoga';
import type { SupabaseClient } from '@supabase/supabase-js';
export interface GraphQLContext {
    userId: string | null;
    db: SupabaseClient;
}
export declare function buildContext(initial: YogaInitialContext): Promise<GraphQLContext>;
