import type { GraphQLContext } from '../context.js';
export declare const habitResolvers: {
    Query: {
        habits: (_: unknown, args: {
            userId?: string;
            status?: string;
            tags?: string[];
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            title: string;
            description: string | null;
            type: string;
            standard: number | null;
            target: number | null;
            unit: string | null;
            schedule: unknown;
            metadata: unknown;
            dependsOn: unknown;
            identityId: string | null;
            tags: string[];
            status: string | null;
            sortOrder: number | null;
            createdAt: string | null;
            updatedAt: string | null;
        }[]>;
        habit: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            title: string;
            description: string | null;
            type: string;
            standard: number | null;
            target: number | null;
            unit: string | null;
            schedule: unknown;
            metadata: unknown;
            dependsOn: unknown;
            identityId: string | null;
            tags: string[];
            status: string | null;
            sortOrder: number | null;
            createdAt: string | null;
            updatedAt: string | null;
        } | null>;
    };
    Mutation: {
        createHabit: (_: unknown, args: {
            input: Record<string, unknown>;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            title: string;
            description: string | null;
            type: string;
            standard: number | null;
            target: number | null;
            unit: string | null;
            schedule: unknown;
            metadata: unknown;
            dependsOn: unknown;
            identityId: string | null;
            tags: string[];
            status: string | null;
            sortOrder: number | null;
            createdAt: string | null;
            updatedAt: string | null;
        }>;
        updateHabit: (_: unknown, args: {
            id: string;
            input: Record<string, unknown>;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            title: string;
            description: string | null;
            type: string;
            standard: number | null;
            target: number | null;
            unit: string | null;
            schedule: unknown;
            metadata: unknown;
            dependsOn: unknown;
            identityId: string | null;
            tags: string[];
            status: string | null;
            sortOrder: number | null;
            createdAt: string | null;
            updatedAt: string | null;
        }>;
        deleteHabit: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
    };
};
