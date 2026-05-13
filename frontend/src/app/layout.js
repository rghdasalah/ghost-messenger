import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';

export const metadata = {
  title: 'Ghost Messenger',
  description: 'Hybrid Ephemeral Messenger — SWAPD352 A2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
