<script lang="ts">
  import { GRAPHQL_URL } from '../lib/api';
  import { copyToClipboard } from '../lib/apiKeys';

  interface Example {
    name: string;
    description?: string;
    query: string;
    variables?: Record<string, unknown>;
    response?: string;
  }

  let { example }: { example: Example } = $props();

  const URL = GRAPHQL_URL;
  const KEY = 'YOUR_API_KEY';

  let menuOpen = $state(false);
  let copiedId = $state('');
  let responseCopied = $state(false);

  const bodyJson = JSON.stringify({ query: example.query, variables: example.variables ?? {} });
  const queryString = example.query.trim();
  const hasVars = !!example.variables && Object.keys(example.variables).length > 0;
  const varsPretty = hasVars ? JSON.stringify(example.variables, null, 2) : '{}';

  const menuItems = [
    { id: 'graphql', label: 'GraphQL' },
    { id: 'json', label: 'JSON request body' },
    { id: 'curl', label: 'curl (bash)' },
    { id: 'curlcmd', label: 'curl (Windows cmd)' },
    { id: 'python', label: 'Python (requests)' },
    { id: 'fetch', label: 'JavaScript (Fetch)' },
    { id: 'axios', label: 'JavaScript (axios)' },
  ];

  function snippet(id: string): string {
    switch (id) {
      case 'graphql':
        return example.query.trim() + '\n';
      case 'json':
        return JSON.stringify({ query: queryString, variables: example.variables ?? {} }, null, 2) + '\n';
      case 'curl':
        return [
          `curl -s -X POST '${URL}' \\`,
          `  -H 'Content-Type: application/json' \\`,
          `  -H 'x-api-key: ${KEY}' \\`,
          `  -d '${bodyJson}'`,
        ].join('\n') + '\n';
      case 'curlcmd':
        return `curl -s -X POST "${URL}" -H "Content-Type: application/json" -H "x-api-key: ${KEY}" -d "${bodyJson.replace(/"/g, '\\"')}"\n`;
      case 'python':
        return [
          'import requests',
          'import json',
          '',
          `url = "${URL}"`,
          'headers = {',
          '    "Content-Type": "application/json",',
          `    "x-api-key": "${KEY}",`,
          '}',
          '',
          `query = """${queryString}"""`,
          `variables = ${varsPretty}`,
          'body = {"query": query}',
          'body["variables"] = variables',
          '',
          'r = requests.post(url, data=json.dumps(body), headers=headers)',
          'print(r.status_code)',
          'print(json.dumps(r.json(), indent=2))',
        ].join('\n') + '\n';
      case 'fetch':
        return [
          `const url = "${URL}";`,
          'const headers = {',
          '  "Content-Type": "application/json",',
          `  "x-api-key": "${KEY}",`,
          '};',
          'const body = {',
          `  query: \`${queryString}\`,`,
          `  variables: ${varsPretty},`,
          '};',
          '',
          'const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });',
          'const data = await res.json();',
          'console.log(JSON.stringify(data, null, 2));',
        ].join('\n') + '\n';
      case 'axios':
        return [
          'const axios = require("axios");',
          '',
          `const url = "${URL}";`,
          'const headers = {',
          '  "Content-Type": "application/json",',
          `  "x-api-key": "${KEY}",`,
          '};',
          'const body = {',
          `  query: \`${queryString}\`,`,
          `  variables: ${varsPretty},`,
          '};',
          '',
          'axios.post(url, body, { headers })',
          '  .then((res) => console.log(JSON.stringify(res.data, null, 2)))',
          '  .catch((err) => console.error(err.response?.data ?? err.message));',
        ].join('\n') + '\n';
      default:
        return '';
    }
  }

  async function handleCopy(id: string) {
    const ok = await copyToClipboard(snippet(id));
    if (ok) {
      copiedId = id;
      setTimeout(() => { if (copiedId === id) copiedId = ''; }, 1400);
    }
    menuOpen = false;
  }

  async function copyResponse() {
    if (!example.response) return;
    const ok = await copyToClipboard(example.response.trim() + '\n');
    if (ok) {
      responseCopied = true;
      setTimeout(() => { responseCopied = false; }, 1400);
    }
  }
</script>

<div class="api-example">
  <div class="head">
    <div class="title-row">
      <h3>{example.name}</h3>
      <div class="copy-wrap">
        <button class="copy-btn" onclick={() => menuOpen = !menuOpen} aria-label="Copy request as…" aria-haspopup="menu">
          {copiedId ? 'Copied ✓' : 'Copy'}
        </button>
        {#if menuOpen}
          <button class="menu-backdrop" aria-label="Close menu" onclick={() => menuOpen = false}></button>
          <div class="menu" role="menu">
            {#each menuItems as it (it.id)}
              <button class="menu-item" role="menuitem" onclick={() => handleCopy(it.id)}>
                <span class="menu-check">{copiedId === it.id ? '✓' : ''}</span>
                <span>{it.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    {#if example.description}
      <p class="desc">{example.description}</p>
    {/if}
  </div>
  <pre class="gql"><code>{example.query.trim()}</code></pre>
  {#if example.response}
    <div class="resp-block">
      <div class="resp-head">
        <span class="resp-label">Sample response</span>
        <button class="resp-copy" onclick={copyResponse}>{responseCopied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <pre class="gql resp"><code>{example.response.trim()}</code></pre>
    </div>
  {/if}
</div>

<style>
  .api-example {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 10px;
    overflow: hidden;
  }
  .head {
    padding: 0.9rem 1rem 0.6rem;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #222);
  }
  .desc {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
  }
  .copy-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .copy-btn {
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .copy-btn:hover { opacity: 0.85; }
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: transparent;
    border: none;
    cursor: default;
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 1000;
    min-width: 210px;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.15);
    padding: 0.25rem;
    display: flex;
    flex-direction: column;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.6rem;
    border: none;
    background: transparent;
    border-radius: 0;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-primary, #222);
    text-align: left;
    font-family: inherit;
  }
  .menu-item:hover { background: var(--btn-secondary-bg, #eee); }
  .menu-check {
    width: 0.9rem;
    color: #2e7d32;
    font-weight: 700;
  }
  .gql {
    margin: 0;
    padding: 0.9rem 1rem 1rem;
    background: var(--input-bg, #f5f5f5);
    border-top: 1px solid var(--card-border, #e0e0e0);
    overflow-x: auto;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--text-primary, #222);
    font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  }
  .resp-block {
    border-top: 1px solid var(--card-border, #e0e0e0);
  }
  .resp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem 0.5rem;
  }
  .resp-label {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary, #666);
  }
  .resp-copy {
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .resp-copy:hover { opacity: 0.85; }
  .gql.resp {
    border-top: none;
    padding-top: 0.5rem;
  }
</style>