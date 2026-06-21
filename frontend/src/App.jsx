import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ExamHistory from './pages/ExamHistory';
import Setup from './pages/Setup';
import Upload from './pages/Upload';
import Dashboard from './pages/Dashboard';
import StudentReport from './pages/StudentReport';
import AddStudents from './pages/AddStudents';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
        {/* Navigation Bar */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
                E
              </div>
              <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300">
                EvalAI
              </span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium text-slate-400">
              <Link to="/setup" className="hover:text-white transition-colors">
                New Exam
              </Link>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
          <Routes>
            <Route path="/" element={<ExamHistory />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/upload/:examId" element={<Upload />} />
            <Route path="/dashboard/:examId" element={<Dashboard />} />
            <Route path="/student/:examId/:studentId" element={<StudentReport />} />
            <Route path="/exam/:examId/add-students" element={<AddStudents />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
