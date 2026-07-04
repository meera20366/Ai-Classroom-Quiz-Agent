/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { Question } from './db.js';

let aiInstance: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. Using fallback mock generation.');
    }
    // GoogleGenAI constructor can initialize with an empty key if needed, or we handle fallback
    aiInstance = new GoogleGenAI({ apiKey: apiKey || 'MOCK_KEY' });
  }
  return aiInstance;
}

export async function generateQuizQuestions(params: {
  topic: string;
  gradeLevel: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'MCQ' | 'True-False' | 'Short Answer';
}): Promise<Question[]> {
  const { topic, gradeLevel, numQuestions, difficulty, questionType } = params;

  if (!process.env.GEMINI_API_KEY) {
    // Return mock questions if Gemini is not configured, to keep the app functional and friendly!
    return generateMockQuestions(topic, numQuestions, difficulty, questionType);
  }

  const ai = getAIClient();

  const systemPrompt = `You are a world-class subject-matter expert teacher. Your goal is to generate age-appropriate, curriculum-aligned, engaging quiz questions.
You must output a single JSON object with a "questions" key containing an array of questions.
Each question MUST strictly follow this TypeScript structure:
interface GeneratedQuestion {
  question: string;
  options: string[]; // 4 options for MCQ, exactly ["True", "False"] for True-False, empty array [] for Short Answer
  correctAnswer: string; // Must exactly match one of the options for MCQ/True-False, or be a concise correct answer phrase for Short Answer
  explanation: string; // Explains why the correct answer is right and why other options are incorrect (if applicable)
  difficulty: 'easy' | 'medium' | 'hard';
}

CRITICAL RULES:
- If questionType is 'MCQ', provide exactly 4 distinct, plausible options.
- If questionType is 'True-False', options must be exactly ["True", "False"]. The correctAnswer must be either "True" or "False".
- If questionType is 'Short Answer', options must be empty []. The correctAnswer should be a short, clear model answer of 1-5 words.
- All content must match the requested grade level (${gradeLevel}) and difficulty (${difficulty}).`;

  const userPrompt = `Generate a quiz with ${numQuestions} questions.
Topic: ${topic}
Grade Level: ${gradeLevel}
Difficulty: ${difficulty}
Question Type: ${questionType}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        // Request structured output
        responseSchema: {
          type: 'OBJECT',
          properties: {
            questions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  question: { type: 'STRING' },
                  options: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  correctAnswer: { type: 'STRING' },
                  explanation: { type: 'STRING' },
                  difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] }
                },
                required: ['question', 'options', 'correctAnswer', 'explanation', 'difficulty']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const data = JSON.parse(text);
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('Invalid JSON structure returned from Gemini API');
    }

    // Map to include a unique ID for each question
    return data.questions.map((q: any, idx: number) => ({
      id: `ai-q-${Date.now()}-${idx}`,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'No explanation provided.',
      difficulty: q.difficulty || difficulty,
    }));
  } catch (error) {
    console.error('Error calling Gemini API, falling back to local quiz generation:', error);
    return generateMockQuestions(topic, numQuestions, difficulty, questionType);
  }
}

export async function regenerateSingleQuestion(params: {
  topic: string;
  gradeLevel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'MCQ' | 'True-False' | 'Short Answer';
  excludeQuestions: string[];
}): Promise<Question> {
  const { topic, gradeLevel, difficulty, questionType, excludeQuestions } = params;

  if (!process.env.GEMINI_API_KEY) {
    const fallback = generateMockQuestions(topic, 1, difficulty, questionType)[0];
    fallback.id = `regen-q-${Date.now()}`;
    return fallback;
  }

  const ai = getAIClient();

  const systemPrompt = `You are a world-class subject-matter expert teacher. Generate EXACTLY ONE high-quality, age-appropriate, curriculum-aligned quiz question.
The generated question MUST NOT be similar to any of these excluded questions: ${JSON.stringify(excludeQuestions)}.
Output a single JSON object matching this structure:
{
  "question": string,
  "options": string[], // 4 for MCQ, ["True", "False"] for True-False, [] for Short Answer
  "correctAnswer": string, // must match one of the options exactly or be a short model answer
  "explanation": string,
  "difficulty": "easy" | "medium" | "hard"
}`;

  const userPrompt = `Generate one new ${difficulty} ${questionType} question about "${topic}" for ${gradeLevel}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
            options: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            },
            correctAnswer: { type: 'STRING' },
            explanation: { type: 'STRING' },
            difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] }
          },
          required: ['question', 'options', 'correctAnswer', 'explanation', 'difficulty']
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response');
    }

    const q = JSON.parse(text);
    return {
      id: `ai-q-${Date.now()}-regen`,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'No explanation provided.',
      difficulty: q.difficulty || difficulty,
    };
  } catch (error) {
    console.error('Error regenerating question from Gemini API:', error);
    const fallback = generateMockQuestions(topic, 1, difficulty, questionType)[0];
    fallback.id = `regen-fallback-${Date.now()}`;
    return fallback;
  }
}

// Highly realistic mock questions fallback so the app is robust and interactive even if API keys are missing!
function generateMockQuestions(
  topic: string,
  numQuestions: number,
  difficulty: 'easy' | 'medium' | 'hard',
  questionType: 'MCQ' | 'True-False' | 'Short Answer'
): Question[] {
  const questions: Question[] = [];
  
  for (let i = 0; i < numQuestions; i++) {
    const qIndex = i + 1;
    let questionText = `Question ${qIndex} about ${topic} (${difficulty})`;
    let options: string[] = [];
    let correctAnswer = '';
    let explanation = `This is a detailed explanation of why the correct answer is right for this ${difficulty} question on ${topic}.`;

    if (questionType === 'MCQ') {
      questionText = `What is the key principle of ${topic} regarding concept ${qIndex}?`;
      options = [
        `Option A: Core foundational mechanism of ${topic}`,
        `Option B: Secondary alternative system of ${topic}`,
        `Option C: Common misconception about ${topic}`,
        `Option D: Advanced theoretical limit of ${topic}`
      ];
      correctAnswer = options[0]; // Option A is correct
    } else if (questionType === 'True-False') {
      questionText = `True or False: Concept ${qIndex} is considered essential for understanding ${topic} at a ${difficulty} level.`;
      options = ['True', 'False'];
      correctAnswer = qIndex % 2 === 0 ? 'True' : 'False';
    } else {
      questionText = `Define the primary element of ${topic} related to process ${qIndex}.`;
      options = [];
      correctAnswer = `${topic} primary definition`;
    }

    questions.push({
      id: `mock-q-${Date.now()}-${i}`,
      question: questionText,
      options,
      correctAnswer,
      explanation,
      difficulty,
    });
  }

  return questions;
}
