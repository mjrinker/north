import { createClient } from '@supabase/supabase-js'
import { env } from '$env/dynamic/public'

const supabase = createClient(
  env.PUBLIC_STORE_SUPABASE_URL || '',
  env.PUBLIC_STORE_SUPABASE_ANON_KEY || ''
)

export const handle = async ({ event, resolve }) => {
  const ua = event.request.headers.get('user-agent') || ''
  // Only log mobile Safari requests to reduce noise
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const { error } = await supabase.from('client_logs').insert({
      level: 'info',
      message: `Request: ${event.request.method} ${event.url.pathname}`,
      user_agent: ua.slice(0, 500),
      url: event.url.href,
    })
    if (error) console.error('[hooks] log error:', error)
  }
  return resolve(event)
}
