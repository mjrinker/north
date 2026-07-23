import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: '0.0.0.0',
		allowedHosts: true,
		cors: true,
	},
	plugins: [
		{
			name: 'fix-request-url',
			configureServer(vite) {
				vite.middlewares.use((req, _res, next) => {
					const normalize = (url) => {
						if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
							try { return new URL(url).pathname + new URL(url).search; } catch {}
						}
						return url;
					};
					req.url = normalize(req.url) ?? req.url;
					req.originalUrl = normalize(req.originalUrl) ?? req.originalUrl;
					if (!req.headers.host) {
						const addr = req.socket?.localAddress;
						const port = req.socket?.localPort || 5173;
						req.headers.host = addr && addr !== '::1'
							? `${addr}:${port}`
							: `localhost:${port}`;
					}
					next();
				});
			}
		},
		Icons({ compiler: 'svelte' }),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') || filename.includes('virtual:') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	]
});
