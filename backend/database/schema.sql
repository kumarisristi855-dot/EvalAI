-- Schema for Answer Sheet Evaluator database

CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    class TEXT NOT NULL,
    total_marks INTEGER NOT NULL,
    instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_number TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT CHECK(question_type IN ('mcq', 'short', 'long')) NOT NULL,
    marks INTEGER NOT NULL,
    answer_key TEXT,
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    student_name TEXT NOT NULL,
    total_marks_obtained REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    grade TEXT,
    status TEXT CHECK(status IN ('pending', 'evaluated')) DEFAULT 'pending',
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    student_answer TEXT,
    marks_awarded REAL DEFAULT 0,
    feedback TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
);
