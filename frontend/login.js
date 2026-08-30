/**
 * login.js — wires the existing login.html form to the backend
 *
 * Loaded by frontend/login.html as a plain <script>.
 * Requires api.js to be loaded first (window.TechnoBridgeAPI).
 */
(function () {
  'use strict';

  /* ── Decide where to send the user after login ─────────── */
  const DASHBOARD_URL = 'dashboard.html';
  const ADMIN_URL     = 'admin.html';

  /* ── On page load: if already authenticated → redirect ─── */
  async function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const data = await window.TechnoBridgeAPI.me();
      // Token is still valid — redirect immediately
      redirectAfterLogin(data.user.role);
    } catch (_) {
      // Token invalid/expired — stay on login page
      localStorage.removeItem('authToken');
    }
  }

  function redirectAfterLogin(role) {
    window.location.href = role === 'admin' ? ADMIN_URL : DASHBOARD_URL;
  }

  /* ── Handle form submit ─────────────────────────────────── */
  function setStatus(msg, isError = false) {
    const el = document.getElementById('status-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ff8080' : '#80ff80';
  }

  function setLoading(isLoading) {
    const btn = document.getElementById('enter-btn');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Entering...' : 'Enter the Game';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      setStatus('Please enter your email and password.', true);
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const data = await window.TechnoBridgeAPI.login(email, password);
      try { localStorage.setItem('rollno', data.user.rollNo); } catch (_) {}
      setStatus('Welcome back! Entering...');
      setTimeout(() => redirectAfterLogin(data.user.role), 600);
    } catch (err) {
      setLoading(false);
      setStatus(err.message || 'Login failed. Please try again.', true);
    }
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    checkExistingAuth();

    // Attach form handler
    const form = document.getElementById('tablet');
    if (form) form.addEventListener('submit', handleSubmit);
  });
})();
