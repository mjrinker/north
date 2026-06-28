export interface Schedule {
	frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
	interval: number; // e.g., every 2 days, every 3 weeks
	
	// Frequency-specific configuration
	daysOfWeek?: number[]; // 0-6 for weekly/monthly patterns
	dayOfMonth?: number;    // 1-31 for monthly patterns
	daysPerWeek?: number;   // target completions per week (e.g., 3 days a week)
	
	startDate: Date;
	endDate?: Date;
	preferredTime?: string; // HH:MM 24h format
	
	// For complex recurrence patterns (e.g., iCal RRULE)
	customRule?: string; 
}