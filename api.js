/**
 * api.js — Techno Bridge API client
 *
 * Exposes window.TechnoBridgeAPI so all game pages (rounds_menu.html,
 * index.html, graph.js) can call auth and game-state endpoints without
 * knowing the base URL or token management details.
 *
 * Token is stored in localStorage under the key "authToken".
 */
(function () {
  'use strict';

  const BASE_URL = 'http://localhost:5000';
  const TOKEN_KEY = 'authToken';

  /* ── Token helpers ──────────────────────────────────────── */
  function getToken()        { return localStorage.getItem(TOKEN_KEY); }
  function setToken(token)   { localStorage.setItem(TOKEN_KEY, token); }
  function clearToken()      { localStorage.removeItem(TOKEN_KEY); }

  /* ── Low-level fetch wrapper ───────────────────────────── */
  async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(BASE_URL + path, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      // If 401, clear stale token
      if (res.status === 401) clearToken();
      const err = new Error(data.message || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ── Auth ───────────────────────────────────────────────── */
  async function login(rollNo, password) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ rollNo, password })
    });
    if (data.token) setToken(data.token);
    return data;
  }

  function logout() {
    clearToken();
    try { localStorage.removeItem('rollno'); } catch (_) {}
  }

  async function me() {
    return apiFetch('/api/auth/me');
  }

  /* ── Game Progress & State (Backend Persistence) ── */
  async function getRoundProgress() {
    try {
      return await apiFetch('/api/game/progress');
    } catch (err) {
      return { success: false, message: err.message, data: [] };
    }
  }

  async function updateRoundProgress(roundNumber, progressData) {
    try {
      return await apiFetch('/api/game/progress/' + encodeURIComponent(roundNumber), {
        method: 'PUT',
        body: JSON.stringify(progressData)
      });
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async function getMaterialConfigs() {
    try {
      return await apiFetch('/api/game/materials');
    } catch (err) {
      return { success: false, message: err.message, data: [] };
    }
  }

  async function getGameState(roundKey) {
    return getRoundProgress();
  }

  async function saveGameState(roundKey, pieces) {
    const roundNumber = parseInt(String(roundKey).replace(/\D/g, ''), 10) || 1;
    return updateRoundProgress(roundNumber, { placedPieces: pieces });
  }

  /* ── Admin helpers (used by admin.js) ────────────────────  */
  async function adminGetStudents(page = 1, limit = 20, search = '') {
    const params = new URLSearchParams({ page, limit, search });
    return apiFetch('/api/admin/students?' + params.toString());
  }

  async function adminCreateStudent(payload) {
    return apiFetch('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function adminDeleteStudent(id) {
    return apiFetch('/api/admin/students/' + id, { method: 'DELETE' });
  }

  async function adminGetMaterials() {
    return apiFetch('/api/admin/materials');
  }

  async function adminCreateMaterial(payload) {
    return apiFetch('/api/admin/materials', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function adminUpdateMaterial(id, payload) {
    return apiFetch('/api/admin/materials/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async function adminDeleteMaterial(id) {
    return apiFetch('/api/admin/materials/' + id, { method: 'DELETE' });
  }

  async function adminGetRounds() {
    return apiFetch('/api/admin/rounds');
  }

  async function adminCreateRound(payload) {
    return apiFetch('/api/admin/rounds', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function adminUpdateRound(id, payload) {
    return apiFetch('/api/admin/rounds/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async function adminDeleteRound(id) {
    return apiFetch('/api/admin/rounds/' + id, { method: 'DELETE' });
  }

  async function adminGetStudentProgress(studentId) {
    return apiFetch('/api/admin/students/' + studentId + '/progress');
  }

  /* ── Expose public API ───────────────────────────────────── */
  window.TechnoBridgeAPI = {
    login,
    logout,
    me,
    getRoundProgress,
    updateRoundProgress,
    getMaterialConfigs,
    getGameState,
    saveGameState,
    adminGetStudents,
    adminCreateStudent,
    adminDeleteStudent,
    adminGetStudentProgress,
    adminGetMaterials,
    adminCreateMaterial,
    adminUpdateMaterial,
    adminDeleteMaterial,
    adminGetRounds,
    adminCreateRound,
    adminUpdateRound,
    adminDeleteRound,
    getToken,
    setToken,
    clearToken
  };
})();
