/**
 * dashboard.js — Student Dashboard logic
 * - Auth guard: redirects to login if no valid token
 * - Populates profile info from /api/auth/me
 * - Wires navigation and logout buttons
 */
(function () {
  'use strict';

  const LOGIN_URL = 'login.html';
  const ADMIN_URL = 'admin.html';

  /* ── Navigation helpers ─────────────────────────────────── */
  function goTo(url) { window.location.href = url; }

  /* ── Loading overlay ────────────────────────────────────── */
  function hideLoader() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
  }

  /* ── Populate profile cards ─────────────────────────────── */
  function populate(user) {
    document.getElementById('welcome-sub').textContent =
      'Roll No: ' + user.rollNo + ' — Good luck on the bridge!';
    document.getElementById('info-rollno').textContent = user.rollNo  || '—';
    document.getElementById('info-email').textContent  = user.email   || '—';
    document.getElementById('info-role').textContent   = (user.role   || '').toUpperCase();
    document.getElementById('info-since').textContent  =
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';
  }

  /* ── Auth guard ─────────────────────────────────────────── */
  async function init() {
    const token = localStorage.getItem('authToken');
    if (!token) { goTo(LOGIN_URL); return; }

    try {
      const data = await window.TechnoBridgeAPI.me();
      hideLoader();

      // Admins get redirected to the admin panel
      if (data.user.role === 'admin') { goTo(ADMIN_URL); return; }

      populate(data.user);
    } catch (_) {
      goTo(LOGIN_URL);
    }
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    init();

    document.getElementById('logout-btn').addEventListener('click', () => {
      window.TechnoBridgeAPI.logout();
      goTo(LOGIN_URL);
    });

    document.getElementById('btn-lobby').addEventListener('click',    () => goTo('../index.html'));
    document.getElementById('btn-round1').addEventListener('click',   () => goTo('../index.html?round=round1'));
    document.getElementById('btn-round2').addEventListener('click',   () => goTo('../index.html?round=round2'));
    document.getElementById('btn-practice').addEventListener('click', () => goTo('../index.html?round=practice'));
  });
})();
