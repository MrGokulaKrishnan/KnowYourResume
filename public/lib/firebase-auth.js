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

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAmNscMGLZFMab3bZaFXWxAOudhk4pr4Vg",
  authDomain: "knowyourresume.firebaseapp.com",
  projectId: "knowyourresume",
  storageBucket: "knowyourresume.firebasestorage.app",
  messagingSenderId: "1033198519479",
  appId: "1:1033198519479:web:5169ad1aa5057023dbf932"
};

export async function initFirebaseAuth(config = {}) {
  if (isFirebaseInitialized) {
    notifyAuthState(currentAuthUser);
    return { auth: authInstance, isDemoMode };
  }

  const finalConfig = {
    ...DEFAULT_FIREBASE_CONFIG,
    ...(config || {})
  };

  if (finalConfig.apiKey && finalConfig.projectId) {
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
      const {
        getAuth,
        setPersistence,
        browserLocalPersistence,
        onAuthStateChanged
      } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

      const existingApps = getApps();
      const app = existingApps.length > 0 ? existingApps[0] : initializeApp(finalConfig);

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
          try { localStorage.removeItem(DEMO_SESSION_KEY); } catch {}
        }
        notifyAuthState(currentAuthUser);
      });

      isFirebaseInitialized = true;
      isDemoMode = false;
      return { auth: authInstance, isDemoMode: false };
    } catch (err) {
      console.error('Firebase Auth initialization error:', err);
    }
  }

  // Fallback demo mode only if CDN / network fails
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

let isGoogleAuthInProgress = false;

export async function signInWithGoogle() {
  if (isGoogleAuthInProgress) {
    throw new Error('Google Sign-In is already in progress. Please complete the popup window.');
  }

  if (authInstance) {
    isGoogleAuthInProgress = true;
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(authInstance, provider);
      const user = result.user;
      currentAuthUser = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Google User',
        email: user.email,
        photoURL: user.photoURL || null,
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
        lastLoginAt: user.metadata?.lastSignInTime || new Date().toISOString()
      };
      notifyAuthState(currentAuthUser);
      return currentAuthUser;
    } catch (err) {
      throw new Error(mapAuthError(err));
    } finally {
      isGoogleAuthInProgress = false;
    }
  }

  // Fallback demo session
  const email = 'user@example.com';
  const name = 'Demo User';
  const uid = `user_${Date.now().toString(36)}`;
  const user = { uid, name, email, photoURL: null, createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() };
  saveDemoSession(user);
  return user;
}

export async function signInWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.');
  if (!password || password.length < 6) throw new Error('Password must contain at least 6 characters.');

  if (authInstance) {
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
      notifyAuthState(currentAuthUser);
      return currentAuthUser;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }

  // Demo fallback
  const users = getDemoUsers();
  const found = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (found) {
    if (found.password && found.password !== password) throw new Error('The email or password is incorrect.');
    found.lastLoginAt = new Date().toISOString();
    saveDemoUsers(users);
    saveDemoSession(found);
    return found;
  }
  const newUser = { uid: `user_${Date.now().toString(36)}`, name: cleanEmail.split('@')[0], email: cleanEmail, password, createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() };
  users.push(newUser);
  saveDemoUsers(users);
  saveDemoSession(newUser);
  return newUser;
}

export async function signUpWithEmail(name, email, password, confirmPassword) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  
  if (!cleanName) throw new Error('Please enter your full name.');
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must contain at least 6 characters.');
  }
  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  if (authInstance) {
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
      notifyAuthState(currentAuthUser);
      return currentAuthUser;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }

  const users = getDemoUsers();
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email already exists.');
  }
  const newUser = { uid: `user_${Date.now().toString(36)}`, name: cleanName, email: cleanEmail, password, createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() };
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
    case 'auth/missing-or-invalid-nonce':
      return 'Sign-in session refreshed. Please click Continue with Google once more.';
    case 'auth/cancelled-popup-request':
      return 'Previous sign-in request was cancelled. Please try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is pending authorization in Firebase Console. (Add domain under Auth > Settings).';
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
