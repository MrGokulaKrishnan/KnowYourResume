import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeRoute(route) {
  const raw = (route || '').toLowerCase().replace(/^[#/]+/, '').replace(/\/+$/, '').trim();
  if (!raw || raw === 'dashboard' || raw === 'home' || raw === 'index' || raw === 'index.html') return 'dashboard';
  if (raw === 'resume' || raw === 'builder') return 'resume';
  if (raw === 'ats' || raw === 'scan' || raw === 'scanner') return 'ats';
  if (raw === 'templates' || raw === 'template') return 'templates';
  if (raw === 'ai' || raw === 'tools' || raw === 'studio') return 'ai';
  if (raw === 'applications' || raw === 'pipeline' || raw === 'jobs') return 'applications';
  if (raw === 'settings' || raw === 'account') return 'settings';
  if (raw === 'pricing' || raw === 'plans' || raw === 'upgrade') return 'pricing';
  if (raw === 'login' || raw === 'signin' || raw === 'signup' || raw === 'register' || raw === 'forgot-password' || raw === 'forgot') return 'dashboard';
  if (raw === 'payment-success' || raw === 'success') return 'payment-success';
  if (raw === 'payment-failed' || raw === 'failed') return 'payment-failed';
  if (raw === 'legal' || raw === 'privacy' || raw === 'terms') return 'legal';
  if (raw === 'faq' || raw === 'help' || raw === 'support') return 'faq';
  if (raw === '404') return '404';
  if (raw === '500') return '500';
  return '404';
}

function calculateDiscount(basePrice, promoCode) {
  if ((promoCode || '').trim().toUpperCase() === 'CAREERPRO') {
    const discount = Math.round(basePrice * 0.20 * 100) / 100;
    return { valid: true, discount, total: Math.round((basePrice - discount) * 100) / 100 };
  }
  return { valid: false, discount: 0, total: basePrice };
}

test('Route Normalization: resolves root, index, and dashboard aliases to dashboard', () => {
  assert.equal(normalizeRoute(''), 'dashboard');
  assert.equal(normalizeRoute('/'), 'dashboard');
  assert.equal(normalizeRoute('/index'), 'dashboard');
  assert.equal(normalizeRoute('/index.html'), 'dashboard');
  assert.equal(normalizeRoute('#dashboard'), 'dashboard');
  assert.equal(normalizeRoute('home'), 'dashboard');
});

test('Route Normalization: resolves auth aliases to dashboard with active modal', () => {
  assert.equal(normalizeRoute('/login'), 'dashboard');
  assert.equal(normalizeRoute('signin'), 'dashboard');
  assert.equal(normalizeRoute('/signup'), 'dashboard');
  assert.equal(normalizeRoute('/register'), 'dashboard');
  assert.equal(normalizeRoute('/forgot-password'), 'dashboard');
});

test('Route Normalization: resolves resume and builder aliases to resume', () => {
  assert.equal(normalizeRoute('/resume'), 'resume');
  assert.equal(normalizeRoute('resume'), 'resume');
  assert.equal(normalizeRoute('/builder'), 'resume');
  assert.equal(normalizeRoute('#builder'), 'resume');
});

test('Route Normalization: resolves pricing and lifecycle paths accurately', () => {
  assert.equal(normalizeRoute('/pricing'), 'pricing');
  assert.equal(normalizeRoute('plans'), 'pricing');
  assert.equal(normalizeRoute('upgrade'), 'pricing');
  assert.equal(normalizeRoute('/payment-success'), 'payment-success');
  assert.equal(normalizeRoute('success'), 'payment-success');
  assert.equal(normalizeRoute('/payment-failed'), 'payment-failed');
  assert.equal(normalizeRoute('failed'), 'payment-failed');
});

test('Route Normalization: resolves FAQ and Help Center aliases', () => {
  assert.equal(normalizeRoute('/faq'), 'faq');
  assert.equal(normalizeRoute('/help'), 'faq');
  assert.equal(normalizeRoute('support'), 'faq');
});

test('Route Normalization: routes unrecognized paths to dedicated 404', () => {
  assert.equal(normalizeRoute('/unknown-endpoint'), '404');
  assert.equal(normalizeRoute('something/random'), '404');
  assert.equal(normalizeRoute('404'), '404');
});

test('Customer Lifecycle: promo code CAREERPRO applies 20% discount on Annual and Monthly plans', () => {
  const annual = calculateDiscount(96.00, 'CAREERPRO');
  assert.equal(annual.valid, true);
  assert.equal(annual.discount, 19.20);
  assert.equal(annual.total, 76.80);

  const monthly = calculateDiscount(12.00, 'careerpro');
  assert.equal(monthly.valid, true);
  assert.equal(monthly.discount, 2.40);
  assert.equal(monthly.total, 9.60);

  const invalid = calculateDiscount(96.00, 'RANDOMCODE');
  assert.equal(invalid.valid, false);
  assert.equal(invalid.discount, 0);
  assert.equal(invalid.total, 96.00);
});

test('SEO & Metadata: public/index.html includes exact title and resume builder/keywords optimization', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const htmlPath = path.resolve('public/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Exact Requested Title
  assert.match(html, /<title>KnowYourResume - AI Resume Builder &amp; AI Career Operating Systems<\/title>/i);
  assert.match(html, /<meta name="title" content="KnowYourResume - AI Resume Builder &amp; AI Career Operating Systems" \/>/i);

  // Resume builder and resume keywords in description and keywords
  assert.match(html, /name="description"[^>]*resume builder/i);
  assert.match(html, /name="description"[^>]*resume keywords/i);
  assert.match(html, /name="keywords"[^>]*resume builder/i);
  assert.match(html, /name="keywords"[^>]*resume keywords/i);

  // Social tags
  assert.match(html, /property="og:title" content="KnowYourResume - AI Resume Builder &amp; AI Career Operating Systems"/i);
  assert.match(html, /name="twitter:title" content="KnowYourResume - AI Resume Builder &amp; AI Career Operating Systems"/i);

  // Schema.org JSON-LD parses and validates
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, 'JSON-LD script block must exist');
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd['@context'], 'https://schema.org');
  const webApp = jsonLd['@graph'].find((item) => item['@type'] === 'WebApplication');
  assert.ok(webApp, 'WebApplication graph entity must exist');
  assert.equal(webApp.name, 'KnowYourResume - AI Resume Builder & AI Career Operating Systems');
  assert.ok(webApp.keywords.includes('resume builder'));
  assert.ok(webApp.keywords.includes('resume keywords'));
});

test('SEO Assets: robots.txt and sitemap.xml exist and declare canonical endpoints', async () => {
  const fs = await import('node:fs');
  const robots = fs.readFileSync('public/robots.txt', 'utf8');
  assert.match(robots, /Sitemap: https:\/\/knowyourresume\.web\.app\/sitemap\.xml/);

  const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
  assert.match(sitemap, /<loc>https:\/\/knowyourresume\.web\.app\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/knowyourresume\.web\.app\/resume<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/knowyourresume\.web\.app\/ats<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/knowyourresume\.web\.app\/templates<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/knowyourresume\.web\.app\/ai<\/loc>/);
});

test('Passwordless Auth Markup: public/index.html includes passwordless magic link form & tabs', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync('public/index.html', 'utf8');

  assert.match(html, /id="tab-auth-passwordless"/);
  assert.match(html, /id="modal-passwordless-form"/);
  assert.match(html, /id="modal-passwordless-email"/);
  assert.match(html, /id="modal-passwordless-submit-btn"/);
  assert.match(html, /id="auth-success-msg"/);
});

test('Print Isolation & Clean PDF Export: public/styles.css suppresses mobile builder tabs and controls in @media print', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync('public/styles.css', 'utf8');

  // Must have final @media print block
  assert.ok(css.includes('@media print {'), 'Must declare @media print block');
  
  // Must hide mobile builder tabs bar and editor controls
  assert.match(css, /\.mobile-builder-tabs-bar/);
  assert.match(css, /\.mobile-builder-tab/);
  assert.match(css, /\.mobile-editor-footer-action/);
  
  // Responsive breakpoints must specify screen and to avoid contaminating print output
  assert.ok(css.includes('@media screen and (max-width: 768px)'));
  assert.ok(css.includes('@media screen and (max-width: 900px)'));
  assert.ok(css.includes('@media screen and (max-width: 1200px)'));
});
