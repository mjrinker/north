import type { Identity } from '../types';
import { getAllIdentities, saveIdentity, deleteIdentity as deleteIdentityFromDB } from '../services/storage';
import { createStore } from '../lib/storeFactory';
import { pushRecord, removeRecord } from '../services/sync';

export const identitiesStore = createStore<Identity>(getAllIdentities, saveIdentity, deleteIdentityFromDB);

export function addIdentity(id: Identity) {
  identitiesStore.add(id);
  pushRecord('identities', id.id, id);
}

export function updateIdentity(id: Identity) {
  identitiesStore.updateItem(id);
  pushRecord('identities', id.id, id);
}

export function removeIdentity(id: string) {
  identitiesStore.remove(id);
  removeRecord('identities', id);
}
