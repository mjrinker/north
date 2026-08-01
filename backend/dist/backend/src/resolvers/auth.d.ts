import type { GraphQLContext } from '../context.js';
export declare const authResolvers: {
    Query: {
        me: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            id: string;
            email: string;
            createdAt: string;
        } | null>;
    };
    Mutation: {
        signup: (_: unknown, args: {
            email: string;
            password: string;
        }, ctx: GraphQLContext) => Promise<{
            token: string;
            user: {
                id: string;
                email: string;
                createdAt: string;
            };
        }>;
        login: (_: unknown, args: {
            email: string;
            password: string;
        }, ctx: GraphQLContext) => Promise<{
            token: string;
            user: {
                id: string;
                email: string;
                createdAt: string;
            };
        }>;
        googleSignIn: (_: unknown, args: {
            idToken: string;
        }, ctx: GraphQLContext) => Promise<{
            token: string;
            user: {
                id: string;
                email: string;
                createdAt: string;
            };
        }>;
    };
};
