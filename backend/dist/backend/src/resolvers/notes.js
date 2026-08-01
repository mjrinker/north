function toNote(row) {
    return {
        id: row.id,
        habitId: row.habit_id,
        date: row.date,
        content: row.content,
        status: row.status,
        createdAt: row.created_at,
    };
}
export const noteResolvers = {
    Query: {
        notes: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            let query = ctx.db.from('notes').select('*').eq('user_id', ctx.userId);
            if (args.habitId)
                query = query.eq('habit_id', args.habitId);
            if (args.date)
                query = query.eq('date', args.date);
            query = query.order('created_at', { ascending: false });
            const { data, error } = await query;
            if (error)
                throw new Error(error.message);
            return data.map(toNote);
        },
    },
    Mutation: {
        addNote: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('notes').insert({
                id: crypto.randomUUID(),
                user_id: ctx.userId,
                habit_id: args.input.habitId,
                date: args.input.date,
                content: args.input.content,
            }).select('*').single();
            if (error)
                throw new Error(error.message);
            return toNote(data);
        },
        deleteNote: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { error } = await ctx.db.from('notes').update({ status: 'deleted' }).eq('id', args.id).eq('user_id', ctx.userId);
            if (error)
                throw new Error(error.message);
            return true;
        },
    },
};
//# sourceMappingURL=notes.js.map