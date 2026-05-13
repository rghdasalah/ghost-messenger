'use client';
import { useEffect, useRef, useState } from 'react';
import { decrypt } from '../lib/crypto';

export default function GhostChat({ messages, onSend, activeUser }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {activeUser
          ? `=== GHOST CHANNEL: ${activeUser.displayName} ===`
          : '=== GHOST CHANNEL ==='}
      </div>

      <div style={styles.messageArea}>
        {!activeUser && (
          <div style={styles.placeholder}>
            &gt; Select a user to initiate ghost channel.
          </div>
        )}
        {messages.length === 0 && activeUser && (
          <div style={styles.placeholder}>&gt; Channel is empty or was purged.</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={styles.message}>
            <span style={styles.sender}>[{msg.displayName}]:</span>{' '}
            {decrypt(msg.encryptedText)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <span style={styles.prompt}>&gt;</span>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type message..."
          disabled={!activeUser}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderLeft: '1px solid #333',
    borderRight: '1px solid #333',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    color: '#00ff88',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  placeholder: {
    color: '#555',
    fontSize: '13px',
  },
  message: {
    fontSize: '13px',
    color: '#ccc',
    lineHeight: '1.5',
    wordBreak: 'break-word',
  },
  sender: {
    color: '#00ff88',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    borderTop: '1px solid #333',
    padding: '8px 12px',
    gap: '8px',
  },
  prompt: {
    color: '#00ff88',
    fontSize: '14px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ccc',
    fontFamily: 'inherit',
    fontSize: '13px',
  },
};
