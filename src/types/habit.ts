import type { Schedule } from './schedule';

export type HabitType = 'binary' | 'quantity' | 'duration' | 'partial' | 'conditional';
export type HabitStatus = 'active' | 'paused' | 'archived';

export interface Habit {
	id: string;
	title: string;
	type: HabitType;
	
	// The numeric value required for "Standard" success
	standard: number; 
	// The numeric value for "Target" success (optional)
	target?: number; 
	// The unit of measurement (e.g., "pages", "minutes", "glasses")
	unit: string; 
	
	schedule: Schedule;
	metadata: HabitMetadata;
	
	identityId?: string; // Optional association with an Identity
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
	externalIds?: Record<string, string>; // Mapping for imports (e.g., { loop: "123" })
}