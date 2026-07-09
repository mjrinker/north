import { writable, type Writable } from 'svelte/store';

export function createStore<T extends { id: string }>(
  getAll: () => Promise<T[]>,
  save: (item: T) => Promise<void>,
  del: (id: string) => Promise<void>
) {
  const store: Writable<T[]> = writable([]);

  if (typeof window !== 'undefined') {
    getAll().then(data => store.set(data));
  }

  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,

    async refresh() {
      store.set(await getAll());
    },

    add(item: T) {
      store.update(list => {
        const updated = [...list, item];
        save(item).catch(console.error);
        return updated;
      });
    },

    updateItem(item: T) {
      store.update(list => list.map(i => i.id === item.id ? item : i));
      save(item).catch(console.error);
    },

    remove(id: string) {
      store.update(list => list.filter(i => i.id !== id));
      del(id).catch(console.error);
    }
  };
}
