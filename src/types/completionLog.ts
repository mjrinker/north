export type CompletionAction = 'complete' | 'start' | 'resume' | 'increment' | 'decrement';

export interface CompletionLog {
  id: string;
  habitId: string;
  timestamp: string;
  action: CompletionAction;
  latitude?: number;
  longitude?: number;
}
