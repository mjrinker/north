// src/types/auth.ts

export type Feature =
  | 'stats'
  | 'sync'
  | 'beta'
  | 'IOS_NATIVE_UI';

export type Permission =
  | 'access_admin'
  | 'manage_roles'

export interface RoleDefinition {
  name: string
  label: string
  description: string
  features: Feature[]
  permissions: Permission[]
}

export interface UserRole {
  userId: string
  roles: string[]
  updatedAt: number
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: 'default',
    label: 'Default',
    description: 'Standard user with no special access',
    features: [],
    permissions: [],
  },
  {
    name: 'beta',
    label: 'Beta Tester',
    description: 'Access to preview features',
    features: ['stats', 'beta', 'IOS_NATIVE_UI'],
    permissions: [],
  },
  {
    name: 'admin',
    label: 'Admin',
    description: 'Full access to all features and user management',
    features: ['stats', 'sync', 'beta'],
    permissions: ['access_admin', 'manage_roles'],
  },
]

export function getRoleDefinitions(): RoleDefinition[] {
  return ROLE_DEFINITIONS
}

export function getFeaturesForRoles(roleNames: string[]): Feature[] {
  const result = new Set<Feature>()
  for (const r of roleNames) {
    const def = ROLE_DEFINITIONS.find(d => d.name === r)
    if (def) def.features.forEach(f => result.add(f))
  }
  return Array.from(result)
}

export function getPermissionsForRoles(roleNames: string[]): Permission[] {
  const result = new Set<Permission>()
  for (const r of roleNames) {
    const def = ROLE_DEFINITIONS.find(d => d.name === r)
    if (def) def.permissions.forEach(p => result.add(p))
  }
  return Array.from(result)
}

export function getAllRoleNames(): string[] {
  return ROLE_DEFINITIONS.map(r => r.name)
}
