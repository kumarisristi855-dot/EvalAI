# EvalAI — AI-Powered Answer Sheet Evaluator

An intelligent web-based evaluation platform for school teachers that automatically grades typed student answer sheet PDFs against a question paper and reference answer key using the Groq LLM API. Results are recorded in a local SQLite database, visualized in a modern interactive class dashboard, and exportable as Excel summaries and student PDF reports.

## Project Structure

```text
answer-evaluator/
├── backend/
│   ├── database/
│   │   ├── db.js               # SQLite connection and schema auto-init
│   │   └── schema.sql          # DB table creation definitions
│   ├── routes/
│   │   ├── exam.js             # Exam setup and PDF parsing endpoints
│   │   ├── upload.js           # Student answer sheet uploads
│   │   ├── evaluate.js         # Grading pipeline status and results
│   │   └── export.js           # PDF and Excel report streaming
│   ├── services/
│   │   ├── pdfParser.js        # PDF text extractor via pdf-parse
│   │   ├── questionParser.js   # Regex question/marks paper parser
│   │   ├── answerParser.js     # Student response parser
│   │   ├── groqEvaluator.js    # Groq API LLM grader (w/ retry logic)
│   │   ├── evaluationOrchestrator.js # Grading pipeline coordinator
│   │   └── reportGenerator.js  # Excel (SheetJS) and PDF (jsPDF) compiler
│   ├── uploads/                # Local storage folder for student answer PDFs
│   ├── .env                    # Port & Groq API key configurations
│   ├── .gitignore              # Ignores database.db, .env, uploads/, and node_modules
│   ├── index.js                # Server entry point
│   └── test_pipeline.js        # Offline end-to-end integration test runner
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Setup.jsx       # Exam details, question paper & answer key upload
    │   │   ├── Upload.jsx      # Student PDF files upload and status polling
    │   │   ├── Dashboard.jsx   # Interactive metrics, sortable grid, Excel export
    │   │   └── StudentReport.jsx # Student score sheet breakdown & PDF export
    │   ├── App.jsx             # Main routing and navigation wrapper
    │   ├── index.css           # Tailwind configuration imports
    │   └── main.jsx            # React root mount file
    ├── vite.config.js          # Vite config with Tailwind CSS plugin
    ├── index.html              # HTML shell loading Google Font 'Outfit'
    ├── package.json            # React dependencies
    └── .gitignore              # Ignores build, dist, and local node_modules
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher recommended)
- A [Groq API Key](https://console.groq.com)

---

### Step 1: Set Up Backend

1. Navigate to the backend folder:
   ```bash
   cd answer-evaluator/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the `.env` file and insert your Groq API Key:
   ```env
   PORT=5000
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ```
   *Note: If no API key is provided, the backend will gracefully run in **MOCK evaluation mode**, using local keyword analysis to grade student papers deterministically.*

4. Run the integration test pipeline to verify database, parsers, and services:
   ```bash
   node test_pipeline.js
   ```
5. Start the Express server:
   ```bash
   node index.js
   ```
   The backend will start listening at `http://localhost:5000`.

---

### Step 2: Set Up Frontend

1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   The application UI will run at `http://localhost:5173`. Open this URL in your web browser.

---

## Grading Standards & Schema

- **MCQs**: Graded strictly against the key. Correct = Full Marks, Incorrect = 0 Marks. No feedback is generated.
- **Theory (Short/Long)**: Graded via LLM prompting based on conceptual matching. Awards partial marks (e.g. 3.5/5) and returns a concise, constructive one-line feedback sentence.
- **Grades Mapping**:
  - `90% - 100%`: **A+**
  - `80% - 89%`: **A**
  - `70% - 79%`: **B**
  - `60% - 69%`: **C**
  - `50% - 59%`: **D**
  - `< 50%`: **F**
