// src/services/roles.ts
import { isNewBackend } from '../lib/backend'
import { gql } from '../lib/api'

export async function getUserRolesFromDb(userId: string): Promise<string[]> {
  if (isNewBackend()) {
    const data = await gql<{ myRoles: string[] }>(`query { myRoles }`)
    return data?.myRoles ?? []
  }

  const { supabase } = await import('../lib/supabase')
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
  if (isNewBackend()) {
    await gql(`mutation ($userId: ID!, $roles: [String!]!) { setRoles(userId: $userId, roles: $roles) }`, {
      userId: targetUserId,
      roles,
    })
    return
  }

  const { supabase } = await import('../lib/supabase')
  await supabase.from('user_roles').delete().eq('user_id', targetUserId)
  if (roles.length > 0) {
    const rows = roles.map(role_name => ({ user_id: targetUserId, role_name }))
    await supabase.from('user_roles').insert(rows)
  }
}

export async function fetchAllUsers(): Promise<{ id: string; email: string; name: string }[]> {
  if (isNewBackend()) {
    const data = await gql<{ usersWithRoles: { id: string; email: string; name?: string | null }[] }>(
      `query { usersWithRoles { id email name } }`,
    )
    return (data?.usersWithRoles ?? []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.name ?? u.email ?? '',
    }))
  }

  const { supabase } = await import('../lib/supabase')
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
