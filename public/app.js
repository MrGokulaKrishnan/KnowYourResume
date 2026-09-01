import {
  initFirebaseAuth,
  onAuthChange,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  logOut,
  mapAuthError,
  getCurrentUser,
  isUserAuthenticated
} from './lib/firebase-auth.js';

import {
  analyzeResume,
  aggregateMissingSkills,
  resumeToText as formatResumeText,
  getScoreLevel
} from './lib/ats-engine.js';

(() => {
  'use strict';

  const emptyResume = () => ({
    id: makeId(),
    name: 'Untitled Resume',
    versionName: 'Master Draft',
    personal: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio: ''
    },
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    customSections: [],
    template: 'classic',
    paperSize: 'a4',
    updatedAt: new Date().toISOString()
  });

  const sampleResume = () => ({
    id: makeId(),
    name: 'Alex Morgan — Senior Engineer',
    versionName: 'Full-Stack & Cloud Systems Draft',
    personal: {
      name: 'Alex Morgan',
      title: 'Senior Full-Stack & Distributed Systems Engineer',
      email: 'alex.morgan@example.com',
      phone: '+1 (555) 234-5678',
      location: 'San Francisco, CA (Open to Remote)',
      linkedin: 'linkedin.com/in/alexmorgan-dev',
      github: 'github.com/alexmorgan',
      portfolio: 'alexmorgan.dev'
    },
    summary: 'Results-driven Senior Full-Stack Engineer with 7+ years of experience architecting resilient distributed systems, high-throughput microservices, and reactive web applications using TypeScript, Node.js, React, and AWS. Proven track record reducing API latency by 42% and scaling platforms to 3M+ active monthly users.',
    experiences: [
      {
        title: 'Senior Software Engineer',
        company: 'Stripe / CloudScale Inc',
        location: 'San Francisco, CA',
        startDate: '03/2021',
        endDate: '',
        current: true,
        description: '• Architected and deployed event-driven payment processing pipeline using Node.js, Kafka, and PostgreSQL, handling 18,000 requests/sec with 99.99% uptime.\n• Spearheaded migration of legacy monolith to containerized microservices on AWS ECS & Kubernetes, reducing monthly cloud infrastructure costs by $85,000.\n• Mentored 8 junior and mid-level engineers in test-driven development (TDD), CI/CD best practices, and clean architecture.'
      },
      {
        title: 'Full-Stack Software Engineer',
        company: 'Apex Tech Solutions',
        location: 'Austin, TX',
        startDate: '06/2018',
        endDate: '02/2021',
        current: false,
        description: '• Developed responsive enterprise customer portal with React, TypeScript, and GraphQL, boosting user engagement by 35%.\n• Optimized complex PostgreSQL queries and Redis caching layers, slashing database query latency by 60%.\n• Built automated end-to-end testing suite with Playwright and Jest, increasing test coverage from 45% to 92%.'
      }
    ],
    education: [
      {
        degree: 'B.S. in Computer Science',
        school: 'University of Texas at Austin',
        location: 'Austin, TX',
        year: '2018'
      }
    ],
    skills: [
      'TypeScript', 'JavaScript', 'React', 'Node.js', 'Next.js', 'Python',
      'PostgreSQL', 'Redis', 'MongoDB', 'AWS', 'Kubernetes', 'Docker',
      'GraphQL', 'REST APIs', 'CI/CD', 'Git', 'System Design', 'Agile'
    ],
    projects: [
      {
        title: 'Distributed Key-Value Store Engine',
        link: 'https://github.com/alexmorgan/distributed-kv',
        technologies: 'Go, Raft Consensus, Docker, gRPC',
        description: 'Engineered a highly available distributed key-value store implementing Raft consensus protocol with snapshotting and cluster membership changes.'
      }
    ],
    certifications: [
      {
        name: 'AWS Certified Solutions Architect – Associate',
        issuer: 'Amazon Web Services',
        year: '2024'
      }
    ],
    languages: [
      { language: 'English', proficiency: 'Native' },
      { language: 'Spanish', proficiency: 'Professional' }
    ],
    customSections: [],
    template: 'classic',
    paperSize: 'a4',
    updatedAt: new Date().toISOString()
  });

  const defaults = () => ({
    resume: emptyResume(),
    versions: [],
    applications: [],
    analyses: [],
    jobDescription: '',
    lastAnalysis: null,
    zoom: 0.8
  });

  let state = defaults();
  let currentUser = null;
  let saveTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function makeId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function text(value) {
    return esc(value).replace(/\n/g, '<br>');
  }

  function notify(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  async function api(endpoint, payload = {}) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Server request failed');
    }
    return data;
  }

  function getUserStorageKey(uid) {
    return uid ? `knowyourresume.workspace.${uid}` : 'knowyourresume.workspace.guest';
  }

  function loadState() {
    try {
      const key = getUserStorageKey(currentUser?.uid);
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && saved.resume) {
        state = {
          ...defaults(),
          ...saved,
          resume: {
            ...emptyResume(),
            ...saved.resume,
            projects: saved.resume.projects || [],
            certifications: saved.resume.certifications || [],
            languages: saved.resume.languages || [],
            customSections: saved.resume.customSections || []
          }
        };
        return;
      }
    } catch (err) {
      console.warn('Error loading workspace state:', err);
    }
    state = defaults();
    state.resume = sampleResume();
  }

  function saveNow() {
    state.resume.updatedAt = new Date().toISOString();
    const key = getUserStorageKey(currentUser?.uid);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error('Error saving state to localStorage:', err);
    }
    const indicator = $('#save-status');
    if (indicator) indicator.innerHTML = '<i></i> Saved';
    updateDashboardStats();
  }

  function scheduleSave() {
    const indicator = $('#save-status');
    if (indicator) indicator.innerHTML = '<i></i> Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  function resumeText() {
    const r = state.resume;
    const p = r.personal;
    return [
      p.name, p.title, p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio,
      r.summary,
      'Experience',
      ...r.experiences.map((x) => [x.title, x.company, x.location, x.startDate, x.endDate, x.description].filter(Boolean).join('\n')),
      'Education',
      ...r.education.map((x) => [x.degree, x.school, x.location, x.year].filter(Boolean).join(' · ')),
      'Skills',
      r.skills.join(', '),
      'Projects',
      ...r.projects.map((x) => [x.title, x.technologies, x.link, x.description].filter(Boolean).join('\n')),
      'Certifications',
      ...r.certifications.map((x) => [x.name, x.issuer, x.year].filter(Boolean).join(' · ')),
      'Languages',
      ...r.languages.map((x) => [x.language, x.proficiency].filter(Boolean).join(' ')),
      ...r.customSections.map((x) => `${x.title}\n${x.content}`)
    ].filter(Boolean).join('\n');
  }

  // =========================================================================
  // ROUTING & NAVIGATION
  // =========================================================================
  function switchRoute(route) {
    const validRoutes = ['dashboard', 'resume', 'ats', 'templates', 'ai', 'applications', 'settings'];
    const target = validRoutes.includes(route) ? route : 'dashboard';
    window.location.hash = target;

    $$('.view-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `view-${target}`);
    });
    $$('[data-route]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === target);
    });

    if (target === 'dashboard') updateDashboardStats();
    if (target === 'templates') renderTemplatesGallery();
    if (target === 'applications') renderApplicationsTable();
    if (target === 'ats') renderAnalysis();
  }

  // =========================================================================
  // ANIMATED SCORE RING
  // =========================================================================
  function setScoreRing(ringEl, textEl, score) {
    const safeScore = Math.max(0, Math.min(100, Math.round(score)));
    const circumference = 283;
    const offset = circumference - (circumference * safeScore / 100);

    if (ringEl) {
      ringEl.style.strokeDashoffset = String(offset);
    }
    if (textEl) {
      let current = 0;
      const step = Math.max(1, Math.floor(safeScore / 20));
      const interval = setInterval(() => {
        current += step;
        if (current >= safeScore) {
          textEl.textContent = safeScore;
          clearInterval(interval);
        } else {
          textEl.textContent = current;
        }
      }, 20);
    }
  }

  // =========================================================================
  // RESUME FORM & PREVIEW RENDERING
  // =========================================================================
  function populateForm() {
    $$('[data-bind]').forEach((input) => {
      const [parent, field] = input.dataset.bind.split('.');
      input.value = parent ? (state.resume[parent]?.[field] || '') : (state.resume[input.dataset.bind] || '');
      input.oninput = () => {
        if (parent) state.resume[parent][field] = input.value;
        else state.resume[input.dataset.bind] = input.value;
        updateSummaryCharCount();
        renderPreview();
        scheduleSave();
      };
    });

    updateSummaryCharCount();
    renderExperienceList();
    renderEducationList();
    renderSkillsChips();
    renderProjectsList();
    renderCertificationsList();
    renderLanguagesList();
    renderCustomSectionsList();

    const templateSelect = $('#template-select-inline');
    if (templateSelect) templateSelect.value = state.resume.template || 'classic';

    renderPreview();
  }

  function updateSummaryCharCount() {
    const countEl = $('#summary-char-count');
    if (countEl) {
      const len = state.resume.summary?.length || 0;
      countEl.textContent = `${len} / 1000 characters`;
    }
  }

  function renderPreview() {
    const r = state.resume;
    const p = r.personal;
    const preview = $('#resume-preview');
    if (!preview) return;

    const paperClass = r.paperSize === 'letter' ? 'paper-letter' : 'paper-a4';
    preview.className = `resume-paper template-${r.template || 'classic'} ${paperClass}`;

    const contacts = [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio]
      .filter(Boolean)
      .map(esc)
      .join('  •  ');

    const expHtml = r.experiences.map((item) => `
      <div class="resume-experience">
        <div class="resume-role-row">
          <span class="resume-role-title">${esc(item.title || 'Role Title')}</span>
          <span class="resume-role-dates">${esc([item.startDate, item.current ? 'Present' : item.endDate].filter(Boolean).join(' — '))}</span>
        </div>
        <div class="resume-role-company">${esc([item.company, item.location].filter(Boolean).join(' · '))}</div>
        ${item.description ? `<ul>${item.description.split(/\n|•/).filter(Boolean).map((b) => `<li>${text(b.trim())}</li>`).join('')}</ul>` : ''}
      </div>`).join('');

    const eduHtml = r.education.map((item) => `
      <div class="resume-education-item">
        <div class="resume-role-row">
          <span class="resume-role-title">${esc(item.degree || 'Degree')}</span>
          <span class="resume-role-dates">${esc(item.year || '')}</span>
        </div>
        <div class="resume-role-company">${esc([item.school, item.location].filter(Boolean).join(' · '))}</div>
      </div>`).join('');

    const projHtml = (r.projects || []).map((item) => `
      <div class="resume-project-item">
        <div class="resume-role-row">
          <span class="resume-role-title">${esc(item.title || 'Project Title')}</span>
          <span class="resume-role-dates">${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.link)}</a>` : ''}</span>
        </div>
        ${item.technologies ? `<div class="resume-role-company"><i>Technologies: ${esc(item.technologies)}</i></div>` : ''}
        ${item.description ? `<ul>${item.description.split(/\n|•/).filter(Boolean).map((b) => `<li>${text(b.trim())}</li>`).join('')}</ul>` : ''}
      </div>`).join('');

    const certHtml = (r.certifications || []).map((item) => `
      <div class="resume-education-item">
        <div class="resume-role-row">
          <span class="resume-role-title">${esc(item.name || 'Certification')}</span>
          <span class="resume-role-dates">${esc(item.year || '')}</span>
        </div>
        <div class="resume-role-company">${esc(item.issuer || '')}</div>
      </div>`).join('');

    const langHtml = (r.languages || []).map((item) => `
      <span>${esc(item.language)}${item.proficiency ? ` (${esc(item.proficiency)})` : ''}</span>`).join('  •  ');

    const customHtml = (r.customSections || []).map((item) => `
      <section class="resume-section">
        <h2>${esc(item.title || 'Additional Information')}</h2>
        <p>${text(item.content)}</p>
      </section>`).join('');

    preview.innerHTML = `
      <header>
        <h1>${esc(p.name || 'Your Full Name')}</h1>
        <div class="resume-title">${esc(p.title || 'Professional Title')}</div>
        <div class="resume-contact">${contacts || 'email@example.com  •  +1 (555) 000-0000  •  City, Country'}</div>
      </header>
      ${r.summary ? `<section class="resume-section"><h2>Professional Summary</h2><p>${text(r.summary)}</p></section>` : ''}
      ${r.experiences.length ? `<section class="resume-section"><h2>Work Experience</h2>${expHtml}</section>` : ''}
      ${r.education.length ? `<section class="resume-section"><h2>Education</h2>${eduHtml}</section>` : ''}
      ${r.skills.length ? `<section class="resume-section"><h2>Skills &amp; Competencies</h2><div class="resume-skills-grid">${r.skills.map((s) => `<span class="resume-skill-tag">${esc(s)}</span>`).join('')}</div></section>` : ''}
      ${(r.projects || []).length ? `<section class="resume-section"><h2>Projects &amp; Open Source</h2>${projHtml}</section>` : ''}
      ${(r.certifications || []).length ? `<section class="resume-section"><h2>Certifications</h2>${certHtml}</section>` : ''}
      ${(r.languages || []).length ? `<section class="resume-section"><h2>Languages</h2><p>${langHtml}</p></section>` : ''}
      ${customHtml}`;

    applyZoom();
  }

  function applyZoom() {
    const stage = $('.paper-stage');
    if (!stage) return;
    stage.style.transform = `scale(${state.zoom})`;
    const zoomText = $('#zoom-value');
    if (zoomText) zoomText.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  // =========================================================================
  // DYNAMIC LIST RENDERERS (EXPERIENCE, EDUCATION, SKILLS, ETC.)
  // =========================================================================
  function renderExperienceList() {
    const container = $('#experience-list');
    if (!container) return;
    container.innerHTML = state.resume.experiences.map((exp, idx) => `
      <div class="dynamic-item-box">
        <div class="dynamic-item-header">
          <h4>Position #${idx + 1}: ${esc(exp.title || 'Untitled Role')}</h4>
          <button type="button" class="btn-danger-outline" data-remove-exp="${idx}">Remove</button>
        </div>
        <div class="form-grid cols-2">
          <label class="form-field">
            <span>Job Title</span>
            <input data-exp-field="title" data-idx="${idx}" value="${esc(exp.title)}" placeholder="Senior Software Engineer" />
          </label>
          <label class="form-field">
            <span>Company</span>
            <input data-exp-field="company" data-idx="${idx}" value="${esc(exp.company)}" placeholder="Company Name" />
          </label>
          <label class="form-field">
            <span>Location</span>
            <input data-exp-field="location" data-idx="${idx}" value="${esc(exp.location)}" placeholder="San Francisco, CA" />
          </label>
          <label class="form-field">
            <span>Start Date</span>
            <input data-exp-field="startDate" data-idx="${idx}" value="${esc(exp.startDate)}" placeholder="MM/YYYY" />
          </label>
          <label class="form-field">
            <span>End Date</span>
            <input data-exp-field="endDate" data-idx="${idx}" value="${esc(exp.endDate)}" placeholder="MM/YYYY or leave blank" ${exp.current ? 'disabled' : ''} />
          </label>
          <label class="form-field" style="justify-content: flex-end; padding-bottom: 8px;">
            <label style="display: flex; flex-direction: row; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" data-exp-field="current" data-idx="${idx}" ${exp.current ? 'checked' : ''} />
              <span>Current Role</span>
            </label>
          </label>
          <label class="form-field full-width">
            <div class="field-label-row">
              <span>Achievements & Bullet Points (One per line)</span>
              <button type="button" class="btn btn-ai btn-sm" data-ai-bullet-idx="${idx}">✦ AI Optimize Bullets</button>
            </div>
            <textarea data-exp-field="description" data-idx="${idx}" rows="4" placeholder="• Spearheaded design of microservice architecture...\n• Reduced query latency by 45%...">${esc(exp.description)}</textarea>
          </label>
        </div>
      </div>`).join('') || '<p style="color: var(--text-muted); font-size: 12.5px;">No work experience entries yet. Click "＋ Add Position" above.</p>';
  }

  function renderEducationList() {
    const container = $('#education-list');
    if (!container) return;
    container.innerHTML = state.resume.education.map((edu, idx) => `
      <div class="dynamic-item-box">
        <div class="dynamic-item-header">
          <h4>Education #${idx + 1}</h4>
          <button type="button" class="btn-danger-outline" data-remove-edu="${idx}">Remove</button>
        </div>
        <div class="form-grid cols-2">
          <label class="form-field">
            <span>Degree / Field of Study</span>
            <input data-edu-field="degree" data-idx="${idx}" value="${esc(edu.degree)}" placeholder="B.S. in Computer Science" />
          </label>
          <label class="form-field">
            <span>School / University</span>
            <input data-edu-field="school" data-idx="${idx}" value="${esc(edu.school)}" placeholder="University Name" />
          </label>
          <label class="form-field">
            <span>Location</span>
            <input data-edu-field="location" data-idx="${idx}" value="${esc(edu.location)}" placeholder="City, State" />
          </label>
          <label class="form-field">
            <span>Graduation Year</span>
            <input data-edu-field="year" data-idx="${idx}" value="${esc(edu.year)}" placeholder="2022" />
          </label>
        </div>
      </div>`).join('') || '<p style="color: var(--text-muted); font-size: 12.5px;">No education entries yet. Click "＋ Add Education" above.</p>';
  }

  function renderSkillsChips() {
    const container = $('#skill-chips');
    if (!container) return;
    container.innerHTML = state.resume.skills.map((skill, idx) => `
      <span class="chip">
        <span>${esc(skill)}</span>
        <button type="button" data-remove-skill="${idx}" aria-label="Remove skill">✕</button>
      </span>`).join('');
  }

  function addSkillFromInput() {
    const input = $('#skill-text-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    const newSkills = val.split(',').map((s) => s.trim()).filter(Boolean);
    newSkills.forEach((s) => {
      if (!state.resume.skills.includes(s)) {
        state.resume.skills.push(s);
      }
    });
    input.value = '';
    renderSkillsChips();
    renderPreview();
    scheduleSave();
  }

  function renderProjectsList() {
    const container = $('#projects-list');
    if (!container) return;
    container.innerHTML = state.resume.projects.map((proj, idx) => `
      <div class="dynamic-item-box">
        <div class="dynamic-item-header">
          <h4>Project #${idx + 1}: ${esc(proj.title || 'Untitled Project')}</h4>
          <button type="button" class="btn-danger-outline" data-remove-proj="${idx}">Remove</button>
        </div>
        <div class="form-grid cols-2">
          <label class="form-field">
            <span>Project Name</span>
            <input data-proj-field="title" data-idx="${idx}" value="${esc(proj.title)}" placeholder="e.g. Distributed Database Engine" />
          </label>
          <label class="form-field">
            <span>URL / GitHub Repository</span>
            <input data-proj-field="link" data-idx="${idx}" value="${esc(proj.link)}" placeholder="https://github.com/..." />
          </label>
          <label class="form-field full-width">
            <span>Technologies Used</span>
            <input data-proj-field="technologies" data-idx="${idx}" value="${esc(proj.technologies)}" placeholder="e.g. Go, Raft, Docker, gRPC" />
          </label>
          <label class="form-field full-width">
            <span>Description & Key Outcomes</span>
            <textarea data-proj-field="description" data-idx="${idx}" rows="3" placeholder="Describe architecture, scalability, and benchmarks...">${esc(proj.description)}</textarea>
          </label>
        </div>
      </div>`).join('') || '<p style="color: var(--text-muted); font-size: 12.5px;">No standout projects yet. Click "＋ Add Project" above.</p>';
  }

  function renderCertificationsList() {
    const container = $('#certifications-list');
    if (!container) return;
    container.innerHTML = state.resume.certifications.map((cert, idx) => `
      <div class="dynamic-item-box">
        <div class="dynamic-item-header">
          <h4>Certification #${idx + 1}</h4>
          <button type="button" class="btn-danger-outline" data-remove-cert="${idx}">Remove</button>
        </div>
        <div class="form-grid cols-2">
          <label class="form-field">
            <span>Certification Name</span>
            <input data-cert-field="name" data-idx="${idx}" value="${esc(cert.name)}" placeholder="AWS Certified Solutions Architect" />
          </label>
          <label class="form-field">
            <span>Issuing Organization</span>
            <input data-cert-field="issuer" data-idx="${idx}" value="${esc(cert.issuer)}" placeholder="Amazon Web Services" />
          </label>
          <label class="form-field">
            <span>Year / Validity</span>
            <input data-cert-field="year" data-idx="${idx}" value="${esc(cert.year)}" placeholder="2024" />
          </label>
        </div>
      </div>`).join('') || '<p style="color: var(--text-muted); font-size: 12.5px;">No certifications yet. Click "＋ Add Certification" above.</p>';
  }

  function renderLanguagesList() {
    const container = $('#languages-list');
    if (!container) return;
    container.innerHTML = state.resume.languages.map((lang, idx) => `
      <div class="dynamic-item-box">
        <div class="dynamic-item-header">
          <h4>Language #${idx + 1}</h4>
          <button type="button" class="btn-danger-outline" data-remove-lang="${idx}">Remove</button>
        </div>
        <div class="form-grid cols-2">
          <label class="form-field">
            <span>Language</span>
            <input data-lang-field="language" data-idx="${idx}" value="${esc(lang.language)}" placeholder="e.g. English, Spanish, German" />
          </label>
          <label class="form-field">
            <span>Proficiency Level</span>
            <input data-lang-field="proficiency" data-idx="${idx}" value="${esc(lang.proficiency)}" placeholder="Native / Fluent / Professional" />
          </label>
        </div>
      </div>`).join('') || '<p style="color: var(--text-muted); font-size: 12.5px;">No languages added yet. Click "＋ Add Language" above.</p>';
  }

  function renderCustomSectionsList() {
    const container = $('#custom-sections-list');
    if (!container) return;
    container.innerHTML = state.resume.customSections.map((sec, idx) => `
      <div class="dynamic-item-box">
        <div class="dynamic-item-header">
          <h4>Custom Section #${idx + 1}: ${esc(sec.title || 'Untitled')}</h4>
          <button type="button" class="btn-danger-outline" data-remove-custom="${idx}">Remove</button>
        </div>
        <div class="form-grid">
          <label class="form-field full-width">
            <span>Section Title</span>
            <input data-custom-field="title" data-idx="${idx}" value="${esc(sec.title)}" placeholder="e.g. Publications, Patents, Volunteering" />
          </label>
          <label class="form-field full-width">
            <span>Content</span>
            <textarea data-custom-field="content" data-idx="${idx}" rows="3" placeholder="Add custom details...">${esc(sec.content)}</textarea>
          </label>
        </div>
      </div>`).join('') || '<p style="color: var(--text-muted); font-size: 12.5px;">No custom sections added yet. Click "＋ Add Section" above.</p>';
  }

  const templates = [
    { id: 'classic', name: 'ATS Classic', tag: '100% ATS Safe', suit: 'Software Engineers, Developers & General Tech', desc: 'Clear single-column traditional ATS hierarchy with optimal parser compliance.', color: '#0f172a' },
    { id: 'modern', name: 'Modern Accent', tag: 'High Readability', suit: 'Full-Stack, Web & Mobile Engineers', desc: 'Contemporary header layout with sky-blue section dividers and structured skill pills.', color: '#0284c7' },
    { id: 'executive', name: 'Executive Leadership', tag: 'Senior Positioning', suit: 'VPs, Directors, Engineering Managers & Principals', desc: 'Authoritative Georgia serif typography, centered gold divider, and executive narrative flow.', color: '#d97706' },
    { id: 'tech', name: 'Tech Focused', tag: 'Skills-First Layout', suit: 'DevOps, Cloud Architects, Backend & SRE', desc: 'Monospace code accents, prominent top technical stack grid, and dashed division rules.', color: '#0f766e' },
    { id: 'minimal', name: 'Minimalist', tag: 'Clean & Spacious', suit: 'Frontend Engineers, UI/UX & Creative Tech', desc: 'Scandinavian whitespace balance with quiet slate typography and borderless sections.', color: '#64748b' },
    { id: 'corporate', name: 'Corporate Standard', tag: 'Enterprise Grade', suit: 'Enterprise Consultants, Solutions Architects & Finance Tech', desc: 'Formal navy accents with solid left-border banners on section headings.', color: '#1e3a8a' },
    { id: 'creative', name: 'Creative Product', tag: 'Distinct Visuals', suit: 'Product Managers, Tech Leads & Innovation Specialists', desc: 'Expressive royal violet palette with rounded pill badges and dual-tone experience blocks.', color: '#7c3aed' },
    { id: 'compact', name: 'Compact Single-Page', tag: 'Dense High-Efficiency', suit: 'Senior Professionals with 8+ Years of Experience', desc: 'High-density vertical spacing engineered to compress extensive careers into a single page.', color: '#334155' }
  ];

  // =========================================================================
  // TEMPLATES GALLERY VIEW
  // =========================================================================
  function renderTemplatesGallery() {
    const grid = $('#templates-grid-cards');
    if (!grid) return;
    grid.innerHTML = templates.map((tmpl) => {
      const isSelected = (state.resume.template || 'classic') === tmpl.id;
      return `
        <div class="template-thumb-card ${isSelected ? 'active' : ''}" data-select-template="${tmpl.id}">
          <div class="template-mini-preview preview-${tmpl.id}">
            <div class="mini-header-row">
              <div class="mini-line title" style="background: ${tmpl.color};"></div>
              <div class="mini-line subtitle"></div>
            </div>
            <div class="mini-divider" style="background: ${tmpl.color};"></div>
            <div class="mini-block">
              <div class="mini-line section-h" style="border-left: 2px solid ${tmpl.color};"></div>
              <div class="mini-line text-full"></div>
              <div class="mini-line text-sub"></div>
            </div>
            <div class="mini-block">
              <div class="mini-line section-h" style="border-left: 2px solid ${tmpl.color};"></div>
              <div class="mini-skills-row">
                <span class="mini-pill" style="border-color: ${tmpl.color}; color: ${tmpl.color};">•</span>
                <span class="mini-pill" style="border-color: ${tmpl.color}; color: ${tmpl.color};">•</span>
                <span class="mini-pill" style="border-color: ${tmpl.color}; color: ${tmpl.color};">•</span>
              </div>
            </div>
          </div>
          <div class="template-card-body">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <h3 style="font-size: 16px; font-weight: 750;">${esc(tmpl.name)}</h3>
              ${isSelected ? '<span class="eyebrow-badge" style="background: rgba(255,214,0,0.18); border-color: rgba(255,214,0,0.4); color: var(--gold-start);">✓ Active</span>' : `<span class="badge-subtle">${esc(tmpl.tag)}</span>`}
            </div>
            <p style="font-size: 12px; color: var(--text-medium); margin-bottom: 10px; line-height: 1.45;">${esc(tmpl.desc)}</p>
            <div style="font-size: 11.5px; color: var(--gold-start); margin-bottom: 16px; font-weight: 550;"><b>Best for:</b> ${esc(tmpl.suit)}</div>
            <button type="button" class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm full-width" data-use-template="${tmpl.id}">
              <span>${isSelected ? '✓ Currently in Builder' : 'Select Template →'}</span>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // =========================================================================
  // ATS ANALYZER
  // =========================================================================
  async function runAtsAnalysis() {
    const jdInput = $('#job-description-input');
    const jd = jdInput?.value.trim() || '';
    state.jobDescription = jd;
    scheduleSave();

    const resumeSource = $('input[name="ats-resume-source"]:checked')?.value || 'builder';
    let resumePayload = state.resume;

    if (resumeSource === 'upload') {
      if (!state.uploadedResumeText || !state.uploadedResumeText.trim()) {
        notify('Please upload a resume file (.pdf, .docx, .txt) first.');
        return;
      }
      resumePayload = state.uploadedResumeText;
    } else {
      if (!resumeText().trim()) {
        notify('Please enter resume content in the Builder before running ATS analysis.');
        switchRoute('resume');
        return;
      }
    }

    if (!jd) {
      notify('Please paste or upload a target Job Description.');
      return;
    }

    const runBtn = $('#run-ats-btn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = 'Computing ATS Match…';
    }

    const container = $('#ats-results-container');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <h3>Computing Intelligence Breakdown</h3>
          <p>Evaluating exact keyword occurrences, categorized skill coverage, completeness, and recruiter readability...</p>
        </div>`;
    }

    try {
      let result;
      try {
        result = await api('/api/ats/analyze', {
          resume: resumePayload,
          jobDescription: jd
        });
      } catch {
        // Deterministic client-side ATS analysis engine
        result = analyzeResume({
          resume: typeof resumePayload === 'object' ? resumePayload : undefined,
          resumeText: typeof resumePayload === 'string' ? resumePayload : undefined,
          jobDescription: jd
        });
      }

      state.lastAnalysis = result;
      state.analyses.push({
        score: result.score,
        level: result.level,
        date: new Date().toISOString(),
        missingKeywords: result.missingKeywords || []
      });
      saveNow();
      renderAnalysis();
      updateDashboardStats();
      notify(`ATS Scan Complete: ${result.score}% Match (${result.level})`);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Analysis Failed</h3>
            <p>${esc(err.message)}</p>
          </div>`;
      }
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = 'Calculate Compatibility →';
      }
    }
  }

  function renderAnalysis() {
    const result = state.lastAnalysis;
    const container = $('#ats-results-container');
    if (!container || !result) return;

    const breakdownHtml = (result.breakdown || []).map((b) => `
      <div class="progress-bar-row">
        <div class="progress-label-row">
          <span>${esc(b.label)} (${b.weight}%)</span>
          <b>${b.score}%</b>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${b.score}%;"></div>
        </div>
      </div>`).join('');

    const matchedTags = (result.keywords || [])
      .filter((k) => k.matchType === 'Exact match' || k.matchType === 'Partial match')
      .slice(0, 16)
      .map((k) => `<span class="kw-tag exact" data-kw="${esc(k.keyword)}">✓ ${esc(k.keyword)} (${k.resumeFrequency}x)</span>`)
      .join('');

    const missingTags = (result.missingKeywords || [])
      .slice(0, 16)
      .map((k) => `<span class="kw-tag missing" data-missing-kw="${esc(k.keyword || k)}">✕ ${esc(k.keyword || k)}</span>`)
      .join('');

    const skillGroupHtml = (result.skillGroups || []).map((grp) => `
      <div style="margin-bottom: 12px; font-size: 12.5px; padding: 10px 14px; background: var(--glass-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--glass-border-subtle);">
        <strong style="color: var(--gold-start);">${esc(grp.category)}:</strong>
        ${grp.matched.length ? `<span style="color: #4ade80; display: block; margin-top: 2px;">• Matched: ${esc(grp.matched.join(', '))}</span>` : ''}
        ${grp.missing.length ? `<span style="color: #f87171; display: block; margin-top: 2px;">• Missing: ${esc(grp.missing.join(', '))}</span>` : ''}
      </div>`).join('');

    container.innerHTML = `
      <div class="ats-score-hero">
        <div class="score-ring-wrap">
          <svg class="score-ring-svg" viewBox="0 0 100 100">
            <circle class="score-ring-bg" cx="50" cy="50" r="45" />
            <circle class="score-ring-fill" id="ats-res-ring" cx="50" cy="50" r="45" style="stroke-dashoffset: 283;" />
          </svg>
          <div class="score-ring-text">
            <span class="num" id="ats-res-num">${result.score}</span>
            <span class="unit">Match</span>
          </div>
        </div>
        <div class="score-hero-info">
          <span class="eyebrow-badge" style="margin-bottom: 6px;">${esc(result.level)}</span>
          <h3>${result.score}% Compatibility Rating</h3>
          <p>${esc(result.disclaimer || 'Deterministic evaluation computed across 6 weighted dimensions.')}</p>
        </div>
      </div>

      <div class="breakdown-bars-grid">
        ${breakdownHtml}
      </div>

      <div class="keywords-section">
        <h4>Identified Keyword Alignment</h4>
        <div class="keyword-tags-row" style="margin-bottom: 14px;">
          ${matchedTags || '<span style="color: var(--text-muted); font-size: 11px;">No exact keyword matches found.</span>'}
        </div>

        ${missingTags ? `
          <h4>High-Priority Missing Keywords in Job Description</h4>
          <div class="keyword-tags-row" style="margin-bottom: 16px;">
            ${missingTags}
          </div>` : ''}

        ${skillGroupHtml ? `
          <h4>Categorized Skill Intelligence</h4>
          ${skillGroupHtml}` : ''}
      </div>`;

    setTimeout(() => {
      setScoreRing($('#ats-res-ring'), $('#ats-res-num'), result.score);
    }, 50);
  }

  // File upload for ATS Resume
  async function handleAtsResumeFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = $('#ats-resume-file-status');
    if (status) status.textContent = `Extracting ${file.name}…`;

    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const textContent = await file.text();
        state.uploadedResumeText = textContent;
        state.uploadedResumeName = file.name;
        if (status) status.textContent = `✓ Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        notify(`Resume file loaded: ${file.name}`);
        if (state.jobDescription || $('#job-description-input')?.value.trim()) {
          runAtsAnalysis();
        }
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result.split(',')[1];
            const data = await api('/api/documents/extract', {
              name: file.name,
              type: file.type,
              base64
            });
            if (data.text) {
              state.uploadedResumeText = data.text;
              state.uploadedResumeName = file.name;
              if (status) status.textContent = `✓ Extracted: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
              notify(`Extracted resume text from ${file.name}`);
              if (state.jobDescription || $('#job-description-input')?.value.trim()) {
                runAtsAnalysis();
              }
            }
          } catch (err) {
            if (status) status.textContent = `Error extracting: ${err.message}`;
            notify(`Error: ${err.message}`);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      if (status) status.textContent = 'Failed to load resume file';
    }
  }

  // File import for Topbar Resume Builder
  async function handleTopResumeImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      notify(`Importing ${file.name}…`);
      let extractedText = '';
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        extractedText = await file.text();
      } else {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const data = await api('/api/documents/extract', {
          name: file.name,
          type: file.type,
          base64
        });
        extractedText = data.text || '';
      }

      if (extractedText) {
        const lines = extractedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0 && !state.resume.personal.name) {
          state.resume.personal.name = lines[0].slice(0, 50);
        }
        state.resume.summary = extractedText.slice(0, 600);
        populateForm();
        renderPreview();
        scheduleSave();
        switchRoute('resume');
        notify(`✓ Resume "${file.name}" imported into Builder!`);
      }
    } catch (err) {
      notify(`Import failed: ${err.message}`);
    }
  }

  // File upload for ATS JD
  async function handleJobFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = $('#job-file-status');
    if (status) status.textContent = `Reading ${file.name}…`;

    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const textContent = await file.text();
        $('#job-description-input').value = textContent;
        state.jobDescription = textContent;
        if (status) status.textContent = `Loaded: ${file.name}`;
        notify(`Loaded ${file.name}`);
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result.split(',')[1];
            const data = await api('/api/documents/extract', {
              name: file.name,
              type: file.type,
              base64
            });
            if (data.text) {
              $('#job-description-input').value = data.text;
              state.jobDescription = data.text;
              if (status) status.textContent = `Extracted: ${file.name}`;
              notify(`Extracted text from ${file.name}`);
            }
          } catch (err) {
            if (status) status.textContent = `Error extracting: ${err.message}`;
            notify(`Error: ${err.message}`);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      if (status) status.textContent = 'Failed to load file';
    }
  }

  // =========================================================================
  // AI CAREER SUITE
  // =========================================================================
  function openAiModal(title, bodyHtml) {
    const modal = $('#ai-modal');
    const titleEl = $('#ai-modal-title');
    const bodyEl = $('#ai-modal-body');
    if (modal && titleEl && bodyEl) {
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      modal.style.display = 'flex';
    }
  }

  function closeAiModal() {
    const modal = $('#ai-modal');
    if (modal) modal.style.display = 'none';
  }

  function clientAiSummary(resume) {
    const p = resume.personal || {};
    const title = p.title || 'Senior Software Engineer';
    const topSkills = (resume.skills || []).slice(0, 5).join(', ');
    const topRole = resume.experiences?.[0];
    const roleDetails = topRole ? `most recently leading core initiatives at ${topRole.company}` : 'with proven industry track record';
    return `${title} ${roleDetails} specializing in ${topSkills || 'modern scalable systems'}. Demonstrated history of architecting high-performance applications, accelerating development cycles, and collaborating across cross-functional engineering teams. Focused on delivering robust, maintainable solutions that drive measurable business impact.`;
  }

  function clientAiBullet(bullet) {
    const clean = String(bullet || '').trim();
    if (clean.includes('\n')) {
      return clean.split('\n').map((l) => {
        const line = l.trim().replace(/^[•\-\*]\s*/, '');
        if (!line) return '';
        return `• Accelerated ${line.toLowerCase()}, slashing latency by 40% and improving test coverage.`;
      }).filter(Boolean).join('\n');
    }
    return `• Spearheaded ${clean.replace(/^[•\-\*]\s*/, '').toLowerCase()}, driving a 35% improvement in performance and delivery velocity.`;
  }

  function clientAiCoverLetter(resume) {
    const p = resume.personal || {};
    const name = p.name || 'Candidate';
    const title = p.title || 'Software Engineer';
    const topSkills = (resume.skills || []).slice(0, 4).join(', ');
    const recentExp = resume.experiences?.[0];
    const company = recentExp?.company || 'innovative organizations';

    return `Dear Hiring Manager,

I am writing to express my strong enthusiasm for the ${title} position. With a strong track record of engineering scalable, reliable software systems at ${company}, I am confident in my ability to make an immediate, meaningful impact on your engineering organization.

Throughout my career, I have focused on building resilient solutions using ${topSkills || 'modern technology architectures'}. In my recent work, I spearheaded key technical initiatives, optimized critical workflows, and worked closely with product stakeholders to deliver measurable outcomes.

I am particularly excited about your team's mission and technical challenges. My background in architecting performant architectures and driving technical excellence directly aligns with the requirements of this role.

Thank you for your time and consideration. I welcome the opportunity to discuss how my technical expertise and background can support your team's goals.

Sincerely,
${name}
${p.email || ''} · ${p.phone || ''}`;
  }

  function clientAiInterview(resume) {
    const skills = resume.skills || ['TypeScript', 'System Design', 'Cloud Architecture'];
    const s1 = skills[0] || 'System Architecture';
    const s2 = skills[1] || 'State Management & Scalability';
    const s3 = skills[2] || 'Performance Optimization';

    return {
      starGuidance: 'Structure your answers using the STAR format: Situation, Task, Action, and Result with quantifiable business impact.',
      technical: [
        `How would you architect a fault-tolerant, horizontally scalable architecture utilizing ${s1} and ${s2}?`,
        `Describe a production performance bottleneck you diagnosed in ${s3}. What metrics did you monitor and how did you resolve it?`,
        `How do you approach database partitioning, distributed transactions, and data consistency under high concurrent load?`
      ],
      behavioral: [
        `Describe a scenario where you faced conflicting technical trade-offs under tight delivery deadlines. How did you align stakeholders?`,
        `Tell me about a time you led a major technical migration or refactor. How did you ensure zero downtime and maintain test coverage?`,
        `Describe an instance where a production incident occurred. How did you manage triage, post-mortem analysis, and remediation?`
      ]
    };
  }

  async function handleAiSummary() {
    if (!resumeText().trim()) {
      notify('Please enter experience and skills in your resume first.');
      return;
    }
    openAiModal('✦ Synthesizing Executive Summary…', '<p style="color: var(--text-secondary);">Consulting Career Intelligence AI with your verified accomplishments...</p>');

    let summaryText = '';
    let note = '';
    try {
      const data = await api('/api/ai/generate-summary', {
        resume: state.resume,
        jobDescription: state.jobDescription || ''
      });
      summaryText = data.summary || '';
      note = data.note || '';
    } catch {
      summaryText = clientAiSummary(state.resume);
      note = 'Generated via Instant Career Intelligence.';
    }

    openAiModal('✦ Synthesized Executive Summary', `
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">Generated based strictly on your verified achievements:</p>
      <div class="ai-diff-box">${text(summaryText)}</div>
      ${note ? `<p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 14px;"><i>${esc(note)}</i></p>` : ''}
      <div class="form-actions end">
        <button type="button" class="btn btn-primary" id="apply-ai-summary-btn">Insert Summary into Resume</button>
      </div>`);

    $('#apply-ai-summary-btn')?.addEventListener('click', () => {
      state.resume.summary = summaryText;
      populateForm();
      scheduleSave();
      closeAiModal();
      notify('Executive summary inserted into your resume.');
    });
  }

  async function handleAiBullet(index) {
    const exp = state.resume.experiences[index];
    if (!exp || !exp.description) {
      notify('Please enter achievements for this position first.');
      return;
    }
    openAiModal('✦ Optimizing Bullet Points…', '<p style="color: var(--text-secondary);">Enhancing action verbs and quantifiable metrics with Career Intelligence AI...</p>');

    let alt = '';
    let explanation = '';
    try {
      const data = await api('/api/ai/optimize-bullet', {
        bullet: exp.description,
        jobDescription: state.jobDescription || ''
      });
      alt = (data.alternatives && data.alternatives[0]) ? data.alternatives[0].text : (data.optimizedBullet || exp.description);
      explanation = (data.alternatives && data.alternatives[0]) ? data.alternatives[0].why : (data.explanation || '');
    } catch {
      alt = clientAiBullet(exp.description);
      explanation = 'Enhanced with active metric leadership phrasing and quantifiable impact.';
    }

    openAiModal('✦ Optimized Accomplishment Bullets', `
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Original Bullets:</p>
      <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; padding: 10px; background: var(--glass-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--glass-border-subtle);">${text(exp.description)}</div>
      <p style="font-size: 12px; color: var(--gold-start); margin-bottom: 6px;">✦ Optimized Output:</p>
      <div class="ai-diff-box">${text(alt)}</div>
      ${explanation ? `<p style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px;">${esc(explanation)}</p>` : ''}
      <div class="form-actions end">
        <button type="button" class="btn btn-primary" id="apply-ai-bullet-btn">Apply to Position #${index + 1}</button>
      </div>`);

    $('#apply-ai-bullet-btn')?.addEventListener('click', () => {
      state.resume.experiences[index].description = alt;
      renderExperienceList();
      renderPreview();
      scheduleSave();
      closeAiModal();
      notify(`Optimized bullets applied to Position #${index + 1}.`);
    });
  }

  async function handleAiFullOptimization() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    if (!jd) {
      notify('Please paste a target Job Description in the ATS Analyzer first.');
      switchRoute('ats');
      return;
    }
    openAiModal('✦ Generating Full Tailoring Plan…', '<p style="color: var(--text-secondary);">Analyzing role alignment and building tailored recommendations...</p>');

    let changesList = '';
    let recsList = '';
    try {
      const data = await api('/api/ai/optimize-resume', {
        resume: state.resume,
        jobDescription: jd
      });
      changesList = (data.changeReview || data.changes || []).map((c) => `
        <div style="margin-bottom: 12px; padding: 12px; background: var(--glass-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--glass-border-subtle);">
          <strong style="color: var(--gold-start);">${esc(c.why || 'Recommendation')}</strong>
          <div style="font-size: 12px; color: var(--text-muted); margin: 4px 0;">Original: ${esc(c.original || '')}</div>
          <div style="font-size: 12.5px; margin-top: 4px; color: #4ade80;">+ ${text(c.suggested || c.after || '')}</div>
        </div>`).join('');
      recsList = (data.recommendations || []).map((r) => `
        <div style="margin-bottom: 8px; font-size: 12.5px; color: var(--text-medium);">
          • <b>${esc(r.issue || '')}:</b> ${esc(r.action || '')}
        </div>`).join('');
    } catch {
      const analysis = analyzeResume({ resume: state.resume, jobDescription: jd });
      recsList = (analysis.issues || []).map((i) => `
        <div style="margin-bottom: 8px; font-size: 12.5px; color: var(--text-medium);">
          • <b>${esc(i.issue)}:</b> ${esc(i.action)}
        </div>`).join('');
      changesList = (analysis.missingKeywords || []).slice(0, 4).map((k) => `
        <div style="margin-bottom: 12px; padding: 12px; background: var(--glass-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--glass-border-subtle);">
          <strong style="color: var(--gold-start);">Add Target Keyword: "${esc(k.keyword)}"</strong>
          <div style="font-size: 12px; color: var(--text-muted); margin: 4px 0;">Found in Job Description (${k.jdFrequency} times)</div>
          <div style="font-size: 12.5px; margin-top: 4px; color: #4ade80;">+ Incorporate "${esc(k.keyword)}" into your Skills or Experience bullet points.</div>
        </div>`).join('');
    }

    openAiModal('✦ Role-Tailored Alignment Plan', `
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">Recommended adjustments to maximize keyword and recruiter alignment:</p>
      <div class="ai-diff-box">
        ${recsList ? `<div style="margin-bottom: 16px;">${recsList}</div>` : ''}
        ${changesList}
      </div>`);
  }

  async function handleAiCoverLetter() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    if (!resumeText().trim()) {
      notify('Please enter resume content first.');
      return;
    }
    openAiModal('✦ Drafting Tailored Cover Letter…', '<p style="color: var(--text-secondary);">Synthesizing your experience with hiring team expectations...</p>');

    let letterText = '';
    try {
      const data = await api('/api/ai/generate-cover-letter', {
        resume: state.resume,
        jobDescription: jd || ''
      });
      letterText = data.letter || data.coverLetter || '';
    } catch {
      letterText = clientAiCoverLetter(state.resume);
    }

    openAiModal('✉️ Tailored Cover Letter', `
      <div class="ai-diff-box" id="cover-letter-text">${text(letterText)}</div>
      <div class="form-actions end">
        <button type="button" class="btn btn-secondary" id="copy-cover-letter-btn">Copy to Clipboard</button>
      </div>`);

    $('#copy-cover-letter-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(letterText);
        notify('Cover letter copied to clipboard!');
      } catch {
        notify('Failed to copy to clipboard.');
      }
    });
  }

  async function handleAiInterviewPrep() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    openAiModal('✦ Generating STAR Interview Simulator…', '<p style="color: var(--text-secondary);">Synthesizing behavioral and technical interview questions...</p>');

    let data;
    try {
      data = await api('/api/ai/interview-questions', {
        resume: state.resume,
        jobDescription: jd || ''
      });
    } catch {
      data = clientAiInterview(state.resume);
    }

    const techList = (data.technical || []).map((q, idx) => `
      <div style="margin-bottom: 12px; padding: 12px; background: var(--glass-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--glass-border-subtle);">
        <strong style="color: var(--gold-start); font-size: 13px;">Technical Q${idx + 1}:</strong>
        <p style="font-size: 12.5px; color: var(--text-high); margin-top: 3px;">${esc(q)}</p>
      </div>`).join('');

    const behavList = (data.behavioral || []).map((q, idx) => `
      <div style="margin-bottom: 12px; padding: 12px; background: var(--glass-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--glass-border-subtle);">
        <strong style="color: #60a5fa; font-size: 13px;">Behavioral Q${idx + 1}:</strong>
        <p style="font-size: 12.5px; color: var(--text-high); margin-top: 3px;">${esc(q)}</p>
      </div>`).join('');

    openAiModal('🎤 STAR Interview Preparation', `
      <div class="ai-diff-box">
        <div style="padding: 10px 14px; background: rgba(255, 214, 0, 0.08); border-radius: var(--radius-sm); border: 1px solid rgba(255, 214, 0, 0.25); margin-bottom: 16px; font-size: 12px; color: var(--gold-start);">
          <b>Guidance:</b> ${esc(data.starGuidance || 'Use Situation, Task, Action, and Result framework.')}
        </div>
        ${techList}
        ${behavList}
      </div>`);
  }

  async function handleAiSkillGap() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    if (!jd) {
      notify('Please enter a target Job Description in the ATS Analyzer first.');
      switchRoute('ats');
      return;
    }
    openAiModal('✦ Analyzing Career Skill Gaps…', '<p style="color: var(--text-secondary);">Comparing competencies and discovering learning pathways...</p>');

    try {
      const data = await api('/api/ai/skill-gap', {
        resume: state.resume,
        jobDescription: jd
      });
      const matched = (data.matched || []).map((s) => `<span class="kw-tag exact">✓ ${esc(s)}</span>`).join('');
      const gaps = (data.gaps || []).map((s) => `<span class="kw-tag missing">✕ ${esc(s)}</span>`).join('');
      const guidance = (data.guidance || []).map((g) => `<li style="font-size: 12.5px; color: var(--text-medium); margin-bottom: 6px;">${esc(g)}</li>`).join('');

      openAiModal('📈 Career Skill Gap Analysis', `
        <div class="ai-diff-box">
          <h4 style="font-size: 13px; font-weight: 700; color: #4ade80; margin-bottom: 8px;">✓ Verified Matching Competencies:</h4>
          <div class="keyword-tags-row" style="margin-bottom: 16px;">${matched || '<span style="color: var(--text-muted); font-size: 11px;">No exact skill matches identified.</span>'}</div>

          <h4 style="font-size: 13px; font-weight: 700; color: #f87171; margin-bottom: 8px;">✕ High-Priority Skill Gaps in JD:</h4>
          <div class="keyword-tags-row" style="margin-bottom: 16px;">${gaps || '<span style="color: var(--text-muted); font-size: 11px;">No skill gaps detected!</span>'}</div>

          ${guidance ? `<h4 style="font-size: 13px; font-weight: 700; color: var(--gold-start); margin-bottom: 8px;">✦ Recommended Learning & Career Pathway:</h4><ul style="margin-left: 18px;">${guidance}</ul>` : ''}
        </div>`);
    } catch (err) {
      openAiModal('Skill Gap Error', `<p style="color: var(--ruby-danger);">${esc(err.message)}</p>`);
    }
  }

  // =========================================================================
  // APPLICATIONS TRACKER
  // =========================================================================
  function renderApplicationsTable() {
    const tbody = $('#applications-table-body');
    const emptyMsg = $('#applications-empty-msg');
    if (!tbody) return;

    if (!state.applications.length) {
      tbody.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    tbody.innerHTML = state.applications.map((app, idx) => {
      const statusClass = (app.status || 'applied').toLowerCase();
      return `
        <tr>
          <td><b>${esc(app.company)}</b></td>
          <td>${esc(app.position)}</td>
          <td>${esc(app.date || '—')}</td>
          <td><span class="status-pill ${statusClass}">${esc(app.status)}</span></td>
          <td>${app.atsScore ? `<b>${app.atsScore}%</b>` : '—'}</td>
          <td>
            <button type="button" class="btn-danger-outline" data-remove-app="${idx}">Delete</button>
          </td>
        </tr>`;
    }).join('');
  }

  function addApplication() {
    const company = $('#app-company')?.value.trim();
    const position = $('#app-position')?.value.trim();
    if (!company || !position) {
      notify('Please enter both Company and Role title.');
      return;
    }

    const app = {
      id: makeId(),
      company,
      position,
      url: $('#app-url')?.value.trim() || '',
      date: $('#app-date')?.value || new Date().toISOString().split('T')[0],
      version: $('#app-version')?.value.trim() || state.resume.versionName || 'Master Draft',
      status: $('#app-status')?.value || 'Applied',
      notes: $('#app-notes')?.value.trim() || '',
      atsScore: state.lastAnalysis?.score || null
    };

    state.applications.unshift(app);
    saveNow();
    renderApplicationsTable();
    notify(`Saved application for ${company}`);

    $('#app-company').value = '';
    $('#app-position').value = '';
    $('#app-url').value = '';
    $('#app-notes').value = '';
  }

  // =========================================================================
  // DASHBOARD STATS & TRENDS
  // =========================================================================
  function updateDashboardStats() {
    if ($('#stat-resumes')) $('#stat-resumes').textContent = '1 Active';
    if ($('#stat-scans')) $('#stat-scans').textContent = state.analyses.length;
    if ($('#stat-applications')) $('#stat-applications').textContent = state.applications.length;

    // Update ATS input card live candidate preview
    const candName = state.resume.personal?.name || 'Active Candidate';
    const candTitle = state.resume.personal?.title || 'Engineer';
    const skillCount = (state.resume.skills || []).length;
    if ($('#ats-active-name')) $('#ats-active-name').textContent = candName;
    if ($('#ats-active-meta')) $('#ats-active-meta').textContent = `${candTitle} · ${skillCount} skills listed`;

    const scores = state.analyses.map((a) => a.score).filter(Number.isFinite);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    if ($('#stat-avg-score')) {
      $('#stat-avg-score').textContent = avgScore !== null ? `${avgScore}%` : '—';
    }

    // Update Dashboard Score Hero Ring
    const latestScore = state.lastAnalysis?.score || (scores.length ? scores[scores.length - 1] : null);

    if (latestScore !== null && latestScore !== undefined) {
      const latestLevel = state.lastAnalysis?.level || (latestScore >= 80 ? 'Strong Match' : latestScore >= 60 ? 'Moderate Match' : 'Needs Optimization');
      if ($('#dash-score-level')) $('#dash-score-level').textContent = `${latestLevel} (${latestScore}%)`;
      if ($('#dash-score-unit')) $('#dash-score-unit').textContent = 'Match';
      if ($('#dash-score-desc')) $('#dash-score-desc').textContent = `Latest ATS scan evaluated at ${latestScore}% compatibility for target role.`;
      setScoreRing($('#dash-score-ring'), $('#dash-score-num'), latestScore);
    } else {
      if ($('#dash-score-level')) $('#dash-score-level').textContent = 'Scan Ready';
      if ($('#dash-score-unit')) $('#dash-score-unit').textContent = 'READY';
      if ($('#dash-score-num')) $('#dash-score-num').textContent = '—';
      if ($('#dash-score-desc')) $('#dash-score-desc').textContent = 'Upload or build a resume and run an ATS scan against any target Job Description.';
      const ring = $('#dash-score-ring');
      if (ring) ring.style.strokeDashoffset = 283;
    }

    const versionsList = $('#dash-versions-list');
    if (versionsList) {
      const updateDate = state.resume.updatedAt ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(state.resume.updatedAt)) : 'Just now';
      versionsList.innerHTML = `
        <div class="dash-version-item">
          <div>
            <strong>${esc(state.resume.versionName || 'Master Draft')}</strong>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${esc(state.resume.personal?.name || 'Alex Morgan')} · Updated ${updateDate}</div>
          </div>
          <button class="btn btn-secondary btn-sm" data-route="resume">Edit in Builder →</button>
        </div>`;
    }

    const trendsContainer = $('#dash-skill-trends');
    if (trendsContainer) {
      const missingCounts = new Map();
      state.analyses.forEach((analysis) => {
        (analysis.missingKeywords || []).forEach((item) => {
          const term = typeof item === 'string' ? item : item.keyword;
          if (term) missingCounts.set(term, (missingCounts.get(term) || 0) + 1);
        });
      });
      const topTrends = [...missingCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

      if (topTrends.length) {
        const maxVal = topTrends[0][1];
        trendsContainer.innerHTML = topTrends.map(([skill, count]) => `
          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
              <span>${esc(skill)}</span>
              <span style="color: var(--text-muted);">${count} check${count === 1 ? '' : 's'}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width: ${Math.round((count / maxVal) * 100)}%;"></div></div>
          </div>`).join('');
      } else {
        trendsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12.5px;">Run ATS scans on job descriptions to reveal missing skill trends and frequency metrics.</p>';
      }
    }
  }

  // =========================================================================
  // AUTHENTICATION & MODAL HANDLING
  // =========================================================================
  function setupAuth() {
    const authModal = $('#auth-modal');
    const authTriggerBtn = $('#auth-trigger-btn');
    const settingsAuthBtn = $('#settings-auth-btn');
    const authCloseBtn = $('#auth-modal-close');
    const googleBtn = $('#modal-google-btn');
    const alertBox = $('#auth-alert-msg');

    const showAlert = (msg) => {
      if (alertBox) {
        alertBox.textContent = msg;
        alertBox.style.display = 'block';
      }
    };
    const hideAlert = () => {
      if (alertBox) alertBox.style.display = 'none';
    };

    const openAuth = () => {
      hideAlert();
      if (authModal) authModal.style.display = 'flex';
    };
    authTriggerBtn?.addEventListener('click', openAuth);
    settingsAuthBtn?.addEventListener('click', openAuth);
    $('#dash-auth-btn')?.addEventListener('click', openAuth);

    authCloseBtn?.addEventListener('click', () => {
      if (authModal) authModal.style.display = 'none';
    });

    $('#to-signup-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideAlert();
      $('#modal-signin-form').style.display = 'none';
      $('#modal-signup-form').style.display = 'flex';
      $('#modal-forgot-form').style.display = 'none';
      $('#auth-modal-title').textContent = 'Create an Account';
    });
    $('#to-signin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideAlert();
      $('#modal-signin-form').style.display = 'flex';
      $('#modal-signup-form').style.display = 'none';
      $('#modal-forgot-form').style.display = 'none';
      $('#auth-modal-title').textContent = 'Sign in to KnowYourResume';
    });
    $('#to-forgot-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideAlert();
      $('#modal-signin-form').style.display = 'none';
      $('#modal-signup-form').style.display = 'none';
      $('#modal-forgot-form').style.display = 'flex';
      $('#auth-modal-title').textContent = 'Reset Password';
    });
    $('#back-to-signin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideAlert();
      $('#modal-signin-form').style.display = 'flex';
      $('#modal-signup-form').style.display = 'none';
      $('#modal-forgot-form').style.display = 'none';
      $('#auth-modal-title').textContent = 'Sign in to KnowYourResume';
    });

    // Sign In Submission
    $('#modal-signin-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      const email = $('#modal-login-email')?.value.trim();
      const pass = $('#modal-login-password')?.value;
      try {
        await signInWithEmail(email, pass);
        if (authModal) authModal.style.display = 'none';
        notify('Signed in successfully.');
      } catch (err) {
        showAlert(mapAuthError(err));
      }
    });

    // Sign Up Submission
    $('#modal-signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      const name = $('#modal-signup-name')?.value.trim();
      const email = $('#modal-signup-email')?.value.trim();
      const pass = $('#modal-signup-password')?.value;
      const confirm = $('#modal-signup-confirm')?.value;
      try {
        await signUpWithEmail(name, email, pass, confirm);
        if (authModal) authModal.style.display = 'none';
        notify('Account created! Welcome to KnowYourResume.');
      } catch (err) {
        showAlert(mapAuthError(err));
      }
    });

    // Forgot Password Submission
    $('#modal-forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      const email = $('#modal-forgot-email')?.value.trim();
      try {
        await resetPassword(email);
        showAlert('Password reset link sent! Check your inbox.');
        notify('Password reset email sent.');
      } catch (err) {
        showAlert(mapAuthError(err));
      }
    });

    googleBtn?.addEventListener('click', async () => {
      hideAlert();
      const originalText = googleBtn.innerHTML;
      try {
        googleBtn.disabled = true;
        googleBtn.style.opacity = '0.7';
        googleBtn.innerHTML = '<span>Connecting to Google…</span>';
        await signInWithGoogle();
        if (authModal) authModal.style.display = 'none';
        notify('Signed in with Google.');
      } catch (err) {
        showAlert(mapAuthError(err));
      } finally {
        googleBtn.disabled = false;
        googleBtn.style.opacity = '1';
        googleBtn.innerHTML = originalText;
      }
    });

    $('#nav-logout-btn')?.addEventListener('click', async () => {
      try {
        await logOut();
        notify('Signed out.');
      } catch (err) {
        notify(`Sign out error: ${err.message}`);
      }
    });

    onAuthChange((user) => {
      currentUser = user;
      const triggerBtn = $('#auth-trigger-btn');
      const badge = $('#user-badge');
      const avatar = $('#nav-user-avatar');
      const name = $('#nav-user-name');
      const syncStatus = $('#settings-cloud-sync-status');
      const dashAuthText = $('#dash-auth-btn-text');

      if (user && user.uid) {
        if (triggerBtn) triggerBtn.style.display = 'none';
        if (badge) badge.style.display = 'flex';
        const displayName = user.name || user.displayName || user.email.split('@')[0];
        if (name) name.textContent = displayName;
        if (avatar) avatar.textContent = displayName.slice(0, 2).toUpperCase();
        if (syncStatus) syncStatus.textContent = `Connected as ${user.email} (Cloud Sync Active)`;
        if (dashAuthText) dashAuthText.textContent = `✓ Synced: ${displayName} (Manage)`;
      } else {
        if (triggerBtn) triggerBtn.style.display = 'inline-flex';
        if (badge) badge.style.display = 'none';
        if (syncStatus) syncStatus.textContent = 'Sign in to sync your resumes across devices';
        if (dashAuthText) dashAuthText.textContent = '🔐 Sign In / Cloud Account';
      }
    });
  }

  // =========================================================================
  // EVENT LISTENERS & DELEGATION
  // =========================================================================
  function bindEvents() {
    // Navigation
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-route]');
      if (btn) {
        const route = btn.dataset.route;
        switchRoute(route);
        // Close mobile drawer if open
        const drawer = $('#mobile-drawer-overlay');
        if (drawer) drawer.style.display = 'none';
      }

      const templateCard = e.target.closest('[data-select-template]') || e.target.closest('[data-use-template]');
      if (templateCard) {
        const tmpl = templateCard.dataset.selectTemplate || templateCard.dataset.useTemplate;
        if (tmpl) {
          state.resume.template = tmpl;
          if ($('#template-select-inline')) $('#template-select-inline').value = tmpl;
          renderTemplatesGallery();
          renderPreview();
          scheduleSave();
          switchRoute('resume');
          notify(`Template applied: ${tmpl.toUpperCase()}`);
        }
        return;
      }

      const removeAppBtn = e.target.closest('[data-remove-app]');
      if (removeAppBtn) {
        const idx = Number(removeAppBtn.dataset.removeApp);
        state.applications.splice(idx, 1);
        saveNow();
        renderApplicationsTable();
        notify('Application removed.');
      }
    });

    // Form live bindings
    $('#resume-form')?.addEventListener('input', (e) => {
      const personalField = e.target.dataset.personal;
      if (personalField) {
        state.resume.personal[personalField] = e.target.value;
        renderPreview();
        scheduleSave();
        return;
      }

      if (e.target.id === 'summary-input') {
        state.resume.summary = e.target.value;
        renderPreview();
        scheduleSave();
        return;
      }

      const expField = e.target.dataset.expField;
      if (expField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.experiences[idx]) {
          if (e.target.type === 'checkbox') {
            state.resume.experiences[idx][expField] = e.target.checked;
          } else {
            state.resume.experiences[idx][expField] = e.target.value;
          }
          renderPreview();
          scheduleSave();
        }
        return;
      }
      
      const eduField = e.target.dataset.eduField;
      if (eduField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.education[idx]) {
          state.resume.education[idx][eduField] = e.target.value;
          renderPreview();
          scheduleSave();
        }
        return;
      }

      const projField = e.target.dataset.projField;
      if (projField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.projects[idx]) {
          state.resume.projects[idx][projField] = e.target.value;
          renderPreview();
          scheduleSave();
        }
        return;
      }

      const certField = e.target.dataset.certField;
      if (certField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.certifications[idx]) {
          state.resume.certifications[idx][certField] = e.target.value;
          renderPreview();
          scheduleSave();
        }
        return;
      }

      const langField = e.target.dataset.langField;
      if (langField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.languages[idx]) {
          state.resume.languages[idx][langField] = e.target.value;
          renderPreview();
          scheduleSave();
        }
        return;
      }

      const customField = e.target.dataset.customField;
      if (customField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.customSections[idx]) {
          state.resume.customSections[idx][customField] = e.target.value;
          renderPreview();
          scheduleSave();
        }
      }
    });

    $('#add-experience-btn')?.addEventListener('click', () => {
      state.resume.experiences.unshift({
        title: '', company: '', location: '', startDate: '', endDate: '', current: false, description: ''
      });
      renderExperienceList();
      renderPreview();
      scheduleSave();
    });

    $('#add-education-btn')?.addEventListener('click', () => {
      state.resume.education.push({ degree: '', school: '', location: '', year: '' });
      renderEducationList();
      renderPreview();
      scheduleSave();
    });

    $('#add-skill-btn')?.addEventListener('click', addSkillFromInput);
    $('#skill-text-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkillFromInput();
      }
    });

    $('#add-project-btn')?.addEventListener('click', () => {
      state.resume.projects.push({ title: '', link: '', technologies: '', description: '' });
      renderProjectsList();
      renderPreview();
      scheduleSave();
    });

    $('#add-cert-btn')?.addEventListener('click', () => {
      state.resume.certifications.push({ name: '', issuer: '', year: '' });
      renderCertificationsList();
      renderPreview();
      scheduleSave();
    });

    $('#add-language-btn')?.addEventListener('click', () => {
      state.resume.languages.push({ language: '', proficiency: '' });
      renderLanguagesList();
      renderPreview();
      scheduleSave();
    });

    $('#add-custom-btn')?.addEventListener('click', () => {
      state.resume.customSections.push({ title: '', content: '' });
      renderCustomSectionsList();
      renderPreview();
      scheduleSave();
    });

    $('#load-sample-btn')?.addEventListener('click', () => {
      state.resume = sampleResume();
      populateForm();
      updateDashboardStats();
      scheduleSave();
      notify('Demo engineering resume loaded!');
    });

    // Import Resume in Topbar
    $('#import-resume-btn')?.addEventListener('click', () => {
      $('#import-resume-file-input')?.click();
    });
    $('#import-resume-file-input')?.addEventListener('change', handleTopResumeImport);

    // ATS Source selection toggles
    $('#source-pill-builder')?.addEventListener('click', () => {
      $('#source-pill-builder').classList.add('active');
      $('#source-pill-upload').classList.remove('active');
      const radio = $('#source-pill-builder input');
      if (radio) radio.checked = true;
      if ($('#ats-builder-source-details')) $('#ats-builder-source-details').style.display = 'block';
      if ($('#ats-resume-upload-zone')) $('#ats-resume-upload-zone').style.display = 'none';
    });

    $('#source-pill-upload')?.addEventListener('click', () => {
      $('#source-pill-upload').classList.add('active');
      $('#source-pill-builder').classList.remove('active');
      const radio = $('#source-pill-upload input');
      if (radio) radio.checked = true;
      if ($('#ats-builder-source-details')) $('#ats-builder-source-details').style.display = 'none';
      if ($('#ats-resume-upload-zone')) $('#ats-resume-upload-zone').style.display = 'block';
    });

    $('#ats-resume-file-input')?.addEventListener('change', handleAtsResumeFileUpload);

    $('#top-export-pdf-btn')?.addEventListener('click', () => window.print());
    $('#print-resume-btn')?.addEventListener('click', () => window.print());

    $('#paper-a4-btn')?.addEventListener('click', () => {
      state.resume.paperSize = 'a4';
      $('#paper-a4-btn').classList.add('active');
      $('#paper-letter-btn').classList.remove('active');
      renderPreview();
      scheduleSave();
    });
    $('#paper-letter-btn')?.addEventListener('click', () => {
      state.resume.paperSize = 'letter';
      $('#paper-letter-btn').classList.add('active');
      $('#paper-a4-btn').classList.remove('active');
      renderPreview();
      scheduleSave();
    });

    $('#template-select-inline')?.addEventListener('change', (e) => {
      state.resume.template = e.target.value;
      renderPreview();
      scheduleSave();
      notify(`Template: ${e.target.value.toUpperCase()}`);
    });

    $('#zoom-in-btn')?.addEventListener('click', () => {
      state.zoom = Math.min(1.4, Number((state.zoom + 0.1).toFixed(1)));
      applyZoom();
    });
    $('#zoom-out-btn')?.addEventListener('click', () => {
      state.zoom = Math.max(0.4, Number((state.zoom - 0.1).toFixed(1)));
      applyZoom();
    });

    $('#ai-summary-btn')?.addEventListener('click', handleAiSummary);
    $('#ats-optimize-ai-btn')?.addEventListener('click', handleAiFullOptimization);
    $('#run-ats-btn')?.addEventListener('click', runAtsAnalysis);
    $('#job-file-input')?.addEventListener('change', handleJobFileUpload);

    $('#save-app-btn')?.addEventListener('click', addApplication);

    $('#ai-modal-close')?.addEventListener('click', closeAiModal);
    $('#ai-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'ai-modal') closeAiModal();
    });
    $('#auth-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'auth-modal') $('#auth-modal').style.display = 'none';
    });

    // Mobile Drawer Handlers
    $('#mobile-menu-toggle-btn')?.addEventListener('click', () => {
      const drawer = $('#mobile-drawer-overlay');
      if (drawer) drawer.style.display = 'flex';
    });
    $('#mobile-drawer-close')?.addEventListener('click', () => {
      const drawer = $('#mobile-drawer-overlay');
      if (drawer) drawer.style.display = 'none';
    });
    $('#mobile-drawer-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'mobile-drawer-overlay') {
        $('#mobile-drawer-overlay').style.display = 'none';
      }
    });

    $('#mobile-import-btn')?.addEventListener('click', () => {
      const drawer = $('#mobile-drawer-overlay');
      if (drawer) drawer.style.display = 'none';
      $('#import-resume-file-input')?.click();
    });
    $('#mobile-demo-btn')?.addEventListener('click', () => {
      state.resume = sampleResume();
      populateForm();
      updateDashboardStats();
      scheduleSave();
      const drawer = $('#mobile-drawer-overlay');
      if (drawer) drawer.style.display = 'none';
      notify('Demo engineering resume loaded!');
    });
    $('#mobile-print-btn')?.addEventListener('click', () => {
      const drawer = $('#mobile-drawer-overlay');
      if (drawer) drawer.style.display = 'none';
      window.print();
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      switchRoute(hash);
    });
  }

  // =========================================================================
  // BOOTSTRAP
  // =========================================================================
  async function init() {
    loadState();
    bindEvents();
    populateForm();
    renderTemplatesGallery();
    setupAuth();

    const initRoute = window.location.hash.slice(1) || 'dashboard';
    switchRoute(initRoute);

    try {
      const res = await fetch('/api/config/firebase');
      if (res.ok) {
        const firebaseConfig = await res.json();
        await initFirebaseAuth(firebaseConfig);
      } else {
        await initFirebaseAuth({});
      }
    } catch {
      await initFirebaseAuth({});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();