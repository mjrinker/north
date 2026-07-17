export interface AppUser {
  id: string
  email?: string
  name?: string
  avatar?: string
}

export interface SuggestedPlace {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  timezone: string
  notificationSettings: NotificationSettings
  places?: SuggestedPlace[];
}

export interface NotificationSettings {
  enabled: boolean
  quietHours?: { start: string; end: string }
  defaultAdvanceMinutes: number
}
