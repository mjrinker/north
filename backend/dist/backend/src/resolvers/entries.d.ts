import type { GraphQLContext } from '../context.js';
export declare const entryResolvers: {
    Query: {
        entries: (_: unknown, args: {
            habitId?: string;
            date?: string;
            dateFrom?: string;
            dateTo?: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            habitId: string;
            date: string;
            value: number;
            standardMet: boolean;
            targetMet: boolean;
            notes: string | null;
            updatedAt: string | null;
        }[]>;
        entry: (_: unknown, args: {
            habitId: string;
            date: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            habitId: string;
            date: string;
            value: number;
            standardMet: boolean;
            targetMet: boolean;
            notes: string | null;
            updatedAt: string | null;
        } | null>;
    };
    Mutation: {
        upsertEntry: (_: unknown, args: {
            input: {
                habitId: string;
                date: string;
                value: number;
                notes?: string;
            };
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            habitId: string;
            date: string;
            value: number;
            standardMet: boolean;
            targetMet: boolean;
            notes: string | null;
            updatedAt: string | null;
        }>;
        deleteEntry: (_: unknown, args: {
            habitId: string;
            date: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
    };
};
