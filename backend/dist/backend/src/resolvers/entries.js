function toEntry(row) {
    return {
        id: row.id,
        habitId: row.habit_id,
        date: row.date,
        value: row.value,
        standardMet: row.standard_met,
        targetMet: row.target_met,
        notes: row.notes,
        updatedAt: row.updated_at,
    };
}
export const entryResolvers = {
    Query: {
        entries: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            let query = ctx.db.from('entries').select('*').eq('user_id', ctx.userId);
            if (args.habitId)
                query = query.eq('habit_id', args.habitId);
            if (args.date)
                query = query.eq('date', args.date);
            if (args.dateFrom)
                query = query.gte('date', args.dateFrom);
            if (args.dateTo)
                query = query.lte('date', args.dateTo);
            query = query.order('date', { ascending: false });
            const { data, error } = await query;
            if (error)
                throw new Error(error.message);
            return data.map(toEntry);
        },
        entry: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('entries').select('*').eq('habit_id', args.habitId).eq('date', args.date).single();
            if (error)
                return null;
            return toEntry(data);
        },
    },
    Mutation: {
        upsertEntry: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const existing = await ctx.db.from('entries').select('id').eq('habit_id', args.input.habitId).eq('date', args.input.date).maybeSingle();
            const now = new Date().toISOString();
            const record = {
                id: existing?.data?.id ?? crypto.randomUUID(),
                user_id: ctx.userId,
                habit_id: args.input.habitId,
                date: args.input.date,
                value: args.input.value,
                updated_at: now,
                ...(args.input.notes !== undefined ? { notes: args.input.notes } : {}),
            };
            const { data, error } = await ctx.db.from('entries').upsert(record).select('*').single();
            if (error)
                throw new Error(error.message);
            return toEntry(data);
        },
        deleteEntry: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { error } = await ctx.db.from('entries').delete().eq('habit_id', args.habitId).eq('date', args.date).eq('user_id', ctx.userId);
            if (error)
                throw new Error(error.message);
            return true;
        },
    },
};
//# sourceMappingURL=entries.js.map