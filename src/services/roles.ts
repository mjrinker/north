// src/services/roles.ts
import { gql } from '../lib/api'

export async function getUserRolesFromDb(): Promise<string[]> {
  const data = await gql<{ myRoles: string[] }>(`query { myRoles }`)
  return data?.myRoles ?? []
}

export async function assignRoles(targetUserId: string, roles: string[]) {
  await gql(`mutation ($userId: ID!, $roles: [String!]!) { setRoles(userId: $userId, roles: $roles) }`, {
    userId: targetUserId,
    roles,
  })
}

export async function fetchAllUsers(): Promise<{ id: string; email: string; name: string }[]> {
  const data = await gql<{ usersWithRoles: { id: string; email: string; name?: string | null }[] }>(
    `query { usersWithRoles { id email name } }`,
  )
  return (data?.usersWithRoles ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name ?? u.email ?? '',
  }))
}
