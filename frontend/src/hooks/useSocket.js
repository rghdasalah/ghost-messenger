'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useSocket(idToken, ready) {
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pulseEvents, setPulseEvents] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});

  useEffect(() => {
    if (!ready || !idToken) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      auth: { token: idToken },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('users_list', (users) => setOnlineUsers(users));

    socket.on('presence_update', ({ uid, status }) => {
      setOnlineUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status } : u))
      );
    });

    socket.on('receive_message', (msg) => {
      setMessagesByRoom((prev) => ({
        ...prev,
        [msg.roomId]: [...(prev[msg.roomId] || []), msg],
      }));
    });

    socket.on('ghost_wipe', ({ roomId }) => {
      setMessagesByRoom((prev) => ({ ...prev, [roomId]: [] }));
    });

    socket.on('pulse_event', (event) => {
      setPulseEvents((prev) => [...prev, event]);
    });

    return () => {
      socket.disconnect();
    };
  }, [idToken, ready]);

  const joinRoom = useCallback((roomId) => {
    socketRef.current?.emit('join_room', { roomId });
  }, []);

  const sendMessage = useCallback((roomId, encryptedText, recipientUid) => {
    socketRef.current?.emit('send_message', { roomId, encryptedText, recipientUid });
  }, []);

  return { onlineUsers, pulseEvents, messagesByRoom, joinRoom, sendMessage };
}
