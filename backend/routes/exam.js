const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../database/db');
const parsePdf = require('../services/pdfParser');
const { parseQuestions, parseAnswerKey, refineTypeWithAnswer } = require('../services/questionParser');

// Multer storage setup
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadFields = upload.fields([
  { name: 'questionPaper', maxCount: 1 },
  { name: 'answerKey', maxCount: 1 }
]);

/**
 * POST /api/exam/setup
 * Sets up a new exam, parses questions & answer keys, and saves metadata.
 */
router.post('/exam/setup', uploadFields, async (req, res) => {
  try {
    const { name, subject, class: className, totalMarks, instructions } = req.body;
    
    // Check if files exist
    if (!req.files || !req.files['questionPaper'] || !req.files['answerKey']) {
      return res.status(400).json({ error: 'Both question paper and answer key PDFs are required' });
    }

    const qPaperFile = req.files['questionPaper'][0];
    const ansKeyFile = req.files['answerKey'][0];

    // 1. Insert exam metadata into the database
    const examInsert = db.prepare(`
      INSERT INTO exams (name, subject, class, total_marks, instructions)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name || 'Unnamed Exam', 
      subject || 'General', 
      className || 'N/A', 
      parseInt(totalMarks, 10) || 100, 
      instructions || ''
    );
    
    const examId = examInsert.lastInsertRowid;

    // 2. Parse Question Paper PDF text
    const qPaperText = await parsePdf(qPaperFile.path);
    const parsedQuestions = parseQuestions(qPaperText);
    
    if (parsedQuestions.length === 0) {
      console.warn("No questions parsed from question paper PDF using regex. Trying line-by-line fallback.");
    }

    // 3. Parse Answer Key PDF text
    const ansKeyText = await parsePdf(ansKeyFile.path);
    const parsedAnswersMap = parseAnswerKey(ansKeyText);

    // 4. Save parsed questions mapped with answer keys to DB
    const insertQuestionStmt = db.prepare(`
      INSERT INTO questions (exam_id, question_number, question_text, question_type, marks, answer_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((questionsList) => {
      for (const q of questionsList) {
        const answer = parsedAnswersMap[q.number] || '';
        const finalType = refineTypeWithAnswer(q.type, answer);
        insertQuestionStmt.run(
          examId,
          q.number,
          q.text,
          finalType,
          q.marks,
          answer
        );
      }
    });

    transaction(parsedQuestions);

    // 5. Update the exam's total_marks to be the sum of parsed question marks
    const totalMarksFromQuestions = parsedQuestions.reduce((sum, q) => sum + q.marks, 0);
    db.prepare(`
      UPDATE exams SET total_marks = ? WHERE id = ?
    `).run(totalMarksFromQuestions, examId);

    // Clean up temporary uploaded files from disk
    fs.unlink(qPaperFile.path, () => {});
    fs.unlink(ansKeyFile.path, () => {});

    res.status(201).json({
      examId,
      questionsFound: parsedQuestions.length,
      totalMarks: totalMarksFromQuestions
    });

  } catch (error) {
    console.error('Error setting up exam:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exams
 * Returns list of all exams sorted by created_at DESC with student counts.
 */
router.get('/exams', (req, res) => {
  try {
    const exams = db.prepare(`
      SELECT id, name, subject, class, total_marks, created_at,
             (SELECT COUNT(*) FROM students WHERE exam_id = exams.id) as student_count
      FROM exams ORDER BY created_at DESC
    `).all();
    res.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id
 * Fetches details of a specific exam along with all its parsed questions.
 */
router.get('/exam/:id', (req, res) => {
  try {
    const examId = req.params.id;
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ?').all(examId);

    res.json({
      exam,
      questions
    });
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * DELETE /api/exams
 * Deletes one or more exams by ID.
 * Body: { examIds: [1, 2, 3] }
 */
router.delete('/exams', (req, res) => {
  try {
    const { examIds } = req.body;

    // Validate examIds is a non-empty array
    if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
      return res.status(400).json({ error: 'examIds must be a non-empty array' });
    }

    // Security check: Verify each exam belongs to req.user.classId
    if (req.user && req.user.classId) {
      for (const examId of examIds) {
        const exam = db.prepare('SELECT class_account_id FROM exams WHERE id = ?').get(examId);
        if (exam && exam.class_account_id !== req.user.classId) {
          return res.status(403).json({ error: 'Access denied: Exam does not belong to your class' });
        }
      }
    }

    // Delete each exam by id
    const deleteStmt = db.prepare('DELETE FROM exams WHERE id = ?');
    const transaction = db.transaction((ids) => {
      for (const id of ids) {
        deleteStmt.run(id);
      }
    });

    transaction(examIds);

    res.json({ success: true, deleted: examIds.length });
  } catch (error) {
    console.error('Error deleting exams:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

module.exports = router;
