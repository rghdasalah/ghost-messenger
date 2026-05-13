'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import MfaModal from '../../components/MfaModal';

export default function LoginPage() {
  const { user, mfaRequired, mfaVerified, loading, signInWithGoogle, verifyMfa } = useAuth();
  const [mfaError, setMfaError] = useState('');
  const [loginError, setLoginError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && (!mfaRequired || mfaVerified)) {
      router.replace('/chat');
    }
  }, [user, mfaRequired, mfaVerified, loading, router]);

  async function handleGoogleLogin() {
    setLoginError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google login failed:', err);
      setLoginError(err.code ? `${err.code}: ${err.message}` : err.message);
    }
  }

  async function handleMfaVerify(code) {
    setMfaError('');
    try {
      await verifyMfa(code);
      router.replace('/chat');
    } catch {
      setMfaError('Invalid code. Please try again.');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.title}>&gt; GHOST PROTOCOL</div>
        <div style={styles.subtitle}>IDENTITY ANCHOR — VERIFIED ACCESS ONLY</div>
        <div style={styles.divider}>{'─'.repeat(40)}</div>

        {!user ? (
          <button style={styles.button} onClick={handleGoogleLogin} disabled={loading}>
            {loading ? '[ CONNECTING... ]' : '[ CONNECT VIA GOOGLE ]'}
          </button>
        ) : (
          <div style={styles.status}>&gt; Authenticated as {user.displayName}</div>
        )}

        {user && mfaRequired && !mfaVerified && (
          <div style={styles.status}>&gt; Awaiting SMS code verification...</div>
        )}

        {loginError && (
          <div style={styles.error}>&gt; ERROR: {loginError}</div>
        )}
      </div>

      {user && mfaRequired && !mfaVerified && (
        <MfaModal onVerify={handleMfaVerify} error={mfaError} />
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#050505',
  },
  card: {
    border: '1px solid #333',
    padding: '40px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minWidth: '380px',
  },
  title: {
    fontSize: '22px',
    color: '#00ff88',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: '11px',
    letterSpacing: '2px',
    color: '#555',
  },
  divider: {
    color: '#222',
    fontSize: '12px',
  },
  button: {
    background: 'transparent',
    border: '1px solid #00ff88',
    color: '#00ff88',
    fontFamily: 'inherit',
    fontSize: '14px',
    padding: '12px',
    cursor: 'pointer',
    letterSpacing: '1px',
  },
  status: {
    color: '#555',
    fontSize: '12px',
  },
  error: {
    color: '#ef5350',
    fontSize: '11px',
    wordBreak: 'break-all',
    background: '#1a0000',
    padding: '8px',
    border: '1px solid #ef5350',
  },
};
