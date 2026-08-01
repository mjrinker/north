function toSettings(row) {
    return {
        userId: row.user_id,
        resetTime: row.reset_time,
        themeMode: row.theme_mode,
        oled: row.oled ?? false,
        accentColor: row.accent_color,
        mainColor: row.main_color,
        launchScreen: row.launch_screen,
        updatedAt: row.updated_at,
    };
}
export const settingsResolvers = {
    Query: {
        settings: async (_, __, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const { data, error } = await ctx.db.from('user_settings').select('*').eq('user_id', ctx.userId).single();
            if (error)
                return null;
            return toSettings(data);
        },
    },
    Mutation: {
        upsertSettings: async (_, args, ctx) => {
            if (!ctx.userId)
                throw new Error('Unauthorized');
            const updates = { user_id: ctx.userId, updated_at: new Date().toISOString() };
            if (args.input.resetTime !== undefined)
                updates.reset_time = args.input.resetTime;
            if (args.input.themeMode !== undefined)
                updates.theme_mode = args.input.themeMode;
            if (args.input.oled !== undefined)
                updates.oled = args.input.oled;
            if (args.input.accentColor !== undefined)
                updates.accent_color = args.input.accentColor;
            if (args.input.mainColor !== undefined)
                updates.main_color = args.input.mainColor;
            if (args.input.launchScreen !== undefined)
                updates.launch_screen = args.input.launchScreen;
            const { data, error } = await ctx.db.from('user_settings').upsert(updates).select('*').single();
            if (error)
                throw new Error(error.message);
            return toSettings(data);
        },
    },
};
//# sourceMappingURL=settings.js.map