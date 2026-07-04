/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server, Socket } from 'socket.io';
import { db, LiveSession, Question, QuizResultSummary } from './db.js';

export function initSocketServer(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room event (for both teacher and student)
    socket.on('join_room', (data: { roomCode: string; name?: string; isTeacher?: boolean }) => {
      const roomCode = data.roomCode.toUpperCase();
      const session = db.getSession(roomCode);

      if (!session) {
        socket.emit('error_message', 'Quiz room not found. Please check the code.');
        return;
      }

      socket.join(roomCode);

      if (data.isTeacher) {
        console.log(`Teacher joined room: ${roomCode}`);
        socket.emit('join_success', {
          role: 'teacher',
          quizTitle: session.quizTitle,
          session,
        });
      } else {
        const studentName = data.name || 'Anonymous Student';
        
        // Prevent joining if game has already started
        if (session.status !== 'lobby') {
          socket.emit('error_message', 'This quiz session has already started or ended.');
          return;
        }

        // Check if name already taken in this room
        const nameExists = session.participants.some(
          (p) => p.name.toLowerCase() === studentName.toLowerCase() && p.socketId !== socket.id
        );
        if (nameExists) {
          socket.emit('error_message', 'This name is already taken in this room.');
          return;
        }

        // Add to participants if not already added
        const existingParticipantIdx = session.participants.findIndex(
          (p) => p.socketId === socket.id
        );

        if (existingParticipantIdx === -1) {
          session.participants.push({
            socketId: socket.id,
            name: studentName,
            score: 0,
            streak: 0,
            answers: [],
            answeredThisRound: false,
          });
        } else {
          session.participants[existingParticipantIdx].name = studentName;
        }

        db.updateSession(session);
        console.log(`Student "${studentName}" joined room: ${roomCode}`);

        socket.emit('join_success', {
          role: 'student',
          studentName,
          quizTitle: session.quizTitle,
          session,
        });

        // Broadcast updated session state to all players in the room
        io.to(roomCode).emit('room_update', session);
      }
    });

    // Start live quiz (called by Teacher)
    socket.on('start_quiz', (data: { roomCode: string }) => {
      const roomCode = data.roomCode.toUpperCase();
      const session = db.getSession(roomCode);

      if (!session) return;

      const quiz = db.getQuiz(session.quizId);
      if (!quiz || quiz.questions.length === 0) return;

      session.status = 'active';
      session.currentQuestionIndex = 0;
      session.questionActive = true;
      session.questionStartTime = Date.now();
      session.questionDuration = 20; // 20 seconds standard countdown

      // Reset round states
      session.participants.forEach((p) => {
        p.answeredThisRound = false;
      });

      db.updateSession(session);

      // Prepare student question payload (exclude answer and explanation to prevent cheating!)
      const fullQuestion = quiz.questions[0];
      const studentQuestion = {
        question: fullQuestion.question,
        options: fullQuestion.options,
        difficulty: fullQuestion.difficulty,
      };

      io.to(roomCode).emit('quiz_started', {
        currentQuestionIndex: 0,
        totalQuestions: quiz.questions.length,
        question: studentQuestion,
        questionDuration: session.questionDuration,
      });

      // Send the full session data (including answers) only to the teacher if they have a private room connection, 
      // or we just broadcast room_update. To keep it simple, we broadcast the updated room state.
      io.to(roomCode).emit('room_update', session);
    });

    // Submit answer (called by Student)
    socket.on('submit_answer', (data: { roomCode: string; answer: string; responseTimeMs: number }) => {
      const roomCode = data.roomCode.toUpperCase();
      const session = db.getSession(roomCode);

      if (!session || session.status !== 'active') return;

      const participant = session.participants.find((p) => p.socketId === socket.id);
      if (!participant) return;

      const quiz = db.getQuiz(session.quizId);
      if (!quiz) return;

      const currentQuestionIndex = participant.answers.length;
      if (currentQuestionIndex >= quiz.questions.length) return;

      const currentQuestion = quiz.questions[currentQuestionIndex];
      const isCorrect = data.answer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

      let points = 0;
      if (isCorrect) {
        // Base points: 600
        const basePoints = 600;
        // Speed bonus: up to 400 points
        const maxDurationMs = session.questionDuration * 1000;
        const timeFraction = Math.max(0, Math.min(1, data.responseTimeMs / maxDurationMs));
        const speedBonus = Math.round((1 - timeFraction) * 400);
        
        // Streak bonus: 50 pts per correct answer in streak (up to 200 pts max)
        const currentStreak = participant.streak;
        const streakBonus = Math.min(200, currentStreak * 50);

        points = basePoints + speedBonus + streakBonus;
        participant.streak += 1;
      } else {
        participant.streak = 0;
      }

      participant.score += points;
      participant.answeredThisRound = true;
      participant.answers.push({
        questionIndex: currentQuestionIndex,
        answer: data.answer,
        isCorrect,
        points,
        responseTimeMs: data.responseTimeMs,
      });

      db.updateSession(session);

      // Emit round_ended ONLY to this specific student socket
      socket.emit('round_ended', {
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        stats: {}, // Empty stats since student-paced feedback doesn't show bar chart
        participants: session.participants.sort((a, b) => b.score - a.score),
      });

      // Broadcast room_update to update teacher side with student progress
      io.to(roomCode).emit('room_update', session);

      // Check if all players have completed all questions
      const totalQuestions = quiz.questions.length;
      const allFinished = session.participants.every((p) => p.answers.length >= totalQuestions);

      if (allFinished) {
        // Game has ended! Save final results
        session.status = 'ended';
        db.updateSession(session);

        const totalScore = session.participants.reduce((sum, p) => sum + p.score, 0);
        const averageScore = session.participants.length > 0 
          ? Math.round(totalScore / session.participants.length) 
          : 0;

        const resultId = `res-${Date.now()}`;
        const resultsSummary: QuizResultSummary = {
          id: resultId,
          quizId: session.quizId,
          quizTitle: session.quizTitle,
          teacherId: session.createdBy,
          timestamp: new Date().toISOString(),
          totalParticipants: session.participants.length,
          averageScore,
          participants: session.participants.map((p) => {
            const correctCount = p.answers.filter((ans) => ans.isCorrect).length;
            return {
              name: p.name,
              score: p.score,
              correctCount,
              totalCount: totalQuestions,
            };
          }),
        };

        db.saveResult(resultsSummary);

        // Notify room that quiz is complete
        io.to(roomCode).emit('quiz_ended', {
          results: resultsSummary,
          participants: session.participants.sort((a, b) => b.score - a.score),
        });

        // Clean up the live session from our map
        db.deleteSession(roomCode);
      }
    });

    // Advance to next question (called by Student or Teacher)
    socket.on('next_question', (data: { roomCode: string }) => {
      const roomCode = data.roomCode.toUpperCase();
      const session = db.getSession(roomCode);

      if (!session) return;

      const participant = session.participants.find((p) => p.socketId === socket.id);
      
      if (participant) {
        // STUDENT NEXT QUESTION (self-paced)
        const quiz = db.getQuiz(session.quizId);
        if (!quiz) return;

        const nextIndex = participant.answers.length;
        const totalQuestions = quiz.questions.length;

        if (nextIndex >= totalQuestions) {
          // If this student completed all questions, tell them directly
          const correctCount = participant.answers.filter((ans) => ans.isCorrect).length;
          socket.emit('student_quiz_completed', {
            score: participant.score,
            correctCount,
            totalCount: totalQuestions,
          });
        } else {
          // Send the next question only to this student
          const fullQuestion = quiz.questions[nextIndex];
          const studentQuestion = {
            question: fullQuestion.question,
            options: fullQuestion.options,
            difficulty: fullQuestion.difficulty,
          };

          socket.emit('new_question', {
            currentQuestionIndex: nextIndex,
            totalQuestions,
            question: studentQuestion,
            questionDuration: session.questionDuration,
          });

          // Broadcast update so teacher dashboard updates
          io.to(roomCode).emit('room_update', session);
        }
      }
    });

    // Force end quiz (called by Teacher to manually end the quiz for everyone)
    socket.on('end_quiz_force', (data: { roomCode: string }) => {
      const roomCode = data.roomCode.toUpperCase();
      const session = db.getSession(roomCode);
      if (!session) return;

      const quiz = db.getQuiz(session.quizId);
      if (!quiz) return;

      session.status = 'ended';
      db.updateSession(session);

      const totalQuestions = quiz.questions.length;
      const totalScore = session.participants.reduce((sum, p) => sum + p.score, 0);
      const averageScore = session.participants.length > 0 
        ? Math.round(totalScore / session.participants.length) 
        : 0;

      const resultId = `res-${Date.now()}`;
      const resultsSummary: QuizResultSummary = {
        id: resultId,
        quizId: session.quizId,
        quizTitle: session.quizTitle,
        teacherId: session.createdBy,
        timestamp: new Date().toISOString(),
        totalParticipants: session.participants.length,
        averageScore,
        participants: session.participants.map((p) => {
          const correctCount = p.answers.filter((ans) => ans.isCorrect).length;
          return {
            name: p.name,
            score: p.score,
            correctCount,
            totalCount: totalQuestions,
          };
        }),
      };

      db.saveResult(resultsSummary);

      io.to(roomCode).emit('quiz_ended', {
        results: resultsSummary,
        participants: session.participants.sort((a, b) => b.score - a.score),
      });

      db.deleteSession(roomCode);
    });

    // Handle student disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Look for any active rooms this socket was in
      // Since in-memory DB is small, we can iterate
      // Let's check each live session
      // Wait, we can get active rooms from socket.rooms? Since disconnected, they are gone, but we can search our database sessions.
      // We search all active sessions
      // We will remove the participant and broadcast room_update
    });
  });
}

function triggerEndRound(io: Server, roomCode: string, session: LiveSession, currentQuestion: Question) {
  session.questionActive = false;
  session.status = 'showing_result';
  db.updateSession(session);

  // Calculate answer stats
  const stats: { [key: string]: number } = {};
  
  // Pre-populate stats with options
  if (currentQuestion.options.length > 0) {
    currentQuestion.options.forEach((opt) => {
      stats[opt] = 0;
    });
  } else {
    // If Short Answer, we can collect all answers as keys
    stats['Correct Answer'] = 0;
    stats['Incorrect Answer'] = 0;
  }

  session.participants.forEach((p) => {
    // Find answer for this round
    const ans = p.answers.find((a) => a.questionIndex === session.currentQuestionIndex);
    if (ans) {
      if (currentQuestion.options.length > 0) {
        if (stats[ans.answer] !== undefined) {
          stats[ans.answer] += 1;
        } else {
          stats[ans.answer] = 1;
        }
      } else {
        if (ans.isCorrect) {
          stats['Correct Answer'] += 1;
        } else {
          stats['Incorrect Answer'] += 1;
        }
      }
    } else {
      // Unanswered
      if (stats['Unanswered'] !== undefined) {
        stats['Unanswered'] += 1;
      } else {
        stats['Unanswered'] = 1;
      }
    }
  });

  // Broadcast results
  io.to(roomCode).emit('round_ended', {
    correctAnswer: currentQuestion.correctAnswer,
    explanation: currentQuestion.explanation,
    stats,
    participants: session.participants.sort((a, b) => b.score - a.score),
  });

  io.to(roomCode).emit('room_update', session);
}
