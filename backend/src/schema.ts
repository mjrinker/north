import { createSchema } from 'graphql-yoga';
import { GraphQLScalarType, Kind } from 'graphql';
import type { GraphQLContext } from './context.js';
import { authResolvers } from './resolvers/auth.js';
import { habitResolvers } from './resolvers/habits.js';
import { entryResolvers } from './resolvers/entries.js';
import { noteResolvers } from './resolvers/notes.js';
import { identityResolvers } from './resolvers/identities.js';
import { settingsResolvers } from './resolvers/settings.js';
import { userResolvers } from './resolvers/users.js';
import { logResolvers } from './resolvers/logs.js';
import { apiKeyResolvers } from './resolvers/apiKeys.js';

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 date time string',
  serialize(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return new Date(value).toISOString();
    return String(value);
  },
  parseValue(value: unknown): unknown {
    if (typeof value === 'string') return value;
    return value;
  },
  parseLiteral(ast): unknown {
    return ast.kind === Kind.STRING ? ast.value : undefined;
  },
});

export const schema = createSchema<GraphQLContext>({
  typeDefs: /* GraphQL */ `
    scalar DateTime
    scalar JSON

    enum SortDirection {
      ASC
      DESC
    }

    enum HabitSortBy {
      SORT_ORDER
      TITLE
      CREATED_AT
      UPDATED_AT
    }

    type User {
      id: ID!
      email: String!
      name: String
      avatar: String
      createdAt: DateTime
    }

    type UserWithRoles {
      id: ID!
      email: String!
      name: String
      avatar: String
      roles: [String!]!
    }

    type AuthPayload {
      token: String!
      user: User!
    }

    type Habit {
      id: ID!
      userId: String!
      title: String!
      description: String
      type: String!
      standard: Float
      target: Float
      unit: String
      schedule: JSON
      metadata: JSON
      dependsOn: JSON
      linkedHabitIds: [String!]!
      identityId: String
      tags: [String!]
      status: String
      sortOrder: Int
      createdAt: DateTime
      updatedAt: DateTime
      entries(dateFrom: String, dateTo: String, limit: Int): [HabitEntry!]!
      notes(dateFrom: String, dateTo: String, limit: Int): [HabitNote!]!
    }

    type HabitEntry {
      id: ID!
      habitId: String!
      date: String!
      value: Float!
      standardMet: Boolean!
      targetMet: Boolean!
      notes: String
      updatedAt: DateTime
    }

    type HabitNote {
      id: ID!
      habitId: String!
      habitIds: [String!]!
      date: String!
      content: String
      status: String
      createdAt: DateTime
    }

    type Identity {
      id: ID!
      userId: String!
      name: String!
      description: String
      goals: [String!]
    }

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

    type HabitNoteConnection {
      nodes: [HabitNote!]!
      pageInfo: PageInfo!
      totalCount: Int!
    }

    type IdentityConnection {
      nodes: [Identity!]!
      pageInfo: PageInfo!
      totalCount: Int!
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

    type ApiKey {
      id: ID!
      userId: String!
      apiKey: String!
      name: String
      createdAt: DateTime
      lastUsedAt: DateTime
    }

    input CreateHabitInput {
      title: String!
      description: String
      type: String!
      standard: Float
      target: Float
      unit: String
      schedule: JSON
      metadata: JSON
      identityId: String
      linkedHabitIds: [String!]
      tags: [String!]
      sortOrder: Int
    }

    input UpdateHabitInput {
      title: String
      description: String
      type: String
      standard: Float
      target: Float
      unit: String
      schedule: JSON
      metadata: JSON
      dependsOn: JSON
      linkedHabitIds: [String!]
      identityId: String
      tags: [String!]
      status: String
      sortOrder: Int
    }

    input UpsertEntryInput {
      habitId: String!
      date: String!
      value: Float!
      standardMet: Boolean
      targetMet: Boolean
      notes: String
    }

    enum BackfillValueMode {
      VALUE
      STANDARD
      TARGET
      LINKED
    }

    type RoleDef {
    name: String!
    label: String!
    description: String
    features: [String!]!
    permissions: [String!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input BackfillHabitInput {
      habitId: String!
      startDate: String!          # YYYY-MM-DD
      endDate: String!            # YYYY-MM-DD
      valueMode: BackfillValueMode!
      value: Float                # required when valueMode = VALUE
      linkedHabitId: String       # required when valueMode = LINKED (copy that habit's per-day value)
      conditionHabitIds: [String!] # backfill only when each day's standard is met for every (or any) of these
      conditionMode: String       # "and" | "or" (default "and")
      skipWeekdays: [Int!]        # 0=Sun .. 6=Sat
      skipDates: [String!]        # YYYY-MM-DD specific days to skip
      skipLogged: Boolean         # skip days already logged (value > 0), even if below the backfill value
      skipAtOrAbove: Boolean      # skip days already at or above the backfill value
    }

    type BackfillResult {
      habitId: ID!
      totalDays: Int!
      appliedDays: Int!
      skippedDays: Int!
      entries: [HabitEntry!]!
    }

input AddNoteInput {
      id: ID
      habitId: String!
      date: String!          # YYYY-MM-DD
      content: String
      habitIds: [String!]    # all linked habits; dominates habitId when set
    }

    input UpsertSettingsInput {
      resetTime: String
      themeMode: String
      oled: Boolean
      accentColor: String
      mainColor: String
      launchScreen: String
    }

    input ClientLogInput {
      level: String
      message: String!
      stack: String
      url: String
      timestamp: DateTime
    }

    type Query {
      me: User
      myRoles: [String!]!
      roleDefs: [RoleDef!]!
      usersWithRoles: [UserWithRoles!]!
      habits(userId: String, status: String, tags: [String!], title: String, type: String, sortBy: HabitSortBy, sortDir: SortDirection): [Habit!]!
      habitsConnection(first: Int, after: String, offset: Int, limit: Int, userId: String, status: String, tags: [String!], title: String, type: String, sortBy: HabitSortBy, sortDir: SortDirection): HabitConnection!
      habit(id: ID!): Habit
      entries(habitId: String, date: String, dateFrom: String, dateTo: String): [HabitEntry!]!
      entriesConnection(first: Int, after: String, offset: Int, limit: Int, habitId: String, date: String, dateFrom: String, dateTo: String): HabitEntryConnection!
      entry(habitId: ID!, date: String!): HabitEntry
      notes(habitId: String, date: String): [HabitNote!]!
      notesConnection(first: Int, after: String, offset: Int, limit: Int, habitId: String, date: String): HabitNoteConnection!
      identity(id: ID!): Identity
      identities: [Identity!]!
      identitiesConnection(first: Int, after: String, offset: Int, limit: Int): IdentityConnection!
      settings: UserSettings
      myApiKeys: [ApiKey!]!
      apiKeys(userId: String): [ApiKey!]!
    }

    type Mutation {
      googleSignIn(idToken: String!): AuthPayload!
      setRoles(userId: ID!, roles: [String!]!): Boolean!
      setRoleDefs(defs: JSON!): Boolean!
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
      upsertSettings(input: UpsertSettingsInput!): UserSettings!
      createMyApiKey(name: String): ApiKey!
      revokeMyApiKey(id: ID!): Boolean!
      createApiKey(userId: ID!, name: String): ApiKey!
      revokeApiKey(id: ID!): Boolean!
      clientLogs(entries: [ClientLogInput!]!): Boolean!
    }
  `,
  resolvers: [
    { DateTime: DateTimeScalar },
    authResolvers,
    habitResolvers,
    entryResolvers,
    noteResolvers,
    identityResolvers,
    settingsResolvers,
    userResolvers,
    logResolvers,
    apiKeyResolvers,
  ] as any,
});
