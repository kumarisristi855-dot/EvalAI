require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Auto-initialize local SQLite database connection & schema
const db = require('./database/db');

// Import routing modules
const examRoutes = require('./routes/exam');
const uploadRoutes = require('./routes/upload');
const evaluateRoutes = require('./routes/evaluate');
const exportRoutes = require('./routes/export');

// Debug tooling imports
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const pdfParser = require('./services/pdfParser');

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads folder on startup if not present
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
  console.log('Created local uploads directory.');
}

// CORS middleware setup (support Vite, CRA, and local network mobile access)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost and any local network interface connections
    callback(null, true);
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets if needed for validation
app.use('/uploads', express.static(uploadsPath));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Temporary Debug Route
app.get('/api/debug/student/:studentId', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.studentId);
  const evaluations = db.prepare('SELECT * FROM evaluations WHERE student_id = ?').all(req.params.studentId);
  res.json({ student, evaluations });
});

app.post('/api/debug/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const text = await pdfParser(req.file.path);
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register API Routes
app.use('/api', examRoutes);
app.use('/api', uploadRoutes);
app.use('/api', evaluateRoutes);
app.use('/api', exportRoutes);

// Unhandled error recovery
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Backend server successfully listening on port ${PORT}`);
});
