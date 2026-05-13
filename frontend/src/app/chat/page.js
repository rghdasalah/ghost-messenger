'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useMessages } from '../../hooks/useMessages';
import UserList from '../../components/UserList';
import GhostChat from '../../components/GhostChat';
import PulseMonitor from '../../components/PulseMonitor';

export default function ChatPage() {
  const { user, idToken, mfaRequired, mfaVerified, loading, signOut } = useAuth();
  const router = useRouter();
  const [activeUser, setActiveUser] = useState(null);

  // All hooks MUST be called before any conditional return
  const socketReady = !!user && (!mfaRequired || mfaVerified) && !loading;
  const { onlineUsers, pulseEvents, messagesByRoom, joinRoom, sendMessage } = useSocket(idToken, socketReady);

  const roomId = useMemo(() => {
    if (!user || !activeUser) return null;
    return [user.uid, activeUser.uid].sort().join('_');
  }, [user?.uid, activeUser?.uid]);

  const { messages, send } = useMessages({
    roomId,
    recipientUid: activeUser?.uid,
    messagesByRoom,
    joinRoom,
    sendMessage,
  });

  // Redirect after hooks (safe — no hook called after this)
  useEffect(() => {
    if (!loading && (!user || (mfaRequired && !mfaVerified))) {
      router.replace('/login');
    }
  }, [user, mfaRequired, mfaVerified, loading, router]);

  if (loading || !user || (mfaRequired && !mfaVerified)) {
    return <div style={{ padding: 20, color: '#555' }}>&gt; Authenticating...</div>;
  }

  return (
    <div style={styles.shell}>
      <div style={styles.topBar}>
        <span style={styles.logo}>&gt; GHOST PROTOCOL — EPHEMERAL MESSENGER</span>
        <span style={styles.userInfo}>
          {user?.displayName}
          <button style={styles.signOut} onClick={signOut}>[ DISCONNECT ]</button>
        </span>
      </div>

      <div style={styles.body}>
        <UserList
          users={onlineUsers}
          onSelectUser={setActiveUser}
          activeUid={activeUser?.uid}
          myUid={user?.uid}
        />
        <div style={styles.chatArea}>
          <GhostChat
            messages={messages}
            onSend={send}
            activeUser={activeUser}
          />
        </div>
        <PulseMonitor pulseEvents={pulseEvents} />
      </div>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#050505',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid #333',
    background: '#0a0a0a',
  },
  logo: {
    color: '#00ff88',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  userInfo: {
    color: '#555',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  signOut: {
    background: 'transparent',
    border: '1px solid #333',
    color: '#555',
    fontFamily: 'inherit',
    fontSize: '11px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
};
