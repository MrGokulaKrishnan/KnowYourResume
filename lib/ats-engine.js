'use strict';

/** A reproducible, dependency-free ATS compatibility estimator. */
const SKILL_CATALOG = {
  'Programming languages': ['javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'go', 'golang', 'rust', 'ruby', 'php', 'kotlin', 'swift', 'sql', 'r', 'scala'],
  'Frontend': ['react', 'next.js', 'nextjs', 'angular', 'vue', 'svelte', 'tailwind', 'redux', 'html5', 'css3', 'webpack', 'vite'],
  'Backend': ['node.js', 'nodejs', 'express', 'nest.js', 'nestjs', 'spring boot', 'spring', 'django', 'flask', 'fastapi', '.net', 'laravel', 'graphql', 'rest api', 'grpc'],
  'Databases': ['postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'dynamodb', 'elasticsearch', 'cassandra', 'supabase', 'firebase'],
  'Cloud & DevOps': ['aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'docker', 'terraform', 'ci/cd', 'github actions', 'jenkins', 'cloudflare', 'linux', 'ansible'],
  'AI & Data': ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'nlp', 'llm', 'data analysis', 'tableau'],
  'Tools & Architecture': ['git', 'jira', 'figma', 'agile', 'scrum', 'unit testing', 'jest', 'cypress', 'system design', 'microservices'],
  'Soft skills': ['leadership', 'communication', 'problem solving', 'collaboration', 'stakeholder management', 'mentoring', 'critical thinking', 'project management']
};

const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'among', 'and', 'are', 'been', 'being', 'between', 'both', 'build', 'building', 'candidate', 'candidates', 'can', 'company', 'customer', 'customers', 'deliver', 'design', 'develop', 'development', 'doing', 'each', 'experience', 'from', 'have', 'help', 'high', 'into', 'join', 'knowledge', 'looking', 'make', 'more', 'must', 'our', 'role', 'skills', 'strong', 'team', 'teams', 'that', 'the', 'their', 'them', 'they', 'this', 'through', 'under', 'use', 'using', 'with', 'will', 'work', 'working', 'years', 'your', 'you', 'ability', 'across', 'support', 'including', 'required', 'preferred', 'responsibilities', 'qualifications']);
const ACTION_VERBS = new Set(['achieved', 'analyzed', 'built', 'collaborated', 'created', 'delivered', 'designed', 'developed', 'drove', 'executed', 'implemented', 'improved', 'increased', 'launched', 'led', 'managed', 'optimized', 'owned', 'reduced', 'shipped', 'streamlined', 'architected', 'spearheaded', 'orchestrated', 'mentored']);

const EXPECTED_SECTIONS = [
  { label: 'Professional summary', patterns: ['summary', 'profile', 'objective', 'about'] },
  { label: 'Experience', patterns: ['experience', 'employment', 'work history', 'career'] },
  { label: 'Education', patterns: ['education', 'academic', 'degrees'] },
  { label: 'Skills', patterns: ['skills', 'technologies', 'technical skills', 'competencies'] },
  { label: 'Projects', patterns: ['projects', 'portfolio projects', 'open source'] },
  { label: 'Certifications', patterns: ['certifications', 'certificates', 'licenses', 'credentials'] }
];

const DEFAULT_WEIGHTS = {
  keywordMatch: 35,
  skillsMatch: 25,
  experienceRelevance: 15,
  completeness: 10,
  formatting: 10,
  readability: 5
};

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function occurrenceCount(text, term) {
  const matches = normalise(text).match(new RegExp(`(?<![a-z0-9+#.])${escapeRegExp(normalise(term))}(?![a-z0-9+#.])`, 'g'));
  return matches ? matches.length : 0;
}

function unique(items) {
  return [...new Set(items)];
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resumeToText(resume) {
  if (typeof resume === 'string') return resume;
  if (!resume || typeof resume !== 'object') return '';
  const personal = resume.personal || {};
  const experiences = (resume.experiences || []).map((item) => [item.title, item.company, item.location, item.description].filter(Boolean).join(' '));
  const education = (resume.education || []).map((item) => [item.degree, item.school, item.year].filter(Boolean).join(' '));
  const projects = (resume.projects || []).map((item) => [item.title, item.technologies, item.description].filter(Boolean).join(' '));
  const certs = (resume.certifications || []).map((item) => [item.name, item.issuer, item.year].filter(Boolean).join(' '));
  const languages = (resume.languages || []).map((item) => [item.language, item.proficiency].filter(Boolean).join(' '));
  const custom = (resume.customSections || []).map((section) => `${section.title || ''} ${section.content || ''}`);

  return [
    personal.name,
    personal.title,
    personal.email,
    personal.phone,
    personal.location,
    resume.summary,
    'Experience',
    ...experiences,
    'Education',
    ...education,
    'Skills',
    ...(resume.skills || []),
    'Projects',
    ...projects,
    'Certifications',
    ...certs,
    'Languages',
    ...languages,
    ...custom
  ].filter(Boolean).join('\n');
}

function extractKnownSkills(text) {
  const found = [];
  for (const [category, skills] of Object.entries(SKILL_CATALOG)) {
    for (const skill of skills) {
      if (occurrenceCount(text, skill)) found.push({ skill, category });
    }
  }
  return found;
}

function extractKeywords(text) {
  const lower = normalise(text);
  const catalogTerms = extractKnownSkills(lower).map(({ skill }) => skill);
  const words = lower.match(/[a-z][a-z+#.]{2,}/g) || [];
  const frequencies = new Map();
  words.forEach((word) => {
    if (!STOP_WORDS.has(word)) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  });
  const rankedWords = [...frequencies.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([word]) => word);
  return unique([...catalogTerms, ...rankedWords]).slice(0, 24);
}

function detectSections(text) {
  const lower = normalise(text);
  return EXPECTED_SECTIONS.map((section) => ({
    label: section.label,
    found: section.patterns.some((pattern) => lower.includes(pattern))
  }));
}

function getScoreLevel(score) {
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Strong Match';
  if (score >= 60) return 'Moderate Match';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor Match';
}

function findSectionForTerm(resume, term) {
  const personal = (resume && resume.personal) || {};
  if (occurrenceCount([personal.name, personal.title, personal.location].join(' '), term)) return 'Personal information';
  if (occurrenceCount(resume && resume.summary, term)) return 'Professional summary';
  if ((resume && resume.experiences || []).some((item) => occurrenceCount(`${item.title || ''} ${item.company || ''} ${item.description || ''}`, term))) return 'Experience';
  if (occurrenceCount((resume && resume.skills || []).join(' '), term)) return 'Skills';
  if ((resume && resume.projects || []).some((item) => occurrenceCount(`${item.title || ''} ${item.technologies || ''} ${item.description || ''}`, term))) return 'Projects';
  if ((resume && resume.certifications || []).some((item) => occurrenceCount(`${item.name || ''} ${item.issuer || ''}`, term))) return 'Certifications';
  return 'Resume';
}

function analyzeResume({ resume, resumeText, jobDescription, weights = {} } = {}) {
  const safeResume = resume && typeof resume === 'object' ? resume : {};
  const text = resumeText || resumeToText(safeResume);
  const jd = String(jobDescription || '');
  const combinedWeights = { ...DEFAULT_WEIGHTS, ...weights };
  const weightTotal = Object.values(combinedWeights).reduce((sum, value) => sum + Number(value || 0), 0) || 100;
  
  if (!normalise(jd)) return emptyAnalysis('Add a job description to calculate a compatibility estimate.');
  if (!normalise(text)) return emptyAnalysis('Add resume content before running analysis.');

  const keywords = extractKeywords(jd);
  const keywordMatches = keywords.map((keyword) => {
    const resumeFrequency = occurrenceCount(text, keyword);
    const jdFrequency = occurrenceCount(jd, keyword);
    let matchType = resumeFrequency ? 'Exact match' : 'Missing';
    if (!resumeFrequency) {
      const fragments = keyword.split(/\s+/).filter((part) => part.length > 3);
      if (fragments.some((fragment) => occurrenceCount(text, fragment))) matchType = 'Partial match';
    }
    return {
      keyword,
      jdFrequency,
      resumeFrequency,
      matchType,
      section: resumeFrequency ? findSectionForTerm(safeResume, keyword) : '—'
    };
  });

  const exactKeywords = keywordMatches.filter((item) => item.matchType === 'Exact match');
  const partialKeywords = keywordMatches.filter((item) => item.matchType === 'Partial match');
  const missingKeywords = keywordMatches.filter((item) => item.matchType === 'Missing');
  const keywordScore = keywords.length ? ((exactKeywords.length + partialKeywords.length * 0.45) / keywords.length) * 100 : 0;

  const jdSkills = extractKnownSkills(jd);
  const resumeSkills = extractKnownSkills(text);
  const matchedSkills = jdSkills.filter(({ skill }) => resumeSkills.some((candidate) => candidate.skill === skill));
  const missingSkills = jdSkills.filter(({ skill }) => !matchedSkills.some((candidate) => candidate.skill === skill));
  const skillsScore = jdSkills.length ? (matchedSkills.length / jdSkills.length) * 100 : keywordScore;
  
  const experienceText = (safeResume.experiences || []).map((item) => `${item.title || ''} ${item.description || ''}`).join(' ');
  const experienceScore = keywords.length ? (keywordMatches.filter((item) => occurrenceCount(experienceText, item.keyword)).length / keywords.length) * 100 : 0;

  const personal = safeResume.personal || {};
  const personalFields = [personal.name, personal.email, personal.phone, personal.location].filter((value) => normalise(value)).length;
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(personal.email || ''));
  const hasPhone = /[+()\d][\d\s().-]{6,}/.test(String(personal.phone || ''));
  const sections = detectSections(text);
  const sectionScore = sections.filter((section) => section.found).length / sections.length;
  const contentScore = [
    safeResume.summary,
    (safeResume.experiences || []).length,
    (safeResume.education || []).length,
    (safeResume.skills || []).length,
    (safeResume.projects || []).length
  ].filter(Boolean).length / 5;
  const completenessScore = ((personalFields / 4) * 0.4 + sectionScore * 0.35 + contentScore * 0.25) * 100;

  const bullets = (safeResume.experiences || []).flatMap((item) => String(item.description || '').split(/\n|•/).map((line) => line.trim()).filter(Boolean));
  const longBullets = bullets.filter((bullet) => bullet.split(/\s+/).length > 35);
  const weakBullets = bullets.filter((bullet) => !ACTION_VERBS.has(normalise(bullet).split(' ')[0]));
  const duplicateTerms = [...new Set(keywords.filter((keyword) => occurrenceCount(text, keyword) > 4))];
  const formattingScore = clamp(100 - longBullets.length * 6 - (sections.filter((section) => !section.found && ['Professional summary', 'Experience', 'Education', 'Skills'].includes(section.label)).length * 8));
  
  const sentenceLengths = (text.match(/[^.!?]+[.!?]?/g) || []).map((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length).filter(Boolean);
  const averageSentenceLength = sentenceLengths.length ? sentenceLengths.reduce((sum, item) => sum + item, 0) / sentenceLengths.length : 0;
  const readabilityScore = clamp(100 - Math.max(0, averageSentenceLength - 22) * 3 - Math.max(0, averageSentenceLength < 4 ? 20 : 0));
  
  const rawScore = (
    keywordScore * combinedWeights.keywordMatch +
    skillsScore * combinedWeights.skillsMatch +
    experienceScore * combinedWeights.experienceRelevance +
    completenessScore * combinedWeights.completeness +
    formattingScore * combinedWeights.formatting +
    readabilityScore * combinedWeights.readability
  ) / weightTotal;
  const score = clamp(rawScore);

  const issues = [];
  if (!hasEmail || !hasPhone) {
    issues.push({ severity: 'Critical', issue: 'Contact information is incomplete', why: 'Recruiters and hiring systems need a reliable email address and phone number.', action: 'Add a valid email address and phone number.' });
  }
  if (!sections.find((section) => section.label === 'Experience').found) {
    issues.push({ severity: 'Critical', issue: 'Experience section is not clearly detected', why: 'ATS systems rely on familiar section names to locate work history.', action: 'Add a clearly labelled Experience section.' });
  }
  if (longBullets.length) {
    issues.push({ severity: 'Warning', issue: `${longBullets.length} bullet${longBullets.length === 1 ? '' : 's'} may be difficult to scan`, why: 'Long bullets can hide important evidence and keywords.', action: 'Keep each bullet focused on one outcome or responsibility.' });
  }
  if (weakBullets.length) {
    issues.push({ severity: 'Suggestion', issue: `${weakBullets.length} bullet${weakBullets.length === 1 ? '' : 's'} could use stronger action verbs`, why: 'Action-led bullets make your contribution easier to understand.', action: 'Start accurate bullets with verbs such as Built, Led, Improved, or Delivered.' });
  }
  if (duplicateTerms.length) {
    issues.push({ severity: 'Suggestion', issue: 'Possible keyword repetition', why: 'Repeating the same terms can reduce clarity without improving relevance.', action: `Review repeated terms: ${duplicateTerms.slice(0, 3).join(', ')}.` });
  }
  if (!issues.length) {
    issues.push({ severity: 'Suggestion', issue: 'No major deterministic issues found', why: 'Your core sections and content appear parseable by this estimator.', action: 'Review missing job requirements before applying.' });
  }

  return {
    score,
    level: getScoreLevel(score),
    disclaimer: 'This is an internal, deterministic compatibility estimate — not an official score from any applicant tracking system.',
    breakdown: [
      { key: 'keywordMatch', label: 'Keyword match', score: clamp(keywordScore), weight: combinedWeights.keywordMatch },
      { key: 'skillsMatch', label: 'Skills match', score: clamp(skillsScore), weight: combinedWeights.skillsMatch },
      { key: 'experienceRelevance', label: 'Experience relevance', score: clamp(experienceScore), weight: combinedWeights.experienceRelevance },
      { key: 'completeness', label: 'Resume completeness', score: clamp(completenessScore), weight: combinedWeights.completeness },
      { key: 'formatting', label: 'Formatting compatibility', score: clamp(formattingScore), weight: combinedWeights.formatting },
      { key: 'readability', label: 'Readability', score: clamp(readabilityScore), weight: combinedWeights.readability }
    ],
    keywords: keywordMatches,
    matchedKeywords: exactKeywords,
    partialKeywords,
    missingKeywords,
    skillGroups: Object.entries(SKILL_CATALOG).map(([category]) => ({
      category,
      matched: matchedSkills.filter((item) => item.category === category).map((item) => item.skill),
      missing: missingSkills.filter((item) => item.category === category).map((item) => item.skill)
    })).filter((group) => group.matched.length || group.missing.length),
    issues,
    meta: {
      detectedSections: sections,
      averageSentenceLength: Number(averageSentenceLength.toFixed(1)),
      analyzedAt: new Date().toISOString()
    }
  };
}

function emptyAnalysis(message) {
  return {
    score: 0,
    level: 'Not analyzed',
    disclaimer: message,
    breakdown: [],
    keywords: [],
    matchedKeywords: [],
    partialKeywords: [],
    missingKeywords: [],
    skillGroups: [],
    issues: [],
    meta: {}
  };
}

function aggregateMissingSkills(analyses = []) {
  const counts = new Map();
  analyses.forEach((analysis) => {
    (analysis.missingKeywords || []).forEach((item) => {
      const term = typeof item === 'string' ? item : item.keyword;
      if (term) {
        counts.set(term, (counts.get(term) || 0) + 1);
      }
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([skill, count]) => ({ skill, count }));
}

module.exports = {
  ACTION_VERBS,
  DEFAULT_WEIGHTS,
  SKILL_CATALOG,
  analyzeResume,
  extractKnownSkills,
  extractKeywords,
  getScoreLevel,
  resumeToText,
  aggregateMissingSkills
};
