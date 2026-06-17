export interface Identity {
	id: string;
	name: string; // e.g., "The Athlete", "The Reader"
	description?: string;
	goals: string[]; // Aspirational goals associated with this identity
	createdAt: Date;
}

export type Tag = string;