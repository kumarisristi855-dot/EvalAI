const express = require('express');
const router = express.Router();

const db = require('../database/db');
const { runEvaluation, getEvaluationStatus } = require('../services/evaluationOrchestrator');

/**
 * POST /api/exam/:id/evaluate
 * Triggers the evaluation orchestrator asynchronously and returns immediately.
 */
router.post('/exam/:id/evaluate', (req, res) => {
  try {
    const examId = req.params.id;
    
    // Check if exam exists
    const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: `Exam with ID ${examId} not found` });
    }

    // Trigger grading asynchronously
    runEvaluation(examId);

    res.json({ message: 'Evaluation started' });
  } catch (error) {
    console.error('Error starting evaluation:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/status
 * Returns current evaluation progress for frontend polling.
 */
router.get('/exam/:id/status', (req, res) => {
  try {
    const examId = req.params.id;
    const progress = getEvaluationStatus(examId);
    res.json(progress);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/results
 * Returns all students of an exam with total marks, percentage, grade, sorted descending.
 */
router.get('/exam/:id/results', (req, res) => {
  try {
    const examId = req.params.id;
    
    // Check if exam exists
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: `Exam with ID ${examId} not found` });
    }

    // Retrieve students sorted by total marks descending
    const students = db.prepare(`
      SELECT * FROM students 
      WHERE exam_id = ? 
      ORDER BY total_marks_obtained DESC
    `).all(examId);

    res.json({
      exam,
      students
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/student/:studentId
 * Returns detailed evaluation breakdown for a single student.
 */
router.get('/exam/:id/student/:studentId', (req, res) => {
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
      return res.status(404).json({ error: 'Student not found for this exam' });
    }

    // Fetch evaluations joined with questions
    const evaluations = db.prepare(`
      SELECT e.id as evaluation_id, e.student_answer, e.marks_awarded, e.feedback, e.is_overridden,
             q.id as question_id, q.question_number, q.question_text, q.question_type, q.marks as max_marks
      FROM evaluations e
      JOIN questions q ON e.question_id = q.id
      WHERE e.student_id = ?
      ORDER BY q.id ASC
    `).all(studentId);

    // Compute strength areas (scored >= 80%) and weak areas (scored < 50%)
    const strengthAreas = [];
    const weakAreas = [];

    evaluations.forEach((item) => {
      const maxVal = item.max_marks || 1;
      const ratio = (item.marks_awarded || 0) / maxVal;
      
      if (ratio >= 0.8) {
        strengthAreas.push(item.question_number);
      } else if (ratio < 0.5) {
        weakAreas.push(item.question_number);
      }
    });

    res.json({
      exam,
      student,
      evaluations,
      strengthAreas,
      weakAreas
    });

  } catch (error) {
    console.error('Error fetching student report:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * PATCH /api/exam/:examId/student/:studentId/question/:questionId/override
 * Overrides the marks awarded for a specific question evaluation and recalculates totals.
 */
router.patch('/exam/:examId/student/:studentId/question/:questionId/override', (req, res) => {
  try {
    const { examId, studentId, questionId } = req.params;
    const marksAwarded = parseFloat(req.body.marks_awarded);

    if (isNaN(marksAwarded)) {
      return res.status(400).json({ error: 'marks_awarded must be a valid number' });
    }

    // 1. Fetch question max marks and validate
    const question = db.prepare('SELECT marks FROM questions WHERE id = ? AND exam_id = ?').get(questionId, examId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (marksAwarded < 0 || marksAwarded > question.marks) {
      return res.status(400).json({ error: `Marks must be between 0 and ${question.marks}` });
    }

    // 2. Fetch exam total marks
    const exam = db.prepare('SELECT total_marks FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // 3. Perform update and recalculation inside a transaction
    const updateTransaction = db.transaction(() => {
      // Update evaluation entry
      db.prepare(`
        UPDATE evaluations
        SET marks_awarded = ?, is_overridden = 1
        WHERE student_id = ? AND question_id = ?
      `).run(marksAwarded, studentId, questionId);

      // Recalculate student total score
      const scoreResult = db.prepare('SELECT SUM(marks_awarded) as total_score FROM evaluations WHERE student_id = ?').get(studentId);
      const newTotal = scoreResult.total_score || 0;

      // Recalculate percentage and grade
      const totalPossibleMarks = exam.total_marks || 1;
      const percentage = parseFloat(((newTotal / totalPossibleMarks) * 100).toFixed(2));
      const cappedPercentage = Math.min(percentage, 100);
      const cappedScore = Math.min(newTotal, totalPossibleMarks);

      let newGrade = 'F';
      if (cappedPercentage >= 90) newGrade = 'A+';
      else if (cappedPercentage >= 80) newGrade = 'A';
      else if (cappedPercentage >= 70) newGrade = 'B';
      else if (cappedPercentage >= 60) newGrade = 'C';
      else if (cappedPercentage >= 50) newGrade = 'D';

      // Update student table
      db.prepare(`
        UPDATE students
        SET total_marks_obtained = ?, percentage = ?, grade = ?
        WHERE id = ?
      `).run(cappedScore, cappedPercentage, newGrade, studentId);

      return {
        newTotal: cappedScore,
        newPercentage: cappedPercentage,
        newGrade
      };
    });

    const result = updateTransaction();

    res.json({
      success: true,
      newTotal: result.newTotal,
      newPercentage: result.newPercentage,
      newGrade: result.newGrade
    });

  } catch (error) {
    console.error('Error overriding marks:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

module.exports = router;
