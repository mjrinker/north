// src/lib/featureFlags.ts
import { getFeaturesForRoles, getPermissionsForRoles, type Feature, type Permission } from '../types/auth'

export function userHasFeature(roles: string[], feature: Feature): boolean {
  return getFeaturesForRoles(roles).includes(feature)
}

export function userHasPermission(roles: string[], perm: Permission): boolean {
  return getPermissionsForRoles(roles).includes(perm)
}
