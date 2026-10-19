# Architecture

This document goes one level deeper than the [README](../README.md): how data moves between the device and the server, how the API is shaped and secured, and the rules behind the habit logic.

## Overview

North is two deployables from one repository:

| Part | Location | Runs on |
| --- | --- | --- |
| Web app (PWA) | repository root (`src/`) | Vercel, SvelteKit with `adapter-auto` |
| API | `backend/` | Vercel serverless function (Hono + GraphQL Yoga) |
| Database | `supabase/migrations/` | Supabase Postgres |

The web app is fully usable without the API. The API exists for backup, multi-device sync, accountability partners and external automation.

## Data model

All primary keys are UUIDs generated on the client, so records can be created offline and keep the same identity when they reach the server.

| Table | Purpose |
| --- | --- |
| `users` | Accounts (created on first Google sign-in) |
| `habits` | Habit definition: type, thresholds, schedule, metadata (color, icon, category, webhooks…), `depends_on`, `linked_habit_ids`, `status` |
| `entries` | One row per habit per day (`unique (habit_id, date)`), with the logged value and derived `standard_met` / `target_met` |
| `notes` | Dated notes linked to one or more habits (`habit_ids uuid[]`, GIN-indexed) |
| `identities` | Optional "who I'm becoming" groupings |
| `user_settings` | Day rollover time, theme, colors, launch screen |
| `api_keys` | Per-user keys for external tools |
| `app_user_roles`, `app_role_defs`, `admins` | Roles, and the features and permissions each role grants |
| `accountability_invitations`, `accountability_partnerships`, `shared_habits` | Partner invites (short link codes, 7-day expiry), two-way partnership rows, and which habits each user shares |
| `client_logs` | Client error reports from signed-in users |

Habits are soft-deleted (`status = 'deleted'`) so the deletion syncs like any other edit; entries and notes cascade if a habit row is ever hard-deleted.

## Client

### State

Each collection (habits, entries, notes, identities) is a Svelte store backed by an IndexedDB object store (`src/lib/storeFactory.ts`, `src/services/storage.ts`). Components read from stores and never wait on the network. Settings live in `localStorage` so the theme can be applied before first paint.

### Write path

1. A change updates the store and IndexedDB immediately.
2. `pushRecord` (`src/services/sync.ts`) sends it to the API as a GraphQL upsert.
3. If the request fails with a network error, the record goes into an **outbox**, a separate IndexedDB database (`north_outbox`), so it survives reloads. The outbox drains on the `online` event and on a 10-second retry timer. A request the server rejects outright (a validation error, for example) is dropped rather than retried forever.

### Read path and merging

`src/services/dataLoader.ts` refreshes from the server on sign-in, when the app regains focus or visibility, when it comes back online, and every five minutes while visible (throttled to once per 30 seconds). Each refresh:

1. Drains the outbox first, so queued edits reach the server before its snapshot is taken.
2. Fetches habits, notes, identities and settings, and pages through all entries with cursor pagination (500 per page).
3. Merges server and local records **last-write-wins** by `updatedAt`. Entries are matched by `habitId + date` rather than ID, because two devices can create the same day's entry independently. The server wins ties, so server-side data migrations propagate.
4. Rewrites each IndexedDB store in a **single transaction** (clear + put), then publishes to the stores, so the UI never observes a partially written cache.

### Deletions

A record that exists only on the device is either new (created offline, not uploaded yet) or was deleted elsewhere. The client keeps a sync watermark (`north:lastSyncedAt`): local-only records changed after it are kept, and older ones are dropped as deleted. The first refresh after this rule shipped uploads local-only records instead of dropping them, so history from before the rule can't be lost (`north:reconciled-v1`).

### Linked and conditional habits

- **Linked habits** form a symmetric group: every member lists every other member, and logging a value on one writes the same value to the rest for that day. `setLinkedHabits` (client) and `applyLinkedGroup` (server) both normalize the group, including stripping members out of habits that are no longer part of it, so an unlink on one device can't leave the group lopsided.
- **Conditional habits** (`dependsOn`, all-of or any-of) complete automatically when their dependencies reach their minimum, and un-complete when they stop meeting it (`src/lib/dependencyEngine.ts`). Dependencies the conditional habit auto-completed are remembered, so unchecking it only reverses what it did.

## API

### Request handling

Every path is rewritten to one function, `backend/src/index.ts`. The rewrite passes the original path as `__path`, and the handler restores it before routing, because depending on the runtime the function sees either the original URL or the rewritten one. Routes: `/graphql`, `/health`, and `/`. CORS is limited to the configured frontend origins.

### Authentication

- **Users:** the browser gets a Google ID token from Google Identity Services. The API verifies it against Google's published keys (issuer, audience, verified email), finds or creates the user, and returns its own HS256 session token (30-day expiry) for the `Authorization: Bearer` header.
- **Tools:** an `x-api-key` header resolves to the key's owner, so a tool gets exactly the access that user has.

### Authorization

The API connects to Postgres with the service role, which bypasses row-level security, so authorization is explicit in the resolvers:

- Every query and mutation filters on the caller's user ID.
- Upserts keyed by a client-supplied ID first check that the row is either new or already owned by the caller (`assertOwnedOrNew`), so knowing another user's ID can't be used to overwrite or take over their row.
- Notes can only link to the caller's habits. Habits can only be shared with partners by their owner. Partners can read only habits shared with them, through an existing partnership.
- Admin queries check the caller's roles.

### Schema conventions

- **Global IDs.** IDs leaving the API are opaque Relay-style strings (`base64("Habit:<uuid>")`), including IDs nested inside JSON such as `dependsOn.habitIds`. The client stores raw UUIDs and converts at the boundary (`src/lib/globalId.ts`).
- **Pagination.** `*Connection` queries support cursor pagination (`first` / `after`) and offset pagination (`offset` / `limit`). Cursors encode the sort value plus ID, and the ID is used as a tie-breaker in the same direction, so a page boundary stays stable when rows share a sort value.
- **Server-computed results.** `upsertEntry` recomputes `standardMet` and `targetMet` from the habit's thresholds rather than trusting the client, and applies the same value to linked habits.

## Habit rules

These rules are implemented on the client in `src/lib/thresholds.ts` and mirrored on the server in `computeMet` (`backend/src/resolvers/entries.ts`).

| Habit | Minimum met when | Stretch goal met when |
| --- | --- | --- |
| Build (count or time) | value ≥ minimum | value ≥ stretch goal |
| Break (count or time) | value ≤ limit | value ≤ stricter limit |
| Check-off | value = 1 | n/a |

- Timed habits store values in seconds.
- The **day rollover time** (default midnight) shifts which calendar day "today" is, so a late-night log can count toward the previous day.
- **Streaks:** build habits count consecutive days that met the minimum; today doesn't break the streak until it's over. Break habits keep their streak through unlogged days and reset only on a logged day that went over the limit. Days-per-week habits count consecutive weeks that hit the weekly target.
- **Completion rate** (Stats) covers the selected range (7, 30 or 90 days, 12 months, or all time; 30 days by default), measured from each habit's start (its creation date or first entry, whichever is earlier). Days-per-week habits are scored against their weekly target, and break habits count a day as done unless a logged value went over the limit.

## Integrations

- **Webhooks and iOS Shortcuts** are configured per habit and per event (`start`, `logged`, `standard_met`, `target_met`, `completed`). They fire from the device, never from the server: webhooks are a `fetch` with URL placeholder interpolation, and Shortcuts open a `shortcuts://` deep link with the event JSON. Rapid repeat events are debounced into one call.
- **API keys** let Shortcuts and scripts read and write the same data through the GraphQL API. The in-app reference at `/api-docs` documents every type and operation with runnable examples.

## UI

Styling runs on semantic design tokens in `src/styles/global.css` (surfaces, text levels, separators, accent, status colors, a spacing scale and three radii) for light, dark and true-black themes. The user's accent color and background tint rewrite those tokens at runtime (`src/stores/theme.ts`), and a small inline script in `src/app.html` applies the saved theme before first paint to avoid a flash. Shared building blocks (grouped lists, buttons, fields, segmented controls, switches) are global classes. `Modal.svelte` renders a bottom sheet on phones and a dialog on wider screens.

## Trade-offs and next steps

- **Conflict resolution is last-write-wins per record**, using client clocks. That's simple and fits a single-person app used on a few devices, but two edits to the same habit from different devices within one sync window keep only the later one.
- **No automated test suite yet.** Type checking (`npm run check`) and a production build are the current gates. The pure modules (`thresholds`, `streakUtils`, `analytics`, the sync merge) are the natural place to start.
- **Partner views use the viewer's calendar day**, not the partner's time zone.
