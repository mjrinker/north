function toHabit(row) {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        type: row.type,
        standard: row.standard,
        target: row.target,
        unit: row.unit,
        schedule: row.schedule,
        metadata: row.metadata,
        dependsOn: row.depends_on,
        identityId: row.identity_id,
        tags: row.tags ?? [],
        status: row.status,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export const habitResolvers = {
    Query: {
        habits: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            let query = ctx.db.from('habits').select('*').order('sort_order', { ascending: true });
            if (args.userId)
                query = query.eq('user_id', args.userId);
            else
                query = query.eq('user_id', ctx.userId);
            if (args.status)
                query = query.eq('status', args.status);
            if (args.tags?.length)
                query = query.contains('tags', args.tags);
            const { data, error } = await query;
            if (error)
                throw new Error(error.message);
            return data.map(toHabit);
        },
        habit: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('habits').select('*').eq('id', args.id).single();
            if (error)
                return null;
            return toHabit(data);
        },
    },
    Mutation: {
        createHabit: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('habits').insert({
                user_id: ctx.userId,
                title: args.input.title,
                description: args.input.description,
                type: args.input.type,
                standard: args.input.standard,
                target: args.input.target,
                unit: args.input.unit,
                schedule: args.input.schedule,
                metadata: args.input.metadata,
                identity_id: args.input.identityId,
                tags: args.input.tags,
            }).select('*').single();
            if (error)
                throw new Error(error.message);
            return toHabit(data);
        },
        updateHabit: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const updates = {};
            if (args.input.title !== undefined)
                updates.title = args.input.title;
            if (args.input.description !== undefined)
                updates.description = args.input.description;
            if (args.input.standard !== undefined)
                updates.standard = args.input.standard;
            if (args.input.target !== undefined)
                updates.target = args.input.target;
            if (args.input.unit !== undefined)
                updates.unit = args.input.unit;
            if (args.input.schedule !== undefined)
                updates.schedule = args.input.schedule;
            if (args.input.metadata !== undefined)
                updates.metadata = args.input.metadata;
            if (args.input.dependsOn !== undefined)
                updates.depends_on = args.input.dependsOn;
            if (args.input.identityId !== undefined)
                updates.identity_id = args.input.identityId;
            if (args.input.tags !== undefined)
                updates.tags = args.input.tags;
            if (args.input.status !== undefined)
                updates.status = args.input.status;
            if (args.input.sortOrder !== undefined)
                updates.sort_order = args.input.sortOrder;
            const { data, error } = await ctx.db.from('habits').update(updates).eq('id', args.id).eq('user_id', ctx.userId).select('*').single();
            if (error)
                throw new Error(error.message);
            return toHabit(data);
        },
        deleteHabit: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { error } = await ctx.db.from('habits').delete().eq('id', args.id).eq('user_id', ctx.userId);
            if (error)
                throw new Error(error.message);
            return true;
        },
    },
};
//# sourceMappingURL=habits.js.map