<script lang="ts">
  import ApiExample from '../../components/ApiExample.svelte';

  const examples = [
    {
      name: 'Fetch all habits',
      description: 'Get metadata for every habit.',
      query: `{
  habits {
    id title type standard target unit metadata status
  }
}`,
    },
    {
      name: 'Fetch a habit by ID',
      description: 'Get a single habit by its id.',
      query: `query GetHabit($id: ID!) {
  habit(id: $id) {
    id title type standard target unit metadata status
  }
}`,
      variables: { id: 'HABIT_ID' },
    },
    {
      name: "Get a habit's log data for today",
      description: 'Get today’s logged value for a habit.',
      query: `query GetEntry($habitId: ID!, $date: String!) {
  entry(habitId: $habitId, date: $date) {
    value standardMet targetMet
  }
}`,
      variables: { habitId: 'HABIT_ID', date: '2026-08-04' },
    },
    {
      name: 'Log an entry',
      description: 'Record a value for a habit. standardMet and targetMet are computed on the server.',
      query: `mutation LogEntry($input: UpsertEntryInput!) {
  upsertEntry(input: $input) {
    value standardMet targetMet
  }
}`,
      variables: { input: { habitId: 'HABIT_ID', date: '2026-08-04', value: 2.5 } },
    },
    {
      name: 'List my API keys',
      description: 'See your API keys and when they were last used.',
      query: `{
  myApiKeys {
    id name createdAt lastUsedAt
  }
}`,
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
</style>