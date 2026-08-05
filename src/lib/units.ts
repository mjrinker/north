// src/lib/units.ts
import pluralize from 'pluralize';

// Units whose abbreviation does not change in the plural (e.g. "5 oz", "3 ml").
// Conventionally the symbol/short form stays the same regardless of count.
const INVARIANT_UNITS = new Set([
  // weight
  'oz', 'lb', 'lbs', 'kg', 'g', 'mg', 'mcg', 'mcg', 'ton', 't', 'st',
  // volume
  'ml', 'l', 'cl', 'dl', 'pt', 'qt', 'gal', 'tsp', 'tbsp', 'fl oz',
  // length / distance
  'mm', 'cm', 'm', 'km', 'ft', 'ft', 'in', 'mi', 'yd',
  // time
  's', 'min', 'hr', 'hrs', 'sec', 'ms',
  // speed
  'mph', 'kph', 'km/h', 'm/s',
  // temperature
  'c', 'f',
  // power / energy
  'w', 'kw', 'wh', 'kwh', 'mw',
  // other
  'rep', 'reps', 'cap', 'caps', 'serving', 'servings',
]);

// Explicit plural overrides for abbreviations that do take an 's' in the plural.
const UNIT_PLURALS: Record<string, string> = {
  // add any non-default plural forms here if needed
};

export function pluralizeUnit(rawUnit: string | undefined | null, count: number): string {
  const raw = (rawUnit ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (key in UNIT_PLURALS && count !== 1) return UNIT_PLURALS[key];
  if (INVARIANT_UNITS.has(key)) return raw;
  return pluralize(raw, count);
}