import { redirect } from '@sveltejs/kit'
import { createServerClient } from '@supabase/ssr'
import { env } from '$env/dynamic/public'

export const GET = async (event) => {
  const { url, cookies } = event
  const code = url.searchParams.get('code')
  if (code) {
    const supabase = createServerClient(
      env.PUBLIC_STORE_SUPABASE_URL || '',
      env.PUBLIC_STORE_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() { return cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies.set(name, value, { ...options, path: '/' })
            )
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }
  throw redirect(303, '/')
}
