'use strict';

const mongoose = require('mongoose');
const Student  = require('../models/Student');

/* ────────────────────────────────────────────────────────────
   POST /api/admin/students
   Create a new student account
──────────────────────────────────────────────────────────── */
async function createStudent(req, res) {
  try {
    const { email, rollNo, password, name, department, year, role } = req.body;

    if (!email || !rollNo || !password) {
      return res.status(400).json({ success: false, message: 'Email, roll number, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const student = await Student.create({
      email,
      rollNo,
      password,
      name:       name || '',
      department: department || '',
      year:       year ? Number(year) : undefined,
      role:       role === 'admin' ? 'admin' : 'student'
    });

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student   // toJSON strips password automatically
    });
  } catch (err) {
    // Duplicate key — email or name must be unique (rollNo is no longer unique)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      const labels = { email: 'email address', name: 'name' };
      const label = labels[field] || field;
      return res.status(400).json({ success: false, message: `A student with that ${label} already exists` });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    console.error('[admin] createStudent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ────────────────────────────────────────────────────────────
   GET /api/admin/students?page=1&limit=20&search=
   Paginated + searchable list. Never returns passwords.
──────────────────────────────────────────────────────────── */
async function getStudents(req, res) {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const skip   = (page - 1) * limit;

    const filter = {};
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ rollNo: re }, { email: re }, { name: re }];
    }

    const [students, total] = await Promise.all([
      Student.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('[admin] getStudents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ────────────────────────────────────────────────────────────
   GET /api/admin/students/:id
──────────────────────────────────────────────────────────── */
async function getStudent(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }
    const student = await Student.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    return res.status(200).json({ success: true, data: student });
  } catch (err) {
    console.error('[admin] getStudent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ────────────────────────────────────────────────────────────
   DELETE /api/admin/students/:id
──────────────────────────────────────────────────────────── */
async function deleteStudent(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }
    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    return res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    console.error('[admin] deleteStudent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ────────────────────────────────────────────────────────────
   GET /api/admin/students/:id/progress
   Returns all round progress & placed bridge equations for student
──────────────────────────────────────────────────────────── */
async function getStudentProgressAdmin(req, res) {
  try {
    const RoundProgress = require('../models/RoundProgress');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }
    const student = await Student.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const progress = await RoundProgress.find({ student: req.params.id }).sort({ roundNumber: 1 });
    return res.status(200).json({
      success: true,
      data: {
        student,
        progress
      }
    });
  } catch (err) {
    console.error('[admin] getStudentProgressAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ────────────────────────────────────────────────────────────
   POST /api/admin/students/bulk
   Bulk-create students from CSV rows.
   Body: { students: [{ name, rollNo, email }] }
   Password is fixed to "Pass@1234" for every row.
──────────────────────────────────────────────────────────── */
const BULK_PASSWORD = 'Pass@1234';

async function bulkCreateStudents(req, res) {
  try {
    const rows = req.body.students;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No student rows provided' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 students per bulk upload' });
    }

    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const { name, rollNo, email } = rows[i];
      const rowNum = i + 1;

      if (!rollNo || !email) {
        results.push({ row: rowNum, rollNo: rollNo || '', email: email || '', status: 'skipped', reason: 'Missing rollNo or email' });
        continue;
      }

      // name is unique in the schema.
      // Fallback: use the part before '@' in email — guaranteed unique since email is unique.
      // Do NOT use rollNo as fallback because multiple students can share the same rollNo.
      const emailPrefix  = email.trim().toLowerCase().split('@')[0];
      const resolvedName = (name || '').trim() || emailPrefix;

      try {
        const student = await Student.create({
          email:    email.trim().toLowerCase(),
          rollNo:   rollNo.trim(),
          password: BULK_PASSWORD,
          name:     resolvedName,
          role:     'student'
        });
        results.push({ row: rowNum, rollNo: student.rollNo, email: student.email, name: student.name, status: 'created' });
      } catch (err) {
        let reason = 'Server error';
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || 'field';
          const labels = { email: 'email address', name: 'name' };
          reason = `Duplicate ${labels[field] || field}`;
        } else if (err.name === 'ValidationError') {
          reason = Object.values(err.errors).map(e => e.message).join('; ');
        }
        results.push({ row: rowNum, rollNo: rollNo || '', email: email || '', name: resolvedName, status: 'skipped', reason });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return res.status(200).json({
      success: true,
      message: `Bulk import complete: ${created} created, ${skipped} skipped`,
      data: { created, skipped, results }
    });
  } catch (err) {
    console.error('[admin] bulkCreateStudents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ────────────────────────────────────────────────────────────
   GET /api/admin/leaderboard
   Returns all students ranked by composite score:
     score = 70% × (stagesPassed / totalStages) + 30% × (budgetRemaining / totalBudget)
   Aggregated across all rounds the student has attempted.
   Score is out of 100.
──────────────────────────────────────────────────────────── */
async function getLeaderboard(req, res) {
  try {
    const RoundProgress = require('../models/RoundProgress');

    // Get all non-admin students
    const students = await Student.find({ role: 'student' }).select('-password').sort({ createdAt: 1 });

    // Get all progress records at once (more efficient than N queries)
    const allProgress = await RoundProgress.find({
      student: { $in: students.map(s => s._id) }
    }).sort({ student: 1, roundNumber: 1 });

    // Group progress by student id
    const progressMap = {};
    allProgress.forEach(p => {
      const key = p.student.toString();
      if (!progressMap[key]) progressMap[key] = [];
      progressMap[key].push(p);
    });

    // Calculate scores for each student
    const leaderboard = students.map(student => {
      const sid = student._id.toString();
      const rounds = progressMap[sid] || [];

      let totalScore = 0;
      let roundsAttempted = 0;
      let totalStagesPassed = 0;
      let totalStagesMax = 0;
      let totalBudgetRetained = 0;
      let totalBudgetMax = 0;

      rounds.forEach(r => {
        const ts = r.totalStages || 5;
        const sp = Math.min(r.stagesPassed || 0, ts);
        const tb = r.totalBudget || 1;
        const br = Math.max(0, Math.min(r.budgetRemaining || 0, tb));

        const stagesScore = ts > 0 ? (sp / ts) : 0;
        const budgetScore = tb > 0 ? (br / tb) : 0;
        const roundScore  = (0.70 * stagesScore + 0.30 * budgetScore) * 100;

        totalScore        += roundScore;
        roundsAttempted   += 1;
        totalStagesPassed += sp;
        totalStagesMax    += ts;
        totalBudgetRetained += br;
        totalBudgetMax    += tb;
      });

      const avgScore = roundsAttempted > 0 ? (totalScore / roundsAttempted) : 0;

      return {
        student: {
          _id:        student._id,
          rollNo:     student.rollNo,
          name:       student.name || '',
          email:      student.email,
          department: student.department || '',
          year:       student.year || null,
          createdAt:  student.createdAt
        },
        score:              Math.round(avgScore * 100) / 100,   // 2 decimal places
        roundsAttempted,
        totalStagesPassed,
        totalStagesMax,
        totalBudgetRetained,
        totalBudgetMax,
        rounds: rounds.map(r => ({
          roundNumber:      r.roundNumber,
          roundName:        r.roundName,
          isCompleted:      r.isCompleted,
          isUnlocked:       r.isUnlocked,
          stagesPassed:     r.stagesPassed || 0,
          totalStages:      r.totalStages  || 5,
          budgetRemaining:  r.budgetRemaining || 0,
          totalBudget:      r.totalBudget  || 0,
          timeRemaining:    r.timeRemaining || 0,
          placedPieces:     r.placedPieces  || []
        }))
      };
    });

    // Sort by score descending, then by name ascending as tiebreaker
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.student.name || '').localeCompare(b.student.name || '');
    });

    // Assign rank
    leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

    return res.status(200).json({
      success: true,
      data: { leaderboard, total: leaderboard.length }
    });
  } catch (err) {
    console.error('[admin] getLeaderboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { createStudent, getStudents, getStudent, deleteStudent, getStudentProgressAdmin, bulkCreateStudents, getLeaderboard };
