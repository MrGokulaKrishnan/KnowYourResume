'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('mapAuthError maps invalid-credential codes to friendly non-enumerating messages', async () => {
  const { mapAuthError } = await import('../public/lib/firebase-auth.js');
  assert.equal(mapAuthError({ code: 'auth/invalid-credential' }), 'The email or password is incorrect.');
  assert.equal(mapAuthError({ code: 'auth/wrong-password' }), 'The email or password is incorrect.');
  assert.equal(mapAuthError({ code: 'auth/user-not-found' }), 'The email or password is incorrect.');
});

test('mapAuthError maps validation error codes accurately', async () => {
  const { mapAuthError } = await import('../public/lib/firebase-auth.js');
  assert.equal(mapAuthError({ code: 'auth/email-already-in-use' }), 'An account with this email already exists.');
  assert.equal(mapAuthError({ code: 'auth/weak-password' }), 'Password must contain at least 8 characters.');
  assert.equal(mapAuthError({ code: 'auth/invalid-email' }), 'Invalid email address.');
  assert.equal(mapAuthError({ code: 'auth/passwords-dont-match' }), 'Passwords do not match.');
  assert.equal(mapAuthError({ code: 'auth/too-many-requests' }), 'Too many failed attempts. Please wait a few minutes and try again.');
  assert.equal(mapAuthError({ code: 'auth/popup-closed-by-user' }), 'Google sign-in was cancelled.');
  assert.equal(mapAuthError({ code: 'auth/missing-or-invalid-nonce' }), 'Sign-in session refreshed. Please click Continue with Google once more.');
  assert.equal(mapAuthError({ code: 'auth/cancelled-popup-request' }), 'Previous sign-in request was cancelled. Please try again.');
  assert.equal(mapAuthError({ code: 'auth/network-request-failed' }), 'Network connection failed. Please check your internet connection.');
});
