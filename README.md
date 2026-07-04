# AI Classroom Quiz Agent Web Application

An AI-powered, real-time live classroom quiz platform built with **React**, **Express**, **Socket.io**, and **Gemini 2.5 Flash** (via `@google/genai`). It allows teachers to generate interactive quizzes for any grade and topic using Gemini, and stream live game lobbies where students can join on their mobile devices or laptops, submit answers, and race to top the 3D championship podium!

---

## 🌟 Key Features

### 👨‍🏫 Teacher Side
* **Instant AI Quiz Generation**: Select topic, grade levels, difficulty (easy/medium/hard), and question types (MCQ, True/False, Short Answer) to auto-generate age-appropriate, curriculum-aligned questions in seconds.
* **Smart Stack Editor**: Add custom questions, edit alternatives, delete items, and use **Single Question AI Regeneration** to refresh specific questions.
* **Live Room Host**: Go Live to spawn a 6-character room code, watch players connect to the lobby in real-time, skip timers, and advance game rounds.
* **Leaderboards & Distributions**: Visual distribution of answer choices and real-time student standings.
* **Performance Analytics**: Visual diagnosis of class average accuracy and a list of the weakest class topics.
* **Results History & CSV Export**: Access historical session scores and download student spreadsheets.

### 👶 Student Side
* **Seamless Join**: Join live rooms via a 6-character code—no email or password registration required.
* **Playful Quiz Controls**: High-contrast, color-coded buttons with playful geometric symbols (Kahoot-style) designed for optimal mobile touch targets.
* **Instant Feedbacks**: Instant evaluation displays points earned, streak count multipliers, correct answers, and thorough AI study explanations.
* **Podium Reveal**: A visual 3D podium at game completion celebrating 1st, 2nd, and 3rd place champions.

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: React + Tailwind CSS
* **Backend**: Node.js + Express
* **Database**: High-performance, fully compliant In-Memory Database store (`/src/server/db.ts`)
* **AI Integration**: `@google/genai` (Gemini 2.5 Flash) with structured JSON schema outputs
* **Real-time Synchronization**: `Socket.io` with server-authoritative state management and delta-updates
* **Bundler & Dev Middleware**: Vite programmatically mounted in Express development mode for single-port execution

---

## 📂 Project Structure

```
├── /src
│   ├── /server
│   │   ├── db.ts       # Seeding data structures & in-memory collections
│   │   ├── ai.ts       # Gemini API SDK quiz generation & single-item regeneration
│   │   └── socket.ts   # Socket.io real-time orchestrator & game state loops
│   ├── App.tsx         # Comprehensive multi-screen responsive student & teacher client
│   ├── index.css       # Global styles & Tailwind imports
│   └── main.tsx        # React client entry point
├── /server.ts          # Main Express full-stack entry point (mounts Vite in dev)
├── /package.json       # Build scripts, configurations & npm dependencies
├── /tsconfig.json      # TypeScript compiler parameters
└── /index.html         # Main SPA entry page
```

---

## 🚀 Local Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** (comes with Node.js)

### Steps

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file at the root by copying from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Provide your standard API secrets inside `.env`:
   ```env
   GEMINI_API_KEY="your-google-gemini-api-key"
   APP_URL="http://localhost:3000"
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Your app will compile and start running on **`http://localhost:3000`** with live hot module updates.

4. **Production Build & Start**:
   To test or deploy in production environments:
   ```bash
   # Compiles frontend assets into dist/ and bundles server.ts into server.js
   npm run build
   
   # Runs the production server
   npm run start
   ```

---

## 🎮 How to Test the App

1. **Teacher Access**:
   * Visit the app and click **Teacher Panel**.
   * Sign up for a new account or log in using the pre-seeded demo credentials:
     * **Email**: `teacher@school.edu`
     * **Password**: `password123`
   * Click **Create Quiz with AI**, configure the parameters, and click **Generate with Gemini AI**.
   * Click **Save & Publish Quiz**.
   * On your dashboard, click **Go Live Session**. This creates your active classroom lobby and a unique **Room Code** (e.g. `X8D9K1`).

2. **Student Access**:
   * Open a new browser tab or mobile screen, go to the landing page, and fill out **Join a Live Quiz**.
   * Input the **Room Code** displayed on the teacher's lobby and enter your name, then click **Enter Live Game**.
   * You'll pop up in real-time on the teacher's screen!

3. **Playing the Game**:
   * On the teacher's screen, click **Start Classroom Quiz**.
   * On the student's screen, the question will render alongside 4 colored geometric buttons. Click one!
   * The teacher can see submission progress ("1 / 1 answered").
   * The round ends when all answers are in or the teacher clicks **Skip Timer**.
   * Results and detailed study explanations are revealed to students while a real-time scoreboard renders on the teacher's screen.
   * Repeat until the final question is complete, then experience the majestic **3D Champion Podium**!
