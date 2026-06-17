# North Domain Model

This document defines the core TypeScript structures for the North habit tracker. The model is designed for an offline-first, SvelteKit application with an optional identity layer and modular sync providers.

## 1. User & Configuration

```ts
interface User {
  id: string;
  email?: string; // Optional for Anonymous Mode
  preferences: UserPreferences;
  identities: Identity[];
  habits: Habit[];
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  notificationSettings: NotificationSettings;
}

interface NotificationSettings {
  enabled: boolean;
  quietHours?: { start: string; end: string };
  defaultAdvanceMinutes: number;
}
```

## 2. Habits

```ts
type HabitType = 'binary' | 'quantity' | 'duration' | 'partial' | 'conditional';
type HabitStatus = 'active' | 'paused' | 'archived';

interface Habit {
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

interface HabitMetadata {
  color?: string;
  icon?: string;
  remindersEnabled: boolean;
  reminderAdvanceMinutes: number;
  streakFreezeDays: number;
  allowBackdating: boolean;
  externalIds?: Record<string, string>; // Mapping for imports (e.g., { loop: "123" })
}
```

## 3. Habit Entries (Progress Tracking)

```ts
interface HabitEntry {
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
```

## 4. Scheduling System

```ts
interface Schedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // e.g., every 2 days, every 3 weeks
  
  // Frequency-specific configuration
  daysOfWeek?: number[]; // 0-6 for weekly/monthly patterns
  dayOfMonth?: number;    // 1-31 for monthly patterns
  
  startDate: Date;
  endDate?: Date;
  preferredTime?: string; // HH:MM 24h format
  
  // For complex recurrence patterns (e.g., iCal RRULE)
  customRule?: string; 
}
```

## 5. Identity & Organization

```ts
interface Identity {
  id: string;
  name: string; // e.g., "The Athlete", "The Reader"
  description?: string;
  goals: string[]; // Aspirational goals associated with this identity
  createdAt: Date;
}

// Tags are handled as simple strings within the Habit interface
type Tag = string;
```

## 6. Completion Logic

Completion is determined by comparing the `HabitEntry.value` against the `Habit` definition.

```ts
type CompletionResult = {
  standardMet: boolean;
  targetMet: boolean;
  progressPercentage: number; // 0.0 to 1.0+ (1.0 = standard met)
};

/**
 * Logic mapping based on HabitType:
 * - 'binary': value 1 = standardMet, value 0 = not met.
 * - 'quantity': value >= standard = standardMet.
 * - 'duration': value >= standard = standardMet.
 * - 'partial': value is a percentage (0.0-1.0) where 1.0 = standardMet.
 * - 'conditional': depends on the completion of a prerequisite HabitEntry.
 */
```

## 7. Sync Architecture

The sync system is abstracted to allow multiple storage providers (Box, Google Drive, etc.).

```ts
interface SyncResult {
  lastSynced: Date;
  status: 'success' | 'partial' | 'error';
  conflicts: SyncConflict[];
}

interface SyncConflict {
  id: string;
  localVersion: any;
  remoteVersion: any;
  resolution: 'local' | 'remote' | 'manual';
}

interface SyncProvider {
  providerId: string; // e.g., 'box', 'googledrive'
  
  // Atomic operations for individual records
  saveRecord(collection: string, id: string, data: any): Promise<void>;
  getRecord(collection: string, id: string): Promise<any>;
  
  // Bulk operations for synchronization
  uploadAll(): Promise<SyncResult>;
  downloadAll(): Promise<SyncResult>;
  
  // Connectivity check
  isAvailable(): Promise<boolean>;
}
```
