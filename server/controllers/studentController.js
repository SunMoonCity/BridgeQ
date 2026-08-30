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
    // Duplicate key (email or rollNo already exists)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ success: false, message: `A student with that ${field} already exists` });
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

      try {
        const student = await Student.create({
          email:    email.trim().toLowerCase(),
          rollNo:   rollNo.trim(),
          password: BULK_PASSWORD,
          name:     (name || '').trim(),
          role:     'student'
        });
        results.push({ row: rowNum, rollNo: student.rollNo, email: student.email, name: student.name, status: 'created' });
      } catch (err) {
        let reason = 'Server error';
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || 'field';
          reason = `Duplicate ${field}`;
        } else if (err.name === 'ValidationError') {
          reason = Object.values(err.errors).map(e => e.message).join('; ');
        }
        results.push({ row: rowNum, rollNo: rollNo || '', email: email || '', status: 'skipped', reason });
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

module.exports = { createStudent, getStudents, getStudent, deleteStudent, getStudentProgressAdmin, bulkCreateStudents };
