export interface HabitEntry {
	id: string;
	habitId: string;
	
	// Use ISO date string (YYYY-MM-DD) for consistent lookups as a key
	date: string; 
	
	// The actual value achieved for this day
	value: number; 
	
	// Derived success states
	standardMet: boolean; // true if value >= habit.standard
	targetMet: boolean;  // true if value >= habit.target
	
	notes?: string;
	updatedAt: Date;
}