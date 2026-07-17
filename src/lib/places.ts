import type { SuggestedPlace } from '../types';

const STORAGE_KEY = 'suggestedPlaces';

export function loadPlaces(): SuggestedPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: SuggestedPlace[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

export function getCurrentTimeSlot(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getCurrentLocation(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos),
      () => resolve(null),
      { timeout: 5000, maximumAge: 600000 }
    );
  });
}

export function isAtPlace(pos: GeolocationPosition, place: SuggestedPlace): boolean {
  const R = 6371e3;
  const lat1 = (pos.coords.latitude * Math.PI) / 180;
  const lat2 = (place.latitude * Math.PI) / 180;
  const dlat = ((place.latitude - pos.coords.latitude) * Math.PI) / 180;
  const dlon = ((place.longitude - pos.coords.longitude) * Math.PI) / 180;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c <= place.radius;
}
