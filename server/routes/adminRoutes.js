'use strict';

const express = require('express');
const router  = express.Router();

const { createStudent, getStudents, getStudent, deleteStudent, getStudentProgressAdmin, bulkCreateStudents } = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin }      = require('../middleware/adminMiddleware');

// All admin routes require a valid JWT AND admin role
router.use(authenticateToken, requireAdmin);

router.post('/bulk',          bulkCreateStudents);   // ← must be before /:id routes
router.post('/',              createStudent);
router.get('/',               getStudents);
router.get('/:id',            getStudent);
router.get('/:id/progress',   getStudentProgressAdmin);
router.delete('/:id',         deleteStudent);

module.exports = router;

