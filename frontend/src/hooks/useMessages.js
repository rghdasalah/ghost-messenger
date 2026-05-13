'use client';
import { useEffect } from 'react';
import { encrypt } from '../lib/crypto';

export function useMessages({ roomId, recipientUid, messagesByRoom, joinRoom, sendMessage }) {
  useEffect(() => {
    if (roomId) joinRoom(roomId);
  }, [roomId, joinRoom]);

  const messages = roomId ? (messagesByRoom[roomId] || []) : [];

  function send(plainText) {
    if (!roomId || !plainText.trim()) return;
    const encryptedText = encrypt(plainText);
    sendMessage(roomId, encryptedText, recipientUid);
  }

  return { messages, send };
}
