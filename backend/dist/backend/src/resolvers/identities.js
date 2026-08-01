function toIdentity(row) {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        goals: row.goals ?? [],
    };
}
export const identityResolvers = {
    Query: {
        identities: async (_, __, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('identities').select('*').eq('user_id', ctx.userId).order('name');
            if (error)
                throw new Error(error.message);
            return data.map(toIdentity);
        },
        identity: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('identities').select('*').eq('id', args.id).single();
            if (error)
                return null;
            return toIdentity(data);
        },
    },
    Mutation: {
        createIdentity: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('identities').insert({
                id: crypto.randomUUID(),
                user_id: ctx.userId,
                name: args.name,
                description: args.description,
                goals: args.goals,
            }).select('*').single();
            if (error)
                throw new Error(error.message);
            return toIdentity(data);
        },
        updateIdentity: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const updates = {};
            if (args.name !== undefined)
                updates.name = args.name;
            if (args.description !== undefined)
                updates.description = args.description;
            if (args.goals !== undefined)
                updates.goals = args.goals;
            const { data, error } = await ctx.db.from('identities').update(updates).eq('id', args.id).eq('user_id', ctx.userId).select('*').single();
            if (error)
                throw new Error(error.message);
            return toIdentity(data);
        },
        deleteIdentity: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { error } = await ctx.db.from('identities').delete().eq('id', args.id).eq('user_id', ctx.userId);
            if (error)
                throw new Error(error.message);
            return true;
        },
    },
};
//# sourceMappingURL=identities.js.map