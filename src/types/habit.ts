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
	createdAt: Date;
	updatedAt: Date;
}

export interface HabitMetadata {
	color?: string;
	icon?: string;
	remindersEnabled: boolean;
	reminderAdvanceMinutes: number;
	streakFreezeDays: number;
	allowBackdating: boolean;
	externalIds?: Record<string, string>;
}