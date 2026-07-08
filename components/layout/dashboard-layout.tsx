'use client';

import { useEffect } from 'react';
import { Sidebar } from './sidebar-nav';
import { Header } from './header';
import { cn } from '@/lib/utils/helpers';
import { useAuthStore, useUIStore } from '@/hooks/store';
import { useAuth } from '@/hooks/useAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useAuth();

  const { user, isLoading } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  // Raccourci clavier global : Ctrl+B pour toggle sidebar
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleSidebar]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={cn('transition-all duration-300', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
