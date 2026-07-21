import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Collect console messages
const logs = [];
page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', err => logs.push({ type: 'error', text: err.message }));

// Seed IndexedDB with a habit
await page.goto('http://localhost:5173');
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('north_db', 2);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('habits')) db.createObjectStore('habits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
    };
    r.onsuccess = e => res(e.target.result);
    r.onerror = e => rej(e.target.error);
  });
  const tx = db.transaction('habits', 'readwrite');
  tx.objectStore('habits').put({
    id: 'test-habit-1',
    title: 'Test Habit',
    type: 'binary',
    status: 'active',
    tags: [],
    schedule: { frequency: 'daily', interval: 1, startDate: new Date('2024-01-01'), daysPerWeek: undefined },
    standard: 1,
    target: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  });
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
});

// Reload to pick up seeded data
await page.reload();
await page.waitForTimeout(2000);

// Log what we have
console.log('--- Console output ---');
for (const l of logs) console.log(`[${l.type}] ${l.text}`);

// Try clicking the habit checkbox
const checkbox = page.locator('input[type="checkbox"]').first();
console.log('checkbox exists:', await checkbox.count() > 0);
if (await checkbox.count() > 0) {
  await checkbox.click({ force: true });
  await page.waitForTimeout(1000);
  console.log('--- After click ---');
  for (const l of logs) console.log(`[${l.type}] ${l.text}`);
}

await browser.close();
