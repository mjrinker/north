<script lang="ts">
  import Icon from '@iconify/svelte';

  let { icon = $bindable(''), emoji = $bindable('') } = $props();

  let open = $state(false);
  let draftIcon = $state('');
  let draftEmoji = $state('');
  let tab = $state<'icon' | 'emoji'>('icon');
  let query = $state('');
  let results = $state<string[]>([]);
  let searching = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const FALLBACK_ICONS = [
    'mdi:run', 'mdi:run-fast', 'mdi:walk', 'mdi:weight-lifter', 'mdi:yoga',
    'mdi:meditation', 'mdi:swim', 'mdi:bike', 'mdi:hiking', 'mdi:dumbbell',
    'mdi:basketball', 'mdi:soccer', 'mdi:tennis', 'mdi:football', 'mdi:baseball',
    'mdi:golf', 'mdi:ski', 'mdi:snowboard', 'mdi:climber', 'mdi:rowing',
    'mdi:food-apple', 'mdi:food-fork-drink', 'mdi:food', 'mdi:silverware-fork-knife',
    'mdi:coffee', 'mdi:tea', 'mdi:glass-cocktail', 'mdi:glass-wine', 'mdi:cup-water',
    'mdi:water', 'mdi:water-outline', 'mdi:food-variant', 'mdi:nutrition',
    'mdi:sleep', 'mdi:bed', 'mdi:power-sleep', 'mdi:clock-alert', 'mdi:alarm',
    'mdi:timer-outline', 'mdi:timer', 'mdi:stopwatch', 'mdi:book-open-variant',
    'mdi:book', 'mdi:notebook', 'mdi:pencil', 'mdi:typewriter', 'mdi:keyboard',
    'mdi:phone', 'mdi:cellphone', 'mdi:laptop', 'mdi:desktop-tower-monitor',
    'mdi:headphones', 'mdi:music', 'mdi:guitar-electric', 'mdi:piano',
    'mdi:palette', 'mdi:brush', 'mdi:draw', 'mdi:camera', 'mdi:video',
    'mdi:heart', 'mdi:heart-outline', 'mdi:heart-pulse', 'mdi:lungs',
    'mdi:brain', 'mdi:tooth', 'mdi:eye', 'mdi:pill', 'mdi:medical-bag',
    'mdi:stethoscope', 'mdi:bandage', 'mdi:home', 'mdi:home-variant', 'mdi:washing-machine',
    'mdi:broom', 'mdi:spray-bottle', 'mdi:shower', 'mdi:bathtub', 'mdi:toothbrush',
    'mdi:car', 'mdi:car-sports', 'mdi:bicycle', 'mdi:bus', 'mdi:train',
    'mdi:airplane', 'mdi:rocket', 'mdi:walking', 'mdi:shopping', 'mdi:cart',
    'mdi:basket', 'mdi:currency-usd', 'mdi:cash', 'mdi:credit-card', 'mdi:bank',
    'mdi:bank-outline', 'mdi:chart-line', 'mdi:chart-bar', 'mdi:finance',
    'mdi:calendar', 'mdi:calendar-check', 'mdi:calendar-heart', 'mdi:clock',
    'mdi:bell', 'mdi:bell-ring', 'mdi:alarm-check', 'mdi:star', 'mdi:star-outline',
    'mdi:star-four-points', 'mdi:fire', 'mdi:lightning-bolt', 'mdi:weather-sunny',
    'mdi:weather-night', 'mdi:weather-rainy', 'mdi:weather-snowy', 'mdi:weather-windy',
    'mdi:leaf', 'mdi:tree', 'mdi:flower', 'mdi:sprout', 'mdi:earth',
    'mdi:dog', 'mdi:cat', 'mdi:bird', 'mdi:fish', 'mdi:rabbit', 'mdi:turtle',
    'mdi:bee', 'mdi:butterfly', 'mdi:bug', 'mdi:duck', 'mdi:owl', 'mdi:paw',
    'mdi:gift', 'mdi:cake', 'mdi:cake-variant', 'mdi:cupcake', 'mdi:party-popper',
    'mdi:balloon', 'mdi:trophy', 'mdi:medal', 'mdi:medal-outline', 'mdi:shield-check',
    'mdi:check-circle', 'mdi:check', 'mdi:check-bold', 'mdi:close-circle',
    'mdi:target', 'mdi:bullseye', 'mdi:flag', 'mdi:flag-variant', 'mdi:map-marker',
    'mdi:map-marker-radius', 'mdi:compass', 'mdi:lightbulb', 'mdi:lightbulb-outline',
    'mdi:book-multiple', 'mdi:school', 'mdi:graduation-cap', 'mdi:briefcase',
    'mdi:tools', 'mdi:hammer-wrench', 'mdi:content-save', 'mdi:email',
    'mdi:chat', 'mdi:message-text', 'mdi:hand-heart', 'mdi:handshake',
    'mdi:emoticon-happy', 'mdi:emoticon-cool', 'mdi:scale-balance', 'mdi:scale',
    'mdi:puzzle', 'mdi:gamepad', 'mdi:cards', 'mdi:dice-multiple', 'mdi:chess-knight',
  ];

  const EMOJIS: { e: string; name: string; cat: string }[] = [
    { e: '😀', name: 'grin', cat: 'Smileys' }, { e: '😄', name: 'smile', cat: 'Smileys' },
    { e: '😁', name: 'beam', cat: 'Smileys' }, { e: '😂', name: 'joy', cat: 'Smileys' },
    { e: '🤣', name: 'rofl', cat: 'Smileys' }, { e: '😊', name: 'blush', cat: 'Smileys' },
    { e: '😇', name: 'innocent', cat: 'Smileys' }, { e: '🙂', name: 'slightly smiling', cat: 'Smileys' },
    { e: '😉', name: 'wink', cat: 'Smileys' }, { e: '😍', name: 'heart eyes', cat: 'Smileys' },
    { e: '😘', name: 'kiss', cat: 'Smileys' }, { e: '😜', name: 'winking tongue', cat: 'Smileys' },
    { e: '🤔', name: 'thinking', cat: 'Smileys' }, { e: '🤗', name: 'hug', cat: 'Smileys' },
    { e: '🤩', name: 'star struck', cat: 'Smileys' }, { e: '🥳', name: 'party', cat: 'Smileys' },
    { e: '😎', name: 'sunglasses', cat: 'Smileys' }, { e: '🥺', name: 'pleading', cat: 'Smileys' },
    { e: '😭', name: 'sob', cat: 'Smileys' }, { e: '😅', name: 'sweat smile', cat: 'Smileys' },
    { e: '😴', name: 'sleeping', cat: 'Smileys' }, { e: '🤯', name: 'exploding head', cat: 'Smileys' },
    { e: '🥰', name: 'loving', cat: 'Smileys' },
    { e: '👍', name: 'thumbs up', cat: 'People' }, { e: '👎', name: 'thumbs down', cat: 'People' },
    { e: '👏', name: 'clap', cat: 'People' }, { e: '🙌', name: 'raise hands', cat: 'People' },
    { e: '🤝', name: 'handshake', cat: 'People' }, { e: '✌️', name: 'victory', cat: 'People' },
    { e: '🤞', name: 'crossed fingers', cat: 'People' }, { e: '🫶', name: 'heart hands', cat: 'People' },
    { e: '💪', name: 'flex', cat: 'People' }, { e: '🧠', name: 'brain', cat: 'People' },
    { e: '👀', name: 'eyes', cat: 'People' }, { e: '👣', name: 'footprints', cat: 'People' },
    { e: '🚶', name: 'walking', cat: 'People' }, { e: '🏃', name: 'running', cat: 'People' },
    { e: '🧘', name: 'meditation', cat: 'People' }, { e: '🤸', name: 'cartwheel', cat: 'People' },
    { e: '🐶', name: 'dog', cat: 'Animals' }, { e: '🐱', name: 'cat', cat: 'Animals' },
    { e: '🦊', name: 'fox', cat: 'Animals' }, { e: '🐻', name: 'bear', cat: 'Animals' },
    { e: '🐼', name: 'panda', cat: 'Animals' }, { e: '🐨', name: 'koala', cat: 'Animals' },
    { e: '🦁', name: 'lion', cat: 'Animals' }, { e: '🐯', name: 'tiger', cat: 'Animals' },
    { e: '🐸', name: 'frog', cat: 'Animals' }, { e: '🐢', name: 'turtle', cat: 'Animals' },
    { e: '🐹', name: 'hamster', cat: 'Animals' }, { e: '🐰', name: 'rabbit', cat: 'Animals' },
    { e: '🦉', name: 'owl', cat: 'Animals' }, { e: '🐦', name: 'bird', cat: 'Animals' },
    { e: '🐝', name: 'bee', cat: 'Animals' }, { e: '🦋', name: 'butterfly', cat: 'Animals' },
    { e: '🌵', name: 'cactus', cat: 'Animals' }, { e: '🌻', name: 'sunflower', cat: 'Animals' },
    { e: '🌸', name: 'cherry blossom', cat: 'Animals' }, { e: '🌳', name: 'tree', cat: 'Animals' },
    { e: '🍎', name: 'apple', cat: 'Food' }, { e: '🍌', name: 'banana', cat: 'Food' },
    { e: '🍇', name: 'grapes', cat: 'Food' }, { e: '🍓', name: 'strawberry', cat: 'Food' },
    { e: '🥑', name: 'avocado', cat: 'Food' }, { e: '🥦', name: 'broccoli', cat: 'Food' },
    { e: '🥕', name: 'carrot', cat: 'Food' }, { e: '🍕', name: 'pizza', cat: 'Food' },
    { e: '🍔', name: 'burger', cat: 'Food' }, { e: '🍟', name: 'fries', cat: 'Food' },
    { e: '🌮', name: 'taco', cat: 'Food' }, { e: '🍣', name: 'sushi', cat: 'Food' },
    { e: '🍩', name: 'donut', cat: 'Food' }, { e: '🍪', name: 'cookie', cat: 'Food' },
    { e: '☕', name: 'coffee', cat: 'Food' }, { e: '🍵', name: 'tea', cat: 'Food' },
    { e: '🥛', name: 'milk', cat: 'Food' }, { e: '🍺', name: 'beer', cat: 'Food' },
    { e: '🍷', name: 'wine', cat: 'Food' }, { e: '💧', name: 'water', cat: 'Food' },
    { e: '🥤', name: 'soda', cat: 'Food' }, { e: '🍊', name: 'orange', cat: 'Food' },
    { e: '⚽', name: 'soccer', cat: 'Activities' }, { e: '🏀', name: 'basketball', cat: 'Activities' },
    { e: '🏈', name: 'football', cat: 'Activities' }, { e: '⚾', name: 'baseball', cat: 'Activities' },
    { e: '🎾', name: 'tennis', cat: 'Activities' }, { e: '🏊', name: 'swim', cat: 'Activities' },
    { e: '🚴', name: 'cycling', cat: 'Activities' }, { e: '⛰️', name: 'mountain', cat: 'Activities' },
    { e: '🏋️', name: 'gym', cat: 'Activities' }, { e: '🧗', name: 'climb', cat: 'Activities' },
    { e: '🎮', name: 'game', cat: 'Activities' }, { e: '🎵', name: 'music', cat: 'Activities' },
    { e: '🎨', name: 'paint', cat: 'Activities' }, { e: '📚', name: 'books', cat: 'Activities' },
    { e: '✍️', name: 'write', cat: 'Activities' }, { e: '📖', name: 'read', cat: 'Activities' },
    { e: '🏕️', name: 'camping', cat: 'Activities' }, { e: '🚵', name: 'mountain bike', cat: 'Activities' },
    { e: '✈️', name: 'plane', cat: 'Travel' }, { e: '🚗', name: 'car', cat: 'Travel' },
    { e: '🚌', name: 'bus', cat: 'Travel' }, { e: '🚆', name: 'train', cat: 'Travel' },
    { e: '🚀', name: 'rocket', cat: 'Travel' }, { e: '🌍', name: 'earth', cat: 'Travel' },
    { e: '🌙', name: 'moon', cat: 'Travel' }, { e: '☀️', name: 'sun', cat: 'Travel' },
    { e: '⭐', name: 'star', cat: 'Travel' }, { e: '🌈', name: 'rainbow', cat: 'Travel' },
    { e: '❄️', name: 'snow', cat: 'Travel' }, { e: '🌧️', name: 'rain', cat: 'Travel' },
    { e: '⚡', name: 'lightning', cat: 'Travel' }, { e: '🏠', name: 'home', cat: 'Travel' },
    { e: '🏢', name: 'office', cat: 'Travel' }, { e: '🛌', name: 'sleep', cat: 'Travel' },
    { e: '💰', name: 'money', cat: 'Objects' }, { e: '💳', name: 'card', cat: 'Objects' },
    { e: '🛒', name: 'cart', cat: 'Objects' }, { e: '💊', name: 'pill', cat: 'Objects' },
    { e: '🩺', name: 'stethoscope', cat: 'Objects' }, { e: '💻', name: 'laptop', cat: 'Objects' },
    { e: '📱', name: 'phone', cat: 'Objects' }, { e: '🖥️', name: 'computer', cat: 'Objects' },
    { e: '📝', name: 'memo', cat: 'Objects' }, { e: '📋', name: 'clipboard', cat: 'Objects' },
    { e: '🧹', name: 'clean', cat: 'Objects' }, { e: '🧼', name: 'soap', cat: 'Objects' },
    { e: '🛁', name: 'bath', cat: 'Objects' }, { e: '🪥', name: 'toothbrush', cat: 'Objects' },
    { e: '🧴', name: 'lotion', cat: 'Objects' }, { e: '🔑', name: 'key', cat: 'Objects' },
    { e: '🔒', name: 'lock', cat: 'Objects' }, { e: '✂️', name: 'scissors', cat: 'Objects' },
    { e: '❤️', name: 'red heart', cat: 'Symbols' }, { e: '💚', name: 'green heart', cat: 'Symbols' },
    { e: '💙', name: 'blue heart', cat: 'Symbols' }, { e: '🧡', name: 'orange heart', cat: 'Symbols' },
    { e: '💜', name: 'purple heart', cat: 'Symbols' }, { e: '🖤', name: 'black heart', cat: 'Symbols' },
    { e: '✅', name: 'check', cat: 'Symbols' }, { e: '❌', name: 'cross', cat: 'Symbols' },
    { e: '🔥', name: 'fire', cat: 'Symbols' }, { e: '💯', name: 'hundred', cat: 'Symbols' },
    { e: '🎯', name: 'target', cat: 'Symbols' }, { e: '🏆', name: 'trophy', cat: 'Symbols' },
    { e: '🥇', name: 'gold medal', cat: 'Symbols' }, { e: '🥈', name: 'silver medal', cat: 'Symbols' },
    { e: '🥉', name: 'bronze medal', cat: 'Symbols' }, { e: '🚫', name: 'no', cat: 'Symbols' },
    { e: '⏰', name: 'alarm', cat: 'Symbols' }, { e: '📅', name: 'calendar', cat: 'Symbols' },
    { e: '📆', name: 'date', cat: 'Symbols' }, { e: '⏱️', name: 'timer', cat: 'Symbols' },
  ];

  let emojiResults = $derived(
    query
      ? EMOJIS.filter(e =>
          e.name.toLowerCase().includes(query.toLowerCase()) || e.e.includes(query)
        )
      : EMOJIS
  );

  function localIconFilter(q: string): string[] {
    const n = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!n) return FALLBACK_ICONS;
    return FALLBACK_ICONS.filter(name => name.toLowerCase().includes(n)).slice(0, 96);
  }

  async function loadIcons(q: string) {
    const clean = q.trim();
    if (!clean) { results = FALLBACK_ICONS; return; }
    searching = true;
    try {
      const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(clean)}&limit=96`);
      if (res.ok) {
        const data = await res.json();
        if (data?.icons?.length) { results = data.icons.slice(0, 96); return; }
      }
      results = localIconFilter(clean);
    } catch {
      results = localIconFilter(clean);
    } finally {
      searching = false;
    }
  }

  function onSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    if (tab === 'emoji') return;
    searchTimer = setTimeout(() => loadIcons(query), 250);
  }

  function openPicker() {
    draftIcon = icon;
    draftEmoji = emoji;
    tab = emoji ? 'emoji' : 'icon';
    query = '';
    open = true;
    loadIcons('');
  }
  function confirm() {
    icon = draftIcon;
    emoji = draftEmoji;
    open = false;
  }
  function cancel() {
    open = false;
  }
  function pickIcon(name: string) { draftIcon = name; draftEmoji = ''; }
  function pickEmoji(e: string) { draftEmoji = e; draftIcon = ''; }
</script>

<button type="button" class="icon-trigger" onclick={openPicker}>
  {#if emoji}
    <span class="trigger-glyph">{emoji}</span>
  {:else if icon}
    <Icon icon={icon} class="trigger-glyph" style="color: inherit" />
  {:else}
    <span class="trigger-glyph none">None</span>
  {/if}
  <span class="trigger-label">Icon</span>
  <span class="trigger-edit">Edit</span>
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <div class="sub-overlay" onclick={cancel} onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Escape') cancel(); }}>
    <div class="sub-picker" onclick={(e) => e.stopPropagation()}>
      <div class="sub-header">
        <h3>Icon</h3>
        <button type="button" class="sub-close" onclick={cancel} aria-label="Close">&times;</button>
      </div>

      <div class="tabs">
        <button type="button" class="tab" class:active={tab === 'icon'} onclick={() => { tab = 'icon'; loadIcons(query); }}>Icon</button>
        <button type="button" class="tab" class:active={tab === 'emoji'} onclick={() => tab = 'emoji'}>Emoji</button>
      </div>

      <input
        type="text"
        class="search"
        bind:value={query}
        oninput={onSearchInput}
        placeholder={tab === 'icon' ? 'Search icons…' : 'Search emojis…'}
      />

      {#if tab === 'icon'}
        <div class="grid">
          {#if searching}
            <span class="hint">Searching…</span>
          {:else if results.length === 0}
            <span class="hint">No icons found</span>
          {:else}
            {#each results as name (name)}
              <button
                type="button"
                class="cell"
                class:selected={draftIcon === name}
                onclick={() => pickIcon(name)}
                title={name}
              >
                <Icon icon={name} style="color: inherit" />
              </button>
            {/each}
          {/if}
        </div>
      {:else}
        {#if emojiResults.length === 0}
          <div class="grid"><span class="hint">No emojis found</span></div>
        {:else}
          <div class="emoji-groups">
            {#each ['Smileys', 'People', 'Animals', 'Food', 'Activities', 'Travel', 'Objects', 'Symbols'] as cat}
              {#if emojiResults.some(e => e.cat === cat)}
                <div class="emoji-group">
                  <span class="emoji-cat">{cat}</span>
                  <div class="grid">
                    {#each emojiResults.filter(e => e.cat === cat) as entry}
                      <button
                        type="button"
                        class="cell emoji-cell"
                        class:selected={draftEmoji === entry.e}
                        onclick={() => pickEmoji(entry.e)}
                        title={entry.name}
                      >{entry.e}</button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/if}

      <div class="sub-actions">
        <button type="button" class="btn btn-cancel" onclick={cancel}>Cancel</button>
        <button type="button" class="btn btn-ok" onclick={confirm}>OK</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .icon-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    font-size: 0.85rem;
    cursor: pointer;
    margin-bottom: 0.75rem;
  }
  .icon-trigger:hover { background: var(--btn-secondary-bg, #eee); }
  .trigger-glyph { font-size: 1.15rem; line-height: 1; }
  .trigger-glyph :global(svg), .trigger-glyph :global(.iconify) { font-size: 1.15rem; color: inherit; }
  .trigger-glyph.none { font-size: 0.85rem; color: var(--text-secondary, #888); }
  .trigger-label { font-weight: 500; }
  .trigger-edit { font-size: 0.75rem; color: var(--text-secondary, #888); }

  .sub-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
  }
  .sub-picker {
    background: var(--card-bg, #fff);
    border-radius: 10px;
    width: 92vw;
    max-width: 400px;
    padding: 1.1rem;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
    max-height: 85vh;
    overflow-y: auto;
  }
  .sub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }
  .sub-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary, #222); }
  .sub-close {
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--text-secondary, #999);
    cursor: pointer;
    padding: 0.25rem;
  }
  .tabs { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
  .tab {
    padding: 0.3rem 0.9rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 999px;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .tab.active { background: var(--accent, #0066cc); color: var(--accent-text, #fff); border-color: var(--accent, #0066cc); }
  .search {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    margin-bottom: 0.5rem;
    box-sizing: border-box;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));
    gap: 0.3rem;
    max-height: 12rem;
    overflow-y: auto;
    padding: 0.1rem;
  }
  .cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--card-border, #ddd);
    border-radius: 4px;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
  }
  .cell :global(svg), .cell :global(.iconify) { font-size: 1.3rem; color: inherit; }
  .cell:hover { border-color: var(--accent, #0066cc); }
  .cell.selected { border-color: var(--accent, #0066cc); background: var(--accent, #0066cc); color: var(--accent-text, #fff); }
  .cell.selected :global(svg), .cell.selected :global(.iconify) { color: var(--accent-text, #fff); }
  .hint { font-size: 0.8rem; color: var(--text-secondary, #888); grid-column: 1 / -1; padding: 0.5rem; }
  .emoji-groups { max-height: 14rem; overflow-y: auto; }
  .emoji-group { margin-bottom: 0.5rem; }
  .emoji-cat { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary, #888); margin-bottom: 0.25rem; }
  .sub-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .btn {
    padding: 0.45rem 1.1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .btn-cancel { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .btn-ok { background: var(--accent, #0066cc); color: var(--accent-text, #fff); }
</style>
