'use client';

export default function UserList({ users, onSelectUser, activeUid, myUid }) {
  const others = users.filter((u) => u.uid !== myUid);

  return (
    <div style={styles.container}>
      <div style={styles.header}>=== USERS ===</div>
      <div style={styles.list}>
        {others.length === 0 && (
          <div style={styles.empty}>&gt; No other users.</div>
        )}
        {others.map((u) => (
          <div
            key={u.uid}
            style={{
              ...styles.userRow,
              ...(u.uid === activeUid ? styles.active : {}),
            }}
            onClick={() => onSelectUser(u)}
          >
            <span style={{ color: u.status === 'online' ? '#00ff88' : '#555' }}>
              {u.status === 'online' ? '●' : '○'}
            </span>{' '}
            <span style={styles.name}>{u.displayName || u.uid}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: '180px',
    maxWidth: '220px',
    borderRight: '1px solid #333',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    color: '#ffeb3b',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 4px',
  },
  empty: {
    color: '#555',
    fontSize: '12px',
    padding: '8px',
  },
  userRow: {
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '2px',
    color: '#ccc',
  },
  active: {
    background: '#1a1a1a',
    color: '#fff',
  },
  name: {
    fontSize: '13px',
  },
};
