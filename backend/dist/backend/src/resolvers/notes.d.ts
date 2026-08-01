import type { GraphQLContext } from '../context.js';
export declare const noteResolvers: {
    Query: {
        notes: (_: unknown, args: {
            habitId?: string;
            date?: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            habitId: string;
            date: string;
            content: string | null;
            status: string | null;
            createdAt: string | null;
        }[]>;
    };
    Mutation: {
        addNote: (_: unknown, args: {
            input: {
                habitId: string;
                date: string;
                content?: string;
            };
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            habitId: string;
            date: string;
            content: string | null;
            status: string | null;
            createdAt: string | null;
        }>;
        deleteNote: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
    };
};
