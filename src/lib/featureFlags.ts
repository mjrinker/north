// src/lib/featureFlags.ts
// Permissions are fixed per role (see types/auth.ts). Features are configured
// per role in the DB via /admin/roles and arrive in the `userFeatures` store.
import { getPermissionsForRoles, type Feature, type Permission } from '../types/auth'

export type { Feature, Permission }

export function userHasPermission(roles: string[], perm: Permission): boolean {
  return getPermissionsForRoles(roles).includes(perm)
}
