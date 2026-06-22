// src/services/roles.ts
import { supabase } from '../lib/supabase'

export async function getUserRolesFromDb(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_name')
    .eq('user_id', userId)

  if (error) {
    console.warn('getUserRoles error:', error.message)
    return []
  }
  return data.map((r: any) => r.role_name)
}

export async function assignRoles(targetUserId: string, roles: string[]) {
  await supabase.from('user_roles').delete().eq('user_id', targetUserId)
  if (roles.length > 0) {
    const rows = roles.map(role_name => ({ user_id: targetUserId, role_name }))
    await supabase.from('user_roles').insert(rows)
  }
}

export async function fetchAllUsers(): Promise<{ id: string; email: string; name: string }[]> {
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) {
    console.warn('fetchAllUsers error (may need service_role):', authErr.message)
    return []
  }
  return authData.users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    name: u.user_metadata?.name ?? u.email ?? '',
  }))
}
