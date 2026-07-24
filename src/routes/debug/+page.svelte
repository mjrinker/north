<script lang="ts">
  let logs = $state<Record<string, unknown>[]>([])
  let filter = $state('')
  let selected = $state<Set<number>>(new Set())

  function load() {
    try {
      logs = JSON.parse(localStorage.getItem('__logs') || '[]')
    } catch { logs = [] }
    selected = new Set(logs.map((_, i) => i))
  }

  function clear() {
    localStorage.removeItem('__logs')
    logs = []
    selected = new Set()
  }

  function selectAll() {
    selected = new Set(logs.map((_, i) => i))
  }

  function selectNone() {
    selected = new Set()
  }

  function toggle(idx: number) {
    const next = new Set(selected)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    selected = next
  }

  function copy() {
    const text = logs
      .filter((_, i) => selected.has(i))
      .map(e => {
        const msg = `[${new Date(e.t as number).toISOString()}] ${e.l?.toString().toUpperCase().padEnd(5)} ${e.m}`
        return e.s ? msg + '\n' + (e.s as string) : msg
      })
      .join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  function download() {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'logs.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  load()

  let filtered = $derived(filter ? logs.filter(e => JSON.stringify(e).toLowerCase().includes(filter.toLowerCase())) : logs)
</script>

<svelte:head>
  <title>Debug Logs</title>
</svelte:head>

<div class="debug-page">
  <div class="toolbar">
    <h1>Debug Logs ({logs.length})</h1>
    <input type="text" bind:value={filter} placeholder="Filter..." class="filter-input" />
    <div class="toolbar-group">
      <button onclick={load}>Refresh</button>
      <button onclick={selectAll}>Select all</button>
      <button onclick={selectNone}>Deselect all</button>
    </div>
    <div class="toolbar-group">
      <span class="sel-count">{selected.size} selected</span>
      <button onclick={copy}>Copy selected</button>
      <button onclick={download}>Download all</button>
      <button onclick={clear} class="danger">Clear</button>
    </div>
  </div>

  <div class="log-list">
    {#each filtered as entry, i}
      {@const idx = logs.indexOf(entry)}
      <div class="log-entry level-{entry.l as string}" class:checked={selected.has(idx)}>
        <label class="checkbox-cell">
          <input type="checkbox" checked={selected.has(idx)} onchange={() => toggle(idx)} />
        </label>
        <span class="time">{new Date(entry.t as number).toLocaleTimeString()}</span>
        <span class="level">{(entry.l as string)?.toUpperCase().padEnd(5)}</span>
        <span class="msg">{entry.m as string}</span>
        {#if entry.s}
          <pre class="stack">{entry.s as string}</pre>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .debug-page {
    padding: 1rem;
    font-family: monospace;
    font-size: 0.8rem;
    background: #111;
    color: #eee;
    min-height: 100vh;
  }
  .toolbar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .toolbar h1 { font-size: 1rem; margin: 0; }
  .filter-input {
    flex: 1;
    min-width: 120px;
    padding: 0.3rem 0.5rem;
    background: #222;
    border: 1px solid #444;
    color: #eee;
    border-radius: 4px;
    font: inherit;
  }
  button {
    padding: 0.3rem 0.7rem;
    background: #333;
    border: 1px solid #555;
    color: #eee;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
  }
  button:hover { background: #444; }
  .danger { color: #f66; border-color: #a33; }
  .toolbar-group { display: flex; gap: 0.25rem; align-items: center; }
  .sel-count { font-size: 0.75rem; color: #888; white-space: nowrap; }
  .log-list { display: flex; flex-direction: column; gap: 2px; }
  .log-entry {
    padding: 0.3rem 0.5rem;
    border-radius: 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.6rem;
    align-items: flex-start;
  }
  .log-entry.level-error { background: #3a1515; }
  .log-entry.level-warn  { background: #3a3515; }
  .log-entry.level-info  { background: #15203a; }
  .log-entry.checked { outline: 1px solid #5588ff; }
  .checkbox-cell {
    display: flex;
    align-items: center;
    padding: 0;
    cursor: pointer;
    line-height: 1;
  }
  .checkbox-cell input { margin: 0; cursor: pointer; }
  .time { color: #888; white-space: nowrap; }
  .level { color: #aaa; white-space: nowrap; font-weight: bold; }
  .level-error .level { color: #f66; }
  .level-warn  .level { color: #fa0; }
  .msg { flex: 1; word-break: break-word; }
  .stack {
    width: 100%;
    margin-top: 0.2rem;
    padding: 0.3rem;
    background: #1a1a1a;
    border-radius: 3px;
    font-size: 0.7rem;
    color: #999;
    white-space: pre-wrap;
    overflow-x: auto;
  }
</style>
