/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  BookOpen, 
  Sparkles, 
  Play, 
  Users, 
  Award, 
  Trash2, 
  Edit, 
  Plus, 
  Check, 
  X, 
  ArrowRight, 
  Clock, 
  LogOut, 
  BarChart2, 
  RefreshCw, 
  Download, 
  ChevronRight, 
  User, 
  Trophy, 
  ArrowLeft,
  Volume2,
  VolumeX,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Types
interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Quiz {
  id: string;
  title: string;
  topic: string;
  gradeLevel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'MCQ' | 'True-False' | 'Short Answer';
  questions: Question[];
  createdBy: string;
  createdAt: string;
}

interface Participant {
  socketId: string;
  name: string;
  score: number;
  streak: number;
  answeredThisRound: boolean;
}

interface LiveSession {
  roomCode: string;
  quizId: string;
  quizTitle: string;
  status: 'lobby' | 'active' | 'showing_result' | 'ended';
  currentQuestionIndex: number;
  questionActive: boolean;
  questionStartTime: number;
  questionDuration: number;
  participants: Participant[];
  createdBy: string;
}

interface QuizResultSummary {
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
  }[];
}

interface TeacherAnalytics {
  totalQuizzes: number;
  totalSessions: number;
  averageScore: number;
  totalParticipants: number;
  weakestTopics: {
    topic: string;
    accuracy: number;
    correct: number;
    total: number;
  }[];
}

// Custom curriculum quiz database of 10 fully interactive pre-seeded topics
const TOPIC_QUIZZES: { [key: string]: Question[] } = {
  "General Knowledge": [
    {
      id: "gk-1",
      question: "Which is the largest ocean on Earth?",
      options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"],
      correctAnswer: "Pacific Ocean",
      explanation: "The Pacific Ocean is the largest and deepest of Earth's oceanic divisions, covering about 46% of Earth's water surface.",
      difficulty: "easy"
    },
    {
      id: "gk-2",
      question: "Who wrote the play 'Romeo and Juliet'?",
      options: ["William Shakespeare", "Charles Dickens", "Mark Twain", "Jane Austen"],
      correctAnswer: "William Shakespeare",
      explanation: "Romeo and Juliet is a tragedy written by William Shakespeare early in his career about two young Italian star-crossed lovers.",
      difficulty: "easy"
    },
    {
      id: "gk-3",
      question: "What is the capital of Japan?",
      options: ["Beijing", "Seoul", "Tokyo", "Bangkok"],
      correctAnswer: "Tokyo",
      explanation: "Tokyo is the capital and most populous city of Japan, located on the eastern coast of Honshu island.",
      difficulty: "easy"
    }
  ],
  "Java Programming": [
    {
      id: "java-1",
      question: "Which of the following is NOT a primitive data type in Java?",
      options: ["int", "boolean", "String", "double"],
      correctAnswer: "String",
      explanation: "In Java, String is an Object class representing a sequence of characters, not a primitive data type.",
      difficulty: "easy"
    },
    {
      id: "java-2",
      question: "What is the default value of an instance variable of type object reference in Java?",
      options: ["null", "undefined", "0", "void"],
      correctAnswer: "null",
      explanation: "All object reference variables in Java default to 'null' when declared as class member fields.",
      difficulty: "easy"
    },
    {
      id: "java-3",
      question: "Which keyword is used to inherit a class in Java?",
      options: ["implements", "extends", "inherits", "exports"],
      correctAnswer: "extends",
      explanation: "The 'extends' keyword is used in class declarations to establish inheritance from a parent superclass.",
      difficulty: "medium"
    }
  ],
  "Python Basics": [
    {
      id: "py-1",
      question: "Which function is used to read a line of text from standard input in Python 3?",
      options: ["read()", "raw_input()", "input()", "readline()"],
      correctAnswer: "input()",
      explanation: "In Python 3, 'input()' reads a line from standard input, converts it to a string, and returns it.",
      difficulty: "easy"
    },
    {
      id: "py-2",
      question: "How do you start a single-line comment in Python?",
      options: ["//", "#", "/*", "--"],
      correctAnswer: "#",
      explanation: "The hash character '#' is used to start a single-line comment in Python.",
      difficulty: "easy"
    },
    {
      id: "py-3",
      question: "What is the output of len(['hello', 2, 3, 4]) in Python?",
      options: ["1", "4", "5", "Error"],
      correctAnswer: "4",
      explanation: "The 'len()' function returns the number of items in a list. This list contains exactly 4 elements.",
      difficulty: "easy"
    }
  ],
  "Web Development": [
    {
      id: "web-1",
      question: "What does HTML stand for?",
      options: ["Hyper Text Markup Language", "High Tech Markup Language", "Hyper Tabular Multi Language", "Hyperlinks and Text Markup Language"],
      correctAnswer: "Hyper Text Markup Language",
      explanation: "HTML is the standard markup language used for creating web pages.",
      difficulty: "easy"
    },
    {
      id: "web-2",
      question: "Which CSS property is used to change the background color of an element?",
      options: ["color", "bg-color", "background-color", "match-color"],
      correctAnswer: "background-color",
      explanation: "The 'background-color' property sets the background color of an HTML element.",
      difficulty: "easy"
    },
    {
      id: "web-3",
      question: "Which JavaScript library was developed by Facebook for building user interfaces?",
      options: ["Angular", "Vue", "React", "Svelte"],
      correctAnswer: "React",
      explanation: "React is a popular open-source JavaScript library developed by Facebook (Meta) for rendering component-based user interfaces.",
      difficulty: "easy"
    }
  ],
  "Database / SQL": [
    {
      id: "db-1",
      question: "What does SQL stand for?",
      options: ["Structured Query Language", "Simple Queue Language", "Standard Query List", "Sequential Query Language"],
      correctAnswer: "Structured Query Language",
      explanation: "SQL is the standard language used for managing data stored in relational database management systems.",
      difficulty: "easy"
    },
    {
      id: "db-2",
      question: "Which SQL statement is used to retrieve data from a database?",
      options: ["GET", "SELECT", "FETCH", "EXTRACT"],
      correctAnswer: "SELECT",
      explanation: "The 'SELECT' statement is used to query and extract records from a database table.",
      difficulty: "easy"
    },
    {
      id: "db-3",
      question: "Which constraint uniquely identifies each record in a database table?",
      options: ["UNIQUE", "FOREIGN KEY", "PRIMARY KEY", "CHECK"],
      correctAnswer: "PRIMARY KEY",
      explanation: "A PRIMARY KEY constraint uniquely identifies each row in a database table. It must contain unique values and cannot contain NULLs.",
      difficulty: "medium"
    }
  ],
  "Computer Networks": [
    {
      id: "net-1",
      question: "What does IP stand for in the context of computer networking?",
      options: ["Internet Protocol", "Intranet Port", "Internal Process", "Instant Packet"],
      correctAnswer: "Internet Protocol",
      explanation: "IP stands for Internet Protocol, which is the principal set of rules governing packet routing across internet boundaries.",
      difficulty: "easy"
    },
    {
      id: "net-2",
      question: "Which layer of the OSI model is responsible for routing packets across different network domains?",
      options: ["Physical Layer", "Data Link Layer", "Network Layer", "Transport Layer"],
      correctAnswer: "Network Layer",
      explanation: "The Network Layer (Layer 3) handles network routing, packet forwarding, and logical addressing (IP).",
      difficulty: "medium"
    },
    {
      id: "net-3",
      question: "Which port is typically used for secure HTTPS web traffic?",
      options: ["80", "21", "443", "8080"],
      correctAnswer: "443",
      explanation: "Port 443 is the default port for secure web browsers transmitting HTTPS traffic using SSL/TLS encryption.",
      difficulty: "easy"
    }
  ],
  "AI & Machine Learning": [
    {
      id: "ai-1",
      question: "What is the term for an AI model's ability to learn and improve from data without being explicitly programmed?",
      options: ["Machine Learning", "Cloud Computing", "Data Mining", "Robotics"],
      correctAnswer: "Machine Learning",
      explanation: "Machine Learning is a subset of AI focused on building systems that learn patterns from historic training data dynamically.",
      difficulty: "easy"
    },
    {
      id: "ai-2",
      question: "What is an artificial neural network in machine learning?",
      options: ["A network of physical server racks", "A computing structure inspired by biological brains", "An internet cryptographic protocol", "A multi-dimensional database view"],
      correctAnswer: "A computing structure inspired by biological brains",
      explanation: "Artificial Neural Networks (ANNs) are computational models composed of interconnected nodes (neurons) inspired by biological brain structures.",
      difficulty: "easy"
    },
    {
      id: "ai-3",
      question: "What is 'overfitting' in machine learning?",
      options: ["When a model performs perfectly on unseen data", "When a model learns training data noise too well, causing poor generalization to unseen data", "When the model runs too slowly", "When training features are missing"],
      correctAnswer: "When a model learns training data noise too well, causing poor generalization to unseen data",
      explanation: "Overfitting happens when a model learns the detail and noise in the training data to the extent that it negatively impacts performance on new, unseen data.",
      difficulty: "medium"
    }
  ],
  "Cyber Security": [
    {
      id: "sec-1",
      question: "What is a phishing attack?",
      options: ["A physical intrusion into server rooms", "A social engineering attack to trick users into giving away sensitive information via fraudulent emails", "A hardware level power supply failure", "A standard database backup operation"],
      correctAnswer: "A social engineering attack to trick users into giving away sensitive information via fraudulent emails",
      explanation: "Phishing is a deceptive email or message designed to steal credentials, credit card details, or install malware.",
      difficulty: "easy"
    },
    {
      id: "sec-2",
      question: "What does VPN stand for?",
      options: ["Virtual Private Network", "Verified Port Network", "Variable Protection Node", "Virtual Protocol Network"],
      correctAnswer: "Virtual Private Network",
      explanation: "A VPN (Virtual Private Network) encrypts internet traffic and masks the user's online identity, securing public network sessions.",
      difficulty: "easy"
    },
    {
      id: "sec-3",
      question: "What is Multi-Factor Authentication (MFA)?",
      options: ["A process requiring multiple passwords", "A security system requiring two or more independent credentials to verify a user's identity", "An advanced file indexing service", "A network diagnostic protocol"],
      correctAnswer: "A security system requiring two or more independent credentials to verify a user's identity",
      explanation: "MFA enhances security by requiring multiple verification categories: something you know (password), something you have (phone code), or something you are (fingerprint).",
      difficulty: "easy"
    }
  ],
  "Aptitude": [
    {
      id: "apt-1",
      question: "A train 120 meters long passes a telegraph post in 6 seconds. Find the speed of the train.",
      options: ["60 km/h", "72 km/h", "80 km/h", "54 km/h"],
      correctAnswer: "72 km/h",
      explanation: "Speed = Distance / Time = 120m / 6s = 20 m/s. To convert to km/h, multiply by 18/5: 20 * 18/5 = 72 km/h.",
      difficulty: "medium"
    },
    {
      id: "apt-2",
      question: "If a person sells an article for $300 and gains 20% profit, what was the cost price of the article?",
      options: ["$240", "$250", "$260", "$270"],
      correctAnswer: "$250",
      explanation: "Selling Price (SP) = Cost Price (CP) * (1 + Profit%). $300 = CP * 1.20. CP = 300 / 1.20 = $250.",
      difficulty: "medium"
    },
    {
      id: "apt-3",
      question: "What is the next number in the sequence: 2, 6, 12, 20, 30, ...?",
      options: ["36", "40", "42", "45"],
      correctAnswer: "42",
      explanation: "The differences between successive terms are: 4, 6, 8, 10. The next difference should be 12. 30 + 12 = 42.",
      difficulty: "medium"
    }
  ],
  "Reasoning": [
    {
      id: "reas-1",
      question: "Pointing to a photograph of a boy, Suresh said, 'He is the son of the only son of my mother.' How is Suresh related to that boy?",
      options: ["Brother", "Uncle", "Cousin", "Father"],
      correctAnswer: "Father",
      explanation: "The 'only son of my mother' is Suresh himself. Therefore, the boy is the son of Suresh, so Suresh is his father.",
      difficulty: "medium"
    },
    {
      id: "reas-2",
      question: "If LIGHT is coded as MJHIT, how is MIGHT coded?",
      options: ["NIHJT", "NGHIU", "LHFGS", "KHEFR"],
      correctAnswer: "NIHJT",
      explanation: "The coding moves the first letter +1 (L->M), second letter +1 (I->J), third letter +1 (G->H), fourth letter +1 (H->I), fifth letter +1 (T->U)? Wait! Let's check LIGHT -> MJHIT: L->M (+1), I->J (+1), G->H (+1), H->I (+1), T->T (0). Yes! So M->N (+1), I->J (+1), G->H (+1), H->I (+1), T->T (0). That gives NIHJT.",
      difficulty: "hard"
    },
    {
      id: "reas-3",
      question: "Which word does not belong with the others?",
      options: ["Parsley", "Basil", "Dill", "Apple"],
      correctAnswer: "Apple",
      explanation: "Parsley, basil, and dill are herbs, whereas an apple is a fruit.",
      difficulty: "easy"
    }
  ]
};

export default function App() {
  // Navigation State
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [assistantText, setAssistantText] = useState("Hi there! I'm the CourseAgent Assistant. How can I help you build or play live interactive quizzes today?");
  const [selectedTypeExplanation, setSelectedTypeExplanation] = useState<string | null>(null);
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Auth Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Student Solo Mode States
  const [soloQuiz, setSoloQuiz] = useState<Quiz | null>(null);
  const [soloCurrentIndex, setSoloCurrentIndex] = useState<number>(0);
  const [soloSelectedAnswer, setSoloSelectedAnswer] = useState<string>('');
  const [soloAnswerSubmitted, setSoloAnswerSubmitted] = useState<boolean>(false);
  const [soloAnswers, setSoloAnswers] = useState<{
    questionId: string;
    questionText: string;
    selectedAnswer: string;
    isCorrect: boolean;
  }[]>([]);
  const [soloScore, setSoloScore] = useState<number>(0);
  const [soloCompleted, setSoloCompleted] = useState<boolean>(false);
  const [studentCardMode, setStudentCardMode] = useState<'live' | 'practice'>('live');
  const [selectedPracticeTopic, setSelectedPracticeTopic] = useState<string>('General Knowledge');
  const [selectedQuizAnalysisId, setSelectedQuizAnalysisId] = useState<string>('demo-quiz-science');

  // Teacher Dashboard Tabs: 'mark_analysis' | 'quizzes' | 'history'
  const [activeTab, setActiveTab] = useState<'mark_analysis' | 'quizzes' | 'history'>('mark_analysis');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResultSummary[]>([]);
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  
  // Quiz Creator / Editor State
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizForm, setQuizForm] = useState({
    title: '',
    topic: '',
    gradeLevel: 'Grade 8',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    questionType: 'MCQ' as 'MCQ' | 'True-False' | 'Short Answer',
    numQuestions: 5,
  });
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [singleQuestionForm, setSingleQuestionForm] = useState<Question>({
    id: '',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    difficulty: 'medium',
  });

  // Live Session / Room State (Teacher and Student)
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [session, setSession] = useState<LiveSession | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [joinSuccessData, setJoinSuccessData] = useState<any>(null);

  // Active Quiz State (Student Side)
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [answerSubmitted, setAnswerSubmitted] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [roundEndedData, setRoundEndedData] = useState<any>(null);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [studentFinished, setStudentFinished] = useState<boolean>(false);
  const [studentResults, setStudentResults] = useState<any>(null);

  // Timer Ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartRef = useRef<number>(0);

  // Load Saved Auth
  useEffect(() => {
    const savedEmail = localStorage.getItem('teacher_email');
    const savedToken = localStorage.getItem('teacher_token');
    if (savedEmail && savedToken) {
      setTeacherEmail(savedEmail);
      setToken(savedToken);
      setRole('teacher');
    }
  }, []);

  // Fetch Teacher Data
  useEffect(() => {
    if (role === 'teacher' && teacherEmail && token) {
      fetchQuizzes();
      fetchHistory();
      fetchAnalytics();
    }
  }, [role, teacherEmail, token]);

  // Clean socket connection on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  // Handle countdown timer for active questions
  useEffect(() => {
    if (session?.status === 'active' && timeLeft > 0 && (role === 'teacher' || (role === 'student' && !answerSubmitted))) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            if (role === 'student' && !answerSubmitted) {
              handleSubmitAnswer("");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [session?.status, timeLeft, role, answerSubmitted, socket]);

  // API Methods
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-user-email': teacherEmail,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const response = await fetch(endpoint, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  };

  const fetchQuizzes = async () => {
    try {
      const data = await apiFetch('/api/quizzes');
      setQuizzes(data.quizzes || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await apiFetch('/api/results');
      setResults(data.results || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await apiFetch('/api/analytics');
      setAnalytics(data.analytics || null);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      localStorage.setItem('teacher_email', data.user.email);
      localStorage.setItem('teacher_token', data.token);
      setTeacherEmail(data.user.email);
      setToken(data.token);
      setEmailInput('');
      setPasswordInput('');
      setRole('teacher');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('teacher_email');
    localStorage.removeItem('teacher_token');
    setTeacherEmail('');
    setToken('');
    setRole(null);
    setSession(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  // Student Solo / Practice Challenge Event Handlers
  const handleStartSoloQuiz = (topic: string) => {
    if (!studentName.trim()) {
      alert('Please enter your name first!');
      return;
    }
    const questions = TOPIC_QUIZZES[topic] || [];
    if (questions.length === 0) {
      alert('Selected topic is currently being developed! Please select another topic.');
      return;
    }

    const quiz: Quiz = {
      id: `solo-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `${topic} Challenge`,
      topic: topic,
      gradeLevel: 'General',
      difficulty: 'medium',
      questionType: 'MCQ',
      questions: questions,
      createdBy: 'System',
      createdAt: new Date().toISOString()
    };

    setSoloQuiz(quiz);
    setSoloCurrentIndex(0);
    setSoloSelectedAnswer('');
    setSoloAnswerSubmitted(false);
    setSoloAnswers([]);
    setSoloScore(0);
    setSoloCompleted(false);
    setRole('student');
  };

  const handleSoloSubmitAnswer = (answer: string) => {
    if (soloAnswerSubmitted) return;
    const q = soloQuiz?.questions[soloCurrentIndex];
    if (!q) return;

    const isCorrect = answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    
    setSoloSelectedAnswer(answer);
    setSoloAnswerSubmitted(true);
    
    const newAnswer = {
      questionId: q.id,
      questionText: q.question,
      selectedAnswer: answer,
      isCorrect: isCorrect
    };
    
    const updatedAnswers = [...soloAnswers, newAnswer];
    setSoloAnswers(updatedAnswers);
    
    if (isCorrect) {
      setSoloScore((prev) => prev + 1000); // 1000 points per correct answer
    }
  };

  const handleSoloNext = () => {
    if (!soloQuiz) return;
    
    const nextIdx = soloCurrentIndex + 1;
    if (nextIdx < soloQuiz.questions.length) {
      setSoloCurrentIndex(nextIdx);
      setSoloSelectedAnswer('');
      setSoloAnswerSubmitted(false);
    } else {
      // Completed the quiz! Save results to the server
      handleSaveSoloResults();
    }
  };

  const handleSaveSoloResults = async () => {
    if (!soloQuiz) return;
    
    const totalCount = soloQuiz.questions.length;
    const correctCount = soloAnswers.filter(a => a.isCorrect).length;
    
    // Save results using the POST API so it shows in teacher analytics
    const payload = {
      quizId: soloQuiz.id,
      quizTitle: soloQuiz.title,
      teacherId: 'teacher@school.edu', // Standard teacher account for demonstration
      participantName: studentName || 'Student',
      score: soloScore,
      correctCount,
      totalCount,
      answers: soloAnswers
    };
    
    try {
      await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // Dynamically fetch updated results/analytics if logged in as teacher,
      // or at least let the local server save it successfully.
    } catch (e) {
      console.error('Failed to automatically save solo results:', e);
    }
    
    setSoloCompleted(true);
  };

  // Generate quiz questions with Gemini AI
  const generateQuestionsWithAI = async () => {
    if (!quizForm.title || !quizForm.topic) {
      alert('Please fill out the Quiz Title and Topic first!');
      return;
    }
    setAiGenerating(true);
    try {
      const data = await apiFetch('/api/quizzes/generate', {
        method: 'POST',
        body: JSON.stringify(quizForm),
      });
      setQuizQuestions(data.questions || []);
    } catch (err: any) {
      alert(`AI generation failed: ${err.message}. Showing fallback questions instead.`);
    } finally {
      setAiGenerating(false);
    }
  };

  // Save Quiz
  const handleSaveQuiz = async () => {
    if (quizQuestions.length === 0) {
      alert('Your quiz must have at least one question!');
      return;
    }
    try {
      const payload = {
        title: quizForm.title,
        topic: quizForm.topic,
        gradeLevel: quizForm.gradeLevel,
        difficulty: quizForm.difficulty,
        questionType: quizForm.questionType,
        questions: quizQuestions,
      };

      if (editingQuizId) {
        await apiFetch(`/api/quizzes/${editingQuizId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/quizzes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsCreating(false);
      setEditingQuizId(null);
      setQuizQuestions([]);
      setQuizForm({
        title: '',
        topic: '',
        gradeLevel: 'Grade 8',
        difficulty: 'medium',
        questionType: 'MCQ',
        numQuestions: 5,
      });
      fetchQuizzes();
      fetchAnalytics();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await apiFetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      fetchQuizzes();
      fetchAnalytics();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditQuizClick = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setQuizForm({
      title: quiz.title,
      topic: quiz.topic,
      gradeLevel: quiz.gradeLevel,
      difficulty: quiz.difficulty,
      questionType: quiz.questionType,
      numQuestions: quiz.questions.length,
    });
    setQuizQuestions(quiz.questions);
    setIsCreating(true);
  };

  // Single Question AI Regeneration
  const handleRegenerateQuestionWithAI = async (idx: number) => {
    const originalId = quizQuestions[idx].id;
    // Set a temporary loading flag or visual cue
    const originalQuestions = [...quizQuestions];
    try {
      // Temporarily set a loading text
      const questionsWithLoading = [...quizQuestions];
      questionsWithLoading[idx] = {
        ...questionsWithLoading[idx],
        question: '🤖 AI is regenerating this question... Please wait.',
      };
      setQuizQuestions(questionsWithLoading);

      const excludeTexts = originalQuestions.map((q) => q.question);
      const data = await apiFetch('/api/quizzes/regenerate-question', {
        method: 'POST',
        body: JSON.stringify({
          topic: quizForm.topic,
          gradeLevel: quizForm.gradeLevel,
          difficulty: quizForm.difficulty,
          questionType: quizForm.questionType,
          excludeQuestions: excludeTexts,
        }),
      });

      if (data.success && data.question) {
        const updated = [...originalQuestions];
        updated[idx] = { ...data.question, id: originalId };
        setQuizQuestions(updated);
      } else {
        throw new Error('Could not regenerate');
      }
    } catch (e) {
      alert('AI regeneration failed. Restored original question.');
      setQuizQuestions(originalQuestions);
    }
  };

  // Socket Connection & Real-Time Rooms
  const setupSocket = () => {
    if (socket) return socket;
    const s = io();
    
    s.on('join_success', (data: any) => {
      setJoinSuccessData(data);
      setSession(data.session);
      setErrorMessage('');
      setStudentFinished(false);
      setStudentResults(null);
      if (data.role === 'student') {
        setRole('student');
      }
    });

    s.on('error_message', (msg: string) => {
      setErrorMessage(msg);
      s.disconnect();
    });

    s.on('room_update', (updatedSession: LiveSession) => {
      setSession(updatedSession);
    });

    s.on('quiz_started', (data: any) => {
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.currentQuestionIndex);
      setTotalQuestions(data.totalQuestions);
      setTimeLeft(data.questionDuration);
      setAnswerSubmitted(false);
      setSelectedAnswer('');
      setRoundEndedData(null);
      setAnsweredCount(0);
      questionStartRef.current = Date.now();
      
      setSession((prev: any) => {
        if (!prev) return null;
        return { ...prev, status: 'active', questionActive: true };
      });
    });

    s.on('new_question', (data: any) => {
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.currentQuestionIndex);
      setTotalQuestions(data.totalQuestions);
      setTimeLeft(data.questionDuration);
      setAnswerSubmitted(false);
      setSelectedAnswer('');
      setRoundEndedData(null);
      setAnsweredCount(0);
      questionStartRef.current = Date.now();
    });

    s.on('answer_submitted', (data: any) => {
      setAnsweredCount(data.answeredCount);
    });

    s.on('round_ended', (data: any) => {
      setRoundEndedData(data);
      setSession((prev: any) => {
        if (!prev) return null;
        return { 
          ...prev, 
          questionActive: false,
          participants: data.participants 
        };
      });
    });

    s.on('student_quiz_completed', (data: any) => {
      setStudentFinished(true);
      setStudentResults(data);
      setSession((prev: any) => {
        if (!prev) return null;
        return { 
          ...prev, 
          status: 'ended'
        };
      });
    });

    s.on('quiz_ended', (data: any) => {
      setRoundEndedData(null);
      setJoinSuccessData(null);
      setSession((prev: any) => {
        if (!prev) return null;
        return { 
          ...prev, 
          status: 'ended', 
          participants: data.participants 
        };
      });
    });

    setSocket(s);
    return s;
  };

  // Student joining room
  const handleStudentJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !studentName) {
      setErrorMessage('Room code and name are required.');
      return;
    }
    const s = setupSocket();
    s.emit('join_room', { roomCode, name: studentName });
  };

  // Teacher Go Live with Quiz
  const handleGoLive = async (quizId: string) => {
    try {
      const data = await apiFetch('/api/sessions/create', {
        method: 'POST',
        body: JSON.stringify({ quizId }),
      });
      
      const s = setupSocket();
      s.emit('join_room', { roomCode: data.roomCode, isTeacher: true });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Answer (Student Side)
  const handleSubmitAnswer = (answer: string) => {
    if (answerSubmitted) return;
    const responseTimeMs = Date.now() - questionStartRef.current;
    setSelectedAnswer(answer);
    setAnswerSubmitted(true);
    
    socket?.emit('submit_answer', {
      roomCode: session?.roomCode,
      answer,
      responseTimeMs,
    });
  };

  // Manual End Round (Teacher Side)
  const handleEndRoundManual = () => {
    socket?.emit('end_round', { roomCode: session?.roomCode });
  };

  // Go to Next Question (Teacher Side)
  const handleNextQuestion = () => {
    socket?.emit('next_question', { roomCode: session?.roomCode });
  };

  // Exit Quiz / Back to Dashboard
  const handleExitQuiz = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setSession(null);
    setJoinSuccessData(null);
    setCurrentQuestion(null);
    setRoundEndedData(null);
    fetchHistory();
    fetchAnalytics();
    setRole('teacher');
  };

  // Generate CSV/Excel simulation data download
  const downloadResultsCSV = (res: QuizResultSummary) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Name,Score,Correct Answers,Total Questions,Accuracy\n";
    
    res.participants.forEach((p) => {
      const accuracy = Math.round((p.correctCount / p.totalCount) * 100);
      csvContent += `"${p.name}",${p.score},${p.correctCount},${p.totalCount},${accuracy}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${res.quizTitle.replace(/\s+/g, '_')}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="root-app" className="min-h-screen bg-[#060b13] text-slate-100 font-sans flex flex-col antialiased selection:bg-cyan-400 selection:text-slate-950">
      {/* Premium CourseAgent Header Bar */}
      <header id="header-bar" className="bg-[#0b101b]/90 border-b border-slate-800/80 py-4 px-6 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            id="brand-logo" 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => { if (!session) setRole(null); }}
          >
            {/* Custom high-fidelity polygonal CourseAgent Logo icon */}
            <div className="relative w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/10 group-hover:scale-105 transition-all duration-300">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <div className="absolute -inset-0.5 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl blur-sm opacity-35 group-hover:opacity-60 transition duration-300"></div>
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <span className="font-display font-black text-2xl tracking-tight text-white">
                  Course<span className="text-cyan-400">Agent</span>
                </span>
              </div>
              <span className="hidden sm:inline text-[10px] text-slate-400 block -mt-1 font-bold uppercase tracking-widest">AI Quiz Platform</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-7 text-sm font-semibold text-slate-300">
            <span className="hover:text-white transition cursor-pointer flex items-center space-x-1">
              <span>Product</span>
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </span>
            <span className="hover:text-white transition cursor-pointer flex items-center space-x-1">
              <span>Solutions</span>
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </span>
            <span className="hover:text-white transition cursor-pointer">Pricing</span>
            <span className="hover:text-white transition cursor-pointer">Compare</span>
            <span className="hover:text-white transition cursor-pointer">FAQ</span>
            <span className="hover:text-white transition cursor-pointer">Blog</span>
            <span className="hover:text-white transition cursor-pointer">About</span>
            <span className="hover:text-white transition cursor-pointer">Contact</span>
          </nav>

          <div className="flex items-center space-x-4">
            {/* Owl Mascot Indicator in Menu */}
            <div className="w-8 h-8 rounded-full bg-[#15233c] border border-slate-700/60 flex items-center justify-center text-cyan-400" title="Mascot Helper Active">
              <span className="text-lg">🦉</span>
            </div>

            {/* Audio Toggle */}
            <button 
              id="btn-sound-toggle"
              onClick={() => setSoundEnabled(!soundEnabled)} 
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors"
              title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Premium trial pill button */}
            <button 
              onClick={() => { if (!session) setRole(null); }}
              className="hidden md:inline-flex bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-cyan-500/10 transition-all duration-300 flex items-center space-x-1"
            >
              <span>Start free trial</span>
              <span className="bg-yellow-400 text-slate-950 font-black px-1.5 py-0.5 rounded text-[8px] tracking-wide uppercase">BETA</span>
            </button>

            {role === 'teacher' && teacherEmail && (
              <div id="teacher-profile-badge" className="flex items-center space-x-2.5 bg-[#121c30] border border-slate-700/60 px-3 py-1.5 rounded-full">
                <div className="w-6.5 h-6.5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 font-extrabold flex items-center justify-center text-xs shadow-inner">
                  {teacherEmail[0].toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-300 hidden md:inline">{teacherEmail}</span>
                <button 
                  id="btn-teacher-logout"
                  onClick={handleLogout} 
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-full transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            
            {role === 'student' && studentName && (
              <div id="student-profile-badge" className="flex items-center space-x-2 bg-[#0d2822] text-emerald-400 border border-[#1b4332] px-3.5 py-1.5 rounded-full text-xs font-bold">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span>{studentName} (Student)</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col relative z-10">
        
        {/* =========================================================================
             SCREEN 1: ROLE SELECTION & LANDING (CourseAgent Premium Hero Redesign)
           ========================================================================= */}
        {!role && !session && (
          <div id="screen-landing" className="flex-1 flex flex-col items-center justify-center py-6 space-y-12 animate-fade-in">
            
            {/* Background glowing ambient elements */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Hero Text Content Block */}
            <div className="max-w-4xl text-center space-y-6 pt-4">
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-[#102237] text-cyan-400 border border-cyan-500/20 mb-2 uppercase tracking-widest shadow-sm shadow-cyan-500/5">
                ✦ AI QUIZ GENERATOR
              </span>
              <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-white tracking-tight leading-[1.1] max-w-3xl mx-auto">
                AI Quiz Generator that tests what the course actually taught.
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Generate balanced quizzes aligned to your learning objectives – 12+ question types, 
                distributed across Bloom's cognitive levels, with distractors written to test 
                understanding. Part of the <span className="text-cyan-400 font-semibold underline decoration-cyan-500/40 cursor-pointer">CourseAgent AI authoring</span> environment.
              </p>

              {/* Action Buttons to scroll to panel */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <button 
                  onClick={() => {
                    const el = document.getElementById('join-panel-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-white hover:bg-slate-100 text-[#060b13] font-bold px-7 py-3.5 rounded-full shadow-xl shadow-white/5 hover:shadow-cyan-400/10 hover:scale-[1.02] transition-all duration-300 flex items-center space-x-2"
                >
                  <span>Start free trial</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById('types-showcase-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-transparent hover:bg-slate-800/40 text-slate-200 border border-slate-700/80 hover:border-slate-500 font-semibold px-7 py-3.5 rounded-full transition-all duration-300"
                >
                  See the full authoring tool
                </button>
              </div>
            </div>

            {/* SECTION: 12+ Question Types Showcase Section (Screenshot 2) */}
            <div id="types-showcase-section" className="w-full max-w-4xl bg-[#09101f]/80 border border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl relative">
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
                  12+ question types
                </h2>
                <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
                  The generator picks types to match the cognitive level being tested. Click any type to see its AI configuration!
                </p>
              </div>

              {/* Tag Wall Grid */}
              <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
                {[
                  { label: "Multiple choice", desc: "Multiple Choice: Auto-generates balanced multiple choice questions with 4 plausible options, optimized by AI to minimize guessing and test active knowledge." },
                  { label: "Multiple response", desc: "Multiple Response: AI designs questions with multiple valid answers to test deep conceptual understanding and prevent memorized patterns." },
                  { label: "True / false", desc: "True / False: Creates nuanced statements where subtle distinctions require rigorous evaluation to correctly assess as True or False." },
                  { label: "Fill in the blank", desc: "Fill in the Blank: Constructs highly contexts-specific sentences where students must recall the precise academic terminology." },
                  { label: "Short answer", desc: "Short Answer: Generates prompt-driven evaluation where students input text directly, assessed via robust AI semantic keyword matching." },
                  { label: "Matching", desc: "Matching: Builds an interactive multi-column puzzle requiring students to associate vocabulary with correct definitions, historical periods, or scientific formulas." },
                  { label: "Ordering", desc: "Ordering: AI creates dynamic sequence challenges (chronological events, algorithmic steps, process flows) to test procedural comprehension." },
                  { label: "Drag and drop", desc: "Drag and Drop: Configures interactive canvas cards where concepts are placed in correct structural slots, ideal for visual curriculum items." },
                  { label: "Scenario-based", desc: "Scenario-Based: Synthesizes real-world case studies with complex problems where students apply multi-step analytical reasoning." },
                  { label: "Branching scenario", desc: "Branching Scenario: Creates multi-level interactive tree stories where each decision leads to progressive consequences, teaching risk analysis." },
                  { label: "Hotspot", desc: "Hotspot: Generates diagrammatic or visual reference challenges where students identify structural coordinate zones (anatomy, maps, machinery)." },
                  { label: "Drop-down", desc: "Drop-down: Embeds inline drop-down options inside complex paragraphs to evaluate contextual reading comprehension and grammar." }
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setSelectedTypeExplanation(selectedTypeExplanation === item.desc ? null : item.desc);
                    }}
                    className={`px-4.5 py-2.5 rounded-full border text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center space-x-2 cursor-pointer hover:scale-102 ${
                      selectedTypeExplanation === item.desc 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-500/5'
                        : 'bg-[#0f192b]/90 text-slate-300 border-slate-800/80 hover:bg-slate-800/60 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <span className="text-cyan-400 opacity-80 text-[10px]">❓</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Type Explanation Popover/Box */}
              {selectedTypeExplanation && (
                <div className="mt-6 p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-[#0e1628] border border-cyan-500/30 rounded-2xl animate-fade-in text-center max-w-2xl mx-auto">
                  <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">Interactive AI Feature Note</div>
                  <p className="text-sm text-slate-200 font-medium leading-relaxed">{selectedTypeExplanation}</p>
                </div>
              )}
            </div>

            {/* SELECTION LOBBY & PORTALS SECTION */}
            <div id="join-panel-section" className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl pt-4">
              {/* STUDENT SIDE */}
              <div id="card-student-entry" className="bg-[#0b1221] rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col hover:border-slate-700 transition-all duration-300 group">
                <div className="flex justify-between items-center mb-6">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <Trophy className="w-8 h-8" />
                  </div>
                  {/* High fidelity pill selector tabs */}
                  <div className="bg-[#070c14] border border-slate-800 p-1 rounded-xl flex space-x-1">
                    <button
                      type="button"
                      onClick={() => setStudentCardMode('live')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${studentCardMode === 'live' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                      Live Game
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentCardMode('practice')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${studentCardMode === 'practice' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                      Practice Solo
                    </button>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  {studentCardMode === 'live' ? 'Join a Live Quiz' : 'Curriculum Solo Practice'}
                </h2>
                <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                  {studentCardMode === 'live' 
                    ? 'Got a room code from your teacher? Enter it below with your nickname to jump straight into the challenge!' 
                    : 'Select from our 10 primary school topics to practice and verify your conceptual understanding individually.'}
                </p>

                {studentCardMode === 'live' ? (
                  <form onSubmit={handleStudentJoin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Room Code</label>
                      <input 
                        id="input-room-code"
                        type="text" 
                        placeholder="e.g. A8D9X1"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-3 text-center font-bold tracking-widest text-lg text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your Name</label>
                      <input 
                        id="input-student-name"
                        type="text" 
                        placeholder="e.g. Liam, Chloe"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition font-medium"
                      />
                    </div>
                    {errorMessage && (
                      <div className="flex items-center space-x-2 text-rose-400 text-sm bg-rose-950/40 border border-rose-900/50 p-3 rounded-xl">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="font-semibold">{errorMessage}</span>
                      </div>
                    )}
                    <button 
                      id="btn-join-room-submit"
                      type="submit" 
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/20 hover:scale-102 transition-all cursor-pointer"
                    >
                      <span>Enter Live Game</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your Name</label>
                      <input 
                        id="input-student-practice-name"
                        type="text" 
                        placeholder="e.g. Liam, Chloe"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Select Quiz Topic</label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {Object.keys(TOPIC_QUIZZES).map((topic) => (
                          <button
                            type="button"
                            key={topic}
                            onClick={() => setSelectedPracticeTopic(topic)}
                            className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all text-left ${
                              selectedPracticeTopic === topic 
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40 shadow-inner' 
                                : 'bg-[#070c14] text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button 
                      id="btn-start-practice"
                      type="button"
                      onClick={() => handleStartSoloQuiz(selectedPracticeTopic)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/20 hover:scale-102 transition-all cursor-pointer"
                    >
                      <span>Start Solo Practice</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* TEACHER SIDE */}
              <div id="card-teacher-entry" className="bg-[#0b1221] rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col hover:border-slate-700 transition-all duration-300 group">
                <div className="w-14 h-14 bg-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-center shadow-inner mb-6 group-hover:scale-105 transition-transform duration-300">
                  <UserCheck className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Teacher Panel</h2>
                <p className="text-slate-300 mb-6 flex-1 text-sm leading-relaxed">
                  Create beautiful, customized quizzes aligned with your grade curriculum using AI, track average class score accuracy, and manage your lobby.
                </p>

                <div className="space-y-4 pt-4 mt-auto">
                  <button 
                    id="btn-go-to-teacher-login"
                    onClick={() => { setRole('teacher'); setAuthMode('login'); }}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-cyan-950/30 hover:scale-102 transition-all cursor-pointer"
                  >
                    <span>Teacher Login / Sign Up</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    Use our demo account: <span className="font-semibold text-slate-300">teacher@school.edu</span> (password: <span className="font-semibold text-slate-300">password123</span>)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 2: TEACHER AUTHENTICATION
           ========================================================================= */}
        {role === 'teacher' && !token && (
          <div id="screen-teacher-auth" className="flex-1 flex items-center justify-center py-10">
            <div className="bg-[#0b1221] rounded-3xl p-8 border border-slate-800 shadow-2xl shadow-black/40 w-full max-w-md">
              <button 
                id="btn-auth-back"
                onClick={() => setRole(null)} 
                className="flex items-center space-x-1.5 text-sm font-semibold text-slate-400 hover:text-cyan-400 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go Back</span>
              </button>

              <h2 className="text-2xl font-display font-extrabold text-white mb-1">
                {authMode === 'login' ? 'Teacher Log In' : 'Create Teacher Account'}
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                {authMode === 'login' ? 'Access your AI-generated quizzes and class histories' : 'Sign up for free and start generating custom quizzes'}
              </p>

              {authError && (
                <div className="bg-rose-950/40 border border-rose-900/50 text-rose-400 rounded-xl p-3.5 text-sm font-semibold mb-4 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input 
                    id="input-auth-email"
                    type="email" 
                    required
                    placeholder="e.g. teacher@school.edu"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <input 
                    id="input-auth-password"
                    type="password" 
                    required
                    placeholder="Minimum 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition font-medium"
                  />
                </div>

                <button 
                  id="btn-auth-submit"
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-cyan-950/30 hover:scale-102 transition-all cursor-pointer"
                >
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                <button 
                  id="btn-toggle-auth-mode"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 3: TEACHER DASHBOARD (QUIZZES, HISTORY, ANALYTICS)
           ========================================================================= */}
        {role === 'teacher' && token && !isCreating && !session && (
          <div id="screen-teacher-dashboard" className="space-y-6 flex-1 flex flex-col">
            
            {/* Dashboard Subheader Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-display font-extrabold text-white">CourseAgent Instructor Console</h1>
                <p className="text-sm text-slate-400">Design, test, and host real-time interactive learning quizzes.</p>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button 
                  id="btn-tab-quizzes"
                  onClick={() => setActiveTab('quizzes')}
                  className={`px-4.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'quizzes' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
                >
                  Quizzes
                </button>
                <button 
                  id="btn-tab-history"
                  onClick={() => setActiveTab('history')}
                  className={`px-4.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
                >
                  Session History
                </button>
                <button 
                  id="btn-tab-analytics"
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
                >
                  Performance Analytics
                </button>
              </div>
            </div>

            {/* TAB CONTENT: QUIZZES */}
            {activeTab === 'quizzes' && (
              <div id="tab-quizzes-content" className="space-y-6 flex-1">
                <div className="flex justify-between items-center bg-[#0b1221] p-4.5 rounded-2xl border border-slate-800/80 shadow-xl">
                  <span className="text-sm font-semibold text-slate-400">
                    You have <span className="font-extrabold text-cyan-400">{quizzes.length}</span> created quizzes.
                  </span>
                  <button 
                    id="btn-create-new-quiz-action"
                    onClick={() => {
                      setEditingQuizId(null);
                      setQuizQuestions([]);
                      setQuizForm({
                        title: '',
                        topic: '',
                        gradeLevel: 'Grade 8',
                        difficulty: 'medium',
                        questionType: 'MCQ',
                        numQuestions: 5,
                      });
                      setIsCreating(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 shadow-md shadow-cyan-950/20 hover:scale-102 transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Quiz with AI</span>
                  </button>
                </div>

                {quizzes.length === 0 ? (
                  <div className="bg-[#0b1221] border border-dashed border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto my-10">
                    <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">No Quizzes Found</h3>
                    <p className="text-sm text-slate-400 mb-6">
                      Click the button below to generate a curriculum-aligned quiz in seconds with our AI integration.
                    </p>
                    <button 
                      id="btn-empty-create-quiz"
                      onClick={() => setIsCreating(true)}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-5 py-2.5 rounded-xl inline-flex items-center space-x-1.5 hover:scale-102 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Start AI Generator</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz) => (
                      <div 
                        key={quiz.id} 
                        id={`quiz-card-${quiz.id}`}
                        className="bg-[#0b1221] border border-slate-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:border-slate-700 transition flex flex-col relative group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            quiz.difficulty === 'easy' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' :
                            quiz.difficulty === 'medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40' : 'bg-rose-950/40 text-rose-400 border border-rose-900/40'
                          }`}>
                            {quiz.difficulty}
                          </span>
                          <span className="text-xs font-bold text-slate-300 bg-[#121d31] px-2.5 py-0.5 rounded-full border border-slate-800">
                            {quiz.gradeLevel}
                          </span>
                        </div>

                        <h3 className="font-display font-extrabold text-lg text-white mb-1 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                          {quiz.title}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mb-4">
                          Topic: <span className="text-slate-200 font-bold">{quiz.topic}</span> | Type: <span className="text-slate-200 font-bold">{quiz.questionType}</span>
                        </p>

                        <div className="bg-[#070c14] border border-slate-800/50 rounded-xl p-3 mb-4 flex justify-between text-xs font-semibold text-slate-400 text-center">
                          <div>
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">Questions</span>
                            <span className="text-white text-sm font-bold">{quiz.questions.length}</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">Created</span>
                            <span className="text-white text-[11px]">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mt-auto pt-2">
                          <button 
                            id={`btn-go-live-${quiz.id}`}
                            onClick={() => handleGoLive(quiz.id)}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md shadow-emerald-950/20 hover:scale-[1.02] transition-all cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Go Live Session</span>
                          </button>
                          
                          <button 
                            id={`btn-edit-quiz-${quiz.id}`}
                            onClick={() => handleEditQuizClick(quiz)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl hover:text-cyan-400 transition-colors"
                            title="Edit Quiz questions"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button 
                            id={`btn-delete-quiz-${quiz.id}`}
                            onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                            className="bg-slate-800 hover:bg-rose-950/50 text-slate-400 p-2.5 rounded-xl hover:text-rose-400 transition-colors border border-transparent hover:border-rose-900/40"
                            title="Delete Quiz"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {activeTab === 'history' && (
              <div id="tab-history-content" className="space-y-6 flex-1">
                {results.length === 0 ? (
                  <div className="bg-[#0b1221] border border-dashed border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto my-10 animate-fade-in">
                    <div className="w-16 h-16 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">No Session History Yet</h3>
                    <p className="text-sm text-slate-400">
                      Once your students complete a live quiz session, their score breakdowns and performance rankings will be stored here.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0b1221] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 bg-[#0f192b] flex justify-between items-center">
                      <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wider">Completed Sessions</h3>
                      <span className="text-xs font-bold text-cyan-400 uppercase bg-[#14233e] px-2.5 py-0.5 rounded-full border border-slate-800">
                        {results.length} Sessions Saved
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800 overflow-x-auto">
                      {results.map((res) => (
                        <div key={res.id} id={`history-row-${res.id}`} className="p-6 hover:bg-[#0f172a]/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-[600px]">
                          <div className="space-y-1">
                            <h4 className="font-display font-extrabold text-white text-base">{res.quizTitle}</h4>
                            <p className="text-xs text-slate-400 font-semibold">
                              Date: <span className="text-slate-200 font-bold">{new Date(res.timestamp).toLocaleString()}</span> | Session ID: <span className="text-cyan-400">{res.id}</span>
                            </p>
                          </div>

                          <div className="flex items-center space-x-8">
                            <div className="text-center">
                              <span className="block text-[10px] text-slate-500 font-bold uppercase">Participants</span>
                              <span className="font-extrabold text-white text-sm flex items-center justify-center space-x-1.5 mt-0.5">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <span>{res.totalParticipants}</span>
                              </span>
                            </div>

                            <div className="text-center">
                              <span className="block text-[10px] text-slate-500 font-bold uppercase">Average Accuracy</span>
                              <span className="font-extrabold text-emerald-400 text-sm block mt-0.5">
                                {res.averageScore} pts
                              </span>
                            </div>

                            <button 
                              id={`btn-download-csv-${res.id}`}
                              onClick={() => downloadResultsCSV(res)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>CSV Export</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: ANALYTICS */}
            {activeTab === 'analytics' && (
              <div id="tab-analytics-content" className="space-y-6 flex-1">
                {analytics ? (
                  <div className="space-y-6">
                    {/* Key Metric Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-[#0b1221] border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                          <Brain className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400 font-bold uppercase">Total Quizzes</span>
                          <span className="text-2xl font-extrabold text-white">{analytics.totalQuizzes}</span>
                        </div>
                      </div>

                      <div className="bg-[#0b1221] border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                          <Play className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400 font-bold uppercase">Live Sessions Run</span>
                          <span className="text-2xl font-extrabold text-white">{analytics.totalSessions}</span>
                        </div>
                      </div>

                      <div className="bg-[#0b1221] border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400 font-bold uppercase">Total Participants</span>
                          <span className="text-2xl font-extrabold text-white">{analytics.totalParticipants}</span>
                        </div>
                      </div>

                      <div className="bg-[#0b1221] border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400 font-bold uppercase">Class Average</span>
                          <span className="text-2xl font-extrabold text-white">{analytics.averageScore} <span className="text-xs font-normal text-slate-400">pts</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Weakest Topics List */}
                    <div className="bg-[#0b1221] border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                        <div>
                          <h3 className="font-display font-extrabold text-white text-lg">Curriculum Topic Performance</h3>
                          <p className="text-xs text-slate-400">Track accuracy rates per subject topic to identify weak class concepts.</p>
                        </div>
                        <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full font-bold">
                          AI Classroom Diagnosis
                        </span>
                      </div>

                      {analytics.weakestTopics.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-6">No historical data yet. Run live quizzes to populate analytics.</p>
                      ) : (
                        <div className="space-y-5">
                          {analytics.weakestTopics.map((stat) => (
                            <div key={stat.topic} className="space-y-2">
                              <div className="flex justify-between items-center text-sm font-semibold">
                                <span className="text-slate-200">{stat.topic}</span>
                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                  stat.accuracy >= 75 ? 'bg-emerald-950/40 text-emerald-400' :
                                  stat.accuracy >= 50 ? 'bg-amber-950/40 text-amber-400' : 'bg-rose-950/40 text-rose-400'
                                }`}>
                                  {stat.accuracy}% Accuracy
                                </span>
                              </div>
                              <div className="w-full bg-[#070c14] h-2.5 rounded-full overflow-hidden border border-slate-800">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    stat.accuracy >= 75 ? 'bg-emerald-500' :
                                    stat.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${stat.accuracy}%` }}
                                ></div>
                              </div>
                              <p className="text-[11px] text-slate-500 font-semibold">
                                Collected from {stat.correct} correct answers out of {stat.total} total answered questions.
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Loading analytics...</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
             SCREEN 4: QUIZ CREATION / AI QUESTION EDITOR
           ========================================================================= */}
        {role === 'teacher' && isCreating && (
          <div id="screen-quiz-creator" className="space-y-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <button 
                  id="btn-creator-back"
                  onClick={() => { setIsCreating(false); setEditingQuizId(null); }}
                  className="bg-slate-800 hover:bg-slate-700 p-2.5 rounded-xl transition text-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-2xl font-display font-extrabold text-white">
                    {editingQuizId ? 'Edit AI Quiz Questions' : 'AI Curriculum Quiz Builder'}
                  </h1>
                  <p className="text-xs text-slate-400">Configure parameters and let CourseAgent AI generate custom curriculum questions.</p>
                </div>
              </div>
              <button 
                id="btn-quiz-save-action"
                onClick={handleSaveQuiz}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-5 py-2.5 rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-950/20 hover:scale-102 transition-all cursor-pointer text-xs sm:text-sm"
              >
                <Check className="w-4 h-4" />
                <span>Save & Publish Quiz</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Generator Configuration Sidebar */}
              <div className="bg-[#0b1221] border border-slate-800 p-6 rounded-2xl shadow-xl h-fit space-y-4">
                <h3 className="font-display font-bold text-cyan-400 text-sm uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>AI Config Settings</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Quiz Title</label>
                    <input 
                      id="input-form-title"
                      type="text" 
                      placeholder="e.g. Intro to Ancient Rome"
                      value={quizForm.title}
                      onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                      className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Curriculum Topic</label>
                    <input 
                      id="input-form-topic"
                      type="text" 
                      placeholder="e.g. Roman Empire, Julius Caesar"
                      value={quizForm.topic}
                      onChange={(e) => setQuizForm({ ...quizForm, topic: e.target.value })}
                      className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Grade level</label>
                      <select 
                        id="select-form-grade"
                        value={quizForm.gradeLevel}
                        onChange={(e) => setQuizForm({ ...quizForm, gradeLevel: e.target.value })}
                        className="w-full bg-[#070c14] border border-slate-800 text-slate-100 rounded-xl px-3 py-2.5 focus:bg-[#09101d] text-sm outline-none transition font-semibold"
                      >
                        <option className="bg-[#0b1221]">Elementary</option>
                        <option className="bg-[#0b1221]">Grade 6</option>
                        <option className="bg-[#0b1221]">Grade 7</option>
                        <option className="bg-[#0b1221]">Grade 8</option>
                        <option className="bg-[#0b1221]">High School</option>
                        <option className="bg-[#0b1221]">University</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Difficulty</label>
                      <select 
                        id="select-form-difficulty"
                        value={quizForm.difficulty}
                        onChange={(e) => setQuizForm({ ...quizForm, difficulty: e.target.value as any })}
                        className="w-full bg-[#070c14] border border-slate-800 text-slate-100 rounded-xl px-3 py-2.5 focus:bg-[#09101d] text-sm outline-none transition font-semibold"
                      >
                        <option value="easy" className="bg-[#0b1221]">Easy</option>
                        <option value="medium" className="bg-[#0b1221]">Medium</option>
                        <option value="hard" className="bg-[#0b1221]">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Question Type</label>
                      <select 
                        id="select-form-type"
                        value={quizForm.questionType}
                        onChange={(e) => setQuizForm({ ...quizForm, questionType: e.target.value as any })}
                        className="w-full bg-[#070c14] border border-slate-800 text-slate-100 rounded-xl px-3 py-2.5 focus:bg-[#09101d] text-sm outline-none transition font-semibold"
                      >
                        <option value="MCQ" className="bg-[#0b1221]">MCQ (4 options)</option>
                        <option value="True-False" className="bg-[#0b1221]">True-False</option>
                        <option value="Short Answer" className="bg-[#0b1221]">Short Answer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Count</label>
                      <input 
                        id="input-form-count"
                        type="number" 
                        min={1}
                        max={15}
                        value={quizForm.numQuestions}
                        onChange={(e) => setQuizForm({ ...quizForm, numQuestions: parseInt(e.target.value) || 5 })}
                        className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:bg-[#09101d] focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <button 
                    id="btn-trigger-ai-generate"
                    onClick={generateQuestionsWithAI}
                    disabled={aiGenerating}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {aiGenerating ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Generating questions...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 fill-current animate-pulse-slow" />
                        <span>Generate with CourseAgent AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Questions Editor Workspace */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#0b1221] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <h3 className="font-display font-extrabold text-white text-base">Questions Stack ({quizQuestions.length})</h3>
                    <button 
                      id="btn-add-question-manually"
                      onClick={() => {
                        const newQ: Question = {
                          id: `manual-q-${Date.now()}`,
                          question: 'Enter your new manually created question text here...',
                          options: quizForm.questionType === 'MCQ' ? ['A', 'B', 'C', 'D'] : quizForm.questionType === 'True-False' ? ['True', 'False'] : [],
                          correctAnswer: quizForm.questionType === 'True-False' ? 'True' : 'A',
                          explanation: 'Enter a detailed study explanation here.',
                          difficulty: quizForm.difficulty,
                        };
                        setQuizQuestions([...quizQuestions, newQ]);
                      }}
                      className="text-xs font-extrabold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Custom Question</span>
                    </button>
                  </div>

                  {quizQuestions.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <Brain className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-sm">No questions in stack yet. Configure options on the left sidebar and click "Generate with CourseAgent AI".</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {quizQuestions.map((q, idx) => (
                        <div key={q.id} className="border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition space-y-3 bg-[#070c14]">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-xs text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2.5 py-1 rounded-full">
                              Question {idx + 1}
                            </span>
                            <div className="flex items-center space-x-2">
                              <button 
                                id={`btn-regen-single-${idx}`}
                                onClick={() => handleRegenerateQuestionWithAI(idx)}
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-2 py-1 rounded-md flex items-center space-x-1 transition-all"
                                title="Regenerate this question only using CourseAgent AI"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Regenerate AI</span>
                              </button>
                              
                              <button 
                                id={`btn-delete-single-${idx}`}
                                onClick={() => {
                                  if (confirm('Delete this question?')) {
                                    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <input 
                              type="text"
                              value={q.question}
                              onChange={(e) => {
                                const copy = [...quizQuestions];
                                copy[idx].question = e.target.value;
                                setQuizQuestions(copy);
                              }}
                              className="w-full bg-[#0b1221] border border-slate-800 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition text-white"
                            />
                            
                            {/* Options display */}
                            {q.options.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options.map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-center space-x-2 bg-[#0b1221] border border-slate-800 p-2 rounded-lg text-xs">
                                    <span className="font-bold text-cyan-400">
                                      {String.fromCharCode(65 + optIdx)}:
                                    </span>
                                    <input 
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const copy = [...quizQuestions];
                                        copy[idx].options[optIdx] = e.target.value;
                                        setQuizQuestions(copy);
                                      }}
                                      className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-slate-200 font-semibold"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Correct Answer & Explanation */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-0.5">Correct Answer</label>
                                {q.options.length > 0 ? (
                                  <select 
                                    value={q.correctAnswer}
                                    onChange={(e) => {
                                      const copy = [...quizQuestions];
                                      copy[idx].correctAnswer = e.target.value;
                                      setQuizQuestions(copy);
                                    }}
                                    className="w-full bg-[#0b1221] border border-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1.5 outline-none transition"
                                  >
                                    {q.options.map((opt) => (
                                      <option key={opt} value={opt} className="bg-[#0b1221]">{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input 
                                    type="text"
                                    value={q.correctAnswer}
                                    onChange={(e) => {
                                      const copy = [...quizQuestions];
                                      copy[idx].correctAnswer = e.target.value;
                                      setQuizQuestions(copy);
                                    }}
                                    className="w-full bg-[#0b1221] border border-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1.5 outline-none transition font-semibold"
                                  />
                                )}
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-0.5">AI Explanation Note</label>
                                <input 
                                  type="text"
                                  value={q.explanation}
                                  onChange={(e) => {
                                    const copy = [...quizQuestions];
                                    copy[idx].explanation = e.target.value;
                                    setQuizQuestions(copy);
                                  }}
                                  className="w-full bg-[#0b1221] border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-1.5 outline-none transition"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 5: LIVE QUIZ ROOM (TEACHER & STUDENT COMBINED LOBBY)
           ========================================================================= */}
        {session && session.status === 'lobby' && (
          <div id="screen-live-lobby" className="space-y-6 flex-1 flex flex-col items-center py-6">
            <div className="w-full max-w-2xl bg-[#0b1221] border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/10 text-center space-y-6 animate-fade-in">
              
              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-cyan-950/50 text-cyan-400 border border-cyan-800/40">
                  Quiz Game Lobby
                </span>
                <h1 className="text-3xl font-display font-extrabold text-white">{session.quizTitle}</h1>
                <p className="text-sm text-slate-400">Instruct your class students to join with the credentials below.</p>
              </div>

              {/* Lobby Code Display */}
              <div className="bg-[#070c14] border border-slate-800/80 rounded-2xl p-6 inline-block mx-auto">
                <span className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 font-mono">JOIN ROOM CODE</span>
                <span className="text-5xl font-mono font-extrabold text-cyan-400 tracking-widest">{session.roomCode}</span>
              </div>

              {/* Active Students Counts */}
              <div className="border-t border-b border-slate-800/80 py-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-display font-bold text-slate-200 text-base flex items-center space-x-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>Connected Students ({session.participants.length})</span>
                  </span>
                  <span className="text-xs text-cyan-400 font-semibold animate-pulse">Waiting for players to join...</span>
                </div>

                {session.participants.length === 0 ? (
                  <div className="py-8 bg-[#070c14]/40 rounded-2xl text-slate-500 text-sm font-semibold border border-slate-900">
                    No students have connected to this lobby yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {session.participants.map((player) => (
                      <div 
                        key={player.socketId} 
                        className="bg-[#111c30]/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-200 flex items-center justify-center space-x-2 animate-scale-up hover:border-slate-700 transition-colors"
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                        <span className="line-clamp-1">{player.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Start Controls */}
              <div className="flex justify-center space-x-4 pt-4">
                {joinSuccessData?.role === 'teacher' ? (
                  <>
                    <button 
                      id="btn-teacher-exit-lobby"
                      onClick={handleExitQuiz}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6 py-3 rounded-xl transition-all cursor-pointer text-sm"
                    >
                      Exit Session
                    </button>
                    <button 
                      id="btn-teacher-start-quiz"
                      onClick={() => socket?.emit('start_quiz', { roomCode: session.roomCode })}
                      disabled={session.participants.length === 0}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all cursor-pointer disabled:opacity-50 text-sm"
                    >
                      Start Classroom Quiz
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-cyan-400 animate-pulse">
                      Teacher is starting the quiz soon... Get ready!
                    </p>
                    <div className="flex justify-center space-x-1.5">
                      <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 6: TEACHER ACTIVE GAME PANEL
           ========================================================================= */}
        {role === 'teacher' && session && session.status === 'active' && (() => {
          const totalQuestionsCount = quizzes.find(q => q.id === session.quizId)?.questions.length || 0;
          const activeParticipants = session.participants || [];
          const classAverageScore = activeParticipants.length > 0
            ? Math.round(activeParticipants.reduce((sum, p) => sum + p.score, 0) / activeParticipants.length)
            : 0;

          let totalAnswersSubmitted = 0;
          let totalCorrectAnswers = 0;
          activeParticipants.forEach(p => {
            totalAnswersSubmitted += p.answers?.length || 0;
            totalCorrectAnswers += p.answers?.filter(a => a.isCorrect).length || 0;
          });

          const averageAccuracy = totalAnswersSubmitted > 0
            ? Math.round((totalCorrectAnswers / totalAnswersSubmitted) * 100)
            : 0;

          const totalPossibleAnswers = activeParticipants.length * totalQuestionsCount;
          const progressPercent = totalPossibleAnswers > 0
            ? Math.round((totalAnswersSubmitted / totalPossibleAnswers) * 100)
            : 0;

          return (
            <div id="screen-teacher-live-active" className="space-y-6 flex-1 flex flex-col max-w-4xl mx-auto py-6">
              <div className="bg-[#0b1221] border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/10 space-y-8 animate-fade-in">
                
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-2xl font-display font-extrabold text-white">Live Classroom Console</h2>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Self-paced Student Mode — Room: <span className="font-mono font-bold text-cyan-400">{session.roomCode}</span></p>
                  </div>
                  <button 
                    id="btn-teacher-force-end"
                    onClick={() => socket?.emit('end_quiz_force', { roomCode: session.roomCode })}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-6 py-2.5 rounded-xl shadow transition duration-200 text-xs sm:text-sm cursor-pointer"
                  >
                    End Session & Reveal Podium
                  </button>
                </div>

                {/* Stats Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#070c14] border border-slate-800/80 p-5 rounded-2xl space-y-1 text-center">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-slate-400">Active Students</span>
                    <span className="text-3xl font-black text-white">{session.participants.length}</span>
                  </div>
                  <div className="bg-[#070c14] border border-slate-800/80 p-5 rounded-2xl space-y-1 text-center">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-slate-400">Class Average Score</span>
                    <span className="text-3xl font-black text-cyan-400">{classAverageScore} pts</span>
                  </div>
                  <div className="bg-[#070c14] border border-slate-800/80 p-5 rounded-2xl space-y-1 text-center">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-slate-400">Class Average Accuracy</span>
                    <span className="text-3xl font-black text-emerald-400">{averageAccuracy}%</span>
                  </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="bg-[#070c14] border border-slate-800/80 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">Class Completion Progress</span>
                    <span className="text-cyan-400">{totalAnswersSubmitted} / {totalPossibleAnswers} questions answered ({progressPercent}%)</span>
                  </div>
                  <div className="w-full bg-[#0b1221] border border-slate-850 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all duration-350"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Live Student Table */}
                <div className="space-y-4">
                  <h3 className="font-display font-extrabold text-base text-slate-200 flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span>Student Progress & Leaderboard</span>
                  </h3>

                  <div className="bg-[#070c14] border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-[#0b1221]/40">
                            <th className="px-5 py-3">Rank</th>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">Progress</th>
                            <th className="px-5 py-3">Streak</th>
                            <th className="px-5 py-3 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {session.participants
                            .sort((a, b) => b.score - a.score)
                            .map((player: any, idx: number) => {
                              const playerProgress = player.answers?.length || 0;
                              const progressPct = totalQuestionsCount > 0 
                                ? Math.round((playerProgress / totalQuestionsCount) * 100) 
                                : 0;

                              return (
                                <tr key={player.socketId} className="text-sm font-semibold text-slate-300 hover:bg-[#0b1221]/10 transition-colors">
                                  <td className="px-5 py-3.5">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-xs ${
                                      idx === 0 ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' :
                                      idx === 1 ? 'bg-slate-800 text-slate-300' :
                                      idx === 2 ? 'bg-orange-950/60 text-orange-400 border border-orange-800/40' : 'text-slate-500'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 font-bold text-white">{player.name}</td>
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center space-x-3 min-w-40">
                                      <div className="w-24 bg-[#0b1221] border border-slate-850 h-2 rounded-full overflow-hidden">
                                        <div 
                                          className="bg-cyan-500 h-full rounded-full"
                                          style={{ width: `${progressPct}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-xs text-slate-400">{playerProgress} / {totalQuestionsCount}</span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    {player.streak > 1 ? (
                                      <span className="bg-rose-950/40 text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-rose-900/40 animate-pulse">
                                        🔥 {player.streak}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">—</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 text-right font-mono font-black text-cyan-400">{player.score} pts</td>
                                </tr>
                              );
                            })}
                          {session.participants.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-semibold">
                                No students in the lobby yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* =========================================================================
             SCREEN 7: TEACHER SHOWING QUESTION RESULTS & LIVE LEADERBOARD
           ========================================================================= */}
        {role === 'teacher' && session && session.status === 'showing_result' && roundEndedData && (
          <div id="screen-teacher-showing-results" className="space-y-6 flex-1 flex flex-col max-w-4xl mx-auto py-6">
            <div className="bg-[#0b1221] border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/10 space-y-6 animate-fade-in">
              
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="text-xs font-bold uppercase bg-violet-950/50 text-violet-400 px-3 py-1 rounded-full border border-violet-900/40">
                  Correct Answer Revealed
                </span>
                <h3 className="font-mono font-bold text-slate-500 text-sm">ROOM {session.roomCode}</h3>
              </div>

              {/* Reveal Body */}
              <div className="space-y-3 bg-[#0e172a] border border-cyan-500/20 p-6 rounded-2xl">
                <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider block">Correct Answer</span>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white flex items-center space-x-2">
                  <Check className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  <span>{roundEndedData.correctAnswer}</span>
                </h2>
                <div className="text-sm text-slate-300 border-t border-slate-800/80 pt-3 font-semibold">
                  <span className="font-extrabold text-white">AI explanation: </span>
                  {roundEndedData.explanation}
                </div>
              </div>

              {/* Answer Distribution bar chart */}
              <div className="space-y-4">
                <h3 className="font-display font-extrabold text-sm text-slate-200 uppercase tracking-wider">Answer Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(roundEndedData.stats as { [key: string]: number }).map(([opt, count]) => {
                    const statsObj = roundEndedData.stats as { [key: string]: number };
                    const totalAnswers = Object.values(statsObj).reduce((a: number, b: number) => a + b, 0) || 1;
                    const percent = Math.round((count / totalAnswers) * 100);
                    const isCorrect = opt === roundEndedData.correctAnswer;
                    
                    return (
                      <div key={opt} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className={`${isCorrect ? 'text-emerald-400 font-black' : 'text-slate-400'}`}>
                            {opt} {isCorrect && '✓'}
                          </span>
                          <span className="text-slate-400">{count} answers ({percent}%)</span>
                        </div>
                        <div className="w-full bg-[#070c14] border border-slate-800/80 h-3 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isCorrect ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboard Table Standings */}
              <div className="border-t border-slate-800 pt-6 space-y-4">
                <h3 className="font-display font-extrabold text-base text-slate-200 flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>Classroom Live Standings</span>
                </h3>

                <div className="bg-[#070c14] border border-slate-800 rounded-2xl p-4 divide-y divide-slate-800 max-h-60 overflow-y-auto">
                  {roundEndedData.participants.map((player: any, idx: number) => (
                    <div key={player.socketId} className="py-2.5 flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs ${
                          idx === 0 ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' :
                          idx === 1 ? 'bg-slate-800 text-slate-300' :
                          idx === 2 ? 'bg-orange-950/60 text-orange-400 border border-orange-800/40' : 'text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-200">{player.name}</span>
                        {player.streak > 1 && (
                          <span className="bg-rose-950/40 text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-rose-900/40 animate-pulse">
                            🔥 {player.streak} STREAK
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-black text-cyan-400">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>



            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 8: CLIENT / STUDENT ACTIVE QUESTION GAME
           ========================================================================= */}
        {role === 'student' && session && session.status === 'active' && currentQuestion && (
          <div id="screen-student-live-active" className="space-y-6 flex-1 flex flex-col max-w-2xl mx-auto py-6">
            
            <div className="bg-[#0b1221] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/10 space-y-6">
              
              {/* Question Header Progress & Timer */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2.5 py-1 rounded-full uppercase">
                  Stage {currentQuestionIndex + 1} of {totalQuestions}
                </span>

                <div className="flex items-center space-x-1 text-slate-300">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <span className="font-mono font-black text-lg text-white">{timeLeft}s</span>
                </div>
              </div>

              {/* Question text */}
              <div className="text-center py-4">
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Display answer options / inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {currentQuestion.options && currentQuestion.options.length > 0 ? (
                  currentQuestion.options.map((opt: string, idx: number) => {
                    const isSelected = selectedAnswer === opt;
                    const isCorrectAnswer = roundEndedData && opt === roundEndedData.correctAnswer;
                    
                    let optStyle = "";
                    if (answerSubmitted) {
                      if (roundEndedData) {
                        if (isCorrectAnswer) {
                          optStyle = "bg-emerald-950/40 border-emerald-500 text-emerald-300";
                        } else if (isSelected) {
                          optStyle = "bg-rose-950/40 border-rose-500 text-rose-300";
                        } else {
                          optStyle = "bg-[#070c14]/40 border-slate-900/60 text-slate-600 opacity-40 cursor-not-allowed";
                        }
                      } else {
                        // Submitted but no feedback yet
                        if (isSelected) {
                          optStyle = "bg-cyan-950/40 border-cyan-500 text-cyan-400 animate-pulse";
                        } else {
                          optStyle = "bg-[#070c14]/30 border-slate-900/40 text-slate-600 opacity-40 cursor-not-allowed";
                        }
                      }
                    } else {
                      // Standard colors before submit
                      optStyle = [
                        'bg-rose-600 hover:bg-rose-500 text-white border-rose-800 shadow-lg shadow-rose-950/30',
                        'bg-blue-600 hover:bg-blue-500 text-white border-blue-800 shadow-lg shadow-blue-950/30',
                        'bg-amber-600 hover:bg-amber-500 text-white border-amber-800 shadow-lg shadow-amber-950/30',
                        'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-800 shadow-lg shadow-emerald-950/30',
                      ][idx % 4];
                    }

                    const shapes = ['▲', '◆', '●', '■'];

                    return (
                      <button 
                        key={opt}
                        id={`btn-student-option-${idx}`}
                        disabled={answerSubmitted}
                        onClick={() => handleSubmitAnswer(opt)}
                        className={`p-5 rounded-2xl border-b-4 font-extrabold text-base transition-all transform active:scale-95 flex items-center space-x-3 cursor-pointer ${optStyle}`}
                      >
                        <span className="text-xl opacity-90">{shapes[idx % 4]}</span>
                        <span className="flex-1 text-left">{opt}</span>
                      </button>
                    );
                  })
                ) : (
                  // Short Answer Form
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const val = (e.currentTarget.elements.namedItem('shortAnswer') as HTMLInputElement).value;
                      handleSubmitAnswer(val);
                    }}
                    className="col-span-2 space-y-3"
                  >
                    <input 
                      id="input-student-short-answer"
                      name="shortAnswer"
                      type="text"
                      required
                      disabled={answerSubmitted}
                      placeholder="Type your answer here..."
                      className="w-full bg-[#070c14] border border-slate-800 rounded-xl px-4 py-3.5 focus:border-cyan-400 outline-none transition font-bold text-white placeholder-slate-600"
                    />
                    {!answerSubmitted && (
                      <button 
                        id="btn-student-short-submit"
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-cyan-950/20 cursor-pointer"
                      >
                        Submit Answer
                      </button>
                    )}
                  </form>
                )}
              </div>

              {/* Submitting/Waiting Screen if roundEndedData hasn't arrived */}
              {answerSubmitted && !roundEndedData && (
                <div className="bg-[#070c14]/50 border border-slate-800 rounded-2xl p-6 text-center space-y-2 animate-fade-in">
                  <div className="w-8 h-8 bg-cyan-950/50 text-cyan-400 border border-cyan-800/40 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">
                    Submitting answer... Loading feedback...
                  </p>
                </div>
              )}

              {/* Show feedback and next question button once feedback arrived */}
              {answerSubmitted && roundEndedData && (
                <>
                  <div className="bg-[#070c14]/50 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in text-left">
                    <div className="flex items-center space-x-2">
                      {selectedAnswer.trim().toLowerCase() === roundEndedData.correctAnswer.trim().toLowerCase() ? (
                        <span className="text-emerald-400 font-black text-sm uppercase tracking-wider bg-emerald-950/50 border border-emerald-900/40 px-3 py-1 rounded-full">Correct Answer! 🎉</span>
                      ) : (
                        <span className="text-rose-400 font-black text-sm uppercase tracking-wider bg-rose-950/50 border border-rose-900/40 px-3 py-1 rounded-full">Incorrect Answer! ❌</span>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Correct Answer</span>
                      <span className="font-bold text-slate-200 text-base">{roundEndedData.correctAnswer}</span>
                    </div>
                    <div className="border-t border-slate-800 pt-3">
                      <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5 font-mono">Study explanation</span>
                      <p className="text-sm text-slate-300 font-semibold leading-relaxed font-mono">
                        {roundEndedData.explanation}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-center border-t border-slate-800/60">
                    <button 
                      id="btn-student-next-question"
                      onClick={handleNextQuestion}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all cursor-pointer text-sm font-display uppercase tracking-wider"
                    >
                      {currentQuestionIndex + 1 === totalQuestions ? 'Finish Quiz' : 'Next Question'}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 9: CLIENT / STUDENT FEEDBACK (CORRECT/WRONG & EXPLANATION)
           ========================================================================= */}
        {role === 'student' && session && session.status === 'showing_result' && roundEndedData && (
          <div id="screen-student-feedback" className="space-y-6 flex-1 flex flex-col max-w-2xl mx-auto py-6">
            <div className="bg-[#0b1221] border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/10 text-center space-y-6 animate-fade-in">
              
              {/* Correctness banner */}
              {(() => {
                const myAns = session.participants.find(p => p.socketId === socket?.id)
                  ?.answers.find(a => a.questionIndex === session.currentQuestionIndex);
                const isCorrect = myAns?.isCorrect || false;
                const points = myAns?.points || 0;

                return (
                  <>
                    <div className="py-4 space-y-2">
                      {isCorrect ? (
                        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 font-extrabold text-sm animate-bounce">
                          <span>CORRECT! 🎉</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-rose-950/50 text-rose-400 border border-rose-900/40 font-extrabold text-sm">
                          <span>INCORRECT ❌</span>
                        </div>
                      )}
                      
                      <h2 className="text-4xl font-display font-black text-white">
                        {isCorrect ? `+${points} Points!` : '0 Points'}
                      </h2>
                    </div>

                    <div className="bg-[#070c14] border border-slate-800 p-5 rounded-2xl text-left space-y-3">
                      <div>
                        <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Correct Answer</span>
                        <span className="font-bold text-slate-200 text-base">{roundEndedData.correctAnswer}</span>
                      </div>
                      <div className="border-t border-slate-800 pt-3">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5 font-mono">Study explanation</span>
                        <p className="text-sm text-slate-300 font-semibold leading-relaxed">
                          {roundEndedData.explanation}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="pt-4 flex justify-center">
                <button 
                  id="btn-student-next-question"
                  onClick={handleNextQuestion}
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all cursor-pointer text-sm font-display uppercase tracking-wider"
                >
                  {currentQuestionIndex + 1 === totalQuestions ? 'Finish Quiz' : 'Next Question'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 10: END OF GAME STANDINGS (PODIUM & STUDENT DETAILED METRICS)
           ========================================================================= */}
        {session && session.status === 'ended' && (
          <div id="screen-game-ended-podium" className="space-y-6 flex-1 flex flex-col items-center justify-center py-6">
            <div className="w-full max-w-5xl bg-[#0b1221] border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/10 space-y-8 animate-fade-in">
              
              <div className="space-y-2 text-center">
                <span className="bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                  Quiz Completed!
                </span>
                <h1 className="text-3xl font-display font-extrabold text-white">Your assessment is completed successfully!</h1>
                <p className="text-sm text-slate-400">Sensational effort by all active classroom participants!</p>
              </div>

              {role === 'student' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {/* Left Column: Student Individual Detailed Grade Card */}
                  {(() => {
                    const me = session.participants.find(p => p.socketId === socket?.id);
                    const totalCount = totalQuestions || 5;
                    const correctCount = me?.answers.filter(a => a.isCorrect).length || 0;
                    const wrongCount = totalCount - correctCount;
                    const percentage = Math.round((correctCount / totalCount) * 100) || 0;

                    return (
                      <div className="bg-[#070c14] border border-slate-800 p-6 rounded-2xl text-left space-y-5 shadow-inner">
                        <div className="flex items-center space-x-2 text-emerald-400">
                          <Check className="w-5 h-5" />
                          <span className="font-extrabold text-sm uppercase tracking-wider">Quiz Completed Successfully!</span>
                        </div>
                        
                        <div className="space-y-3 border-t border-slate-850/80 pt-4">
                          <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>Student Name:</span>
                            <span className="text-white font-bold">{studentName || 'Student'}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>Total Score:</span>
                            <span className="text-cyan-400 font-bold">{me?.score || 0} pts</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>Correct Answers:</span>
                            <span className="text-emerald-400 font-bold">{correctCount}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>Wrong Answers:</span>
                            <span className="text-rose-400 font-bold">{wrongCount}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>Percentage Accuracy:</span>
                            <span className="text-white font-bold">{percentage}%</span>
                          </div>
                        </div>

                        {/* Percentage accuracy tracking line */}
                        <div className="space-y-1">
                          <div className="w-full bg-[#0b1221] border border-slate-850 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="pt-2 space-y-2">
                          <button 
                            id="btn-student-practice-another"
                            onClick={() => {
                              setSession(null);
                              setStudentCardMode('practice');
                            }}
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all text-xs sm:text-sm text-center cursor-pointer font-display uppercase tracking-wider"
                          >
                            Practice Another Quiz (Solo)
                          </button>
                          <button 
                            id="btn-student-game-ended-back-inline"
                            onClick={() => {
                              setRole(null);
                              setSession(null);
                              setStudentName('');
                            }}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white font-bold py-2.5 px-4 rounded-xl transition text-[11px] sm:text-xs text-center cursor-pointer"
                          >
                            Exit to Main Menu
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Right Column: Class Standings and 3D Podium */}
                  <div className="space-y-6">
                    <h3 className="font-display font-extrabold text-sm text-slate-200 uppercase tracking-wider text-center flex items-center justify-center space-x-1.5">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Classroom Standings</span>
                    </h3>

                    {/* 3D Podium */}
                    <div className="flex items-end justify-center space-x-2 pt-6 pb-4">
                      {session.participants[1] && (
                        <div className="flex flex-col items-center w-20 sm:w-24">
                          <span className="font-extrabold text-[10px] text-slate-300 line-clamp-1 mb-1">{session.participants[1].name}</span>
                          <div className="w-full bg-slate-800/80 border border-slate-700/60 h-16 rounded-t-xl flex flex-col items-center justify-center">
                            <span className="font-black text-slate-300 text-[10px]">2ND</span>
                            <span className="text-[10px] text-slate-400 font-bold font-mono">{session.participants[1].score}</span>
                          </div>
                        </div>
                      )}
                      {session.participants[0] && (
                        <div className="flex flex-col items-center w-24 sm:w-28">
                          <Trophy className="w-4 h-4 text-amber-400 animate-bounce mb-1" />
                          <span className="font-black text-xs text-white line-clamp-1 mb-1">{session.participants[0].name}</span>
                          <div className="w-full bg-gradient-to-b from-amber-600 to-amber-700 border border-amber-500/30 h-24 rounded-t-xl flex flex-col items-center justify-center">
                            <span className="font-black text-amber-200 text-xs">1ST</span>
                            <span className="text-[10px] text-amber-100 font-black font-mono">{session.participants[0].score}</span>
                          </div>
                        </div>
                      )}
                      {session.participants[2] && (
                        <div className="flex flex-col items-center w-20 sm:w-24">
                          <span className="font-extrabold text-[10px] text-slate-300 line-clamp-1 mb-1">{session.participants[2].name}</span>
                          <div className="w-full bg-orange-950/30 border border-orange-900/30 h-12 rounded-t-xl flex flex-col items-center justify-center">
                            <span className="font-black text-orange-400 text-[10px]">3RD</span>
                            <span className="text-[10px] text-orange-500 font-bold font-mono">{session.participants[2].score}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {session.participants.length > 3 && (
                      <div className="bg-[#070c14] border border-slate-850 rounded-xl p-3 divide-y divide-slate-800/60 max-h-32 overflow-y-auto">
                        {session.participants.slice(3).map((p, idx) => (
                          <div key={p.socketId} className="py-1.5 flex justify-between text-[11px] text-slate-400">
                            <span>{idx + 4}. {p.name}</span>
                            <span className="text-cyan-400 font-bold">{p.score} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Standard non-student / Teacher Podium View */}
                  <div className="flex items-end justify-center space-x-4 pt-10 pb-6 max-w-lg mx-auto">
                    {/* 2nd Place */}
                    {session.participants[1] && (
                      <div className="flex flex-col items-center w-28 animate-slide-up" style={{ animationDelay: '200ms' }}>
                        <div className="w-10 h-10 bg-slate-800 border border-slate-700 text-slate-300 font-extrabold rounded-full flex items-center justify-center shadow-md mb-2">
                          2
                        </div>
                        <span className="font-extrabold text-sm text-slate-300 line-clamp-1 mb-1">{session.participants[1].name}</span>
                        <span className="text-xs font-bold text-slate-500 mb-2">{session.participants[1].score} pts</span>
                        <div className="w-full bg-slate-800/80 border border-slate-700/60 h-28 rounded-t-2xl shadow-inner flex items-center justify-center">
                          <span className="font-bold text-slate-400 text-sm tracking-wider">SILVER</span>
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {session.participants[0] && (
                      <div className="flex flex-col items-center w-32 animate-slide-up" style={{ animationDelay: '0ms' }}>
                        <Trophy className="w-8 h-8 text-amber-400 animate-bounce mb-1" />
                        <div className="w-12 h-12 bg-amber-950/50 border-2 border-amber-500 text-amber-400 font-extrabold rounded-full flex items-center justify-center shadow-lg mb-2 text-lg">
                          1
                        </div>
                        <span className="font-black text-base text-white line-clamp-1 mb-1">{session.participants[0].name}</span>
                        <span className="text-sm font-extrabold text-cyan-400 mb-2">{session.participants[0].score} pts</span>
                        <div className="w-full bg-gradient-to-b from-amber-600 to-amber-850 border border-amber-500/30 h-36 rounded-t-2xl shadow-md flex items-center justify-center">
                          <span className="font-black text-amber-200 text-base tracking-wider">GOLD</span>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {session.participants[2] && (
                      <div className="flex flex-col items-center w-28 animate-slide-up" style={{ animationDelay: '400ms' }}>
                        <div className="w-10 h-10 bg-orange-950/50 border border-orange-800/50 text-orange-400 font-extrabold rounded-full flex items-center justify-center shadow-md mb-2">
                          3
                        </div>
                        <span className="font-extrabold text-sm text-slate-300 line-clamp-1 mb-1">{session.participants[2].name}</span>
                        <span className="text-xs font-bold text-slate-500 mb-2">{session.participants[2].score} pts</span>
                        <div className="w-full bg-orange-950/30 border border-orange-900/30 h-20 rounded-t-2xl shadow-inner flex items-center justify-center">
                          <span className="font-bold text-orange-400 text-xs tracking-wider">BRONZE</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {session.participants.length > 3 && (
                    <div className="max-w-md mx-auto bg-[#070c14] border border-slate-800 rounded-2xl p-4 divide-y divide-slate-800">
                      {session.participants.slice(3).map((p, idx) => (
                        <div key={p.socketId} className="py-2 flex justify-between text-xs font-semibold text-slate-400">
                          <span>{idx + 4}. {p.name}</span>
                          <span className="text-cyan-400">{p.score} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* General Controls */}
              <div className="pt-4 border-t border-slate-800/60 flex justify-center">
                {joinSuccessData?.role === 'teacher' ? (
                  <button 
                    id="btn-teacher-game-ended-back"
                    onClick={handleExitQuiz}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all cursor-pointer text-sm"
                  >
                    Return to Dashboard
                  </button>
                ) : (
                  <button 
                    id="btn-student-game-ended-back"
                    onClick={() => {
                      setRole(null);
                      setSession(null);
                      setStudentName('');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-8 py-3.5 rounded-xl hover:scale-102 transition-all cursor-pointer text-sm"
                  >
                    Back to Student Dashboard
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 11: STUDENT SOLO PRACTICE INTERACTIVE CHALLENGE
           ========================================================================= */}
        {role === 'student' && soloQuiz && !soloCompleted && (
          <div id="screen-student-solo-active" className="space-y-6 flex-1 flex flex-col max-w-2xl mx-auto py-6">
            <div className="bg-[#0b1221] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/10 space-y-6 animate-fade-in">
              
              {/* Header progress info */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2.5 py-1 rounded-full uppercase">
                  Solo Practice: Question {soloCurrentIndex + 1} of {soloQuiz.questions.length}
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">SCORE: {soloScore} pts</span>
              </div>

              {/* Question Body */}
              <div className="text-center py-4">
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                  {soloQuiz.questions[soloCurrentIndex].question}
                </h2>
              </div>

              {/* MCQ Options list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {soloQuiz.questions[soloCurrentIndex].options.map((opt: string, idx: number) => {
                  const isSelected = soloSelectedAnswer === opt;
                  const isCorrectAnswer = opt === soloQuiz.questions[soloCurrentIndex].correctAnswer;
                  
                  let optStyle = "bg-[#070c14] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white";
                  if (soloAnswerSubmitted) {
                    if (isCorrectAnswer) {
                      optStyle = "bg-emerald-950/40 border-emerald-500 text-emerald-400";
                    } else if (isSelected) {
                      optStyle = "bg-rose-950/40 border-rose-500 text-rose-400";
                    } else {
                      optStyle = "bg-[#070c14]/40 border-slate-900 text-slate-600 cursor-not-allowed";
                    }
                  } else if (isSelected) {
                    optStyle = "bg-cyan-950/50 border-cyan-500 text-cyan-400";
                  }

                  return (
                    <button
                      key={opt}
                      id={`btn-solo-option-${idx}`}
                      type="button"
                      disabled={soloAnswerSubmitted}
                      onClick={() => handleSoloSubmitAnswer(opt)}
                      className={`p-5 rounded-2xl border-2 font-bold text-sm transition-all transform active:scale-95 text-left flex items-center space-x-3 cursor-pointer ${optStyle}`}
                    >
                      <span className="font-bold text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-400">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 font-semibold">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Result Explanations details */}
              {soloAnswerSubmitted && (
                <div className="bg-[#070c14]/50 border border-slate-800 p-5 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center space-x-2">
                    {soloSelectedAnswer === soloQuiz.questions[soloCurrentIndex].correctAnswer ? (
                      <span className="text-emerald-400 font-bold text-sm">Correct Answer! +1000 Points 🎉</span>
                    ) : (
                      <span className="text-rose-400 font-bold text-sm">Incorrect Answer! ❌</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-450 leading-relaxed font-semibold">
                    <span className="font-extrabold text-slate-300">Explanation: </span>
                    {soloQuiz.questions[soloCurrentIndex].explanation}
                  </div>
                </div>
              )}

              {/* Action Controls */}
              <div className="flex justify-end pt-4 border-t border-slate-800/60">
                <button
                  id="btn-solo-next"
                  type="button"
                  onClick={handleSoloNext}
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-102 transition-all cursor-pointer text-sm"
                >
                  {soloCurrentIndex + 1 === soloQuiz.questions.length ? 'Finish Quiz' : 'Next Question'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
             SCREEN 12: STUDENT SOLO CHALLENGE COMPLETION PAGE
           ========================================================================= */}
        {role === 'student' && soloCompleted && soloQuiz && (
          <div id="screen-student-solo-completed" className="space-y-6 flex-1 flex flex-col max-w-2xl mx-auto py-6">
            <div className="bg-[#0b1221] border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/10 text-center space-y-6 animate-fade-in">
              
              <div className="space-y-2">
                <span className="bg-emerald-950/50 border border-emerald-900/40 text-emerald-400 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                  Completed Successfully!
                </span>
                <h1 className="text-3xl font-display font-extrabold text-white">Your assessment is completed successfully!</h1>
                <p className="text-sm text-slate-400">Excellent progress completed on the "{soloQuiz.topic}" curriculum topic.</p>
              </div>

              {(() => {
                const totalCount = soloQuiz.questions.length;
                const correctCount = soloAnswers.filter(a => a.isCorrect).length;
                const wrongCount = totalCount - correctCount;
                const percentage = Math.round((correctCount / totalCount) * 100) || 0;

                return (
                  <div className="bg-[#070c14] border border-slate-800 p-6 rounded-2xl text-left space-y-4 max-w-md mx-auto shadow-inner">
                    <div className="flex items-center space-x-2 text-emerald-400">
                      <Check className="w-5 h-5 animate-bounce" />
                      <span className="font-extrabold text-sm uppercase tracking-wider">Assessment Report Card</span>
                    </div>
                    
                    <div className="space-y-3 border-t border-slate-850/80 pt-4">
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Student Name:</span>
                        <span className="text-white font-bold">{studentName || 'Student'}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Total score:</span>
                        <span className="text-cyan-400 font-bold">{soloScore} pts</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Correct answers:</span>
                        <span className="text-emerald-400 font-bold">{correctCount}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Wrong answers:</span>
                        <span className="text-rose-400 font-bold">{wrongCount}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Percentage:</span>
                        <span className="text-white font-bold">{percentage}%</span>
                      </div>
                    </div>

                    {/* Progress feedback bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-[#0b1221] border border-slate-850 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button 
                        id="btn-solo-practice-another"
                        onClick={() => {
                          setSoloQuiz(null);
                          setSoloCompleted(false);
                          setStudentCardMode('practice');
                        }}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-950/20 hover:scale-102 transition-all text-xs sm:text-sm text-center cursor-pointer font-display uppercase tracking-wider"
                      >
                        Practice Another Quiz
                      </button>
                      <button 
                        id="btn-solo-exit-dashboard"
                        onClick={() => {
                          setRole(null);
                          setSoloQuiz(null);
                          setSoloCompleted(false);
                          setStudentName('');
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white font-bold py-2.5 px-4 rounded-xl transition text-[11px] sm:text-xs text-center cursor-pointer"
                      >
                        Exit to Main Menu
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        )}

      </main>

      {/* Styled Footer */}
      <footer id="footer-main" className="bg-[#070c14] border-t border-slate-800 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>CourseAgent Classroom Quiz Platform &copy; 2026. All rights reserved.</span>
          <div className="flex space-x-4">
            <span className="hover:text-cyan-400 cursor-pointer transition-colors">Security Policy</span>
            <span>&middot;</span>
            <span className="hover:text-cyan-400 cursor-pointer transition-colors">Terms of Service</span>
            <span>&middot;</span>
            <span className="hover:text-cyan-400 cursor-pointer transition-colors">Help Center</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
