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

(() => {
  'use strict';

  const templates = [
    ['classic', 'ATS Classic', 'Clear hierarchy · Traditional layout'],
    ['modern', 'Modern Accent', 'Structured headers · Refined accents'],
    ['executive', 'Executive', 'Senior positioning · Editorial typography'],
    ['tech', 'Tech Focused', 'Skills-focused · Engineering layout'],
    ['minimal', 'Minimalist', 'Quiet typography · Direct layout'],
    ['corporate', 'Corporate', 'Formal balance · Structured sections'],
    ['creative', 'Creative', 'Expressive accents · Clear flow'],
    ['compact', 'Compact', 'Dense typography · Space-efficient']
  ];

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
    versionName: 'Full-Stack & Cloud Engineer',
    personal: {
      name: 'Alex Morgan',
      title: 'Senior Full-Stack & Cloud Systems Engineer',
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
  let aiAvailable = false;

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
    toast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
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
    // If no saved state, initialize with sample data so user immediately sees a live preview
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
    const validRoutes = ['resume', 'ats', 'templates', 'ai', 'applications', 'dashboard'];
    const target = validRoutes.includes(route) ? route : 'resume';
    window.location.hash = target;

    $$('.view-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `view-${target}`);
    });
    $$('[data-route]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === target);
    });

    if (target === 'templates') renderTemplatesGallery();
    if (target === 'applications') renderApplicationsTable();
    if (target === 'dashboard') updateDashboardStats();
    if (target === 'ats') renderAnalysis();
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
            <label style="flex-direction: row; align-items: center; gap: 8px; cursor: pointer;">
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
      </div>`).join('') || '<p class="muted-text">No work experience entries yet. Click "＋ Add Position" above.</p>';
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
      </div>`).join('') || '<p class="muted-text">No education entries yet. Click "＋ Add Education" above.</p>';
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

    // Support comma-separated skills
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
      </div>`).join('') || '<p class="muted-text">No standout projects yet. Click "＋ Add Project" above.</p>';
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
      </div>`).join('') || '<p class="muted-text">No certifications yet. Click "＋ Add Certification" above.</p>';
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
      </div>`).join('') || '<p class="muted-text">No languages added yet. Click "＋ Add Language" above.</p>';
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
      </div>`).join('') || '<p class="muted-text">No custom sections added yet. Click "＋ Add Section" above.</p>';
  }

  // =========================================================================
  // TEMPLATES GALLERY VIEW
  // =========================================================================
  function renderTemplatesGallery() {
    const grid = $('#templates-grid-cards');
    if (!grid) return;
    grid.innerHTML = templates.map(([id, name, desc]) => {
      const isSelected = (state.resume.template || 'classic') === id;
      return `
        <div class="template-thumb-card ${isSelected ? 'active' : ''}" data-select-template="${id}">
          <div class="template-mini-preview">
            <div class="mini-line title"></div>
            <div class="mini-line accent"></div>
            <div class="mini-line"></div>
            <div class="mini-line"></div>
            <div class="mini-line" style="width: 80%;"></div>
          </div>
          <h3>${esc(name)} ${isSelected ? '✓' : ''}</h3>
          <p>${esc(desc)}</p>
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

    if (!resumeText().trim()) {
      notify('Please add some content to your resume before running ATS analysis.');
      switchRoute('resume');
      return;
    }
    if (!jd) {
      notify('Please paste or upload a target Job Description.');
      return;
    }

    const runBtn = $('#run-ats-btn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = 'Calculating ATS Score…';
    }

    const container = $('#ats-results-container');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <h3>Analyzing Resume &amp; Job Alignment</h3>
          <p>Evaluating deterministic keyword frequency, categorized skill coverage, completeness, and recruiter readability...</p>
        </div>`;
    }

    try {
      const result = await api('/api/ats/analyze', {
        resume: state.resume,
        jobDescription: jd
      });
      state.lastAnalysis = result;
      state.analyses.push({
        score: result.score,
        level: result.level,
        date: new Date().toISOString(),
        missingKeywords: result.missingKeywords || []
      });
      saveNow();
      renderAnalysis();
      notify(`ATS Analysis Complete: ${result.score}% Compatibility (${result.level})`);
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
        runBtn.innerHTML = 'Calculate ATS Compatibility <span>→</span>';
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
      .slice(0, 15)
      .map((k) => `<span class="kw-tag exact">${esc(k.keyword)} (${k.resumeFrequency}x)</span>`)
      .join('');

    const missingTags = (result.missingKeywords || [])
      .slice(0, 15)
      .map((k) => `<span class="kw-tag missing">${esc(k.keyword || k)}</span>`)
      .join('');

    const skillGroupHtml = (result.skillGroups || []).map((grp) => `
      <div style="margin-bottom: 10px; font-size: 12px;">
        <strong style="color: var(--brand-primary);">${esc(grp.category)}:</strong>
        ${grp.matched.length ? `<span style="color: #4ade80;"> Matched: ${esc(grp.matched.join(', '))}</span>` : ''}
        ${grp.missing.length ? `<span style="color: #f87171;"> Missing: ${esc(grp.missing.join(', '))}</span>` : ''}
      </div>`).join('');

    container.innerHTML = `
      <div class="ats-score-hero">
        <div class="score-badge-circle">
          <span>${result.score}%</span>
          <small>Match</small>
        </div>
        <div class="score-hero-info">
          <h3>${esc(result.level)}</h3>
          <p>${esc(result.disclaimer || 'Deterministic compatibility estimate based on 6 weighted factors.')}</p>
        </div>
      </div>

      <div class="breakdown-bars-grid">
        ${breakdownHtml}
      </div>

      <div class="keywords-section">
        <h4>Identified Keyword Alignment</h4>
        <div class="keyword-tags-row" style="margin-bottom: 12px;">
          ${matchedTags || '<span style="color: var(--text-muted); font-size: 11px;">No exact keyword matches found.</span>'}
        </div>

        ${missingTags ? `
          <h4>High-Priority Missing Keywords in Job Description</h4>
          <div class="keyword-tags-row" style="margin-bottom: 14px;">
            ${missingTags}
          </div>` : ''}

        ${skillGroupHtml ? `
          <h4>Catalogued Skill Categories</h4>
          ${skillGroupHtml}` : ''}
      </div>`;
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
        if (status) status.textContent = `Loaded: ${file.name}`;
        notify(`Loaded ${file.name}`);
      } else {
        // Use backend extract endpoint for PDF / DOCX
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
              if (status) status.textContent = `Extracted: ${file.name}`;
              notify(`Extracted text from ${file.name}`);
            }
          } catch (err) {
            if (status) status.textContent = `Error extracting document: ${err.message}`;
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

  async function handleAiSummary() {
    if (!resumeText().trim()) {
      notify('Please add some experience and skills to your resume first.');
      return;
    }
    openAiModal('Generating Executive Summary…', '<p>Consulting Gemini AI with your resume evidence...</p>');

    try {
      const data = await api('/api/ai/generate-summary', {
        resume: state.resume,
        jobDescription: state.jobDescription || ''
      });
      openAiModal('✦ Generated Executive Summary', `
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">Based strictly on your supplied achievements and target role:</p>
        <div class="ai-diff-box">${text(data.summary)}</div>
        <div class="form-actions end">
          <button type="button" class="btn btn-primary" id="apply-ai-summary-btn">Insert Summary into Resume</button>
        </div>`);

      $('#apply-ai-summary-btn')?.addEventListener('click', () => {
        state.resume.summary = data.summary;
        populateForm();
        scheduleSave();
        closeAiModal();
        notify('Executive summary inserted into your resume.');
      });
    } catch (err) {
      openAiModal('AI Summary Error', `<p style="color: var(--danger);">${esc(err.message)}</p>`);
    }
  }

  async function handleAiBullet(index) {
    const exp = state.resume.experiences[index];
    if (!exp || !exp.description) {
      notify('Please enter achievements for this position first.');
      return;
    }
    openAiModal('Optimizing Bullet Points…', '<p>Enhancing action language and clarity with Gemini AI...</p>');

    try {
      const data = await api('/api/ai/optimize-bullet', {
        bullet: exp.description,
        jobDescription: state.jobDescription || ''
      });
      openAiModal('✦ Optimized Accomplishment Bullets', `
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Original Bullets:</p>
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px;">${text(exp.description)}</div>
        <p style="font-size: 12px; color: var(--brand-primary); margin-bottom: 8px;">Optimized Bullets:</p>
        <div class="ai-diff-box">${text(data.optimizedBullet)}</div>
        ${data.explanation ? `<p style="font-size: 11px; color: var(--text-muted);">${esc(data.explanation)}</p>` : ''}
        <div class="form-actions end">
          <button type="button" class="btn btn-primary" id="apply-ai-bullet-btn">Apply to Position #${index + 1}</button>
        </div>`);

      $('#apply-ai-bullet-btn')?.addEventListener('click', () => {
        state.resume.experiences[index].description = data.optimizedBullet;
        renderExperienceList();
        renderPreview();
        scheduleSave();
        closeAiModal();
        notify(`Optimized bullets applied to Position #${index + 1}.`);
      });
    } catch (err) {
      openAiModal('AI Bullet Optimizer Error', `<p style="color: var(--danger);">${esc(err.message)}</p>`);
    }
  }

  async function handleAiFullOptimization() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    if (!jd) {
      notify('Please enter a target Job Description in the ATS Analyzer first.');
      switchRoute('ats');
      return;
    }
    openAiModal('Tailoring Full Resume…', '<p>Analyzing role alignment and building tailored recommendations with Gemini AI...</p>');

    try {
      const data = await api('/api/ai/optimize-resume', {
        resume: state.resume,
        jobDescription: jd
      });

      const changesList = (data.changes || []).map((c) => `
        <div style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px;">
          <strong style="color: var(--brand-primary);">${esc(c.section || 'Section')}</strong>: ${esc(c.reason || '')}
          <div style="font-size: 12px; margin-top: 4px; color: #4ade80;">+ ${text(c.after || c.suggested || '')}</div>
        </div>`).join('');

      openAiModal('✦ Role-Tailored Resume Plan', `
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">${esc(data.executiveFeedback || 'Review recommended adjustments to maximize keyword alignment and relevance:')}</p>
        <div class="ai-diff-box">${changesList || `<p>${text(data.tailoredSummary || 'Tailoring complete.')}</p>`}</div>
        ${data.tailoredSummary ? `
          <div class="form-actions end">
            <button type="button" class="btn btn-primary" id="apply-ai-tailored-summary">Apply Tailored Summary</button>
          </div>` : ''}`);

      $('#apply-ai-tailored-summary')?.addEventListener('click', () => {
        state.resume.summary = data.tailoredSummary;
        populateForm();
        scheduleSave();
        closeAiModal();
        notify('Tailored summary applied.');
      });
    } catch (err) {
      openAiModal('AI Tailoring Error', `<p style="color: var(--danger);">${esc(err.message)}</p>`);
    }
  }

  async function handleAiCoverLetter() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    if (!resumeText().trim()) {
      notify('Please enter resume content first.');
      return;
    }
    openAiModal('Drafting Tailored Cover Letter…', '<p>Synthesizing your experience with target role requirements...</p>');

    try {
      const data = await api('/api/ai/generate-cover-letter', {
        resume: state.resume,
        jobDescription: jd || ''
      });
      openAiModal('✉️ Tailored Cover Letter', `
        <div class="ai-diff-box" id="cover-letter-text">${text(data.coverLetter)}</div>
        <div class="form-actions end">
          <button type="button" class="btn btn-secondary" id="copy-cover-letter-btn">Copy to Clipboard</button>
        </div>`);

      $('#copy-cover-letter-btn')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(data.coverLetter);
          notify('Cover letter copied to clipboard!');
        } catch {
          notify('Failed to copy to clipboard.');
        }
      });
    } catch (err) {
      openAiModal('Cover Letter Error', `<p style="color: var(--danger);">${esc(err.message)}</p>`);
    }
  }

  async function handleAiInterviewPrep() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    openAiModal('Generating STAR Interview Questions…', '<p>Building behavioral & technical practice questions from your background...</p>');

    try {
      const data = await api('/api/ai/interview-questions', {
        resume: state.resume,
        jobDescription: jd || ''
      });
      const qHtml = (data.questions || []).map((q, idx) => `
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <h4 style="font-size: 13px; font-weight: 700; color: var(--brand-primary); margin-bottom: 6px;">Q${idx + 1}: ${esc(q.question)}</h4>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;"><b>What they are testing:</b> ${esc(q.intent || '')}</p>
          <p style="font-size: 12px; color: #4ade80;"><b>STAR Framework Tip:</b> ${esc(q.starGuidance || q.sampleAnswer || '')}</p>
        </div>`).join('');

      openAiModal('🎤 STAR Interview Preparation', `<div class="ai-diff-box">${qHtml}</div>`);
    } catch (err) {
      openAiModal('Interview Prep Error', `<p style="color: var(--danger);">${esc(err.message)}</p>`);
    }
  }

  async function handleAiSkillGap() {
    const jd = state.jobDescription || $('#job-description-input')?.value.trim();
    if (!jd) {
      notify('Please enter a target Job Description in the ATS Analyzer first.');
      switchRoute('ats');
      return;
    }
    openAiModal('Analyzing Career Skill Gaps…', '<p>Comparing domain competencies and identifying growth opportunities with Gemini AI...</p>');

    try {
      const data = await api('/api/ai/skill-gap', {
        resume: state.resume,
        jobDescription: jd
      });
      const gaps = (data.skillGaps || []).map((g) => `
        <div style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px;">
          <strong style="color: #f87171;">${esc(g.skill || g.name)}</strong>: ${esc(g.impact || '')}
          <div style="font-size: 12px; margin-top: 4px; color: var(--text-muted);">Recommended Action: ${esc(g.recommendedLearning || g.resource || '')}</div>
        </div>`).join('');

      openAiModal('📈 Career Skill Gap Analysis', `
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">${esc(data.summary || 'Skill gap analysis for target position:')}</p>
        <div class="ai-diff-box">${gaps}</div>`);
    } catch (err) {
      openAiModal('Skill Gap Error', `<p style="color: var(--danger);">${esc(err.message)}</p>`);
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
    notify(`Added application for ${company}`);

    // Reset inputs
    $('#app-company').value = '';
    $('#app-position').value = '';
    $('#app-url').value = '';
    $('#app-notes').value = '';
  }

  // =========================================================================
  // DASHBOARD STATS
  // =========================================================================
  function updateDashboardStats() {
    if ($('#stat-resumes')) $('#stat-resumes').textContent = '1 Active Draft';
    if ($('#stat-scans')) $('#stat-scans').textContent = state.analyses.length;
    if ($('#stat-applications')) $('#stat-applications').textContent = state.applications.length;

    const scores = state.analyses.map((a) => a.score).filter(Number.isFinite);
    if ($('#stat-avg-score')) {
      $('#stat-avg-score').textContent = scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : '—';
    }
    if ($('#stat-high-score')) {
      $('#stat-high-score').textContent = scores.length ? `${Math.max(...scores)}%` : '—';
    }

    const versionsList = $('#dash-versions-list');
    if (versionsList) {
      const updateDate = state.resume.updatedAt ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(state.resume.updatedAt)) : 'Just now';
      versionsList.innerHTML = `
        <div class="dash-version-item">
          <div>
            <strong>${esc(state.resume.versionName || 'Master Draft')}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${esc(state.resume.personal?.name || 'Alex Morgan')} · Updated ${updateDate}</div>
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
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
              <span>${esc(skill)}</span>
              <span style="color: var(--text-muted);">${count} check${count === 1 ? '' : 's'}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width: ${Math.round((count / maxVal) * 100)}%;"></div></div>
          </div>`).join('');
      } else {
        trendsContainer.innerHTML = '<p class="muted-text">Run ATS checks on job descriptions to reveal missing skill trends.</p>';
      }
    }
  }

  // =========================================================================
  // AUTHENTICATION & MODAL HANDLING
  // =========================================================================
  function setupAuth() {
    const authModal = $('#auth-modal');
    const authTriggerBtn = $('#auth-trigger-btn');
    const authCloseBtn = $('#auth-modal-close');
    const googleBtn = $('#modal-google-btn');

    authTriggerBtn?.addEventListener('click', () => {
      if (authModal) authModal.style.display = 'flex';
    });
    authCloseBtn?.addEventListener('click', () => {
      if (authModal) authModal.style.display = 'none';
    });

    // Toggle forms inside auth modal
    $('#to-signup-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      $('#modal-signin-form').style.display = 'none';
      $('#modal-signup-form').style.display = 'flex';
      $('#modal-forgot-form').style.display = 'none';
      $('#auth-modal-title').textContent = 'Create an Account';
    });
    $('#to-signin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      $('#modal-signin-form').style.display = 'flex';
      $('#modal-signup-form').style.display = 'none';
      $('#modal-forgot-form').style.display = 'none';
      $('#auth-modal-title').textContent = 'Sign in to KnowYourResume';
    });
    $('#to-forgot-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      $('#modal-signin-form').style.display = 'none';
      $('#modal-signup-form').style.display = 'none';
      $('#modal-forgot-form').style.display = 'flex';
      $('#auth-modal-title').textContent = 'Reset Password';
    });
    $('#back-to-signin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      $('#modal-signin-form').style.display = 'flex';
      $('#modal-signup-form').style.display = 'none';
      $('#modal-forgot-form').style.display = 'none';
      $('#auth-modal-title').textContent = 'Sign in to KnowYourResume';
    });

    // Google Sign-In
    googleBtn?.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
        if (authModal) authModal.style.display = 'none';
        notify('Signed in with Google');
      } catch (err) {
        showAuthAlert(mapAuthError(err));
      }
    });

    // Email Sign-In
    $('#modal-signin-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#modal-login-email').value.trim();
      const password = $('#modal-login-password').value;
      try {
        await signInWithEmail(email, password);
        if (authModal) authModal.style.display = 'none';
        notify('Signed in successfully');
      } catch (err) {
        showAuthAlert(mapAuthError(err));
      }
    });

    // Email Sign-Up
    $('#modal-signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#modal-signup-name').value.trim();
      const email = $('#modal-signup-email').value.trim();
      const password = $('#modal-signup-password').value;
      const confirm = $('#modal-signup-confirm').value;
      if (password !== confirm) {
        showAuthAlert('Passwords do not match');
        return;
      }
      try {
        await signUpWithEmail(name, email, password);
        if (authModal) authModal.style.display = 'none';
        notify('Account created successfully');
      } catch (err) {
        showAuthAlert(mapAuthError(err));
      }
    });

    // Reset Password
    $('#modal-forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#modal-forgot-email').value.trim();
      try {
        await resetPassword(email);
        notify('Password reset link sent to your email.');
        if (authModal) authModal.style.display = 'none';
      } catch (err) {
        showAuthAlert(mapAuthError(err));
      }
    });

    // Logout button
    $('#nav-logout-btn')?.addEventListener('click', async () => {
      await logOut();
      notify('Signed out.');
    });

    // Firebase Auth State Listener
    onAuthChange((user) => {
      currentUser = user;
      updateAuthUI(user);
      loadState();
      populateForm();
    });
  }

  function showAuthAlert(msg) {
    const alertBox = $('#auth-alert-msg');
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
    }
  }

  function updateAuthUI(user) {
    const authBtn = $('#auth-trigger-btn');
    const userBadge = $('#user-badge');
    const avatar = $('#nav-user-avatar');
    const name = $('#nav-user-name');

    if (user && user.uid) {
      if (authBtn) authBtn.style.display = 'none';
      if (userBadge) userBadge.style.display = 'flex';
      const initials = (user.name || 'User')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      if (avatar) avatar.textContent = initials;
      if (name) name.textContent = user.name || user.email?.split('@')[0] || 'User';
    } else {
      if (authBtn) authBtn.style.display = 'inline-flex';
      if (userBadge) userBadge.style.display = 'none';
    }
  }

  // =========================================================================
  // EVENT DELEGATION & GLOBAL INITIALIZATION
  // =========================================================================
  function bindEvents() {
    // Navigation routing
    document.addEventListener('click', (e) => {
      const routeTarget = e.target.closest('[data-route]');
      if (routeTarget) {
        e.preventDefault();
        switchRoute(routeTarget.dataset.route);
        return;
      }

      // Template selection from gallery
      const templateTarget = e.target.closest('[data-select-template]');
      if (templateTarget) {
        const tId = templateTarget.dataset.selectTemplate;
        state.resume.template = tId;
        const select = $('#template-select-inline');
        if (select) select.value = tId;
        renderTemplatesGallery();
        renderPreview();
        scheduleSave();
        notify(`Template switched to ${tId.toUpperCase()}`);
        return;
      }

      // AI Suite tool card actions
      const aiActionTarget = e.target.closest('[data-ai-action]');
      if (aiActionTarget) {
        const action = aiActionTarget.dataset.aiAction;
        if (action === 'summary') handleAiSummary();
        else if (action === 'bullet') handleAiBullet(0);
        else if (action === 'optimize') handleAiFullOptimization();
        else if (action === 'cover') handleAiCoverLetter();
        else if (action === 'interview') handleAiInterviewPrep();
        else if (action === 'gap') handleAiSkillGap();
        return;
      }

      // Remove item buttons
      if (e.target.dataset.removeExp !== undefined) {
        const idx = Number(e.target.dataset.removeExp);
        state.resume.experiences.splice(idx, 1);
        renderExperienceList();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeEdu !== undefined) {
        const idx = Number(e.target.dataset.removeEdu);
        state.resume.education.splice(idx, 1);
        renderEducationList();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeSkill !== undefined) {
        const idx = Number(e.target.dataset.removeSkill);
        state.resume.skills.splice(idx, 1);
        renderSkillsChips();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeProj !== undefined) {
        const idx = Number(e.target.dataset.removeProj);
        state.resume.projects.splice(idx, 1);
        renderProjectsList();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeCert !== undefined) {
        const idx = Number(e.target.dataset.removeCert);
        state.resume.certifications.splice(idx, 1);
        renderCertificationsList();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeLang !== undefined) {
        const idx = Number(e.target.dataset.removeLang);
        state.resume.languages.splice(idx, 1);
        renderLanguagesList();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeCustom !== undefined) {
        const idx = Number(e.target.dataset.removeCustom);
        state.resume.customSections.splice(idx, 1);
        renderCustomSectionsList();
        renderPreview();
        scheduleSave();
      }
      if (e.target.dataset.removeApp !== undefined) {
        const idx = Number(e.target.dataset.removeApp);
        state.applications.splice(idx, 1);
        renderApplicationsTable();
        scheduleSave();
      }

      // AI optimize specific bullet
      if (e.target.dataset.aiBulletIdx !== undefined) {
        handleAiBullet(Number(e.target.dataset.aiBulletIdx));
      }
    });

    // Form inputs for repeatable arrays
    document.addEventListener('input', (e) => {
      const expField = e.target.dataset.expField;
      if (expField) {
        const idx = Number(e.target.dataset.idx);
        if (state.resume.experiences[idx]) {
          if (expField === 'current') {
            state.resume.experiences[idx].current = e.target.checked;
            const endInput = $(`[data-exp-field="endDate"][data-idx="${idx}"]`);
            if (endInput) endInput.disabled = e.target.checked;
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

    // Add buttons
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

    // Load Sample Data
    $('#load-sample-btn')?.addEventListener('click', () => {
      state.resume = sampleResume();
      populateForm();
      scheduleSave();
      notify('Sample tech resume loaded!');
    });

    // Export PDF / Print
    $('#top-export-pdf-btn')?.addEventListener('click', () => window.print());
    $('#print-resume-btn')?.addEventListener('click', () => window.print());

    // Paper Format Switcher (A4 vs Letter)
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

    // Template selector inline dropdown
    $('#template-select-inline')?.addEventListener('change', (e) => {
      state.resume.template = e.target.value;
      renderPreview();
      scheduleSave();
      notify(`Template: ${e.target.value.toUpperCase()}`);
    });

    // Zoom Controls
    $('#zoom-in-btn')?.addEventListener('click', () => {
      state.zoom = Math.min(1.4, Number((state.zoom + 0.1).toFixed(1)));
      applyZoom();
    });
    $('#zoom-out-btn')?.addEventListener('click', () => {
      state.zoom = Math.max(0.4, Number((state.zoom - 0.1).toFixed(1)));
      applyZoom();
    });

    // AI Tools triggers from Builder & ATS view
    $('#ai-summary-btn')?.addEventListener('click', handleAiSummary);
    $('#ats-optimize-ai-btn')?.addEventListener('click', handleAiFullOptimization);
    $('#run-ats-btn')?.addEventListener('click', runAtsAnalysis);
    $('#job-file-input')?.addEventListener('change', handleJobFileUpload);

    // Applications Tracker
    $('#save-app-btn')?.addEventListener('click', addApplication);

    // AI Modal close button & backdrop click
    $('#ai-modal-close')?.addEventListener('click', closeAiModal);
    $('#ai-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'ai-modal') closeAiModal();
    });
    $('#auth-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'auth-modal') $('#auth-modal').style.display = 'none';
    });

    // Hash change listener
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

    // Set initial route
    const initRoute = window.location.hash.slice(1) || 'resume';
    switchRoute(initRoute);

    // Initialize Firebase
    try {
      const firebaseConfig = await (await fetch('/api/config/firebase')).json();
      await initFirebaseAuth(firebaseConfig);
    } catch {
      await initFirebaseAuth({});
    }

    setupAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();