const express = require('express');
const router = express.Router();

const db = require('../database/db');
const { generateExcelBuffer, generateStudentReportPDF, generateClassResultsPDF } = require('../services/reportGenerator');

/**
 * GET /api/exam/:id/export/excel
 * Generates and streams the class results Excel file.
 */
router.get('/exam/:id/export/excel', (req, res) => {
  try {
    const examId = req.params.id;

    // Verify exam exists
    const exam = db.prepare('SELECT name FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const students = db.prepare(`
      SELECT student_name, total_marks_obtained, percentage, grade, status 
      FROM students 
      WHERE exam_id = ? 
      ORDER BY total_marks_obtained DESC
    `).all(examId);

    if (students.length === 0) {
      return res.status(400).json({ error: 'No students found for this exam to export' });
    }

    const buffer = generateExcelBuffer(students);

    // Normalize filename
    const safeExamName = exam.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeExamName}_results.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/student/:studentId/export/pdf
 * Generates and streams a PDF performance card for a specific student.
 */
router.get('/exam/:id/student/:studentId/export/pdf', (req, res) => {
  try {
    const { id: examId, studentId } = req.params;

    // Fetch exam
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Fetch student
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND exam_id = ?').get(studentId, examId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Fetch evaluations joined with questions
    const evaluations = db.prepare(`
      SELECT e.id as evaluation_id, e.student_answer, e.marks_awarded, e.feedback,
             q.question_number, q.question_text, q.question_type, q.marks
      FROM evaluations e
      JOIN questions q ON e.question_id = q.id
      WHERE e.student_id = ?
      ORDER BY q.id ASC
    `).all(studentId);

    const buffer = generateStudentReportPDF(student, exam, evaluations);

    // Normalize filename
    const safeStudentName = student.student_name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeStudentName}_report.pdf"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/export/pdf
 * Generates and streams the class results PDF file.
 */
router.get('/exam/:id/export/pdf', (req, res) => {
  try {
    const examId = req.params.id;

    // Verify exam exists
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const students = db.prepare(`
      SELECT student_name, total_marks_obtained, percentage, grade, status 
      FROM students 
      WHERE exam_id = ? 
      ORDER BY total_marks_obtained DESC
    `).all(examId);

    if (students.length === 0) {
      return res.status(400).json({ error: 'No students found for this exam to export' });
    }

    const buffer = generateClassResultsPDF(exam, students);

    // Normalize filename
    const safeExamName = exam.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeExamName}_results.pdf"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting class results PDF:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

module.exports = router;
