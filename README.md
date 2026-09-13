# KnowYourResume

<p align="center">
  <strong>Build. Analyze. Optimize. Get Hired.</strong>
</p>

<p align="center">
  An AI-powered resume intelligence workspace for building ATS-friendly resumes, analyzing job compatibility, optimizing applications, preparing for interviews, and tracking your job search.
</p>

<p align="center">
  <a href="https://knowyourresume.web.app/">Live Application</a>
</p>

---

## Overview

**KnowYourResume** is a production-grade resume intelligence platform built to help job seekers transform their resume into a structured, measurable, and job-targeted application.

It combines a **deterministic ATS compatibility engine**, **Gemini-powered AI career assistance**, professional resume templates, PDF export, and an application tracking workflow in one workspace.

The platform is designed around four core stages:

```text
Build
  ↓
Analyze
  ↓
Optimize
  ↓
Apply & Track
```

---

## Why KnowYourResume?

Traditional resume builders focus primarily on formatting.

KnowYourResume focuses on the complete application workflow.

Instead of simply creating a resume, the platform helps users:

* Build a professional resume
* Measure compatibility with a target job
* Identify missing keywords and skills
* Improve resume content
* Tailor applications
* Generate role-specific cover letters
* Prepare for interviews
* Identify skill gaps
* Track applications and opportunities

---

# Core Features

## 1. Resume Builder

Create structured, professional resumes using a guided resume-building workflow.

### Supported capabilities

* Personal information
* Professional summary
* Work experience
* Education
* Skills
* Projects
* Certifications
* Additional resume sections
* Live resume preview
* Template switching
* PDF export

The resume structure is designed to remain readable by both recruiters and automated parsing systems.

---

## 2. Deterministic ATS Compatibility Engine

KnowYourResume includes a transparent ATS compatibility estimator designed to provide an explainable score rather than presenting an opaque number.

### Scoring Model

| Category                 |   Weight |
| ------------------------ | -------: |
| Keyword Match            |  **35%** |
| Skills Match             |  **25%** |
| Experience Relevance     |  **15%** |
| Resume Completeness      |  **10%** |
| Formatting Compatibility |  **10%** |
| Readability              |   **5%** |
| **Total**                | **100%** |

The scoring system provides users with actionable information about how their resume aligns with a specific job description.

### Important Disclaimer

> The ATS score is an internal compatibility estimate. It does not represent, reproduce, or guarantee the scoring methodology of any proprietary Applicant Tracking System.

Different ATS vendors and employers may use different parsing, ranking, filtering, and recruitment workflows.

---

## 3. Job Description Analysis

Analyze job descriptions against your resume to identify relevant requirements and potential gaps.

Supported document inputs include:

* `.txt`
* `.pdf`
* `.docx`

The analysis can help identify:

* Relevant keywords
* Required skills
* Experience requirements
* Missing competencies
* Resume completeness issues
* Formatting considerations

---

# AI Career Intelligence

KnowYourResume integrates **Gemini AI** for semantic career assistance.

AI functionality is designed to complement the deterministic ATS engine rather than replace it.

## AI Capabilities

### Executive Summary Generator

Generate a professional summary based on the user's actual resume information.

### Bullet Optimizer

Improve experience bullets for:

* Clarity
* Impact
* Relevance
* Professional language
* Achievement-oriented writing

### Resume Optimizer

Optimize resume content against a target job description with a **diff-oriented workflow** so users can understand what changed.

### Cover Letter Generator

Generate a role-specific cover letter using the resume and target job context.

### Interview Preparation

Prepare for interviews with role-specific questions and structured guidance.

### Skill Gap Analysis

Identify potential gaps between the candidate's existing skills and a target role.

---

# AI Safety & Reliability

AI-generated career content can introduce serious risks if it fabricates candidate information.

KnowYourResume therefore implements safeguards designed to reduce hallucinated resume content.

### Prompt Injection Defense

Resume and job-description content is treated as untrusted input and separated using explicit boundaries:

```text
<resume>
...
</resume>

<job-description>
...
</job-description>
```

This helps prevent document content from being interpreted as system-level instructions.

### Anti-Fabrication Controls

AI assistance is designed to avoid inventing:

* Companies
* Job titles
* Credentials
* Certifications
* Achievements
* Metrics
* Employment history
* Skills not supported by the user's information

The objective is to **improve presentation without manufacturing experience**.

### Server-Side API Protection

Gemini API credentials are kept on the server and are not exposed directly to the client application.

---

# Resume Templates

KnowYourResume provides **8 executive resume templates**:

| Template    | Design Focus                       |
| ----------- | ---------------------------------- |
| ATS Classic | Traditional ATS-friendly structure |
| Modern      | Contemporary professional layout   |
| Executive   | Senior-level presentation          |
| Tech        | Technology-focused resume          |
| Minimal     | Clean and focused                  |
| Corporate   | Professional corporate style       |
| Creative    | Distinctive visual presentation    |
| Compact     | Space-efficient layout             |

Templates include:

* Live preview
* Template switching
* Zoomable preview
* Print-ready styling
* PDF export

---

# Application Tracker

Manage the job-search pipeline from the same workspace.

Track opportunities and their current status while connecting relevant ATS analysis to applications.

### Typical workflow

```text
Job Found
   ↓
Analyze Job
   ↓
Check ATS Compatibility
   ↓
Optimize Resume
   ↓
Generate Cover Letter
   ↓
Apply
   ↓
Track Application
   ↓
Interview
   ↓
Offer
```

This creates a continuous workflow rather than treating resume creation as a one-time activity.

---

# Authentication & User Isolation

KnowYourResume uses **Firebase Authentication** for account management.

### Authentication Features

* Google Sign-In
* Email/password registration
* Email/password login
* Password strength evaluation
* Password reset
* Session persistence
* Protected application routes

### Workspace Isolation

User-specific application data is associated with the authenticated Firebase UID.

This provides logical separation between individual user workspaces.

Protected application routes include:

```text
#dashboard
#resume
#ats
#applications
#templates
#ai
#settings
```

---

# Security

Security is treated as a core part of the application architecture.

### Security Measures

* Server-side AI API key protection
* Firebase Authentication
* User workspace isolation
* Protected application routes
* Prompt injection boundaries
* Anti-fabrication AI controls
* Password reset enumeration protection
* Graceful AI failure handling
* Environment-based secret configuration

### Secret Management

Sensitive credentials must never be committed to source control.

Use environment variables for:

* Gemini API keys
* Firebase configuration
* Server configuration
* Other environment-specific secrets

---

# Technology Stack

KnowYourResume is built using a modern web application architecture.

### Core Technologies

* **JavaScript / Node.js**
* **Firebase Authentication**
* **Firebase**
* **Gemini AI**
* **PDF / DOCX document processing**
* **Client-side web technologies**
* **Server-side API integration**

### AI Architecture

```text
                ┌────────────────────┐
                │      User          │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  KnowYourResume UI │
                └─────────┬──────────┘
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
    ┌─────────────────┐      ┌──────────────────┐
    │ Deterministic   │      │ Server-side AI   │
    │ ATS Engine      │      │ Gateway          │
    └────────┬────────┘      └────────┬─────────┘
             │                        │
             ▼                        ▼
       ATS Analysis             Gemini AI
             │                        │
             └────────────┬───────────┘
                          ▼
                ┌────────────────────┐
                │ Career Intelligence│
                └────────────────────┘
```

---

# Getting Started

## Requirements

Before running the project locally, make sure you have:

* **Node.js 20+**
* npm
* A Firebase project
* Firebase Authentication configured
* Gemini API access if AI features are enabled

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd knowyourresume
```

Install dependencies:

```bash
npm install
```

---

# Environment Configuration

Create a `.env` file based on `.env.example`.

```env
PORT=3000

# Gemini AI
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash

# Firebase Authentication
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-firebase-app-id
```

### Never commit `.env`

Make sure secrets are excluded from Git:

```gitignore
.env
.env.*
!.env.example
```

---

# Run Locally

Start the application:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

---

# Testing

KnowYourResume includes automated verification for application quality.

## Run Tests

```bash
npm test
```

## Run Linting

```bash
npm run lint
```

A successful build should pass both the automated test suite and lint checks before deployment.

---

# Production Verification

Before deploying a release, verify the following areas:

### Authentication

* Google login
* Email registration
* Email login
* Password reset
* Logout
* Session persistence
* Protected routes

### Resume

* Resume creation
* Resume editing
* Resume persistence
* Template switching
* Preview rendering
* PDF generation

### ATS

* Resume parsing
* Job description parsing
* Keyword analysis
* Skills analysis
* Score calculation
* Result rendering

### AI

* Summary generation
* Bullet optimization
* Resume optimization
* Cover letter generation
* Interview preparation
* Skill-gap analysis
* API failure handling
* Rate-limit handling

### Application Tracking

* Create application
* Update status
* View application
* Edit application
* Delete application
* ATS score association

### Responsive Design

Verify the application on:

* Desktop
* Laptop
* Tablet
* Mobile

---

# Deployment

The production application is available at:

**https://knowyourresume.web.app/**

For Firebase deployments, configure the appropriate Firebase project and deployment configuration before publishing.

Example:

```bash
npm run build
```

Then deploy using the project's configured Firebase deployment workflow.

---

# Recommended Project Workflow

```text
                    KNOWYOURRESUME
                          │
          ┌───────────────┴───────────────┐
          │                               │
       BUILD                            IMPORT
          │                               │
          └───────────────┬───────────────┘
                          ▼
                   RESUME PROFILE
                          │
                          ▼
                   TARGET JOB
                          │
                          ▼
                  ATS ANALYSIS
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
        Strong Match               Skill Gap
             │                         │
             ▼                         ▼
       AI Optimization          Skill Analysis
             │                         │
             └────────────┬────────────┘
                          ▼
                   FINAL RESUME
                          │
                          ▼
                  COVER LETTER
                          │
                          ▼
                      APPLY
                          │
                          ▼
                  TRACK APPLICATION
                          │
                          ▼
                     INTERVIEW
```

---

# Product Principles

KnowYourResume is built around several principles:

### Accuracy Over Fabrication

AI should improve a candidate's presentation without inventing experience.

### Explainability

ATS analysis should provide understandable scoring components rather than an unexplained number.

### Security

API credentials and user data should be handled using appropriate security boundaries.

### User Ownership

Candidates should remain in control of their resume, applications, and career information.

### Practicality

Every feature should contribute to a real job-search workflow.

---

# Roadmap

Potential future improvements include:

* [ ] Advanced resume analytics
* [ ] Additional ATS scoring signals
* [ ] More resume templates
* [ ] Advanced job-description intelligence
* [ ] Resume version management
* [ ] Enhanced application analytics
* [ ] Interview performance tracking
* [ ] Job-search insights dashboard
* [ ] Additional export formats
* [ ] Accessibility improvements
* [ ] Performance optimization
* [ ] Expanded AI career workflows

---

# Contributing

Contributions are welcome.

### Development Workflow

1. Fork the repository.
2. Create a feature branch.
3. Install dependencies.
4. Implement the change.
5. Run tests.
6. Run linting.
7. Verify responsive behavior.
8. Commit your changes.
9. Open a Pull Request.

### Bug Reports

When reporting a bug, provide:

* Browser and version
* Operating system
* Device type
* Steps to reproduce
* Expected behavior
* Actual behavior
* Console errors, if applicable
* Screenshots when useful

---

# Security Disclosure

If you discover a security vulnerability, please avoid publicly disclosing exploitable details.

Report security issues through the repository's designated private security reporting mechanism.

Do not include API keys, passwords, authentication tokens, or other sensitive information in public issues.

---

# License

Add the project's applicable open-source license here.

If this project is intended to be distributed under the MIT License, include an `MIT` license file in the repository.

---

# Live Application

<p align="center">

<strong>Try KnowYourResume</strong>

<br><br>

<a href="https://knowyourresume.web.app/">
https://knowyourresume.web.app/
</a>

</p>

---

<p align="center">
  <strong>KnowYourResume</strong>
  <br>
  Build. Analyze. Optimize. Get Hired.
</p>
