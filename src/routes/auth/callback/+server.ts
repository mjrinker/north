import { redirect } from '@sveltejs/kit'
import { env } from '$env/dynamic/public'

export const GET = async (event) => {
  const { url } = event
  const code = url.searchParams.get('code')
  if (code) {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      env.PUBLIC_SUPABASE_URL || '',
      env.PUBLIC_SUPABASE_ANON_KEY || ''
    )
    await supabase.auth.exchangeCodeForSession(code)
  }
  throw redirect(303, '/')
}
