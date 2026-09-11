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
