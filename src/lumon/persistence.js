import { createLumonState } from "./model";

export const LUMON_REGISTRY_STORAGE_KEY = "lumon.registry.v1";
export const LUMON_REGISTRY_VERSION = 1;
export const LUMON_REGISTRY_ENVELOPE_KIND = "lumon-registry";

const getBrowserStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

const resolveStorage = (storage) => (typeof storage === "function" ? storage() : storage);

const createEnvelope = (state, savedAt = new Date().toISOString()) => ({
  kind: LUMON_REGISTRY_ENVELOPE_KIND,
  version: LUMON_REGISTRY_VERSION,
  savedAt,
  state,
});

const isValidEnvelope = (value) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    value.kind === LUMON_REGISTRY_ENVELOPE_KIND &&
    value.version === LUMON_REGISTRY_VERSION &&
    value.state &&
    typeof value.state === "object"
  );
};

export function isStorageAvailable(storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  const testKey = `${LUMON_REGISTRY_STORAGE_KEY}:availability`;

  try {
    storage.setItem(testKey, "ok");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadLumonState({
  storage = getBrowserStorage(),
  storageKey = LUMON_REGISTRY_STORAGE_KEY,
} = {}) {
  if (!isStorageAvailable(storage)) {
    return null;
  }

  let rawValue = null;
  try {
    rawValue = storage.getItem(storageKey);
  } catch {
    return null;
  }

  if (rawValue == null) {
    return null;
  }

  try {
    const envelope = JSON.parse(rawValue);
    if (!isValidEnvelope(envelope)) {
      return null;
    }

    return createLumonState(envelope.state);
  } catch {
    return null;
  }
}

export function saveLumonState(
  state,
  {
    storage = getBrowserStorage(),
    storageKey = LUMON_REGISTRY_STORAGE_KEY,
    savedAt = new Date().toISOString(),
  } = {},
) {
  if (!isStorageAvailable(storage)) {
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(createEnvelope(state, savedAt)));
    return true;
  } catch {
    return false;
  }
}

export function clearLumonState({
  storage = getBrowserStorage(),
  storageKey = LUMON_REGISTRY_STORAGE_KEY,
} = {}) {
  if (!isStorageAvailable(storage)) {
    return false;
  }

  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function createLumonPersistence({
  storage = getBrowserStorage,
  storageKey = LUMON_REGISTRY_STORAGE_KEY,
} = {}) {
  const readStorage = () => resolveStorage(storage);

  return {
    storageKey,
    isAvailable: () => isStorageAvailable(readStorage()),
    loadState: () => loadLumonState({ storage: readStorage(), storageKey }),
    saveState: (state, options = {}) =>
      saveLumonState(state, {
        storage: readStorage(),
        storageKey,
        savedAt: options.savedAt,
      }),
    clearState: () => clearLumonState({ storage: readStorage(), storageKey }),
  };
}

export const lumonLocalPersistence = createLumonPersistence();
