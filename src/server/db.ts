/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Quiz {
  id: string;
  title: string;
  topic: string;
  gradeLevel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'MCQ' | 'True-False' | 'Short Answer';
  questions: Question[];
  createdBy: string; // User email
  createdAt: string;
}

export interface Participant {
  socketId: string;
  name: string;
  score: number;
  streak: number;
  answers: {
    questionIndex: number;
    answer: string;
    isCorrect: boolean;
    points: number;
    responseTimeMs: number;
  }[];
  answeredThisRound: boolean;
}

export interface LiveSession {
  roomCode: string;
  quizId: string;
  quizTitle: string;
  status: 'lobby' | 'active' | 'showing_result' | 'ended';
  currentQuestionIndex: number;
  questionActive: boolean;
  questionStartTime: number; // Date.now() timestamp
  questionDuration: number; // In seconds
  participants: Participant[];
  createdBy: string; // Teacher email
}

export interface QuizResultSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  teacherId: string;
  timestamp: string;
  averageScore: number;
  totalParticipants: number;
  participants: {
    name: string;
    score: number;
    correctCount: number;
    totalCount: number;
    answers?: {
      questionId: string;
      questionText: string;
      selectedAnswer: string;
      isCorrect: boolean;
    }[];
  }[];
}

export interface User {
  email: string;
  passwordHash: string; // for simplicity, plain text check is ok, but we call it passwordHash
  role: 'teacher';
}

class InMemoryDatabase {
  private users = new Map<string, User>();
  private quizzes = new Map<string, Quiz>();
  private sessions = new Map<string, LiveSession>();
  private results = new Map<string, QuizResultSummary>();

  constructor() {
    // Seed a couple of default quizzes and a default teacher for testing
    this.users.set('teacher@school.edu', {
      email: 'teacher@school.edu',
      passwordHash: 'password123',
      role: 'teacher',
    });

    const demoQuizId = 'demo-quiz-science';
    this.quizzes.set(demoQuizId, {
      id: demoQuizId,
      title: 'Solar System Exploration',
      topic: 'Astronomy',
      gradeLevel: 'Grade 6',
      difficulty: 'medium',
      questionType: 'MCQ',
      createdBy: 'teacher@school.edu',
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: 'q1',
          question: 'Which planet is known as the Red Planet?',
          options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
          correctAnswer: 'Mars',
          explanation: 'Mars is covered in iron oxide (rust), which gives it a distinct reddish appearance in the night sky.',
          difficulty: 'easy',
        },
        {
          id: 'q2',
          question: 'What is the largest planet in our solar system?',
          options: ['Saturn', 'Uranus', 'Jupiter', 'Neptune'],
          correctAnswer: 'Jupiter',
          explanation: 'Jupiter is more than twice as massive as all the other planets in our solar system combined.',
          difficulty: 'easy',
        },
        {
          id: 'q3',
          question: 'How long does light from the Sun take to reach Earth?',
          options: ['8 seconds', '8 minutes', '8 hours', '8 days'],
          correctAnswer: '8 minutes',
          explanation: 'The Sun is about 93 million miles away, and light travels at 186,000 miles per second, taking roughly 8 minutes and 20 seconds to reach us.',
          difficulty: 'medium',
        }
      ],
    });

    // Seed default student assessment results for testing
    const demoResId = 'demo-res-1';
    this.results.set(demoResId, {
      id: demoResId,
      quizId: demoQuizId,
      quizTitle: 'Solar System Exploration',
      teacherId: 'teacher@school.edu',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
      averageScore: 760,
      totalParticipants: 3,
      participants: [
        {
          name: 'Sarah Jenkins',
          score: 950,
          correctCount: 3,
          totalCount: 3,
          answers: [
            { questionId: 'q1', questionText: 'Which planet is known as the Red Planet?', selectedAnswer: 'Mars', isCorrect: true },
            { questionId: 'q2', questionText: 'What is the largest planet in our solar system?', selectedAnswer: 'Jupiter', isCorrect: true },
            { questionId: 'q3', questionText: 'How long does light from the Sun take to reach Earth?', selectedAnswer: '8 minutes', isCorrect: true }
          ]
        },
        {
          name: 'Alex Rivera',
          score: 780,
          correctCount: 2,
          totalCount: 3,
          answers: [
            { questionId: 'q1', questionText: 'Which planet is known as the Red Planet?', selectedAnswer: 'Mars', isCorrect: true },
            { questionId: 'q2', questionText: 'What is the largest planet in our solar system?', selectedAnswer: 'Jupiter', isCorrect: true },
            { questionId: 'q3', questionText: 'How long does light from the Sun take to reach Earth?', selectedAnswer: '8 seconds', isCorrect: false }
          ]
        },
        {
          name: 'Jordan Lee',
          score: 550,
          correctCount: 1,
          totalCount: 3,
          answers: [
            { questionId: 'q1', questionText: 'Which planet is known as the Red Planet?', selectedAnswer: 'Earth', isCorrect: false },
            { questionId: 'q2', questionText: 'What is the largest planet in our solar system?', selectedAnswer: 'Jupiter', isCorrect: true },
            { questionId: 'q3', questionText: 'How long does light from the Sun take to reach Earth?', selectedAnswer: '8 hours', isCorrect: false }
          ]
        }
      ]
    });
  }

  // Users Auth
  getUser(email: string): User | undefined {
    return this.users.get(email.toLowerCase());
  }

  addUser(user: User): void {
    this.users.set(user.email.toLowerCase(), user);
  }

  // Quizzes
  getQuiz(id: string): Quiz | undefined {
    return this.quizzes.get(id);
  }

  getTeacherQuizzes(email: string): Quiz[] {
    return Array.from(this.quizzes.values()).filter(
      (q) => q.createdBy.toLowerCase() === email.toLowerCase()
    );
  }

  saveQuiz(quiz: Quiz): void {
    this.quizzes.set(quiz.id, quiz);
  }

  deleteQuiz(id: string): boolean {
    return this.quizzes.delete(id);
  }

  // Live Sessions
  getSession(roomCode: string): LiveSession | undefined {
    return this.sessions.get(roomCode.toUpperCase());
  }

  createSession(session: LiveSession): void {
    this.sessions.set(session.roomCode.toUpperCase(), session);
  }

  updateSession(session: LiveSession): void {
    this.sessions.set(session.roomCode.toUpperCase(), session);
  }

  deleteSession(roomCode: string): void {
    this.sessions.delete(roomCode.toUpperCase());
  }

  // Results
  getTeacherResults(email: string): QuizResultSummary[] {
    return Array.from(this.results.values()).filter(
      (r) => r.teacherId.toLowerCase() === email.toLowerCase()
    );
  }

  saveResult(result: QuizResultSummary): void {
    this.results.set(result.id, result);
  }
}

export const db = new InMemoryDatabase();
