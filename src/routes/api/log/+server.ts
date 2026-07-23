import { json } from '@sveltejs/kit'
import { supabaseAdmin } from '$lib/server/supabase'

export async function POST({ request }) {
  const entries = await request.json()
  const batch = Array.isArray(entries) ? entries : [entries]

  const rows = batch.map((e: Record<string, unknown>) => ({
    level: e.level || 'log',
    message: typeof e.message === 'string' ? e.message.slice(0, 5000) : String(e.message || ''),
    stack: typeof e.stack === 'string' ? e.stack.slice(0, 10000) : null,
    url: typeof e.url === 'string' ? e.url.slice(0, 1000) : null,
    user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
  }))

  const { error } = await supabaseAdmin.from('client_logs').insert(rows)
  if (error) {
    console.error('[api/log] insert error:', error)
    return json({ ok: false, error: error.message }, { status: 500 })
  }

  return json({ ok: true })
}
