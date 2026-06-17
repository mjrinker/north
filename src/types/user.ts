import type { Identity } from './identity';
import type { Habit } from './habit';

export interface User {
	id: string;
	email?: string; // Optional for Anonymous Mode
	preferences: UserPreferences;
	identities: Identity[];
	habits: Habit[];
}

export interface UserPreferences {
	theme: 'light' | 'dark' | 'system';
	timezone: string;
	notificationSettings: NotificationSettings;
}

export interface NotificationSettings {
	enabled: boolean;
	quietHours?: { start: string; end: string };
	defaultAdvanceMinutes: number;
}