import type { Identity } from '../types';
import { getAllIdentities, saveIdentity, deleteIdentity } from '../services/storage';
import { createStore } from '../lib/storeFactory';

export const identitiesStore = createStore<Identity>(getAllIdentities, saveIdentity, deleteIdentity);

export function addIdentity(id: Identity) {
  identitiesStore.add(id);
}

export function updateIdentity(id: Identity) {
  identitiesStore.updateItem(id);
}

export function removeIdentity(id: string) {
  identitiesStore.remove(id);
}
