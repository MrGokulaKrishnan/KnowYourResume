# KnowYourResume

**Build. Analyze. Optimize. Get Hired.**

KnowYourResume is a production-grade resume intelligence workspace with Firebase Authentication, a deterministic ATS compatibility estimator, semantic Gemini AI career assistance, and isolated user workspaces.

---

## Key Features

1. **Firebase Authentication**
   - Google Sign-In with popup OAuth flow.
   - Email and Password registration & sign-in with client-side strength evaluation.
   - Password reset workflow with account-enumeration protection.
   - Session persistence and protected routes (`#dashboard`, `#resume`, `#ats`, `#applications`, `#templates`, `#ai`, `#settings`).
   - Isolated user workspaces keyed to each Firebase UID.

2. **Deterministic ATS Engine**
   - Transparent, explainable compatibility score breakdown:
     - Keyword Match: 35%
     - Skills Match: 25%
     - Experience Relevance: 15%
     - Resume Completeness: 10%
     - Formatting Compatibility: 10%
     - Readability: 5%
   - Job description document parsing for `.txt`, `.pdf`, and `.docx`.
   - Clear disclaimers indicating internal estimates rather than proprietary ATS vendor claims.

3. **Semantic Gemini AI Assistance**
   - 8 specialized endpoints: summary generation, bullet optimizer, resume optimizer (with diff view), cover letter generation, interview preparation, and skill gap analysis.
   - Server-side API key protection with zero client-side exposure.
   - Prompt injection defense with boundary delimiters (`<resume>`, `<job-description>`).
   - Anti-fabrication guards preventing hallucinated metrics, companies, or credentials.
   - Fallback error handling when Gemini is unconfigured or rate-limited.

4. **8 Executive Resume Templates & PDF Export**
   - ATS Classic, Modern, Executive, Tech, Minimal, Corporate, Creative, and Compact.
   - Live zoomable preview, template switcher, and print-ready PDF styling.

5. **Application Tracker**
   - Opportunity pipeline with linked ATS scores and real-time status management.

---

## Getting Started

### 1. Requirements
- Node.js 20 or higher.

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your keys:

```env
PORT=3000

# Gemini AI (Server-side only)
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash

# Firebase Authentication (Client credentials)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
```

### 3. Run Application
```sh
npm start
```
Open `http://localhost:3000` in your browser.

---

## Verification & Tests

Run automated test suite:
```sh
npm test
```

Run code syntax & linter check:
```sh
npm run lint
```

