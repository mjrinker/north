<script lang="ts">
  import '../styles/global.css';
  import { theme } from '../stores/theme';
  let { children }: { children: any } = $props();
  let currentTheme: 'light' | 'dark' | 'system' = 'system';
  theme.subscribe(v => currentTheme = v);
</script>

<nav style="display: flex; align-items: center; padding: 0.5rem 1rem; background: #f5f5f5; border-bottom: 1px solid #e0e0e0;">
  <a href="/" style="margin-right: 1rem;">Home</a>
  <a href="/habits" style="margin-right: 1rem;">Habits</a>
  <div style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
    <span style="font-size: 0.85rem; color: #555;">Theme:</span>
    <div style="display: flex; background: #e0e0e0; border-radius: 999px; padding: 0.25rem; gap: 0.25rem;">
      <button type="button" style="padding: 0.25rem 0.5rem; border: none; border-radius: 999px; background: ${currentTheme === 'system' ? '#fff' : 'transparent'}; cursor: pointer;" onclick={() => theme.set('system')}>S</button>
      <button type="button" style="padding: 0.25rem 0.5rem; border: none; border-radius: 999px; background: ${currentTheme === 'light' ? '#fff' : 'transparent'}; cursor: pointer;" onclick={() => theme.set('light')}>L</button>
      <button type="button" style="padding: 0.25rem 0.5rem; border: none; border-radius: 999px; background: ${currentTheme === 'dark' ? '#fff' : 'transparent'}; cursor: pointer;" onclick={() => theme.set('dark')}>D</button>
    </div>
  </div>
</nav>

{@render children()}