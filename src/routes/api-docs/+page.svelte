<script lang="ts">
  import ApiExample from '../../components/ApiExample.svelte';

  const examples = [
    {
      name: 'Fetch all habits',
      description: 'Get metadata for every habit. Optionally filter and sort.',
      query: `query GetHabits($status: String, $tag: String, $title: String, $sortBy: HabitSortBy, $sortDir: SortDirection) {
  habits(status: $status, tags: $tag, title: $title, sortBy: $sortBy, sortDir: $sortDir) {
    id
    title
    type
    standard
    target
    unit
    metadata
    status
  }
}`,
      variables: { status: 'active', title: 'water', sortBy: 'title', sortDir: 'asc' },
      response: `{
  "data": {
    "habits": [
      {
        "id": "de5059e0-ea2f-483e-9418-3b5fd1e2b4f9",
        "title": "Drink water",
        "type": "quantity",
        "standard": 8,
        "target": 10,
        "unit": "glasses",
        "metadata": null,
        "status": "active"
      }
    ]
  }
}`,
    },
    {
      name: 'Get habits with their log entries',
      description: 'Fetch habits and each one’s entries in a single query.',
      query: `query GetHabitsWithEntries($status: String, $dateFrom: String, $dateTo: String) {
  habits(status: $status) {
    id
    title
    status
    entries(dateFrom: $dateFrom, dateTo: $dateTo) {
      habitId
      date
      value
      standardMet
      targetMet
    }
  }
}`,
      variables: { status: 'active', dateFrom: '2026-07-28', dateTo: '2026-08-04' },
      response: `{
  "data": {
    "habits": [
      {
        "id": "de5059e0-ea2f-483e-9418-3b5fd1e2b4f9",
        "title": "Drink water",
        "status": "active",
        "entries": [
          {
            "habitId": "de5059e0-ea2f-483e-9418-3b5fd1e2b4f9",
            "date": "2026-08-04",
            "value": 9,
            "standardMet": true,
            "targetMet": false
          },
          {
            "habitId": "de5059e0-ea2f-483e-9418-3b5fd1e2b4f9",
            "date": "2026-08-03",
            "value": 8,
            "standardMet": true,
            "targetMet": false
          }
        ]
      }
    ]
  }
}`,
    },
    {
      name: 'Fetch a habit by ID',
      description: 'Get a single habit by its id.',
      query: `query GetHabit($id: ID!) {
  habit(id: $id) {
    id
    title
    type
    standard
    target
    unit
    metadata
    status
  }
}`,
      variables: { id: 'HABIT_ID' },
      response: `{
  "data": {
    "habit": {
      "id": "de5059e0-ea2f-483e-9418-3b5fd1e2b4f9",
      "title": "Drink water",
      "type": "quantity",
      "standard": 8,
      "target": 10,
      "unit": "glasses",
      "metadata": null,
      "status": "active"
    }
  }
}`,
    },
    {
      name: "Get a habit's log data for today",
      description: 'Get today’s logged value for a habit.',
      query: `query GetEntry($habitId: ID!, $date: String!) {
  entry(habitId: $habitId, date: $date) {
    value
    standardMet
    targetMet
  }
}`,
      variables: { habitId: 'HABIT_ID', date: '2026-08-04' },
      response: `{
  "data": {
    "entry": {
      "value": 9,
      "standardMet": true,
      "targetMet": false
    }
  }
}`,
    },
    {
      name: 'Log an entry',
      description: 'Record a value for a habit. standardMet and targetMet are computed on the server.',
      query: `mutation LogEntry($input: UpsertEntryInput!) {
  upsertEntry(input: $input) {
    value
    standardMet
    targetMet
  }
}`,
      variables: { input: { habitId: 'HABIT_ID', date: '2026-08-04', value: 2.5 } },
      response: `{
  "data": {
    "upsertEntry": {
      "value": 2.5,
      "standardMet": true,
      "targetMet": false
    }
  }
}`,
    },
    {
      name: 'List my API keys',
      description: 'See your API keys and when they were last used.',
      query: `query GetMyApiKeys {
  myApiKeys {
    id
    name
    createdAt
    lastUsedAt
  }
}`,
      response: `{
  "data": {
    "myApiKeys": [
      {
        "id": "7c7b9e2a-18d4-4f3e-9b2a-1a2b3c4d5e6f",
        "name": "iOS-Shortcuts",
        "createdAt": "2026-08-05T12:51:34Z",
        "lastUsedAt": "2026-08-05T13:02:11Z"
      }
    ]
  }
}`,
    },
  ];

  const typeSections = [
    {
      title: 'Object types',
      code: `type Habit {
  id: ID!
  userId: String!
  title: String!
  description: String
  type: String!          # "quantity" | "duration" | "count" | "binary"
  standard: Float        # threshold that satisfies the habit
  target: Float          # stretch goal
  unit: String
  schedule: JSON
  metadata: JSON         # e.g. quickSteps
  dependsOn: JSON
  identityId: String
  tags: [String!]
  status: String         # "active" | "paused" | "deleted"
  sortOrder: Int
  createdAt: DateTime
  updatedAt: DateTime
  entries(dateFrom: String, dateTo: String, limit: Int): [HabitEntry!]!
}

type HabitEntry {
  id: ID!
  habitId: String!
  date: String!          # YYYY-MM-DD
  value: Float!
  standardMet: Boolean!
  targetMet: Boolean!
  notes: String
  updatedAt: DateTime
}

type HabitNote {
  id: ID!
  habitId: String!
  date: String!
  content: String
  status: String
  createdAt: DateTime
}

type ApiKey {
  id: ID!
  userId: String!
  apiKey: String!
  name: String
  createdAt: DateTime
  lastUsedAt: DateTime
}

type User {
  id: ID!
  email: String!
  name: String
  avatar: String
  createdAt: DateTime
}

type Identity {
  id: ID!
  userId: String!
  name: String!
  description: String
  goals: [String!]
}

type UserSettings {
  userId: String!
  resetTime: String
  themeMode: String
  oled: Boolean
  accentColor: String
  mainColor: String
  launchScreen: String
  updatedAt: DateTime
}`,
    },
    {
      title: 'Enums',
      code: `enum SortDirection {
  asc
  desc
}

enum HabitSortBy {
  sortOrder
  title
  createdAt
  updatedAt
}`,
    },
    {
      title: 'Inputs',
      code: `input UpsertEntryInput {
  habitId: String!
  date: String!          # YYYY-MM-DD
  value: Float!
  standardMet: Boolean   # computed on the server if omitted
  targetMet: Boolean
  notes: String
}

input CreateHabitInput {
  title: String!
  type: String!
  description: String
  standard: Float
  target: Float
  unit: String
  schedule: JSON
  metadata: JSON
  identityId: String
  tags: [String!]
  sortOrder: Int
}`,
    },
    {
      title: 'Queries & Mutations',
      code: `# Queries
me: User
myRoles: [String!]!
habits(status: String, tags: [String!], title: String,
       type: String, sortBy: HabitSortBy, sortDir: SortDirection): [Habit!]!
habit(id: ID!): Habit
entries(habitId: String, date: String, dateFrom: String, dateTo: String): [HabitEntry!]!
entry(habitId: ID!, date: String!): HabitEntry
notes(habitId: String, date: String): [HabitNote!]!
identities: [Identity!]!
settings: UserSettings
myApiKeys: [ApiKey!]!

# Mutations
createHabit(input: CreateHabitInput!): Habit!
updateHabit(id: ID!, input: UpdateHabitInput!): Habit
deleteHabit(id: ID!): Boolean!
upsertEntry(input: UpsertEntryInput!): HabitEntry!
deleteEntry(habitId: ID!, date: String!): Boolean!
addNote(input: AddNoteInput!): HabitNote!
createMyApiKey(name: String): ApiKey!
revokeMyApiKey(id: ID!): Boolean!`,
    },
  ];
</script>

<div class="page">
  <h1>North API</h1>
  <p class="intro">
    The API lives at <code>https://north-api-rho.vercel.app/graphql</code>. Send a POST with a JSON body
    containing your GraphQL <code>query</code> and optional <code>variables</code>, and authenticate with
    an <code>x-api-key</code> header.
  </p>
  <p class="intro">
    Generate an API key in <a href="/settings">Settings → API Key</a>. Your key grants full access to your
    own account data — treat it like a password.
  </p>

  <div class="examples">
    {#each examples as ex (ex.name)}
      <ApiExample example={ex} />
    {/each}
  </div>

  <h2 class="section-title">Types</h2>
  <div class="types">
    {#each typeSections as s (s.title)}
      <section class="type-section">
        <h3>{s.title}</h3>
        <pre class="gql"><code>{s.code}</code></pre>
      </section>
    {/each}
  </div>
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 720px;
    margin: 0 auto;
  }
  h1 {
    color: var(--text-primary, #222);
    margin-bottom: 0.5rem;
  }
  .intro {
    color: var(--text-secondary, #555);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0 0 0.75rem;
  }
  .intro code {
    font-size: 0.82em;
    background: var(--btn-secondary-bg, #eee);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  }
  .intro a {
    color: var(--accent, #0066cc);
  }
  .examples {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.25rem;
  }
  .section-title {
    margin: 2rem 0 0.25rem;
    color: var(--text-primary, #222);
  }
  .types {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 0.75rem;
  }
  .type-section h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    color: var(--text-secondary, #555);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .type-section .gql {
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
  }
  .gql {
    margin: 0;
    padding: 0.9rem 1rem 1rem;
    background: var(--input-bg, #f5f5f5);
    border-radius: 8px;
    overflow-x: auto;
    font-size: 0.8rem;
    line-height: 1.55;
    color: var(--text-primary, #222);
    font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  }
</style>