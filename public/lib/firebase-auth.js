/**
 * KnowYourResume — Centralized Firebase Authentication Module
 * Supports Google OAuth, Email/Password Registration, Sign In, Password Reset,
 * Auth State Persistence, User Session Handling, and User-Friendly Error Mapping.
 */

let authInstance = null;
let currentAuthUser = null;
let authStateListeners = [];
let isFirebaseInitialized = false;
let isDemoMode = false;

const DEMO_USERS_STORAGE_KEY = 'knowyourresume.demo_users.v1';
const DEMO_SESSION_KEY = 'knowyourresume.demo_session.v1';

export async function initFirebaseAuth(config = {}) {
  if (isFirebaseInitialized) {
    notifyAuthState(currentAuthUser);
    return { auth: authInstance, isDemoMode };
  }

  if (config && config.apiKey && config.projectId) {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
      const {
        getAuth,
        setPersistence,
        browserLocalPersistence,
        onAuthStateChanged
      } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

      const app = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId || '',
        appId: config.appId || ''
      });

      authInstance = getAuth(app);
      await setPersistence(authInstance, browserLocalPersistence);

      onAuthStateChanged(authInstance, (user) => {
        if (user) {
          currentAuthUser = {
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email,
            photoURL: user.photoURL || null,
            createdAt: user.metadata?.creationTime || new Date().toISOString(),
            lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString()
          };
        } else {
          currentAuthUser = null;
        }
        notifyAuthState(currentAuthUser);
      });

      isFirebaseInitialized = true;
      isDemoMode = false;
      return { auth: authInstance, isDemoMode: false };
    } catch (err) {
      console.warn('Could not initialize official Firebase SDK, falling back to local auth mode:', err);
    }
  }

  // Local / Standalone Auth Mode (when Firebase keys are pending in .env)
  isDemoMode = true;
  isFirebaseInitialized = true;
  initDemoSession();
  return { auth: null, isDemoMode: true };
}

function initDemoSession() {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (raw) {
      currentAuthUser = JSON.parse(raw);
    } else {
      currentAuthUser = null;
    }
  } catch {
    currentAuthUser = null;
  }
  notifyAuthState(currentAuthUser);
}

function getDemoUsers() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_STORAGE_KEY, JSON.stringify(users));
}

function saveDemoSession(user) {
  if (user) {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEMO_SESSION_KEY);
  }
  currentAuthUser = user;
  notifyAuthState(user);
}

function notifyAuthState(user) {
  authStateListeners.forEach((listener) => {
    try {
      listener(user);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  });
}

export function onAuthChange(callback) {
  authStateListeners.push(callback);
  if (isFirebaseInitialized) {
    callback(currentAuthUser);
  }
  return () => {
    authStateListeners = authStateListeners.filter((cb) => cb !== callback);
  };
}

export function getCurrentUser() {
  return currentAuthUser;
}

export function isUserAuthenticated() {
  return Boolean(currentAuthUser && currentAuthUser.uid);
}

export async function signInWithGoogle() {
  if (!isDemoMode && authInstance) {
    const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const result = await signInWithPopup(authInstance, provider);
    const user = result.user;
    currentAuthUser = {
      uid: user.uid,
      name: user.displayName || 'Google User',
      email: user.email,
      photoURL: user.photoURL || null,
      createdAt: user.metadata?.creationTime || new Date().toISOString(),
      lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString()
    };
    return currentAuthUser;
  }

  // Standalone simulated Google OAuth flow
  const email = 'alex.chen@example.com';
  const name = 'Alex Chen';
  const uid = 'google_user_demo_123';
  const user = {
    uid,
    name,
    email,
    photoURL: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  saveDemoSession(user);
  return user;
}

export async function signInWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Invalid email address.');
  if (!password) throw new Error('The email or password is incorrect.');

  if (!isDemoMode && authInstance) {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    try {
      const result = await signInWithEmailAndPassword(authInstance, cleanEmail, password);
      const user = result.user;
      currentAuthUser = {
        uid: user.uid,
        name: user.displayName || cleanEmail.split('@')[0],
        email: user.email,
        photoURL: user.photoURL || null,
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
        lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString()
      };
      return currentAuthUser;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }

  // Demo mode
  const users = getDemoUsers();
  const found = users.find((u) => u.email.toLowerCase() === cleanEmail && u.password === password);
  if (!found) {
    // If empty demo database, create initial test account if password meets standard
    if (users.length === 0 && cleanEmail.includes('@') && password.length >= 8) {
      const newUser = {
        uid: `user_${Date.now().toString(36)}`,
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      saveDemoUsers([newUser]);
      saveDemoSession(newUser);
      return newUser;
    }
    throw new Error('The email or password is incorrect.');
  }

  found.lastLoginAt = new Date().toISOString();
  saveDemoUsers(users);
  saveDemoSession(found);
  return found;
}

export async function signUpWithEmail(name, email, password, confirmPassword) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  
  if (!cleanName) throw new Error('Please enter your full name.');
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Invalid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }
  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  if (!isDemoMode && authInstance) {
    const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    try {
      const result = await createUserWithEmailAndPassword(authInstance, cleanEmail, password);
      const user = result.user;
      await updateProfile(user, { displayName: cleanName });
      currentAuthUser = {
        uid: user.uid,
        name: cleanName,
        email: user.email,
        photoURL: null,
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
        lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString()
      };
      return currentAuthUser;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }

  // Demo mode
  const users = getDemoUsers();
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const newUser = {
    uid: `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    password,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  users.push(newUser);
  saveDemoUsers(users);
  saveDemoSession(newUser);
  return newUser;
}

export async function resetPassword(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Invalid email address.');
  }

  if (!isDemoMode && authInstance) {
    const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    try {
      await sendPasswordResetEmail(authInstance, cleanEmail);
      return { success: true };
    } catch (err) {
      if (err.code === 'auth/network-request-failed') {
        throw new Error('Network connection failed. Please check your internet connection.');
      }
      return { success: true };
    }
  }

  return { success: true };
}

export async function logOut() {
  if (!isDemoMode && authInstance) {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    await signOut(authInstance);
  }
  saveDemoSession(null);
}

export function mapAuthError(error) {
  const code = error?.code || (typeof error === 'string' ? error : error?.message || '');
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must contain at least 8 characters.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/passwords-dont-match':
      return 'Passwords do not match.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}
