export const STORAGE_KEY = 'growise.garden.v1';

const PLANT_FIELDS = [
  'name',
  'species',
  'location',
  'sunlight',
  'waterEveryDays',
  'lastWatered',
  'notes',
];

function emptyGarden() {
  return { version: 1, plants: [], journal: [] };
}

function validateGarden(value) {
  if (
    !value
    || value.version !== 1
    || !Array.isArray(value.plants)
    || !Array.isArray(value.journal)
  ) {
    throw new TypeError('This is not a supported Growise garden backup.');
  }

  const plantIds = new Set();
  for (const plant of value.plants) {
    if (!plant || typeof plant.id !== 'string' || typeof plant.name !== 'string' || !plant.name.trim()) {
      throw new TypeError('Every plant needs a name and a valid id.');
    }
    if (plantIds.has(plant.id)) throw new TypeError('Plant ids must be unique.');
    plantIds.add(plant.id);
  }

  for (const entry of value.journal) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string' || !entry.text.trim()) {
      throw new TypeError('Every journal entry needs text and a valid id.');
    }
  }

  return structuredClone(value);
}

function newId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGardenStore(storage = globalThis.localStorage) {
  if (!storage) throw new Error('Browser storage is not available.');

  let garden;
  try {
    const saved = storage.getItem(STORAGE_KEY);
    garden = saved ? validateGarden(JSON.parse(saved)) : emptyGarden();
  } catch {
    garden = emptyGarden();
  }

  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(garden));
  }

  return {
    getState() {
      return structuredClone(garden);
    },

    addPlant(input) {
      const name = String(input.name ?? '').trim();
      if (!name) throw new TypeError('Give your plant a name.');
      const plant = { id: newId(), ...Object.fromEntries(PLANT_FIELDS.map((field) => [field, ''])) };
      for (const field of PLANT_FIELDS) {
        if (field in input) plant[field] = field === 'waterEveryDays'
          ? Number(input[field])
          : String(input[field] ?? '').trim();
      }
      plant.name = name;
      if (!Number.isInteger(plant.waterEveryDays) || plant.waterEveryDays < 1 || plant.waterEveryDays > 60) {
        plant.waterEveryDays = 7;
      }
      garden.plants.unshift(plant);
      persist();
      return structuredClone(plant);
    },

    updatePlant(id, updates) {
      const plant = garden.plants.find((item) => item.id === id);
      if (!plant) return false;
      const next = { ...plant };
      for (const field of PLANT_FIELDS) {
        if (field in updates) {
          next[field] = field === 'waterEveryDays'
            ? Number(updates[field])
            : String(updates[field] ?? '').trim();
        }
      }
      if (!next.name) throw new TypeError('Give your plant a name.');
      if (!Number.isInteger(next.waterEveryDays) || next.waterEveryDays < 1 || next.waterEveryDays > 60) {
        throw new TypeError('Watering interval must be between 1 and 60 days.');
      }
      Object.assign(plant, next);
      persist();
      return true;
    },

    removePlant(id) {
      const before = garden.plants.length;
      garden.plants = garden.plants.filter((plant) => plant.id !== id);
      garden.journal = garden.journal.filter((entry) => entry.plantId !== id);
      if (before !== garden.plants.length) persist();
      return before !== garden.plants.length;
    },

    waterPlant(id, date = new Date().toISOString().slice(0, 10)) {
      const plant = garden.plants.find((item) => item.id === id);
      if (!plant) return false;
      plant.lastWatered = date;
      persist();
      return true;
    },

    addJournalEntry(input) {
      const text = String(input.text ?? '').trim();
      if (!text) throw new TypeError('Write a note before adding it to your journal.');
      if (input.plantId && !garden.plants.some((plant) => plant.id === input.plantId)) {
        throw new TypeError('Choose a plant in your garden.');
      }
      const entry = {
        id: newId(),
        plantId: input.plantId || '',
        text,
        date: input.date || new Date().toISOString().slice(0, 10),
      };
      garden.journal.unshift(entry);
      persist();
      return structuredClone(entry);
    },

    removeJournalEntry(id) {
      const before = garden.journal.length;
      garden.journal = garden.journal.filter((entry) => entry.id !== id);
      if (before !== garden.journal.length) persist();
      return before !== garden.journal.length;
    },

    exportData() {
      return JSON.stringify(garden, null, 2);
    },

    importData(json) {
      const next = validateGarden(JSON.parse(json));
      garden = next;
      persist();
      return this.getState();
    },

    clear() {
      garden = emptyGarden();
      persist();
      return this.getState();
    },
  };
}