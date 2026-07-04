/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Configure dotenv
dotenv.config();

// Import local server modules
import { db, Quiz, Question, LiveSession, User } from './src/server/db.js';
import { generateQuizQuestions, regenerateSingleQuestion } from './src/server/ai.js';
import { initSocketServer } from './src/server/socket.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Configure standard middleware
app.use(cors());
app.use(express.json());

// Apply Socket.io handlers
initSocketServer(io);

// API ROUTES

// Auth Routes
app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const existingUser = db.getUser(email);
  if (existingUser) {
    res.status(400).json({ error: 'An account with this email already exists.' });
    return;
  }

  const newUser: User = {
    email,
    passwordHash: password, // For mock playground, simple equality check
    role: 'teacher',
  };

  db.addUser(newUser);

  res.json({
    success: true,
    user: { email: newUser.email, role: newUser.role },
    token: `mock-token-${Buffer.from(email).toString('base64')}`,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db.getUser(email);
  if (!user || user.passwordHash !== password) {
    res.status(400).json({ error: 'Invalid email or password.' });
    return;
  }

  res.json({
    success: true,
    user: { email: user.email, role: user.role },
    token: `mock-token-${Buffer.from(email).toString('base64')}`,
  });
});

// Quiz CRUD Routes
app.get('/api/quizzes', (req, res) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) {
    res.status(401).json({ error: 'Authorization email required in headers.' });
    return;
  }

  const quizzes = db.getTeacherQuizzes(email);
  res.json({ success: true, quizzes });
});

app.get('/api/quizzes/:id', (req, res) => {
  const quiz = db.getQuiz(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }
  res.json({ success: true, quiz });
});

app.post('/api/quizzes', (req, res) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) {
    res.status(401).json({ error: 'Authorization email required.' });
    return;
  }

  const { title, topic, gradeLevel, difficulty, questionType, questions } = req.body;

  if (!title || !topic || !questions || !Array.isArray(questions)) {
    res.status(400).json({ error: 'Title, topic, and questions array are required.' });
    return;
  }

  const newQuiz: Quiz = {
    id: `quiz-${Date.now()}`,
    title,
    topic,
    gradeLevel: gradeLevel || 'General',
    difficulty: difficulty || 'medium',
    questionType: questionType || 'MCQ',
    questions: questions.map((q: any, idx: number) => ({
      id: q.id || `q-${Date.now()}-${idx}`,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      difficulty: q.difficulty || difficulty || 'medium',
    })),
    createdBy: email,
    createdAt: new Date().toISOString(),
  };

  db.saveQuiz(newQuiz);
  res.status(210).json({ success: true, quiz: newQuiz });
});

app.put('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  const existingQuiz = db.getQuiz(id);

  if (!existingQuiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  const { title, topic, gradeLevel, difficulty, questionType, questions } = req.body;

  const updatedQuiz: Quiz = {
    ...existingQuiz,
    title: title || existingQuiz.title,
    topic: topic || existingQuiz.topic,
    gradeLevel: gradeLevel || existingQuiz.gradeLevel,
    difficulty: difficulty || existingQuiz.difficulty,
    questionType: questionType || existingQuiz.questionType,
    questions: questions ? questions.map((q: any, idx: number) => ({
      id: q.id || `q-${Date.now()}-${idx}`,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      difficulty: q.difficulty || existingQuiz.difficulty || 'medium',
    })) : existingQuiz.questions,
  };

  db.saveQuiz(updatedQuiz);
  res.json({ success: true, quiz: updatedQuiz });
});

app.delete('/api/quizzes/:id', (req, res) => {
  const success = db.deleteQuiz(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }
  res.json({ success: true, message: 'Quiz deleted successfully.' });
});

// AI generation endpoint
app.post('/api/quizzes/generate', async (req, res) => {
  const { topic, gradeLevel, numQuestions, difficulty, questionType } = req.body;

  if (!topic) {
    res.status(400).json({ error: 'Topic is required.' });
    return;
  }

  try {
    const questions = await generateQuizQuestions({
      topic,
      gradeLevel: gradeLevel || 'Grade 8',
      numQuestions: Number(numQuestions) || 5,
      difficulty: difficulty || 'medium',
      questionType: questionType || 'MCQ',
    });

    res.json({ success: true, questions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

// AI single question regeneration endpoint
app.post('/api/quizzes/regenerate-question', async (req, res) => {
  const { topic, gradeLevel, difficulty, questionType, excludeQuestions } = req.body;

  try {
    const question = await regenerateSingleQuestion({
      topic: topic || 'General Knowledge',
      gradeLevel: gradeLevel || 'Grade 8',
      difficulty: difficulty || 'medium',
      questionType: questionType || 'MCQ',
      excludeQuestions: excludeQuestions || [],
    });

    res.json({ success: true, question });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to regenerate question' });
  }
});

// Create Live Session
app.post('/api/sessions/create', (req, res) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) {
    res.status(401).json({ error: 'Authorization email required.' });
    return;
  }

  const { quizId } = req.body;
  if (!quizId) {
    res.status(400).json({ error: 'Quiz ID is required.' });
    return;
  }

  const quiz = db.getQuiz(quizId);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // Generate unique 6-character room code
  let roomCode = '';
  let attempts = 0;
  while (attempts < 10) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (!db.getSession(code)) {
      roomCode = code;
      break;
    }
    attempts++;
  }

  if (!roomCode) {
    res.status(500).json({ error: 'Failed to generate a unique room code. Try again.' });
    return;
  }

  const newSession: LiveSession = {
    roomCode,
    quizId,
    quizTitle: quiz.title,
    status: 'lobby',
    currentQuestionIndex: -1,
    questionActive: false,
    questionStartTime: 0,
    questionDuration: 20,
    participants: [],
    createdBy: email,
  };

  db.createSession(newSession);

  res.json({ success: true, roomCode, session: newSession });
});

// Results Endpoint
app.get('/api/results', (req, res) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) {
    res.status(401).json({ error: 'Authorization email required.' });
    return;
  }

  const results = db.getTeacherResults(email);
  res.json({ success: true, results });
});

// Results POST Endpoint (Saves individual student or live session results)
app.post('/api/results', (req, res) => {
  const { quizId, quizTitle, teacherId, participantName, score, correctCount, totalCount, answers } = req.body;

  const targetTeacherId = teacherId || 'teacher@school.edu';
  const resultId = `res-${Date.now()}`;

  const resultsSummary = {
    id: resultId,
    quizId,
    quizTitle,
    teacherId: targetTeacherId,
    timestamp: new Date().toISOString(),
    totalParticipants: 1,
    averageScore: score,
    participants: [{
      name: participantName || 'Student',
      score,
      correctCount,
      totalCount,
      answers
    }]
  };

  db.saveResult(resultsSummary);
  res.json({ success: true, result: resultsSummary });
});

// Analytics Endpoint
app.get('/api/analytics', (req, res) => {
  const email = req.headers['x-user-email'] as string;
  if (!email) {
    res.status(401).json({ error: 'Authorization email required.' });
    return;
  }

  const results = db.getTeacherResults(email);
  const quizzes = db.getTeacherQuizzes(email);

  const totalQuizzes = quizzes.length;
  const totalSessions = results.length;
  
  // Calculate average accuracy and assemble topics performance
  let overallSum = 0;
  let totalParticipants = 0;
  const topicStats: { [topic: string]: { correct: number; total: number } } = {};

  results.forEach((resSummary) => {
    totalParticipants += resSummary.totalParticipants;
    
    // Find quiz details to associate with topic
    const quiz = quizzes.find((q) => q.id === resSummary.quizId);
    const topic = quiz?.topic || 'General';

    if (!topicStats[topic]) {
      topicStats[topic] = { correct: 0, total: 0 };
    }

    resSummary.participants.forEach((p) => {
      overallSum += p.score;
      topicStats[topic].correct += p.correctCount;
      topicStats[topic].total += p.totalCount;
    });
  });

  const averageScore = totalParticipants > 0 ? Math.round(overallSum / totalParticipants) : 0;

  // Process weakest topics
  const weakestTopics = Object.entries(topicStats)
    .map(([topic, stats]) => {
      const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      return { topic, accuracy, ...stats };
    })
    .sort((a, b) => a.accuracy - b.accuracy); // lowest accuracy first

  res.json({
    success: true,
    analytics: {
      totalQuizzes,
      totalSessions,
      averageScore,
      totalParticipants,
      weakestTopics,
    },
  });
});

// INTEGRATION WITH VITE
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // Serve production build static files
  const distPath = path.resolve('dist');
  app.use(express.static(distPath));
  
  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Mount Vite programmatically in dev mode
  console.log('Starting dev server in Vite middleware mode...');
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

// Listen on port 3000 (Required hardcoded port!)
const PORT = 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is fully operational on http://localhost:${PORT}`);
});
