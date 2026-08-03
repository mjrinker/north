import type { Schedule } from './schedule';

export type HabitType = 'binary' | 'quantity' | 'duration';
export type HabitStatus = 'active' | 'paused' | 'archived' | 'deleted';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface DependsOn {
  habitIds: string[];
  mode: 'and' | 'or';
}

export interface Habit {
	id: string;
	title: string;
	description?: string;
	type: HabitType;
	
	// The numeric value required for "Standard" success
	standard: number; 
	// The numeric value for "Target" success (optional)
	target?: number; 
	// The unit of measurement (e.g., "pages", "minutes", "glasses")
	unit: string; 
	
	schedule: Schedule;
	metadata: HabitMetadata;
	
	// Optional dependency: complete this habit only if dependencies are met
	dependsOn?: DependsOn;
	
	identityId?: string;
	tags: string[];
	
	status: HabitStatus;
	// Optional global sort position used when the user picks custom ordering
	sortOrder?: number;
	createdAt: Date;
	updatedAt: Date;
}

export type HabitCategory = 'build' | 'break';

export interface HabitMetadata {
	color?: string;
	icon?: string;
	emoji?: string;
	category?: HabitCategory;
	// ISO date (YYYY-MM-DD) the habit auto-resumes on/after while paused; undefined = indefinite pause
	pauseUntil?: string;
	remindersEnabled: boolean;
	reminderAdvanceMinutes: number;
	streakFreezeDays: number;
	allowBackdating: boolean;
	externalIds?: Record<string, string>;
}