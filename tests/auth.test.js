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
  assert.equal(mapAuthError({ code: 'auth/invalid-action-code' }), 'The sign-in link is invalid or has expired. Please request a new magic link.');
  assert.equal(mapAuthError({ code: 'auth/expired-action-code' }), 'This sign-in link has expired. Please request a new magic link.');
});

test('Passwordless Auth: sendPasswordlessLink validates email format strictly', async () => {
  const { sendPasswordlessLink } = await import('../public/lib/firebase-auth.js');
  await assert.rejects(
    async () => sendPasswordlessLink(''),
    { message: 'Please enter a valid email address.' }
  );
  await assert.rejects(
    async () => sendPasswordlessLink('not-an-email'),
    { message: 'Please enter a valid email address.' }
  );
});

test('Passwordless Auth: signInPasswordlessInstant creates user session without password', async () => {
  const { signInPasswordlessInstant, getCurrentUser } = await import('../public/lib/firebase-auth.js');
  const user = await signInPasswordlessInstant('candidate@test.com');
  assert.ok(user, 'User should be returned');
  assert.equal(user.email, 'candidate@test.com');
  assert.ok(user.uid.startsWith('usr_'));
  assert.equal(getCurrentUser()?.email, 'candidate@test.com');
});
