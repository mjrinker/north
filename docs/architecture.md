# Architecture

## Tech Stack

Frontend:

* SvelteKit
* TypeScript
* Progressive Web App (PWA)

Hosting:

* Vercel

Version Control:

* Git
* GitHub (Private Repository)

## Application Modes

### Anonymous Mode

Users may use North without creating an account.

Capabilities:

* Local storage
* Offline support
* Export backups
* Import backups

Limitations:

* No cloud synchronization

### Account Mode

Users may create an account.

Authentication Providers:

* Google
* Apple
* Email/Password

Capabilities:

* Cloud synchronization
* Multi-device access
* Backup and recovery
* Offline-first synchronization

## Storage Providers

Storage should be abstracted behind a provider interface.

Potential providers:

* Box
* Google Drive
* Dropbox
* Additional providers in the future

Authentication and storage providers should remain independent.

Examples:

* Google login + Box storage
* Apple login + Dropbox storage
* Email login + Box storage

## Habit Types

### Binary

Examples:

* Make Bed
* Pray
* Read Scriptures

### Quantity

Examples:

* Drink 8 Glasses of Water
* Complete 100 Pushups

### Duration

Examples:

* Read for 30 Minutes
* Walk for 20 Minutes

### Partial Progress

Examples:

* Read 12 of 30 Minutes
* Drink 5 of 8 Glasses

### Conditional Habits

Habit completion may depend on other habit outcomes.

## Habit States

Habits may be:

* Active
* Paused
* Archived

Users may backdate habit entries.

## Scheduling

Supported scheduling includes:

* Daily
* Weekly
* Monthly
* Biweekly
* Every X Days
* X Days Per Week
* X Days Per Month
* Specific Days of Week
* Future Start Dates
* Custom recurrence patterns

## Progress Model

Habits may define:

### Standard

The minimum successful completion.

### Target

The ideal completion goal.

Examples:

Read

* Standard: 1 page
* Target: 30 pages

Exercise

* Standard: 10 minutes
* Target: 45 minutes

Statistics should track:

* Success (Standard Achieved)
* Target Achievement

independently.

## Identity Layer

Identity is optional.

Users should never be required to define identities.

Identities may be used as an advanced organizational layer above tags.

Examples:

Identity:

* Athlete

Tags:

* Fitness
* Strength

Habit:

* Bench Press

## Statistics

Planned statistics:

* Current streak
* Longest streak
* Completion percentage
* 7-day trends
* 30-day trends
* Monthly averages
* Daily heatmaps
* Monthly heatmaps
* Identity score (future)

## Notifications

Notification channels:

* Push notifications
* Email notifications

Defaults:

* Disabled by default
* Fully configurable

## Offline Strategy

North should function offline.

Changes should be stored locally and synchronized when connectivity returns.

Conflict-resolution strategy to be defined.

## Import System

North should support importing data from external habit-tracking platforms.

Potential import sources:

* Habitica
* Loop Habit Tracker
* Streaks
* Everyday
* TickTick Habits
* Google Sheets
* CSV
* JSON
* Apple Reminders
* Google Tasks

Import architecture should be extensible.
