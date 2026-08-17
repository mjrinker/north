export interface AppUser {
  id: string
  email?: string
  name?: string
  avatar?: string
}

// Unified user shape for both backends. Keeps `user_metadata` so the UI can
// read avatar/name without caring which backend produced the user.
export interface AppAuthUser {
  id: string
  email: string | null
  name?: string | null
  avatar?: string | null
  user_metadata?: {
    name?: string
    avatar_url?: string
  }
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  timezone: string
  notificationSettings: NotificationSettings
}

export interface NotificationSettings {
  enabled: boolean
  quietHours?: { start: string; end: string }
  defaultAdvanceMinutes: number
}
