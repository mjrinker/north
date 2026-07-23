import { createClient } from '@supabase/supabase-js'
import { env } from '$env/dynamic/public'

export const supabaseAdmin = createClient(
  env.PUBLIC_STORE_SUPABASE_URL || '',
  env.PUBLIC_STORE_SUPABASE_ANON_KEY || ''
)
