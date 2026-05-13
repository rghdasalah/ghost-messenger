'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        try {
          const { data } = await api.post('/auth/login', { idToken: token });
          setUser(data.user);
          setMfaRequired(data.mfaRequired);
          setMfaVerified(!data.mfaRequired);
        } catch (err) {
          console.error('Login failed:', err);
        }
      } else {
        setUser(null);
        setIdToken(null);
        setMfaRequired(false);
        setMfaVerified(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function verifyMfa(code) {
    await api.post('/auth/mfa/verify', { code });
    setMfaVerified(true);
  }

  return (
    <AuthContext.Provider value={{ user, idToken, mfaRequired, mfaVerified, loading, signInWithGoogle, signOut, verifyMfa }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
