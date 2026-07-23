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
			name: 'fix-host-header',
			configureServer(vite) {
				vite.middlewares.use((req, _res, next) => {
					const authority = req.headers[':authority'];
					const host = req.headers.host;
					const url = req.url;
					const proto = vite.config.server.https ? 'https' : 'http';
					const base = `${proto}://${authority || host}`;
					const full = base + url;
					console.log('[host]', JSON.stringify({ url, host, authority }));
					try {
						new URL(full);
					} catch (e) {
						console.log('[host] INVALID URL:', JSON.stringify(full));
						console.log('[host] host type:', typeof host, 'length:', host?.length);
					}
					if (!host && !authority) {
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
		}),
		{
			name: 'catch-url-error',
			configureServer(vite) {
				vite.middlewares.use((err, req, res, _next) => {
					console.log('[catch]', err?.constructor?.name, '-', err?.message);
					console.log('[catch] url:', req.url, 'host:', req.headers.host);
					if (!res.headersSent) {
						res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
						res.end('<!-- bypassed URL error --><script>location.reload()</script>');
					}
				});
			}
		}
	]
});
