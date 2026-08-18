<script lang="ts">
  import ApiExample from '../../components/ApiExample.svelte';
  import { userRoles } from '../../stores/roles';

  const exampleGroups = [
    {
      title: 'Habits',
      examples: [
        {
          name: 'Create a habit',
          description: 'Create a new habit and get the created record back.',
          query: `mutation CreateHabit($input: CreateHabitInput!) {
  createHabit(input: $input) {
    id
    title
    type
    standard
    target
    unit
    status
  }
}`,
          variables: { input: { title: 'Drink water', type: 'quantity', standard: 8, target: 10, unit: 'glasses' } },
          response: `{
  "data": {
    "createHabit": {
      "id": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
      "title": "Drink water",
      "type": "quantity",
      "standard": 8,
      "target": 10,
      "unit": "glasses",
      "status": "active"
    }
  }
}`,
        },
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
          variables: { status: 'active', title: 'water', sortBy: 'TITLE', sortDir: 'ASC' },
          response: `{
  "data": {
    "habits": [
      {
        "id": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
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
          name: 'Paginate habits (cursor)',
          description: 'Fetch habits a page at a time. Use `endCursor` as `after` for the next page; stop when `hasNextPage` is false.',
          query: `query GetHabitsPage($first: Int, $after: String, $status: String) {
  habitsConnection(first: $first, after: $after, status: $status) {
    nodes {
      id
      title
      status
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}`,
          variables: { first: 50, after: null, status: 'active' },
          response: `{
  "data": {
    "habitsConnection": {
      "nodes": [
        {
          "id": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
          "title": "Drink water",
          "status": "active"
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "WyJhY2N0aXZlIiwzXQ==",
        "endCursor": "WyJhY2N0aXZlIiwxMl0="
      },
      "totalCount": 12
    }
  }
}`,
        },
        {
          name: 'Paginate habits (offset)',
          description: 'Fetch habits with offset/limit. Combine with a stable sort for consistent pages.',
          query: `query GetHabitsPage($offset: Int, $limit: Int) {
  habitsConnection(offset: $offset, limit: $limit, sortBy: TITLE, sortDir: ASC) {
    nodes {
      id
      title
      status
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    totalCount
  }
}`,
          variables: { offset: 0, limit: 25 },
          response: `{
  "data": {
    "habitsConnection": {
      "nodes": [
        {
          "id": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
          "title": "Drink water",
          "status": "active"
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false
      },
      "totalCount": 12
    }
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
      "id": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
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
        "id": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
        "title": "Drink water",
        "status": "active",
        "entries": [
          {
            "habitId": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
            "date": "2026-08-04",
            "value": 9,
            "standardMet": true,
            "targetMet": false
          },
          {
            "habitId": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
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
          name: 'Update a habit',
          description: 'Partially update a habit. Omitted fields are left unchanged.',
          query: `mutation UpdateHabit($id: ID!, $input: UpdateHabitInput!) {
  updateHabit(id: $id, input: $input) {
    id
    title
    standard
    status
  }
}`,
          variables: { id: 'HABIT_ID', input: { standard: 9 } },
          response: `{
  "data": {
    "updateHabit": {
      "id": "SGFiaXQ6ZDU1MTltZS1ZTYyYi00ODNlLTk0MTgtM2I1ZmQxMWEyMGY5",
      "title": "Drink water",
      "standard": 9,
      "status": "active"
    }
  }
}`,
        },
        {
          name: 'Upsert a habit',
          description: 'Create or replace a habit in one call. Requires a stable id.',
          query: `mutation UpsertHabit($id: ID!, $input: UpdateHabitInput!) {
  upsertHabit(id: $id, input: $input) {
    id
    title
    type
    status
  }
}`,
          variables: { id: 'HABIT_ID', input: { title: 'Drink water', type: 'quantity' } },
          response: `{
  "data": {
    "upsertHabit": {
      "id": "SGFiaXQ6ZTk4N2FiYzEtYzY3MC00YTVkLTk5MjZiMTM4ZDU3YjFh",
      "title": "Drink water",
      "type": "quantity",
      "status": "active"
    }
  }
}`,
        },
        {
          name: 'Delete a habit',
          description: 'Permanently delete a habit and its entries. Returns true on success.',
          query: `mutation DeleteHabit($id: ID!) {
  deleteHabit(id: $id)
}`,
          variables: { id: 'HABIT_ID' },
          response: `{
  "data": {
    "deleteHabit": true
  }
}`,
        },
      ],
    },
    {
      title: 'Entries',
      examples: [
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
          name: 'Fetch log entries across habits',
          description: 'Get entries matching a habit and/or date range.',
          query: `query Entries($habitId: String, $dateFrom: String, $dateTo: String) {
  entries(habitId: $habitId, dateFrom: $dateFrom, dateTo: $dateTo) {
    habitId
    date
    value
    standardMet
    targetMet
  }
}`,
          variables: { habitId: 'HABIT_ID', dateFrom: '2026-07-28', dateTo: '2026-08-04' },
          response: `{
  "data": {
    "entries": [
      {
        "habitId": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
        "date": "2026-08-04",
        "value": 9,
        "standardMet": true,
        "targetMet": false
      }
    ]
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
          name: 'Delete an entry',
          description: 'Remove a single logged entry for a habit on a given date.',
          query: `mutation DeleteEntry($habitId: ID!, $date: String!) {
  deleteEntry(habitId: $habitId, date: $date)
}`,
          variables: { habitId: 'HABIT_ID', date: '2026-08-04' },
          response: `{
  "data": {
    "deleteEntry": true
  }
}`,
        },
        {
          name: 'Backfill a habit',
          description: 'Bulk-write entries across a date range. The server resolves standard/target shortcuts, evaluates per-day conditions against other habits, and applies skip rules.',
          query: `mutation BackfillHabit($input: BackfillHabitInput!) {
  backfillHabit(input: $input) {
    habitId
    totalDays
    appliedDays
    skippedDays
    entries {
      date
      value
      standardMet
      targetMet
    }
  }
}`,
          variables: {
            input: {
              habitId: 'HABIT_ID',
              startDate: '2026-07-28',
              endDate: '2026-08-04',
              valueMode: 'STANDARD',
              conditionHabitIds: ['OTHER_HABIT_ID'],
              conditionMode: 'and',
              skipWeekdays: [0, 6],
              skipLogged: true,
              skipAtOrAbove: false,
            },
          },
          response: `{
  "data": {
    "backfillHabit": {
      "habitId": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
      "totalDays": 8,
      "appliedDays": 6,
      "skippedDays": 2,
      "entries": [
        {
          "date": "2026-08-04",
          "value": 8,
          "standardMet": true,
          "targetMet": false
        },
        {
          "date": "2026-08-03",
          "value": 8,
          "standardMet": true,
          "targetMet": false
        }
      ]
    }
  }
}`,
        },
      ],
    },
    {
      title: 'Notes',
      examples: [
        {
          name: 'Add a note',
          description: 'Create (or upsert by id) a note for a habit on a date.',
          query: `mutation AddNote($input: AddNoteInput!) {
  addNote(input: $input) {
    id
    habitId
    date
    content
    status
    createdAt
  }
}`,
          variables: { input: { habitId: 'HABIT_ID', date: '2026-08-04', content: 'Felt great after the walk' } },
          response: `{
  "data": {
    "addNote": {
      "id": "SGFiaXROdXRlOjZjYzE5NmI2LTBjZjAtNDQ3Zi05NGJlLTU2MThjZGYxMFBmYQ==",
      "habitId": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTkxMTgtM2I1ZmQxZTJiNGY5",
      "date": "2026-08-04",
      "content": "Felt great after the walk",
      "status": null,
      "createdAt": "2026-08-04T18:30:00Z"
    }
  }
}`,
        },
        {
          name: 'Get notes for a habit',
          description: 'Fetch all notes for a habit, optionally by date.',
          query: `query GetNotes($habitId: String, $date: String) {
  notes(habitId: $habitId, date: $date) {
    id
    habitId
    date
    content
    status
    createdAt
  }
}`,
          variables: { habitId: 'HABIT_ID' },
          response: `{
  "data": {
    "notes": [
      {
        "id": "SGFiaXROb3RlOjZjYzE5NmI2LTBjZjAtNDQ3Zi05NGJlLTU2MThjZGYxMGJmYQ==",
        "habitId": "SGFiaXQ6ZGU1MDU5ZTAtZWEyZi00ODNlLTk0MTgtM2I1ZmQxZTJiNGY5",
        "date": "2026-08-04",
        "content": "Felt great after the walk",
        "status": null,
        "createdAt": "2026-08-04T18:30:00Z"
      }
    ]
  }
}`,
        },
        {
          name: 'Delete a note',
          description: 'Mark a note as deleted. Returns true on success.',
          query: `mutation DeleteNote($id: ID!) {
  deleteNote(id: $id)
}`,
          variables: { id: 'NOTE_ID' },
          response: `{
  "data": {
    "deleteNote": true
  }
}`,
        },
      ],
    },
    {
      title: 'Identities',
      examples: [
        {
          name: 'Create an identity',
          description: 'Create a new identity (persona) to tag habits with.',
          query: `mutation CreateIdentity($name: String!, $description: String, $goals: [String!]) {
  createIdentity(name: $name, description: $description, goals: $goals) {
    id
    name
    description
    goals
  }
}`,
          variables: { name: 'Runner', description: 'The version of me that runs regularly', goals: ['Train 3x weekly'] },
          response: `{
  "data": {
    "createIdentity": {
      "id": "SWRlbnRpdHk6YTViNmMzZDUtZTFjMS00Mjg3LTgzYWItZGVmNDU2Nzg5MGFi",
      "name": "Runner",
      "description": "The version of me that runs regularly",
      "goals": ["Train 3x weekly"]
    }
  }
}`,
        },
        {
          name: 'List my identities',
          description: 'Fetch every identity (persona) for the current user.',
          query: `query {
  identities {
    id
    name
    description
    goals
  }
}`,
          response: `{
  "data": {
    "identities": [
      {
        "id": "SWRlbnRpdHk6YTFiMmMzLDU1ZTFjLTQyODctODNhYm1kZWY3MDEwYWJj",
        "name": "Runner",
        "description": "The version of me that runs regularly",
        "goals": ["Train 3x/week", "Complete a 10k"]
      }
    ]
  }
}`,
        },
        {
          name: 'Get an identity by ID',
          description: 'Fetch a single named identity (persona) by its id.',
          query: `query GetIdentity($id: ID!) {
  identity(id: $id) {
    id
    name
    description
    goals
  }
}`,
          variables: { id: 'IDENTITY_ID' },
          response: `{
  "data": {
    "identity": {
      "id": "SWRlbnRpdHk6YTFiMmMzZDAtZTVmNi00MjAwLTgzYWItZGVmNDU2Nzg5MGFi",
      "name": "Runner",
      "description": "The version of me that runs regularly",
      "goals": ["Run 3x a week", "Complete a 10k"]
    }
  }
}`,
        },
        {
          name: 'Update an identity',
          description: 'Partially update an identity’s name, description, or goals.',
          query: `mutation UpdateIdentity($id: ID!, $name: String, $description: String, $goals: [String!]) {
  updateIdentity(id: $id, name: $name, description: $description, goals: $goals) {
    id
    name
    description
    goals
  }
}`,
          variables: { id: 'IDENTITY_ID', description: 'Someone who always shows up to run' },
          response: `{
  "data": {
    "updateIdentity": {
      "id": "SWRlbnRpdHk6YjcyYzhlOWYtZDRhZi00NTJlLWJiYmQtM2U5ZjdiODMxNzIx",
      "name": "Runner",
      "description": "Someone who always shows up to run",
      "goals": ["Train 3x weekly"]
    }
  }
}`,
        },
        {
          name: 'Upsert an identity',
          description: 'Create or update an identity by id in one call.',
          query: `mutation UpsertIdentity($id: ID!, $name: String!, $description: String, $goals: [String!]) {
  upsertIdentity(id: $id, name: $name, description: $description, goals: $goals) {
    id
    name
    description
    goals
  }
}`,
          variables: { id: 'IDENTITY_ID', name: 'Runner', description: 'The version of me that runs regularly' },
          response: `{
  "data": {
    "upsertIdentity": {
      "id": "SWRlbnRpY3k6ZTljYTY5YmMtYzQ3MC00NWIyLTk5ZmFiMTM4ZDY3YjFh",
      "name": "Runner",
      "description": "The version of me that runs regularly",
      "goals": []
    }
  }
}`,
        },
        {
          name: 'Delete an identity',
          description: 'Delete an identity. Returns true on success.',
          query: `mutation DeleteIdentity($id: ID!) {
  deleteIdentity(id: $id)
}`,
          variables: { id: 'IDENTITY_ID' },
          response: `{
  "data": {
    "deleteIdentity": true
  }
}`,
        },
      ],
    },
    {
      title: 'User',
      examples: [
        {
          name: 'Get the current user',
          description: 'Fetch your own account. Returns the user bound to the API key.',
          query: `query Me {
  me {
    id
    email
    name
    avatar
    createdAt
  }
}`,
          response: `{
  "data": {
    "me": {
      "id": "VXNlcjphYmMxMjMwZC1mNDU2LTY3ODktYWJjZC0xMjM0NTY3ODlhYmM=",
      "email": "you@example.com",
      "name": "Alex",
      "avatar": null,
      "createdAt": "2026-05-01T09:12:00Z"
    }
  }
}`,
        },
        {
          name: 'Get my roles',
          description: 'List the roles granted to the current user (e.g. "admin").',
          query: `query MyRoles {
  myRoles
}`,
          response: `{
  "data": {
    "myRoles": []
  }
}`,
        },
      ],
    },
    {
      title: 'Settings',
      examples: [
        {
          name: 'Get settings',
          description: 'Fetch your account and UI settings.',
          query: `query {
  settings {
    userId
    resetTime
    themeMode
    oled
    accentColor
    mainColor
    launchScreen
    updatedAt
  }
}`,
          response: `{
  "data": {
    "settings": {
      "userId": "VXNlcjphYmMxMjMwZC1lZjQ1LTI3ODktMDBiYy0xMjM0NTY3ODlhYmM=",
      "resetTime": "00:00",
      "themeMode": "dark",
      "oled": true,
      "accentColor": "#4caf50",
      "mainColor": "#4caf50",
      "launchScreen": "today",
      "updatedAt": "2026-08-01T10:00:00Z"
    }
  }
}`,
        },
        {
          name: 'Update settings',
          description: 'Update your account and UI settings. Only supplied fields are written.',
          query: `mutation UpsertSettings($input: UpsertSettingsInput!) {
  upsertSettings(input: $input) {
    userId
    resetTime
    themeMode
    accentColor
  }
}`,
          variables: { input: { resetTime: '00:00', themeMode: 'dark' } },
          response: `{
  "data": {
    "upsertSettings": {
      "userId": "VXNlcjE1YWJiMzRoYmUtYTdjZi1kMjBlLTY1Y2EtZGFiY2YxMDIyM2Zk",
      "resetTime": "00:00",
      "themeMode": "dark",
      "accentColor": "#4caf50"
    }
  }
}`,
        },
      ],
    },
    {
      title: 'Admin',
      adminOnly: true,
      examples: [
        {
          name: 'List users and their roles',
          description: 'Fetch every user and the roles they hold. Admin only.',
          query: `query UsersWithRoles {
  usersWithRoles {
    id
    email
    name
    roles
  }
}`,
          response: `{
  "data": {
    "usersWithRoles": [
      {
        "id": "VXNlcjphYmMxMjMwZC1mNDU2LTY3ODktYWJjZC0xMjM0NTY3ODlhYmM=",
        "email": "you@example.com",
        "name": "Alex",
        "roles": ["admin"]
      }
    ]
  }
}`,
        },
        {
          name: 'Set a user’s roles',
          description: 'Replace the role list for a user. Admin only.',
          query: `mutation SetRoles($userId: ID!, $roles: [String!]!) {
  setRoles(userId: $userId, roles: $roles)
}`,
          variables: { userId: 'USER_ID', roles: ['admin'] },
          response: `{
  "data": {
    "setRoles": true
  }
}`,
        },
      ],
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
  notes(dateFrom: String, dateTo: String, limit: Int): [HabitNote!]!
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
}

# Pagination
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type HabitConnection {
  nodes: [Habit!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type HabitEntryConnection {
  nodes: [HabitEntry!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type BackfillResult {
  habitId: ID!
  totalDays: Int!
  appliedDays: Int!
  skippedDays: Int!
  entries: [HabitEntry!]!
}

type HabitNoteConnection {
  nodes: [HabitNote!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type IdentityConnection {
  nodes: [Identity!]!
  pageInfo: PageInfo!
  totalCount: Int!
}`,
    },
    {
      title: 'Enums',
      code: `enum SortDirection {
  ASC
  DESC
}

enum HabitSortBy {
  SORT_ORDER
  TITLE
  CREATED_AT
  UPDATED_AT
}

enum BackfillValueMode {
  VALUE
  STANDARD
  TARGET
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

input BackfillHabitInput {
  habitId: String!
  startDate: String!     # YYYY-MM-DD
  endDate: String!       # YYYY-MM-DD
  valueMode: BackfillValueMode!
  value: Float           # required when valueMode = VALUE
  conditionHabitIds: [String!]  # backfill only when each day's standard is met for every (or any) of these
  conditionMode: String  # "and" | "or" (default "and")
  skipWeekdays: [Int!]   # 0=Sun .. 6=Sat
  skipDates: [String!]   # YYYY-MM-DD specific days to skip
  skipLogged: Boolean    # skip days already logged (value > 0), even if below the backfill value
  skipAtOrAbove: Boolean # skip days already at or above the backfill value
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
}

input UpdateHabitInput {
  title: String
  type: String
  description: String
  standard: Float
  target: Float
  unit: String
  schedule: JSON
  metadata: JSON
  dependsOn: JSON
  identityId: String
  tags: [String!]
  status: String
  sortOrder: Int
}

input AddNoteInput {
  id: ID
  habitId: String!
  date: String!          # YYYY-MM-DD
  content: String
}

input UpsertSettingsInput {
  resetTime: String
  themeMode: String
  oled: Boolean
  accentColor: String
  mainColor: String
  launchScreen: String
}`,
    },
    {
      title: 'Queries & Mutations',
      code: `# Queries
me: User
myRoles: [String!]!
habits(userId: String, status: String, tags: [String!], title: String,
       type: String, sortBy: HabitSortBy, sortDir: SortDirection): [Habit!]!
habitsConnection(first: Int, after: String, offset: Int, limit: Int,
                 userId: String, status: String, tags: [String!], title: String,
                 type: String, sortBy: HabitSortBy, sortDir: SortDirection): HabitConnection!
habit(id: ID!): Habit
entries(habitId: String, date: String, dateFrom: String, dateTo: String): [HabitEntry!]!
entriesConnection(first: Int, after: String, offset: Int, limit: Int,
                  habitId: String, date: String, dateFrom: String, dateTo: String): HabitEntryConnection!
entry(habitId: ID!, date: String!): HabitEntry
notes(habitId: String, date: String): [HabitNote!]!
notesConnection(first: Int, after: String, offset: Int, limit: Int,
                habitId: String, date: String): HabitNoteConnection!
identity(id: ID!): Identity
identities: [Identity!]!
identitiesConnection(first: Int, after: String, offset: Int, limit: Int): IdentityConnection!
settings: UserSettings

# Mutations
createHabit(input: CreateHabitInput!): Habit!
updateHabit(id: ID!, input: UpdateHabitInput!): Habit
upsertHabit(id: ID!, input: UpdateHabitInput!): Habit!
deleteHabit(id: ID!): Boolean!
upsertEntry(input: UpsertEntryInput!): HabitEntry!
deleteEntry(habitId: ID!, date: String!): Boolean!
backfillHabit(input: BackfillHabitInput!): BackfillResult!
addNote(input: AddNoteInput!): HabitNote!
deleteNote(id: ID!): Boolean!
createIdentity(name: String!, description: String, goals: [String!]): Identity!
updateIdentity(id: ID!, name: String, description: String, goals: [String!]): Identity
upsertIdentity(id: ID!, name: String!, description: String, goals: [String!]): Identity!
deleteIdentity(id: ID!): Boolean!
upsertSettings(input: UpsertSettingsInput!): UserSettings!`,
    },
  ];

  const adminSection = {
    title: 'Admin operations',
    code: `# Queries (admin only)
usersWithRoles: [UserWithRoles!]!

# Mutations (admin only)
setRoles(userId: ID!, roles: [String!]!): Boolean!`,
  };

  let isAdmin = $derived($userRoles.includes('admin'));
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

  <h2 class="section-title">Global IDs</h2>
  <p class="intro">
    Every <code>id</code>, and every reference such as <code>habitId</code>, <code>userId</code> and
    <code>identityId</code>, is a <strong>global ID</strong>: the base64 encoding of
    <code>&lt;TypeName&gt;:&lt;uuid&gt;</code>. Use the ID exactly as returned — pass it straight back into
    queries and mutations; don’t try to parse or alter it.
  </p>
  <pre class="gql"><code># The id for a Habit with uuid 23d82b83-f52a-40a6-8ebe-05126ebc2f55 is:
base64("Habit:23d82b83-f52a-40a6-8ebe-05126ebc2f55")
  -> "SGFiaXQ6MjNkODJiODMtZjUyYS00MGE2LThlYmUtMDUxMjZlYmMyZjU1"</code></pre>

  <h2 class="section-title">Pagination</h2>
  <p class="intro">
    The list queries have a <code>…Connection</code> counterpart that supports two styles:
    <strong>cursor</strong> pagination via <code>first</code> + <code>after</code> (pass the previous page’s
    <code>endCursor</code>; stop when <code>hasNextPage</code> is <code>false</code>) and <strong>offset</strong>
    pagination via <code>offset</code> + <code>limit</code>. Don’t mix the two styles in one call. Pages are
    sorted by a stable column (ties broken by id), so consecutive pages don’t skip or repeat rows. Each
    <code>…Connection</code> returns <code>nodes</code>, <code>pageInfo</code> and a <code>totalCount</code>.
  </p>

  <div class="examples">
    {#each exampleGroups as group (group.title)}
      {#if !group.adminOnly || isAdmin}
        <h2 class="group-title">{group.title}{#if group.adminOnly} <span class="admin-badge">admin</span>{/if}</h2>
        {#each group.examples as ex (ex.name)}
          <ApiExample example={ex} />
        {/each}
      {/if}
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
    {#if isAdmin}
      <section class="type-section">
        <h3>{adminSection.title}</h3>
        <pre class="gql"><code>{adminSection.code}</code></pre>
      </section>
    {/if}
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
  .group-title {
    margin: 1.5rem 0 0.25rem;
    font-size: 1rem;
    color: var(--text-primary, #222);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .group-title:first-child {
    margin-top: 0;
  }
  .admin-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fff;
    background: var(--accent, #0066cc);
    border-radius: 4px;
    padding: 1px 6px;
    vertical-align: middle;
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