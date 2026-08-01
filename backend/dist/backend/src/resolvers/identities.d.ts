import type { GraphQLContext } from '../context.js';
export declare const identityResolvers: {
    Query: {
        identities: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            name: string;
            description: string | null;
            goals: string[];
        }[]>;
        identity: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            name: string;
            description: string | null;
            goals: string[];
        } | null>;
    };
    Mutation: {
        createIdentity: (_: unknown, args: {
            name: string;
            description?: string;
            goals?: string[];
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            name: string;
            description: string | null;
            goals: string[];
        }>;
        updateIdentity: (_: unknown, args: {
            id: string;
            name?: string;
            description?: string;
            goals?: string[];
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            userId: string;
            name: string;
            description: string | null;
            goals: string[];
        }>;
        deleteIdentity: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
    };
};
