'use client';

import { ToastProvider } from '@/components/Toast';
import ChatWidget from '@/components/ChatWidget';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ChatWidget />
    </ToastProvider>
  );
}
