'use client';

import { useState, useEffect } from 'react';

function getInitialCollapsed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('sidebar-collapsed') === 'true';
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    const interval = setInterval(() => {
      const val = localStorage.getItem('sidebar-collapsed') === 'true';
      setCollapsed(prev => prev !== val ? val : prev);
    }, 300);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sidebar-collapsed') {
        setCollapsed(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <main className={`flex-1 transition-all duration-200 ${collapsed ? 'lg:ml-16' : 'lg:ml-60'}`}>
      {children}
    </main>
  );
}
