'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeResume,
  getScoreLevel,
  resumeToText,
  aggregateMissingSkills
} = require('../lib/ats-engine');

const resume = {
  personal: { name: 'Avery Doe', email: 'avery@example.com', phone: '+1 555 010 0200', location: 'Pune, India' },
  summary: 'Software engineer with experience building scalable web applications.',
  experiences: [{ title: 'Software Engineer', company: 'Example Co', description: 'Developed React interfaces.\nBuilt Node.js backend services.' }],
  education: [{ degree: 'BSc Computer Science', school: 'Example University', year: '2024' }],
  skills: ['JavaScript', 'React', 'Git', 'PostgreSQL'],
  projects: [{ title: 'Distributed Key-Value Store', technologies: 'Go, Redis, Docker', description: 'Implemented Raft consensus.' }],
  certifications: [{ name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', year: '2025' }],
  languages: [{ language: 'English', proficiency: 'Fluent' }]
};

test('matches keywords without regard to letter case', () => {
  const result = analyzeResume({ resume, jobDescription: 'We need a REACT engineer with JAVASCRIPT and Docker experience.' });
  const react = result.keywords.find((item) => item.keyword === 'react');
  const javascript = result.keywords.find((item) => item.keyword === 'javascript');
  assert.equal(react.matchType, 'Exact match');
  assert.equal(javascript.matchType, 'Exact match');
});

test('identifies a missing catalogued skill', () => {
  const result = analyzeResume({ resume, jobDescription: 'Required skills include React, JavaScript, Kubernetes, and Python.' });
  assert.ok(result.missingKeywords.some((item) => item.keyword === 'kubernetes'));
  assert.ok(result.skillGroups.some((group) => group.missing.includes('kubernetes')));
});

test('matches keywords across projects and certifications sections', () => {
  const result = analyzeResume({ resume, jobDescription: 'Seeking an engineer with AWS, Redis, and Go experience.' });
  const aws = result.keywords.find((item) => item.keyword === 'aws');
  const redis = result.keywords.find((item) => item.keyword === 'redis');
  const go = result.keywords.find((item) => item.keyword === 'go');
  assert.equal(aws.matchType, 'Exact match');
  assert.equal(redis.matchType, 'Exact match');
  assert.equal(go.matchType, 'Exact match');
});

test('ATS-10: isolates tokens and avoids false substring matches (Java vs JavaScript)', () => {
  const jsResume = {
    personal: { name: 'Alex Smith', email: 'alex@example.com' },
    summary: 'Expert in JavaScript and TypeScript frontend development.',
    skills: ['JavaScript', 'TypeScript', 'React']
  };
  const result = analyzeResume({ resume: jsResume, jobDescription: 'Core Java developer with Spring Boot experience required.' });
  const javaKeyword = result.keywords.find((k) => k.keyword === 'java');
  assert.ok(javaKeyword, 'Java keyword should be identified from JD');
  assert.equal(javaKeyword.matchType, 'Missing', 'Java should not match JavaScript');
});

test('ATS-11: supports synonym resolution (Amazon Web Services ↔ AWS, Postgres ↔ PostgreSQL)', () => {
  const cloudResume = {
    personal: { name: 'Cloud Dev' },
    summary: 'Extensive AWS and PostgreSQL experience.',
    skills: ['AWS', 'PostgreSQL']
  };
  const result = analyzeResume({ resume: cloudResume, jobDescription: 'Requires Amazon Web Services and Postgres experience.' });
  const aws = result.keywords.find((k) => k.keyword === 'amazon web services' || k.keyword === 'aws');
  assert.ok(aws && (aws.matchType === 'Exact match' || aws.matchType === 'Partial match'));
});

test('ATS-08 & ATS-09: high match vs low match score differential', () => {
  const highMatch = analyzeResume({
    resume,
    jobDescription: 'Software Engineer with React, Node.js, JavaScript, PostgreSQL, Git, and AWS experience.'
  });
  const lowMatch = analyzeResume({
    resume,
    jobDescription: 'Senior Certified Accountant with GAAP, QuickBooks, Tax Audit, and Financial Modeling.'
  });
  assert.ok(highMatch.score > 65, `High match score should be > 65, got ${highMatch.score}`);
  assert.ok(lowMatch.score < 35, `Low match score should be < 35, got ${lowMatch.score}`);
  assert.ok(highMatch.score > lowMatch.score + 35, 'High match score should substantially exceed low match score');
});

test('ATS-12: default breakdown weights sum to exactly 100%', () => {
  const result = analyzeResume({ resume, jobDescription: 'React Node.js PostgreSQL AWS engineer' });
  const totalWeight = result.breakdown.reduce((sum, item) => sum + item.weight, 0);
  assert.equal(totalWeight, 100, `Expected total weight sum of 100%, got ${totalWeight}%`);
  assert.equal(result.breakdown.length, 6, 'Expected exactly 6 categories in breakdown');
});

test('is deterministic for identical input', () => {
  const input = { resume, jobDescription: 'React JavaScript Docker AWS experience is required.' };
  const first = analyzeResume(input);
  const second = analyzeResume(input);
  assert.equal(first.score, second.score);
  assert.deepEqual(first.breakdown, second.breakdown);
});

test('supports configurable scoring weights', () => {
  const customWeights = { keywordMatch: 50, skillsMatch: 20, experienceRelevance: 10, completeness: 10, formatting: 5, readability: 5 };
  const result = analyzeResume({ resume, jobDescription: 'React JavaScript Postgres required', weights: customWeights });
  const kwBreakdown = result.breakdown.find((b) => b.key === 'keywordMatch');
  assert.equal(kwBreakdown.weight, 50);
});

test('aggregates missing skill trends across multiple checks', () => {
  const analyses = [
    { missingKeywords: [{ keyword: 'kubernetes' }, { keyword: 'terraform' }, { keyword: 'aws' }] },
    { missingKeywords: [{ keyword: 'kubernetes' }, { keyword: 'python' }] },
    { missingKeywords: [{ keyword: 'kubernetes' }, { keyword: 'terraform' }] }
  ];
  const trends = aggregateMissingSkills(analyses);
  assert.equal(trends[0].skill, 'kubernetes');
  assert.equal(trends[0].count, 3);
  assert.equal(trends[1].skill, 'terraform');
  assert.equal(trends[1].count, 2);
});

test('returns a helpful result for missing source text', () => {
  const result = analyzeResume({ resume: {}, jobDescription: '' });
  assert.equal(result.score, 0);
  assert.equal(result.level, 'Not analyzed');
  assert.match(result.disclaimer, /job description/i);
});

test('uses the documented score bands', () => {
  assert.equal(getScoreLevel(39), 'Poor Match');
  assert.equal(getScoreLevel(40), 'Needs Improvement');
  assert.equal(getScoreLevel(60), 'Moderate Match');
  assert.equal(getScoreLevel(75), 'Strong Match');
  assert.equal(getScoreLevel(90), 'Excellent Match');
});
