import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenStore, STORAGE_KEY } from '../garden-store.mjs';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('plants, watering, and journal entries persist together', () => {
  const storage = createMemoryStorage();
  const store = createGardenStore(storage);
  const plant = store.addPlant({ name: 'Basil', waterEveryDays: 3 });
  store.waterPlant(plant.id, '2026-11-09');
  store.addJournalEntry({ plantId: plant.id, text: 'New leaves after repotting.' });

  const reloaded = createGardenStore(storage).getState();
  assert.equal(reloaded.plants[0].lastWatered, '2026-11-09');
  assert.equal(reloaded.journal[0].plantId, plant.id);
  assert.equal(reloaded.journal[0].text, 'New leaves after repotting.');
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('removing a plant also removes its linked journal entries', () => {
  const store = createGardenStore(createMemoryStorage());
  const plant = store.addPlant({ name: 'Mint' });
  store.addJournalEntry({ plantId: plant.id, text: 'Moved to a larger pot.' });

  assert.equal(store.removePlant(plant.id), true);
  assert.deepEqual(store.getState().plants, []);
  assert.deepEqual(store.getState().journal, []);
});

test('invalid plant updates do not partially change saved data', () => {
  const store = createGardenStore(createMemoryStorage());
  const plant = store.addPlant({ name: 'Sage', waterEveryDays: 5 });

  assert.throws(() => store.updatePlant(plant.id, { name: 'New sage', waterEveryDays: 0 }), /between 1 and 60/);
  assert.deepEqual(store.getState().plants[0], plant);
});

test('backup import validates before replacing the current garden', () => {
  const store = createGardenStore(createMemoryStorage());
  store.addPlant({ name: 'Rosemary' });
  const before = store.getState();

  assert.throws(() => store.importData('{"version":2}'), /supported Growise/);
  assert.deepEqual(store.getState(), before);

  const copy = createGardenStore(createMemoryStorage());
  copy.importData(store.exportData());
  assert.deepEqual(copy.getState(), before);
});

test('corrupt local storage starts a clean garden rather than crashing', () => {
  const store = createGardenStore(createMemoryStorage({ [STORAGE_KEY]: '{' }));
  assert.deepEqual(store.getState(), { version: 1, plants: [], journal: [] });
});