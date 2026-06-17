export type CompletionResult = {
	standardMet: boolean;
	targetMet: boolean;
	progressPercentage: number; // 0.0 to 1.0+ (1.0 = standard met)
};