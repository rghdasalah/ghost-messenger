'use client';
import { useState } from 'react';

export default function MfaModal({ onVerify, error }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      await onVerify(code.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>&gt; MFA CHALLENGE</div>
        <div style={styles.subtitle}>SMS VERIFICATION REQUIRED</div>
        <div style={styles.info}>
          A 6-digit code has been sent to the registered phone number.
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? '[ VERIFYING... ]' : '[ VERIFY CODE ]'}
          </button>
        </form>
        {error && <div style={styles.error}>&gt; ERROR: {error}</div>}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#0a0a0a',
    border: '1px solid #333',
    padding: '32px',
    minWidth: '340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    color: '#66bb6a',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#aaa',
    fontSize: '12px',
    letterSpacing: '2px',
  },
  info: {
    color: '#555',
    fontSize: '12px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    background: '#111',
    border: '1px solid #444',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: '22px',
    letterSpacing: '8px',
    padding: '10px',
    textAlign: 'center',
    outline: 'none',
  },
  button: {
    background: 'transparent',
    border: '1px solid #66bb6a',
    color: '#66bb6a',
    fontFamily: 'inherit',
    fontSize: '13px',
    padding: '10px',
    cursor: 'pointer',
  },
  error: {
    color: '#ef5350',
    fontSize: '12px',
  },
};
