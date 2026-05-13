'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function RootPage() {
  const { user, mfaRequired, mfaVerified, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (mfaRequired && !mfaVerified) {
      router.replace('/login');
    } else {
      router.replace('/chat');
    }
  }, [user, mfaRequired, mfaVerified, loading, router]);

  return (
    <div style={{ padding: 20, color: '#555' }}>
      &gt; Authenticating...
    </div>
  );
}
