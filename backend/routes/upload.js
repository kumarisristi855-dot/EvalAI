const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../database/db');
const parsePdf = require('../services/pdfParser');
const parseStudentAnswers = require('../services/answerParser');

// Configure Multer for student sheets
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Save with unique name to avoid naming collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/exam/:id/upload-students
 * Accepts multiple PDF student answer sheets, parses them, and inserts records into DB.
 */
router.post('/exam/:id/upload-students', upload.array('studentFiles'), async (req, res) => {
  try {
    const examId = req.params.id;
    
    // Verify exam exists
    const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: `Exam with ID ${examId} not found` });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No student answer sheet files were uploaded' });
    }

    // Fetch questions for this exam
    const questions = db.prepare('SELECT id, question_number FROM questions WHERE exam_id = ?').all(examId);
    if (questions.length === 0) {
      return res.status(400).json({ error: 'This exam has no questions set up yet. Setup the exam first.' });
    }

    const uploadedStudentsList = [];

    for (const file of req.files) {
      // Derive student name from filename (strip .pdf, replace dashes/underscores with spaces)
      let studentName = path.basename(file.originalname, path.extname(file.originalname));
      studentName = studentName.replace(/[_-]/g, ' ');
      // Capitalize words
      studentName = studentName.replace(/\b\w/g, c => c.toUpperCase());

      // Parse the PDF text
      const pdfText = await parsePdf(file.path);
      const studentAnswersMap = parseStudentAnswers(pdfText);

      // Save student record in pending status
      const studentInsert = db.prepare(`
        INSERT INTO students (exam_id, filename, student_name, total_marks_obtained, percentage, grade, status)
        VALUES (?, ?, ?, 0, 0, NULL, 'pending')
      `).run(examId, file.originalname, studentName);
      
      const studentId = studentInsert.lastInsertRowid;

      // Populate evaluations table with student's raw answers
      const insertEvalStmt = db.prepare(`
        INSERT INTO evaluations (student_id, question_id, student_answer, marks_awarded, feedback)
        VALUES (?, ?, ?, 0, NULL)
      `);

      const evalTransaction = db.transaction(() => {
        for (const q of questions) {
          // Check if there is an answer for this question number, else default
          const ansText = studentAnswersMap[q.question_number] || 'No answer provided';
          insertEvalStmt.run(studentId, q.id, ansText);
        }
      });

      evalTransaction();

      uploadedStudentsList.push({
        id: studentId,
        studentName,
        filename: file.originalname,
        status: 'pending'
      });
    }

    res.status(201).json({
      studentsUploaded: uploadedStudentsList.length,
      studentList: uploadedStudentsList
    });

  } catch (error) {
    console.error('Error uploading students:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

module.exports = router;
