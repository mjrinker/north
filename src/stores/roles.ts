// src/stores/roles.ts
import { writable } from 'svelte/store'
import { user } from './auth'
import { gql } from '../lib/api'
import { encodeId, decodeId } from '../lib/globalId'

export const userRoles = writable<string[]>([])

let currentUserId: string | null = null

user.subscribe(async (u) => {
  const uid = u?.id ?? null
  if (uid && uid !== currentUserId) {
    currentUserId = uid
    await fetchRoles()
  } else if (!uid) {
    currentUserId = null
    userRoles.set([])
  }
})

async function fetchRoles() {
  try {
    const data = await gql<{ myRoles: string[] }>(`query { myRoles }`)
    userRoles.set(data?.myRoles ?? [])
  } catch {
    userRoles.set([])
  }
}

export async function setUserRoles(targetUserId: string, roles: string[]) {
  await gql(`mutation ($userId: ID!, $roles: [String!]!) { setRoles(userId: $userId, roles: $roles) }`, {
    userId: encodeId('User', targetUserId),
    roles,
  })
  if (targetUserId === currentUserId) {
    userRoles.set(roles)
  }
}

export async function getAllUsersWithRoles(): Promise<{ id: string; email: string; roles: string[] }[]> {
  const data = await gql<{ usersWithRoles: { id: string; email: string; name?: string | null; roles: string[] }[] }>(
    `query { usersWithRoles { id email name roles } }`,
  )
  return (data?.usersWithRoles ?? []).map(u => ({ id: decodeId(u.id), email: u.email, roles: u.roles }))
}
