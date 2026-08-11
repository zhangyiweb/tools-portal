const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { writeNginxConf } = require('./writeNginxConf');

function getStatePath() {
  return path.join(app.getPath('userData'), 'state.json');
}

function defaultState() {
  return {
    settings: {
      portStart: 8000
    },
    projects: []
  };
}

function loadState() {
  const p = getStatePath();
  try {
    if (!fs.existsSync(p)) return defaultState();
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed?.projects) return defaultState();
    parsed.settings = parsed.settings || { portStart: 8000 };
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  const p = getStatePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

function createProject({ distPath, port }) {
  const id = crypto.randomBytes(8).toString('hex');
  const name = path.basename(path.dirname(distPath)) || path.basename(distPath) || `project-${id}`;
  return {
    id,
    name,
    distPath,
    port,
    enabled: true,
    createdAt: Date.now()
  };
}

function toggleProjectEnabled(state, projectId, enabled) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;
  p.enabled = !!enabled;
}

function removeProject(state, projectId) {
  state.projects = state.projects.filter((x) => x.id !== projectId);
}

function renameProject(state, projectId, name) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;
  const trimmed = String(name || '').trim();
  if (!trimmed) return;
  p.name = trimmed;
}

function updateGeneratedConfig(state) {
  writeNginxConf(state);
}

module.exports = {
  loadState,
  saveState,
  createProject,
  toggleProjectEnabled,
  removeProject,
  renameProject,
  updateGeneratedConfig
};

