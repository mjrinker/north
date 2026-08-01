// src/stores/roles.ts
import { writable } from 'svelte/store'
import { user } from './auth'
import { isNewBackend } from '../lib/backend'
import { gql } from '../lib/api'

export const userRoles = writable<string[]>([])

let currentUserId: string | null = null

user.subscribe(async (u) => {
  const uid = u?.id ?? null
  if (uid && uid !== currentUserId) {
    currentUserId = uid
    await fetchRoles(uid)
  } else if (!uid) {
    currentUserId = null
    userRoles.set([])
  }
})

async function fetchRoles(userId: string) {
  try {
    if (isNewBackend()) {
      const data = await gql<{ myRoles: string[] }>(`query { myRoles }`)
      userRoles.set(data?.myRoles ?? [])
      return
    }

    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', userId)

    if (error) {
      console.warn('Failed to fetch roles:', error.message)
      return
    }
    userRoles.set(data.map((r: any) => r.role_name))
  } catch {
    userRoles.set([])
  }
}

export async function setUserRoles(targetUserId: string, roles: string[]) {
  if (isNewBackend()) {
    await gql(`mutation ($userId: ID!, $roles: [String!]!) { setRoles(userId: $userId, roles: $roles) }`, {
      userId: targetUserId,
      roles,
    })
    if (targetUserId === currentUserId) {
      userRoles.set(roles)
    }
    return
  }

  const { supabase } = await import('../lib/supabase')
  const { error: delErr } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)

  if (delErr) throw delErr

  if (roles.length > 0) {
    const rows = roles.map(role_name => ({
      user_id: targetUserId,
      role_name,
    }))
    const { error: insErr } = await supabase
      .from('user_roles')
      .insert(rows)

    if (insErr) throw insErr
  }

  if (targetUserId === currentUserId) {
    userRoles.set(roles)
  }
}

export async function getAllUsersWithRoles(): Promise<{ id: string; email: string; roles: string[] }[]> {
  if (isNewBackend()) {
    const data = await gql<{ usersWithRoles: { id: string; email: string; name?: string | null; roles: string[] }[] }>(
      `query { usersWithRoles { id email name roles } }`,
    )
    return (data?.usersWithRoles ?? []).map(u => ({ id: u.id, email: u.email, roles: u.roles }))
  }

  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase.rpc('get_all_users_with_roles')
  if (error) {
    console.error('Failed to get users:', error.message)
    return []
  }
  return data as any
}
