import type { GraphQLContext } from '../context.js';
export declare const settingsResolvers: {
    Query: {
        settings: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            userId: string;
            resetTime: string | null;
            themeMode: string | null;
            oled: boolean;
            accentColor: string | null;
            mainColor: string | null;
            launchScreen: string | null;
            updatedAt: string | null;
        } | null>;
    };
    Mutation: {
        upsertSettings: (_: unknown, args: {
            input: Record<string, unknown>;
        }, ctx: GraphQLContext) => Promise<{
            userId: string;
            resetTime: string | null;
            themeMode: string | null;
            oled: boolean;
            accentColor: string | null;
            mainColor: string | null;
            launchScreen: string | null;
            updatedAt: string | null;
        }>;
    };
};
