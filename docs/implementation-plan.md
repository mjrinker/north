# North Technical Implementation Plan

## 1. Domain Model (TypeScript Structures)

**Habit Definition**
```ts
interface Habit {
  id: string;
  title: string;
  type: 'binary' | 'quantity' | 'duration' | 'partial' | 'conditional';
  standard: number | string; // e.g., "1 page" for reading
  target?: number | string; // Optional target goal
  schedule: Schedule;
  states: HabitState[];
  identity?: Identity; // Optional identity reference
  metadata: HabitMetadata; // custom notes, etc.
  createdAt: Date;
  updatedAt: Date;
  active: boolean; // habit can be active, paused, or archived
}
```

**Schedule Interface**
```ts
interface Schedule {
  // Base scheduling properties
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number; // e.g., every 2 days, every 3 weeks
  
  // Weekly specifics
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday), for weekly/monthly patterns
  
  // Monthly specifics
  dayOfMonth?: number; // 1-31, for monthly patterns
  weekOfMonth?: number; // 1-5 (first, second, etc. week of month)
  
  // Start/end dates
  startDate: Date;
  endDate?: Date; // optional end date for finite habits
  
  // Time of day (for reminders)
  preferredTime?: string; // HH:MM format in 24-hour time
  
  // Custom recurrence (for complex patterns)
  customRule?: string; // iCal RRULE format or similar
  
  // Derived properties
  nextOccurrence?: Date; // calculated next occurrence
}
```

**HabitState Interface**
```ts
interface HabitState {
  id: string; // unique identifier for this state entry
  habitId: string; // reference to parent habit
  date: Date; // date this state applies to (usually midnight UTC)
  
  // Completion data varies by habit type
  completed: boolean; // whether standard was met
  value?: number | string; // actual value achieved (for quantity/duration/partial)
  
  // For partial progress: progress towards standard (0-1+)
  progress?: number; // 0.0 to 1.0+ where 1.0 = standard met
  
  // Achievement levels
  targetMet?: boolean; // whether target goal was achieved
  
  // Metadata
  notes?: string; // user notes for this completion
  createdAt: Date;
  updatedAt: Date;
}
```

**HabitMetadata Interface**
```ts
interface HabitMetadata {
  // User-defined categorization
  tags: string[]; // free-form tags for organization
  
  // Visual customization
  color?: string; // hex color for habit display
  icon?: string; // icon identifier (from icon set)
  
  // Reminder preferences
  remindersEnabled: boolean;
  reminderAdvance?: number; // minutes before preferred time to remind
  
  // Streak and motivation
  streakFreezeDays: number; // allowed missed days before streak breaks
  
  // Advanced settings
  allowBackdating: boolean; // whether user can log past completions
  hideCompletedDates: boolean; // UI preference to hide completed dates
  
  // External IDs (for import/export syncing)
  externalIds?: Record<string, string>; // e.g., { habitica: "123", loop: "abc" }
  
  // Custom fields (extensible)
  customFields?: Record<string, any>;
}
```

**Identity System**
```ts
interface Identity {
  id: string;
  name: string;
  habits: Habit[];
  goals: string[]; // aspirational identity goals
}

**Storage Adapter Interface**
```ts
interface StorageProvider {
  save(data: any): Promise<void>;
  get(id: string): Promise<any>;
  list(type: 'habits' | 'identities' | 'stats'): Promise<any[]>;
}
```

---

## 2. Habit Engine Design

**Core Workflow**
- Habit creation via form (autocomplete for types/schedules)
- Completion tracking based on type:
  - Binary: Toggle completion
  - Quantity: Track counts
  - Duration: Track time spent
  - Partial: Allow fractional completion
  - Scheduled reminders via browser notifications

**Key Features**
- Partial progress support for all types
- Critical path enforcement (e.g., conditional habits depend on parent habits)
- Multi-day streaks tracking

---

## 3. Scheduling System Design

**Supported Patterns**
- Daily/weekly/monthly recurrence
- Custom delays (e.g., "every 3 days")
- Start date scheduling

**Implementation**
- Use SvelteKit Server Actions for daylight savings adjustments
- Store schedules as normalized JSON (`startDate`, `interval`)
- Local scheduler runs in background (e.g., setInterval)

---

## 4. Standard vs Target Progress System

**Data Structure**
```ts
interface Progress {
  completed: number;
  // Actual completion

  standard: number;
  // Minimum required
target: number;
  // Ideal goal
}
```

**UX Integration**
- Dual progress bars (standard vs target)
- Percentage indicators for both
- Alerts when target is unachievable in time

---

## 5. Identity System

**Design Philosophy**
- Fully optional: No onboarding required
- Identity acts as a thematic grouping (e.g., "Athlete" groups fitness habits)

**Implementation**
- Identity UI only appears if user adds it
- Habits can belong to multiple identities
- Stats aggregated per identity (future)

---

## 6. Sync Architecture

**Current: Box Sync**
- Store habits/identities locally in IndexedDB
- Sync to Box via REST API when online
- Conflict resolution: Priority order (local > remote)

**Future Providers**
- Google Drive/Dropbox via adapter pattern
- Modular `StorageProvider` interface

**Offline-First Flow**
1. Local changes saved to IndexedDB
2. On reconnect, POST to sync endpoint
3. Apply server changes to local store

---

## 7. Local Storage Strategy

**IndexedDB Design**
- Versioned schema (upgrade path for new habit types)
- Indexed by habit ID for fast access
- Statistics stored separately for performance

**Optimizations**
- Batch updates to reduce sync frequency
- Local-only computation for stats requiring calculation

---

## 8. Import/Export System

**Export**
- CSV: Habit title, type, standard, target (simplified)
- JSON: Full habit structure
- Apple Reminders: Map habits to reminder events

**Import**
- Parser for:
  - CSV/JSON
  - Habitica/Loop Habit Tracker JSON
  - Google Sheets column mapping

**API Design**
- `/+import` route for file uploads
- `/-/export` route for downloadable files

---

## 9. Statistics System

**Core Metrics**
- Streaks (daily/weekly/monthly)
- Completion percentages (standard vs target)
- Trend analysis (7/30-day averages)

**Implementation**
- Real-time updates via SvelteKit stores
- Precomputed daily/weekly data chunks stored locally
- Heatmaps rendered via Svelte components

---

# Summary
- **SvelteKit-focused**: Server Actions for auth/sync, Stores for state
- **Offline-first**: IndexedDB as primary store, Box as optional sync
- **Modular**: Identity, sync providers, and import formats decoupled
- **Simplicity**: No monetization, no feature gates, retained accessibility

Next steps:
1. Prototype domain model in Svelte components
2. Implement IndexedDB adapter
3. Build habit creation UI