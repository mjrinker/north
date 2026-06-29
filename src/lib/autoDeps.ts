export function autoDepsKey(condId: string, date: string): string {
  return `autoDep_${condId}_${date}`;
}

export function getAutoCompletedDepIds(condId: string, date: string): string[] {
  try {
    const saved = localStorage.getItem(autoDepsKey(condId, date));
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

export function recordAutoCompletedDep(condId: string, date: string, depId: string) {
  const ids = getAutoCompletedDepIds(condId, date);
  if (!ids.includes(depId)) {
    ids.push(depId);
    try { localStorage.setItem(autoDepsKey(condId, date), JSON.stringify(ids)); } catch {}
  }
}

export function clearAutoCompletedDeps(condId: string, date: string) {
  try { localStorage.removeItem(autoDepsKey(condId, date)); } catch {}
}
