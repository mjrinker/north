export interface AppUser {
  id: string
  email?: string
  name?: string
  avatar?: string
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
