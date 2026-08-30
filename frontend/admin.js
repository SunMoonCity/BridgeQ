/**
 * admin.js — Admin Panel logic
 * - Auth guard: only allows admin role
 * - Create student (modal form)
 * - Paginated + searchable student table
 * - Delete student
 */
(function () {
  'use strict';

  const LOGIN_URL = 'login.html';
  const LIMIT     = 20;

  let currentPage  = 1;
  let totalPages   = 1;
  let searchQuery  = '';
  let isSubmitting = false;

  /* ── Redirect helper ────────────────────────────────────── */
  function goTo(url) { window.location.href = url; }

  /* ── Loading overlay ────────────────────────────────────── */
  function hideLoader() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
  }

  /* ── Form status message ─────────────────────────────────── */
  function setFormStatus(msg, isError) {
    const el = document.getElementById('form-status');
    el.textContent = msg;
    el.className   = isError ? 'status--err' : 'status--ok';
  }

  /* ── Modal helpers ───────────────────────────────────────── */
  function openModal() {
    document.getElementById('create-modal').classList.add('open');
    setFormStatus('', false);
    clearForm();
  }

  function closeModal() {
    document.getElementById('create-modal').classList.remove('open');
  }

  function clearForm() {
    ['f-rollno','f-email','f-password','f-name','f-dept'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('f-year').value = '';
  }

  /* ── Render students table ───────────────────────────────── */
  function renderTable(students, offset) {
    const tbody = document.getElementById('students-tbody');

    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">NO STUDENTS FOUND</td></tr>';
      return;
    }

    tbody.innerHTML = students.map((s, i) => {
      const roleClass = s.role === 'admin' ? 'td--role-admin' : 'td--role-student';
      const created   = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—';
      return `
        <tr>
          <td>${offset + i + 1}</td>
          <td class="td--roll">${s.rollNo}</td>
          <td>${s.name || '—'}</td>
          <td>${s.email}</td>
          <td class="${roleClass}">${(s.role || '').toUpperCase()}</td>
          <td>${created}</td>
          <td style="display: flex; gap: 6px;">
            <button
              class="px-btn px-btn--sm"
              style="background: #7c3aed;"
              data-details-id="${s._id}">
              🎮 GAME DETAILS
            </button>
            <button
              class="px-btn px-btn--sm px-btn--danger"
              data-id="${s._id}"
              data-roll="${s.rollNo}">
              DELETE
            </button>
          </td>
        </tr>`;
    }).join('');

    /* Attach delete & game details listeners */
    tbody.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.id, btn.dataset.roll));
    });

    tbody.querySelectorAll('[data-details-id]').forEach(btn => {
      btn.addEventListener('click', () => openStudentDetailsModal(btn.dataset.detailsId));
    });
  }

  /* ── Load students from API ──────────────────────────────── */
  async function loadStudents(page, search) {
    const tbody = document.getElementById('students-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">LOADING...</td></tr>';

    try {
      const data = await window.TechnoBridgeAPI.adminGetStudents(page, LIMIT, search);
      const { students, pagination } = data.data;

      currentPage = pagination.page;
      totalPages  = pagination.pages;

      const offset = (pagination.page - 1) * pagination.limit;
      renderTable(students, offset);

      document.getElementById('page-info').textContent =
        'PAGE ' + pagination.page + ' / ' + (pagination.pages || 1);
      document.getElementById('total-count').textContent =
        'TOTAL: ' + pagination.total + ' STUDENT' + (pagination.total !== 1 ? 'S' : '');

      document.getElementById('prev-btn').disabled = pagination.page <= 1;
      document.getElementById('next-btn').disabled = pagination.page >= pagination.pages;
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">ERROR: ' + (err.message || 'Failed to load') + '</td></tr>';
    }
  }

  /* ── Create student ──────────────────────────────────────── */
  async function handleCreate() {
    if (isSubmitting) return;

    const rollNo   = document.getElementById('f-rollno').value.trim();
    const email    = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-password').value;
    const name     = document.getElementById('f-name').value.trim();
    const dept     = document.getElementById('f-dept').value.trim();
    const year     = document.getElementById('f-year').value;

    if (!rollNo || !email || !password) {
      setFormStatus('Roll number, email, and password are required.', true);
      return;
    }
    if (password.length < 6) {
      setFormStatus('Password must be at least 6 characters.', true);
      return;
    }

    isSubmitting = true;
    const submitBtn = document.getElementById('create-submit-btn');
    submitBtn.disabled    = true;
    submitBtn.textContent = '[ CREATING... ]';
    setFormStatus('', false);

    try {
      await window.TechnoBridgeAPI.adminCreateStudent({
        rollNo, email, password,
        name: name || undefined,
        department: dept || undefined,
        year: year ? Number(year) : undefined
      });

      setFormStatus('✓ Student created successfully!', false);
      setTimeout(() => {
        closeModal();
        currentPage = 1;
        loadStudents(1, searchQuery);
      }, 900);
    } catch (err) {
      setFormStatus(err.message || 'Failed to create student.', true);
    } finally {
      isSubmitting           = false;
      submitBtn.disabled     = false;
      submitBtn.textContent  = '[ CREATE ]';
    }
  }

  /* ── Delete student ──────────────────────────────────────── */
  async function handleDelete(id, rollNo) {
    if (!confirm('Delete student ' + rollNo + '? This cannot be undone.')) return;
    try {
      await window.TechnoBridgeAPI.adminDeleteStudent(id);
      loadStudents(currentPage, searchQuery);
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Server error'));
    }
  }

  let nextRoundNumberToCreate = 1;
  let autoGeneratedRoundName  = 'Round 1 - The First Crossing';

  /* ── Tab Switching ────────────────────────────────────────── */
  function switchTab(activeTab) {
    const tabStudents  = document.getElementById('tab-students');
    const tabMaterials = document.getElementById('tab-materials');
    const tabRounds    = document.getElementById('tab-rounds');

    const panelStudents  = document.getElementById('panel-students');
    const panelMaterials = document.getElementById('panel-materials');
    const panelRounds    = document.getElementById('panel-rounds');

    const btnCreateStudent = document.getElementById('open-create-btn');
    const btnBulk          = document.getElementById('open-bulk-btn');
    const btnCreateMat     = document.getElementById('open-create-mat-btn');
    const btnCreateRound   = document.getElementById('open-create-round-btn');

    [panelStudents, panelMaterials, panelRounds].forEach(p => p && (p.style.display = 'none'));
    [tabStudents, tabMaterials, tabRounds].forEach(t => t && t.classList.remove('active'));
    // Hide all tab-specific create buttons (bulk button is always visible)
    [btnCreateStudent, btnCreateMat, btnCreateRound].forEach(b => b && (b.style.display = 'none'));
    if (btnBulk) btnBulk.style.display = 'none'; // hide by default, show only on students tab

    if (activeTab === 'students') {
      tabStudents.classList.add('active');
      panelStudents.style.display = 'block';
      btnCreateStudent.style.display = 'inline-block';
      if (btnBulk) btnBulk.style.display = 'inline-block'; // show bulk on students tab
    } else if (activeTab === 'materials') {
      tabMaterials.classList.add('active');
      panelMaterials.style.display = 'block';
      btnCreateMat.style.display = 'inline-block';
      loadMaterials();
    } else if (activeTab === 'rounds') {
      tabRounds.classList.add('active');
      panelRounds.style.display = 'block';
      btnCreateRound.style.display = 'inline-block';
      loadRounds();
    }
  }

  /* ── Material Modal Helpers ───────────────────────────────── */
  function setMatFormStatus(msg, isError) {
    const el = document.getElementById('mat-form-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = isError ? 'status--err' : 'status--ok';
  }

  function openMatModal() {
    document.getElementById('create-mat-modal').classList.add('open');
    setMatFormStatus('', false);
    ['fm-key','fm-label','fm-price','fm-youngs','fm-tensile','fm-comp','fm-density','fm-color'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function closeMatModal() {
    document.getElementById('create-mat-modal').classList.remove('open');
  }

  /* ── Edit Material Modal Helpers ──────────────────────────── */
  function setEditMatFormStatus(msg, isError) {
    const el = document.getElementById('edit-mat-form-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = isError ? 'status--err' : 'status--ok';
  }

  function openEditMatModal(m) {
    document.getElementById('edit-mat-modal').classList.add('open');
    setEditMatFormStatus('', false);

    document.getElementById('fme-id').value     = m._id;
    document.getElementById('fme-key').value    = m.key || '';
    document.getElementById('fme-label').value  = m.label || '';
    document.getElementById('fme-price').value  = m.price !== undefined ? m.price : '';
    document.getElementById('fme-youngs').value = m.youngsModulus || 200000;
    document.getElementById('fme-tensile').value = m.tensileStrength || 100;
    document.getElementById('fme-comp').value    = m.compressionStrength || 90;
    document.getElementById('fme-density').value = m.density || 7.8;
    document.getElementById('fme-color').value   = m.color || '#475569';
  }

  function closeEditMatModal() {
    document.getElementById('edit-mat-modal').classList.remove('open');
  }

  /* ── Render Materials Table ───────────────────────────────── */
  function renderMaterialsTable(materials) {
    const tbody = document.getElementById('materials-tbody');

    if (!materials || !materials.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-table-msg">NO MATERIALS CONFIGURED</td></tr>';
      return;
    }

    tbody.innerHTML = materials.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight: bold; color: #2563eb;">${m.key}</td>
        <td>${m.label}</td>
        <td style="font-weight: bold; color: #16a34a;">₹${m.price}</td>
        <td>${m.youngsModulus || 200000}</td>
        <td>${m.tensileStrength || 100}</td>
        <td>${m.compressionStrength || 90}</td>
        <td>${m.density || 7.8}</td>
        <td style="display: flex; gap: 6px;">
          <button
            class="px-btn px-btn--sm"
            style="background: #2563eb;"
            data-edit-mat-id="${m._id}">
            EDIT
          </button>
          <button
            class="px-btn px-btn--sm px-btn--danger"
            data-mat-id="${m._id}"
            data-mat-label="${m.label}">
            DELETE
          </button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-mat-id]').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteMaterial(btn.dataset.matId, btn.dataset.matLabel));
    });

    tbody.querySelectorAll('[data-edit-mat-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const matId = btn.dataset.editMatId;
        const mat = materials.find(m => String(m._id) === String(matId));
        if (mat) {
          openEditMatModal(mat);
        } else {
          console.error('[Admin] Could not find material for ID:', matId);
        }
      });
    });
  }

  /* ── Load Materials from API ──────────────────────────────── */
  async function loadMaterials() {
    const tbody = document.getElementById('materials-tbody');
    tbody.innerHTML = '<tr><td colspan="9" class="px-table-msg">LOADING MATERIALS...</td></tr>';

    try {
      const data = await window.TechnoBridgeAPI.adminGetMaterials();
      if (data.success && Array.isArray(data.data)) {
        renderMaterialsTable(data.data);
      } else {
        tbody.innerHTML = '<tr><td colspan="9" class="px-table-msg">FAILED TO LOAD MATERIALS</td></tr>';
      }
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-table-msg">ERROR: ' + (err.message || 'Server error') + '</td></tr>';
    }
  }

  /* ── Create Material ──────────────────────────────────────── */
  async function handleCreateMaterial() {
    const key   = document.getElementById('fm-key').value.trim();
    const label = document.getElementById('fm-label').value.trim();
    const price = document.getElementById('fm-price').value;
    const youngs = document.getElementById('fm-youngs').value;
    const tensile = document.getElementById('fm-tensile').value;
    const comp = document.getElementById('fm-comp').value;
    const density = document.getElementById('fm-density').value;
    const color = document.getElementById('fm-color').value.trim();

    if (!key || !label || price === '') {
      setMatFormStatus('Material key, label, and price are required.', true);
      return;
    }

    const btn = document.getElementById('create-mat-submit-btn');
    btn.disabled = true;
    setMatFormStatus('', false);

    try {
      await window.TechnoBridgeAPI.adminCreateMaterial({
        key,
        label,
        price: Number(price),
        youngsModulus: youngs ? Number(youngs) : undefined,
        tensileStrength: tensile ? Number(tensile) : undefined,
        compressionStrength: comp ? Number(comp) : undefined,
        density: density ? Number(density) : undefined,
        color: color || undefined
      });

      setMatFormStatus('✓ Material created successfully!', false);
      setTimeout(() => {
        closeMatModal();
        loadMaterials();
      }, 900);
    } catch (err) {
      setMatFormStatus(err.message || 'Failed to create material.', true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ── Update Material ──────────────────────────────────────── */
  async function handleUpdateMaterial() {
    const id    = document.getElementById('fme-id').value;
    const label = document.getElementById('fme-label').value.trim();
    const price = document.getElementById('fme-price').value;
    const youngs = document.getElementById('fme-youngs').value;
    const tensile = document.getElementById('fme-tensile').value;
    const comp = document.getElementById('fme-comp').value;
    const density = document.getElementById('fme-density').value;
    const color = document.getElementById('fme-color').value.trim();

    if (!id || !label || price === '') {
      setEditMatFormStatus('Label and price are required.', true);
      return;
    }

    const btn = document.getElementById('edit-mat-submit-btn');
    btn.disabled = true;
    setEditMatFormStatus('', false);

    try {
      await window.TechnoBridgeAPI.adminUpdateMaterial(id, {
        label,
        price: Number(price),
        youngsModulus: youngs ? Number(youngs) : undefined,
        tensileStrength: tensile ? Number(tensile) : undefined,
        compressionStrength: comp ? Number(comp) : undefined,
        density: density ? Number(density) : undefined,
        color: color || undefined
      });

      setEditMatFormStatus('✓ Material updated successfully!', false);
      setTimeout(() => {
        closeEditMatModal();
        loadMaterials();
      }, 900);
    } catch (err) {
      setEditMatFormStatus(err.message || 'Failed to update material.', true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ── Delete Material ──────────────────────────────────────── */
  async function handleDeleteMaterial(id, label) {
    if (!confirm('Delete material "' + label + '"? This will remove it from future construction sessions.')) return;
    try {
      await window.TechnoBridgeAPI.adminDeleteMaterial(id);
      loadMaterials();
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Server error'));
    }
  }

  /* ── Round Modal Helpers ──────────────────────────────────── */
  function setRoundFormStatus(msg, isError) {
    const el = document.getElementById('round-form-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = isError ? 'status--err' : 'status--ok';
  }

  function openCreateRoundModal() {
    document.getElementById('create-round-modal').classList.add('open');
    setRoundFormStatus('', false);
    document.getElementById('fr-number').value = nextRoundNumberToCreate;
    document.getElementById('fr-name').value   = autoGeneratedRoundName;
    document.getElementById('fr-budget').value = 4000000;
    document.getElementById('fr-time').value   = 300;
    document.getElementById('fr-desc').value   = `Competition objectives and constraints for Round ${nextRoundNumberToCreate}.`;

    const titleEl = document.getElementById('create-round-modal-title');
    if (titleEl) titleEl.textContent = `▸ Add Round ${nextRoundNumberToCreate}`;
  }

  function closeCreateRoundModal() {
    document.getElementById('create-round-modal').classList.remove('open');
  }

  function setEditRoundFormStatus(msg, isError) {
    const el = document.getElementById('edit-round-form-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = isError ? 'status--err' : 'status--ok';
  }

  function openEditRoundModal(r) {
    document.getElementById('edit-round-modal').classList.add('open');
    setEditRoundFormStatus('', false);

    document.getElementById('fre-id').value     = r._id;
    document.getElementById('fre-number').value = r.roundNumber;
    document.getElementById('fre-name').value   = r.roundName || '';
    document.getElementById('fre-budget').value = r.budget || 4000000;
    document.getElementById('fre-time').value   = r.buildTimeSeconds || 300;
    document.getElementById('fre-desc').value   = r.description || '';
  }

  function closeEditRoundModal() {
    document.getElementById('edit-round-modal').classList.remove('open');
  }

  /* ── Render Rounds Table ──────────────────────────────────── */
  function renderRoundsTable(rounds) {
    const tbody = document.getElementById('rounds-tbody');

    if (!rounds || !rounds.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">NO ROUNDS CONFIGURED</td></tr>';
      return;
    }

    tbody.innerHTML = rounds.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight: bold; color: #7c3aed;">Round ${r.roundNumber}</td>
        <td style="font-weight: bold; color: #0f172a;">${r.roundName}</td>
        <td style="font-weight: bold; color: #16a34a;">₹${(r.budget || 0).toLocaleString('en-IN')}</td>
        <td>${Math.round((r.buildTimeSeconds || 300) / 60)} mins (${r.buildTimeSeconds}s)</td>
        <td style="color: #64748b;">${r.description || '—'}</td>
        <td style="display: flex; gap: 6px;">
          <button
            class="px-btn px-btn--sm"
            style="background: #2563eb;"
            data-edit-round-id="${r._id}">
            EDIT
          </button>
          <button
            class="px-btn px-btn--sm px-btn--danger"
            data-round-id="${r._id}"
            data-round-num="${r.roundNumber}">
            DELETE
          </button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-round-id]').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteRound(btn.dataset.roundId, btn.dataset.roundNum));
    });

    tbody.querySelectorAll('[data-edit-round-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const roundId = btn.dataset.editRoundId;
        const round = rounds.find(r => String(r._id) === String(roundId));
        if (round) openEditRoundModal(round);
      });
    });
  }

  /* ── Load Rounds from API ─────────────────────────────────── */
  async function loadRounds() {
    const tbody = document.getElementById('rounds-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">LOADING ROUNDS...</td></tr>';

    try {
      const data = await window.TechnoBridgeAPI.adminGetRounds();
      if (data.success && Array.isArray(data.data)) {
        nextRoundNumberToCreate = data.nextRoundNumber || (data.data.length + 1);
        autoGeneratedRoundName  = data.autoGeneratedName || `Round ${nextRoundNumberToCreate} - Competition Phase ${nextRoundNumberToCreate}`;

        const btnCreateRound = document.getElementById('open-create-round-btn');
        if (btnCreateRound) {
          btnCreateRound.textContent = `[ + ADD ROUND ${nextRoundNumberToCreate} ]`;
        }

        renderRoundsTable(data.data);
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">FAILED TO LOAD ROUNDS</td></tr>';
      }
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-table-msg">ERROR: ' + (err.message || 'Server error') + '</td></tr>';
    }
  }

  /* ── Create Round ─────────────────────────────────────────── */
  async function handleCreateRound() {
    const roundNumber      = document.getElementById('fr-number').value;
    const roundName        = document.getElementById('fr-name').value.trim();
    const budget           = document.getElementById('fr-budget').value;
    const buildTimeSeconds = document.getElementById('fr-time').value;
    const description      = document.getElementById('fr-desc').value.trim();

    const btn = document.getElementById('create-round-submit-btn');
    btn.disabled = true;
    setRoundFormStatus('', false);

    try {
      await window.TechnoBridgeAPI.adminCreateRound({
        roundNumber: Number(roundNumber),
        roundName,
        budget: Number(budget),
        buildTimeSeconds: Number(buildTimeSeconds),
        description
      });

      setRoundFormStatus('✓ Round created successfully!', false);
      setTimeout(() => {
        closeCreateRoundModal();
        loadRounds();
      }, 900);
    } catch (err) {
      setRoundFormStatus(err.message || 'Failed to create round.', true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ── Update Round ─────────────────────────────────────────── */
  async function handleUpdateRound() {
    const id               = document.getElementById('fre-id').value;
    const roundName        = document.getElementById('fre-name').value.trim();
    const budget           = document.getElementById('fre-budget').value;
    const buildTimeSeconds = document.getElementById('fre-time').value;
    const description      = document.getElementById('fre-desc').value.trim();

    if (!id || !roundName || budget === '' || buildTimeSeconds === '') {
      setEditRoundFormStatus('Round name, budget, and time are required.', true);
      return;
    }

    const btn = document.getElementById('edit-round-submit-btn');
    btn.disabled = true;
    setEditRoundFormStatus('', false);

    try {
      await window.TechnoBridgeAPI.adminUpdateRound(id, {
        roundName,
        budget: Number(budget),
        buildTimeSeconds: Number(buildTimeSeconds),
        description
      });

      setEditRoundFormStatus('✓ Round updated successfully!', false);
      setTimeout(() => {
        closeEditRoundModal();
        loadRounds();
      }, 900);
    } catch (err) {
      setEditRoundFormStatus(err.message || 'Failed to update round.', true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ── Delete Round ─────────────────────────────────────────── */
  async function handleDeleteRound(id, roundNumber) {
    if (!confirm(`Delete Round ${roundNumber}? This will remove this competition phase.`)) return;
    try {
      await window.TechnoBridgeAPI.adminDeleteRound(id);
      loadRounds();
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Server error'));
    }
  }

  /* ── Student Game Details Modal ────────────────────────────── */
  function closeStudentDetailsModal() {
    document.getElementById('student-details-modal').classList.remove('open');
  }

  async function openStudentDetailsModal(studentId) {
    const modal = document.getElementById('student-details-modal');
    const content = document.getElementById('student-details-content');
    modal.classList.add('open');
    content.innerHTML = '<div class="px-table-msg">LOADING STUDENT GAME DETAILS FROM MONGODB...</div>';

    try {
      const res = await window.TechnoBridgeAPI.adminGetStudentProgress(studentId);
      if (!res.success || !res.data) {
        content.innerHTML = '<div class="px-table-msg">FAILED TO LOAD STUDENT GAME DETAILS</div>';
        return;
      }

      const { student, progress } = res.data;
      document.getElementById('student-details-title').textContent = `▸ Game Details: ${student.rollNo} (${student.name || 'Student'})`;

      let html = `
        <div style="background: #f8fafc; border: 3px solid #1e293b; padding: 14px 18px; margin-bottom: 20px;">
          <div style="font-family: 'Press Start 2P', monospace; font-size: 0.75rem; color: #0f172a; margin-bottom: 6px;">
            STUDENT PROFILE: <span style="color: #2563eb;">${student.rollNo}</span>
          </div>
          <div style="font-family: 'VT323', monospace; font-size: 1.2rem; color: #475569; display: flex; gap: 20px; flex-wrap: wrap;">
            <span>Name: ${student.name || '—'}</span>
            <span>Email: ${student.email}</span>
            <span>Dept: ${student.department || '—'}</span>
            <span>Year: ${student.year || '—'}</span>
          </div>
        </div>`;

      if (!progress || progress.length === 0) {
        html += '<div class="px-table-msg">NO GAME PROGRESS RECORDED YET</div>';
      } else {
        html += progress.map(p => {
          const isCompletedBadge = p.isCompleted ? '<span style="color: #16a34a; font-weight: bold;">[ COMPLETED ]</span>' : '<span style="color: #d97706; font-weight: bold;">[ IN PROGRESS ]</span>';
          const isUnlockedBadge  = p.isUnlocked  ? '<span style="color: #2563eb;">UNLOCKED</span>' : '<span style="color: #dc2626;">LOCKED</span>';

          let piecesTable = '<div style="font-size: 0.9rem; color: #64748b; margin-top: 8px;">No placed bridge members.</div>';
          if (Array.isArray(p.placedPieces) && p.placedPieces.length > 0) {
            piecesTable = `
              <div style="overflow-x: auto; margin-top: 10px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 1.1rem;">
                  <thead>
                    <tr style="background: #e2e8f0; border-bottom: 2px solid #1e293b;">
                      <th style="padding: 6px 8px; font-size: 0.5rem;">#</th>
                      <th style="padding: 6px 8px; font-size: 0.5rem;">EQUATION</th>
                      <th style="padding: 6px 8px; font-size: 0.5rem;">MATERIAL</th>
                      <th style="padding: 6px 8px; font-size: 0.5rem;">DOMAIN BOUNDS</th>
                      <th style="padding: 6px 8px; font-size: 0.5rem;">COST</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${p.placedPieces.map((piece, idx) => `
                      <tr style="border-bottom: 1px solid #cbd5e1;">
                        <td style="padding: 6px 8px;">${idx + 1}</td>
                        <td style="padding: 6px 8px; font-weight: bold; color: #2563eb;">${piece.equation}</td>
                        <td style="padding: 6px 8px; text-transform: uppercase;">${piece.material || (piece.isRoad ? 'road' : 'steel')}</td>
                        <td style="padding: 6px 8px;">[${piece.rangeMin !== undefined ? piece.rangeMin : 0}, ${piece.rangeMax !== undefined ? piece.rangeMax : 600}]</td>
                        <td style="padding: 6px 8px; color: #16a34a;">₹${Math.round(piece.cost || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`;
          }

          return `
            <div style="background: #ffffff; border: 3px solid #1e293b; box-shadow: 4px 4px 0px #cbd5e1; padding: 16px; margin-bottom: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="font-family: 'Press Start 2P', monospace; font-size: 0.75rem; color: #7c3aed;">
                  ROUND ${p.roundNumber} — ${p.roundName || 'Competition Phase'}
                </div>
                <div style="font-family: 'VT323', monospace; font-size: 1.2rem; display: flex; gap: 12px;">
                  ${isUnlockedBadge}
                  ${isCompletedBadge}
                </div>
              </div>

              <div style="font-family: 'VT323', monospace; font-size: 1.25rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div>Stages Passed: <strong>${p.stagesPassed} / ${p.totalStages || 5}</strong></div>
                <div>Budget Remaining: <strong style="color: #16a34a;">₹${(p.budgetRemaining || 0).toLocaleString('en-IN')}</strong> / ₹${(p.totalBudget || 0).toLocaleString('en-IN')}</div>
                <div>Build Time Remaining: <strong>${p.timeRemaining || 0}s</strong></div>
              </div>

              <div style="font-family: 'Press Start 2P', monospace; font-size: 0.6rem; color: #1e293b; margin-top: 10px;">
                ▸ PLACED BRIDGE EQUATIONS & MEMBERS (${p.placedPieces ? p.placedPieces.length : 0})
              </div>
              ${piecesTable}
            </div>
          `;
        }).join('');
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = '<div class="px-table-msg">ERROR: ' + (err.message || 'Server error loading student game data') + '</div>';
    }
  }

  /* ── Auth guard ─────────────────────────────────────────── */
  async function init() {
    const token = localStorage.getItem('authToken');
    if (!token) { goTo(LOGIN_URL); return; }

    try {
      const data = await window.TechnoBridgeAPI.me();
      if (data.user.role !== 'admin') {
        // Student landed here — redirect to dashboard
        goTo('dashboard.html');
        return;
      }
      hideLoader();
      loadStudents(1, '');
    } catch (_) {
      goTo(LOGIN_URL);
    }
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    init();

    /* Tab switcher */
    document.getElementById('tab-students').addEventListener('click', () => switchTab('students'));
    document.getElementById('tab-materials').addEventListener('click', () => switchTab('materials'));
    document.getElementById('tab-rounds').addEventListener('click', () => switchTab('rounds'));

    /* Logout */
    document.getElementById('logout-btn').addEventListener('click', () => {
      window.TechnoBridgeAPI.logout();
      goTo(LOGIN_URL);
    });

    /* Open / close modals */
    document.getElementById('open-create-btn').addEventListener('click', openModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);

    document.getElementById('open-create-mat-btn').addEventListener('click', openMatModal);
    document.getElementById('close-mat-modal-btn').addEventListener('click', closeMatModal);
    document.getElementById('cancel-mat-btn').addEventListener('click', closeMatModal);

    document.getElementById('close-edit-mat-modal-btn').addEventListener('click', closeEditMatModal);
    document.getElementById('cancel-edit-mat-btn').addEventListener('click', closeEditMatModal);

    document.getElementById('open-create-round-btn').addEventListener('click', openCreateRoundModal);
    document.getElementById('close-round-modal-btn').addEventListener('click', closeCreateRoundModal);
    document.getElementById('cancel-round-btn').addEventListener('click', closeCreateRoundModal);

    document.getElementById('close-edit-round-modal-btn').addEventListener('click', closeEditRoundModal);
    document.getElementById('cancel-edit-round-btn').addEventListener('click', closeEditRoundModal);

    document.getElementById('close-student-details-modal-btn').addEventListener('click', closeStudentDetailsModal);
    document.getElementById('close-student-details-btn').addEventListener('click', closeStudentDetailsModal);

    /* Close modals on backdrop click */
    document.getElementById('create-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('create-modal')) closeModal();
    });
    document.getElementById('create-mat-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('create-mat-modal')) closeMatModal();
    });
    document.getElementById('edit-mat-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('edit-mat-modal')) closeEditMatModal();
    });
    document.getElementById('create-round-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('create-round-modal')) closeCreateRoundModal();
    });
    document.getElementById('edit-round-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('edit-round-modal')) closeEditRoundModal();
    });
    document.getElementById('student-details-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('student-details-modal')) closeStudentDetailsModal();
    });

    /* Submit create & update forms */
    document.getElementById('create-submit-btn').addEventListener('click', handleCreate);
    document.getElementById('create-mat-submit-btn').addEventListener('click', handleCreateMaterial);
    document.getElementById('edit-mat-submit-btn').addEventListener('click', handleUpdateMaterial);

    document.getElementById('create-round-submit-btn').addEventListener('click', handleCreateRound);
    document.getElementById('edit-round-submit-btn').addEventListener('click', handleUpdateRound);

    /* Search */
    document.getElementById('search-btn').addEventListener('click', () => {
      searchQuery = document.getElementById('search-input').value.trim();
      currentPage = 1;
      loadStudents(1, searchQuery);
    });

    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        loadStudents(1, searchQuery);
      }
    });

    /* Pagination */
    document.getElementById('prev-btn').addEventListener('click', () => {
      if (currentPage > 1) loadStudents(--currentPage, searchQuery);
    });

    document.getElementById('next-btn').addEventListener('click', () => {
      if (currentPage < totalPages) loadStudents(++currentPage, searchQuery);
    });

    /* ── Bulk CSV Import ──────────────────────────────────── */
    initBulkImport();
  });

  /* ══════════════════════════════════════════════════════════
     BULK CSV IMPORT MODULE
  ══════════════════════════════════════════════════════════ */
  let bulkParsedRows = [];
  let isBulkSubmitting = false;

  function openBulkModal() {
    document.getElementById('bulk-modal').classList.add('open');
    resetBulkModal();
  }

  function closeBulkModal() {
    document.getElementById('bulk-modal').classList.remove('open');
  }

  function resetBulkModal() {
    bulkParsedRows = [];
    isBulkSubmitting = false;
    document.getElementById('bulk-step-upload').style.display  = 'block';
    document.getElementById('bulk-step-preview').style.display = 'none';
    document.getElementById('bulk-step-results').style.display = 'none';
    document.getElementById('bulk-parse-status').textContent   = '';
    document.getElementById('bulk-file-input').value           = '';
    setBulkDropZoneHighlight(false);
  }

  function setBulkDropZoneHighlight(on) {
    const zone = document.getElementById('bulk-drop-zone');
    zone.style.background    = on ? 'rgba(56,189,248,0.08)' : '';
    zone.style.borderColor   = on ? '#38bdf8' : '';
  }

  /* ── Robust CSV parser (handles quoted fields & CRLF) ── */
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const fields = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          fields.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur.trim());
      rows.push(fields);
    }
    return rows;
  }

  /* Normalise column header strings */
  function normHeader(s) { return s.toLowerCase().replace(/[\s_\-]/g, ''); }

  function processCSVText(text) {
    const setBulkParseStatus = (msg, isErr) => {
      const el = document.getElementById('bulk-parse-status');
      el.textContent = msg;
      el.className   = isErr ? 'status--err' : 'status--ok';
    };

    const rows = parseCSV(text);
    if (rows.length < 2) {
      setBulkParseStatus('⚠ CSV must have a header row and at least one data row.', true);
      return;
    }

    /* Map header → index */
    const headers = rows[0].map(normHeader);
    const idx = {
      name:   headers.findIndex(h => h === 'name'),
      rollNo: headers.findIndex(h => h === 'rollno' || h === 'roll' || h === 'rollnumber'),
      email:  headers.findIndex(h => h === 'email')
    };

    if (idx.rollNo === -1 || idx.email === -1) {
      setBulkParseStatus('⚠ CSV must have "rollNo" and "email" columns.', true);
      return;
    }

    bulkParsedRows = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.every(c => !c)) continue; // skip blank lines
      bulkParsedRows.push({
        name:   idx.name  >= 0 ? r[idx.name]  || '' : '',
        rollNo: idx.rollNo >= 0 ? r[idx.rollNo] || '' : '',
        email:  idx.email  >= 0 ? r[idx.email]  || '' : ''
      });
    }

    if (bulkParsedRows.length === 0) {
      setBulkParseStatus('⚠ No data rows found in the CSV.', true);
      return;
    }

    setBulkParseStatus('', false);
    showBulkPreview();
  }

  function showBulkPreview() {
    document.getElementById('bulk-step-upload').style.display  = 'none';
    document.getElementById('bulk-step-preview').style.display = 'block';
    document.getElementById('bulk-step-results').style.display = 'none';

    document.getElementById('bulk-preview-count').textContent =
      `${bulkParsedRows.length} student${bulkParsedRows.length !== 1 ? 's' : ''} ready to import  |  Password: Pass@1234`;

    const tbody = document.getElementById('bulk-preview-tbody');
    tbody.innerHTML = bulkParsedRows.map((r, i) => {
      const hasRoll  = !!r.rollNo;
      const hasEmail = !!r.email;
      const ok = hasRoll && hasEmail;
      return `<tr style="${ok ? '' : 'opacity:0.55;'}">
        <td>${i + 1}</td>
        <td>${r.name  || '<em style="color:#64748b">—</em>'}</td>
        <td style="font-weight:bold; color:${ok?'#38bdf8':'#ef4444'}">${r.rollNo || '<em>MISSING</em>'}</td>
        <td>${r.email || '<em style="color:#ef4444">MISSING</em>'}</td>
        <td style="color:${ok?'#4ade80':'#f87171'}">${ok ? '✓ Ready' : '⚠ Will skip'}</td>
      </tr>`;
    }).join('');

    document.getElementById('bulk-import-status').textContent = '';

    // Always ensure the import button is enabled when preview appears
    const submitBtn = document.getElementById('bulk-submit-btn');
    submitBtn.disabled    = false;
    submitBtn.textContent = '[ 🚀 IMPORT ALL STUDENTS ]';
    isBulkSubmitting      = false;
  }

  async function handleBulkSubmit() {
    if (isBulkSubmitting || !bulkParsedRows.length) return;
    isBulkSubmitting = true;

    const submitBtn = document.getElementById('bulk-submit-btn');
    submitBtn.disabled    = true;
    submitBtn.textContent = '[ ⏳ IMPORTING... ]';

    const statusEl = document.getElementById('bulk-import-status');
    statusEl.textContent = '';
    statusEl.className   = '';

    try {
      const result = await window.TechnoBridgeAPI.adminBulkCreateStudents(bulkParsedRows);
      showBulkResults(result.data);
      // refresh the students table
      currentPage = 1;
      loadStudents(1, searchQuery);
    } catch (err) {
      statusEl.textContent = '✗ ' + (err.message || 'Server error — check console');
      statusEl.className   = 'status--err';
    } finally {
      // Always reset button so it never stays permanently stuck
      isBulkSubmitting      = false;
      submitBtn.disabled    = false;
      submitBtn.textContent = '[ 🚀 IMPORT ALL STUDENTS ]';
    }
  }

  function showBulkResults(data) {
    document.getElementById('bulk-step-upload').style.display  = 'none';
    document.getElementById('bulk-step-preview').style.display = 'none';
    document.getElementById('bulk-step-results').style.display = 'block';

    const summaryEl = document.getElementById('bulk-results-summary');
    summaryEl.innerHTML =
      `<span style="color:#4ade80">✓ ${data.created} Created</span>  ` +
      (data.skipped ? `<span style="color:#f87171">✗ ${data.skipped} Skipped</span>` : '');

    const tbody = document.getElementById('bulk-results-tbody');
    tbody.innerHTML = (data.results || []).map(r => {
      const isOk = r.status === 'created';
      return `<tr>
        <td>${r.row}</td>
        <td style="font-weight:bold; color:#38bdf8">${r.rollNo || '—'}</td>
        <td>${r.name || '—'}</td>
        <td>${r.email || '—'}</td>
        <td style="color:${isOk?'#4ade80':'#f87171'}; font-weight:bold">${isOk ? '✓ Created' : '✗ Skipped'}</td>
        <td style="color:#94a3b8; font-size:12px">${isOk ? '' : (r.reason || '')}</td>
      </tr>`;
    }).join('');
  }

  function downloadCSVTemplate() {
    const csv = 'name,rollNo,email\nAlice Johnson,24BCS0001,alice@example.com\nBob Smith,24BCS0002,bob@example.com\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'students_template.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function initBulkImport() {
    document.getElementById('open-bulk-btn').addEventListener('click', openBulkModal);
    document.getElementById('close-bulk-modal-btn').addEventListener('click', closeBulkModal);
    document.getElementById('bulk-cancel-btn').addEventListener('click', closeBulkModal);
    document.getElementById('bulk-done-btn').addEventListener('click', () => { closeBulkModal(); });
    document.getElementById('bulk-reset-btn').addEventListener('click', resetBulkModal);
    document.getElementById('bulk-submit-btn').addEventListener('click', handleBulkSubmit);
    document.getElementById('bulk-download-template-btn').addEventListener('click', downloadCSVTemplate);

    /* Close on backdrop click */
    document.getElementById('bulk-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('bulk-modal')) closeBulkModal();
    });

    /* File input */
    document.getElementById('bulk-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => processCSVText(ev.target.result);
      reader.readAsText(file);
    });

    /* Drag & Drop */
    const zone = document.getElementById('bulk-drop-zone');
    zone.addEventListener('dragover',  (e) => { e.preventDefault(); setBulkDropZoneHighlight(true); });
    zone.addEventListener('dragleave', ()  => setBulkDropZoneHighlight(false));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      setBulkDropZoneHighlight(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => processCSVText(ev.target.result);
      reader.readAsText(file);
    });
    /* Fix: stop the file input's click from bubbling up to the zone
       (which would fire a second file dialog and cancel both) */
    const fileInput = document.getElementById('bulk-file-input');
    fileInput.addEventListener('click', (e) => e.stopPropagation());

    zone.addEventListener('click', (e) => {
      // Only open dialog if click was directly on the zone (not a child that handles itself)
      fileInput.click();
    });
  }

})();

