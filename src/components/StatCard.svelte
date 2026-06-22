<script lang="ts">
  let { label, value, sub = '' }: { label: string; value: string | number; sub?: string } = $props();
</script>

<div class="stat-card">
  <span class="stat-label">{label}</span>
  <span class="stat-value">{value}</span>
  {#if sub}<span class="stat-sub">{sub}</span>{/if}
</div>

<style>
  .stat-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }
  .stat-label {
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary, #222);
  }
  .stat-sub {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }
</style>
