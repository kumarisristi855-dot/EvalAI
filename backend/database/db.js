const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to the database file
const dbPath = path.join(__dirname, '../database.db');

// Establish SQLite database connection
const db = new Database(dbPath, { verbose: console.log });

// Enable foreign key support
db.pragma('foreign_keys = ON');

// Initialize database schema
try {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('Database initialized successfully.');

  // Run migrations for manual mark override
  try {
    db.prepare("ALTER TABLE evaluations ADD COLUMN is_overridden INTEGER DEFAULT 0").run();
    console.log("Migration: Added is_overridden column.");
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    db.prepare("ALTER TABLE evaluations ADD COLUMN override_note TEXT").run();
    console.log("Migration: Added override_note column.");
  } catch (e) {
    // Ignore error if column already exists
  }
  // Run migration for class_account_id on exams
  try {
    db.prepare("ALTER TABLE exams ADD COLUMN class_account_id INTEGER").run();
    console.log("Migration: Added class_account_id column to exams table.");
  } catch (e) {
    // Ignore error if column already exists
  }
} catch (error) {
  console.error('Error initializing database:', error);
}

module.exports = db;
