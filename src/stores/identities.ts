// src/stores/identities.ts
import type { Identity } from '../types';
import { writable, type Writable } from 'svelte/store';
import { 
  getAllIdentities, 
  saveIdentity, 
  deleteIdentity 
} from '../services/storage';

export const identitiesStore: Writable<Identity[]> = writable([]);

// Load initial data only on the client
if (typeof window !== 'undefined') {
  getAllIdentities().then(ids => identitiesStore.set(ids));
}

export function addIdentity(id: Identity) {
  identitiesStore.update(list => {
    const updated = [...list, id];
    saveIdentity(id).catch(console.error);
    return updated;
  });
}

export function updateIdentity(id: Identity) {
  identitiesStore.update(list => list.map(item => item.id === id.id ? id : item));
  saveIdentity(id).catch(console.error);
}

export function removeIdentity(id: string) {
  identitiesStore.update(list => list.filter(item => item.id !== id));
  deleteIdentity(id).catch(console.error);
}