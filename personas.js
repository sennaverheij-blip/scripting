/**
 * personas.js
 * Local data layer — clients, scripts, settings stored in localStorage.
 */

const PERSONAS_KEY  = 'ca_personas';
const SCRIPTS_KEY   = 'ca_scripts';
const SETTINGS_KEY  = 'ca_settings';

// ─── ID GENERATION ────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch { return {}; }
}

function saveSettings(patch) {
  const current = loadSettings();
  const updated = { ...current, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

function getApiKey() {
  return loadSettings().apiKey || '';
}

// ─── PERSONAS ──────────────────────────────────────────────────────────────────
function loadPersonas() {
  try { return JSON.parse(localStorage.getItem(PERSONAS_KEY) || '[]'); }
  catch { return []; }
}

/**
 * Save (create or update) a persona.
 * If persona.id is absent or not found, a new record is created.
 * Returns the saved persona (with id and timestamps populated).
 */
function savePersona(persona) {
  const all = loadPersonas();
  const existing = persona.id ? all.findIndex(p => p.id === persona.id) : -1;

  if (existing >= 0) {
    all[existing] = { ...all[existing], ...persona, updatedAt: new Date().toISOString() };
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(all));
    return all[existing];
  } else {
    const created = {
      ...persona,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(created);
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(all));
    return created;
  }
}

function getPersona(id) {
  return loadPersonas().find(p => p.id === id) || null;
}

function deletePersona(id) {
  const all = loadPersonas().filter(p => p.id !== id);
  localStorage.setItem(PERSONAS_KEY, JSON.stringify(all));
  // Also remove their scripts
  const scripts = loadAllScripts().filter(s => s.personaId !== id);
  localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts));
}

// ─── SCRIPTS ──────────────────────────────────────────────────────────────────
function loadAllScripts() {
  try { return JSON.parse(localStorage.getItem(SCRIPTS_KEY) || '[]'); }
  catch { return []; }
}

function loadScriptsForPersona(personaId) {
  return loadAllScripts().filter(s => s.personaId === personaId);
}

/**
 * Save a batch of generated scripts for a persona.
 * Replaces any previous scripts for that persona.
 * Returns the saved scripts.
 */
function saveScriptsForPersona(personaId, scripts, weekLabel) {
  const others = loadAllScripts().filter(s => s.personaId !== personaId);
  const stamped = scripts.map((s, i) => ({
    ...s,
    id: generateId(),
    personaId,
    number: i + 1,
    weekLabel: weekLabel || '',
    generatedAt: new Date().toISOString(),
  }));
  localStorage.setItem(SCRIPTS_KEY, JSON.stringify([...others, ...stamped]));
  return stamped;
}

function clearAllData() {
  localStorage.removeItem(PERSONAS_KEY);
  localStorage.removeItem(SCRIPTS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
}
