import { createSchema } from 'graphql-yoga';
import type { GraphQLContext } from './context';
import { authResolvers } from './resolvers/auth';
import { habitResolvers } from './resolvers/habits';
import { entryResolvers } from './resolvers/entries';
import { noteResolvers } from './resolvers/notes';
import { identityResolvers } from './resolvers/identities';
import { settingsResolvers } from './resolvers/settings';

export const schema = createSchema<GraphQLContext>({
  typeDefs: /* GraphQL */ `
    scalar DateTime
    scalar JSON

    type User {
      id: ID!
      email: String!
      createdAt: DateTime
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
      identityId: String
      tags: [String!]
      status: String
      sortOrder: Int
      createdAt: DateTime
      updatedAt: DateTime
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
      tags: [String!]
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
      identityId: String
      tags: [String!]
      status: String
      sortOrder: Int
    }

    input UpsertEntryInput {
      habitId: String!
      date: String!
      value: Float!
      notes: String
    }

    input AddNoteInput {
      habitId: String!
      date: String!
      content: String
    }

    input UpsertSettingsInput {
      resetTime: String
      themeMode: String
      oled: Boolean
      accentColor: String
      mainColor: String
      launchScreen: String
    }

    type Query {
      me: User
      habits(userId: String, status: String, tags: [String!]): [Habit!]!
      habit(id: ID!): Habit
      entries(habitId: String, date: String, dateFrom: String, dateTo: String): [HabitEntry!]!
      entry(habitId: ID!, date: String!): HabitEntry
      notes(habitId: String, date: String): [HabitNote!]!
      identity(id: ID!): Identity
      identities: [Identity!]!
      settings: UserSettings
    }

    type Mutation {
      signup(email: String!, password: String!): AuthPayload!
      login(email: String!, password: String!): AuthPayload!
      googleSignIn(idToken: String!): AuthPayload!
      createHabit(input: CreateHabitInput!): Habit!
      updateHabit(id: ID!, input: UpdateHabitInput!): Habit
      deleteHabit(id: ID!): Boolean!
      upsertEntry(input: UpsertEntryInput!): HabitEntry!
      deleteEntry(habitId: ID!, date: String!): Boolean!
      addNote(input: AddNoteInput!): HabitNote!
      deleteNote(id: ID!): Boolean!
      createIdentity(name: String!, description: String, goals: [String!]): Identity!
      updateIdentity(id: ID!, name: String, description: String, goals: [String!]): Identity
      deleteIdentity(id: ID!): Boolean!
      upsertSettings(input: UpsertSettingsInput!): UserSettings!
    }
  `,
  resolvers: [
    { DateTime: Date },
    authResolvers,
    habitResolvers,
    entryResolvers,
    noteResolvers,
    identityResolvers,
    settingsResolvers,
  ] as any,
});
