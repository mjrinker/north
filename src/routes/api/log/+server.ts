import { json } from '@sveltejs/kit'
import { supabaseAdmin } from '$lib/server/supabase'

function parseEntries(body: string, ua: string | null) {
  let entries: any[]
  try {
    entries = JSON.parse(body)
    if (!Array.isArray(entries)) entries = [entries]
  } catch {
    entries = [{ level: 'log', message: body }]
  }
  return entries.map((e: Record<string, unknown>) => ({
    level: e.level || 'log',
    message: typeof e.message === 'string' ? e.message.slice(0, 5000) : String(e.message || ''),
    stack: typeof e.stack === 'string' ? e.stack.slice(0, 10000) : null,
    url: typeof e.url === 'string' ? e.url.slice(0, 1000) : null,
    user_agent: ua ? ua.slice(0, 500) : null,
  }))
}

export async function POST({ request }) {
  const body = await request.text()
  const rows = parseEntries(body, request.headers.get('user-agent'))
  const { error } = await supabaseAdmin.from('client_logs').insert(rows)
  if (error) {
    console.error('[api/log] insert error:', error)
    return json({ ok: false, error: error.message }, { status: 500 })
  }
  return json({ ok: true })
}

export async function GET({ url, request }) {
  const body = url.searchParams.get('body') || ''
  const rows = parseEntries(body, request.headers.get('user-agent'))
  const { error } = await supabaseAdmin.from('client_logs').insert(rows)
  if (error) {
    console.error('[api/log] insert error:', error)
    return new Response('error', { status: 500 })
  }
  return new Response('ok', { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
