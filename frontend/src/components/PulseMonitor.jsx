'use client';
import { useEffect, useRef } from 'react';

const TAG_COLORS = {
  '[AUTH]': '#00bcd4',
  '[SOCKET]': '#ffeb3b',
  '[REDIS]': '#ce93d8',
  '[GHOST]': '#ef5350',
  '[TWILIO]': '#66bb6a',
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
}

export default function PulseMonitor({ pulseEvents }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pulseEvents]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>=== SYSTEM PULSE MONITOR ===</div>
      <div style={styles.log}>
        {pulseEvents.length === 0 && (
          <div style={styles.empty}>&gt; Awaiting system events...</div>
        )}
        {pulseEvents.map((evt, i) => (
          <div key={i} style={styles.line}>
            <span style={styles.time}>[{formatTime(evt.timestamp)}]</span>{' '}
            <span style={{ color: TAG_COLORS[evt.tag] || '#aaa' }}>{evt.tag}</span>{' '}
            <span style={styles.msg}>{evt.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: '320px',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    color: '#ef5350',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  log: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  empty: {
    color: '#555',
    fontSize: '12px',
  },
  line: {
    fontSize: '12px',
    lineHeight: '1.6',
    wordBreak: 'break-word',
  },
  time: {
    color: '#555',
  },
  msg: {
    color: '#aaa',
  },
};
