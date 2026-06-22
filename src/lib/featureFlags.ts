// src/lib/featureFlags.ts
// Feature flags default to false (off in production).
// Enable via VITE_FEATURE_<NAME>=true in Vercel env vars (e.g., for dev branch).

interface FeatureFlags {
  /** Statistics Dashboard at /stats */
  stats: boolean;
}

function env(name: string): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[`VITE_FEATURE_${name}`] === 'true';
  }
  return false;
}

const defaults: FeatureFlags = {
  stats: false,
};

let overrides: Partial<FeatureFlags> = {};

try {
  for (const key of Object.keys(defaults) as (keyof FeatureFlags)[]) {
    const envVal = env(key);
    if (envVal) overrides[key] = true;
  }
} catch {
  // SSR or missing env — use defaults
}

export const flags: FeatureFlags = { ...defaults, ...overrides };

export function isEnabled(key: keyof FeatureFlags): boolean {
  return flags[key];
}
